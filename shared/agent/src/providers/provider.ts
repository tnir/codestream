"use strict";
import { GraphQLClient } from "graphql-request";
import { Agent as HttpsAgent } from "https";
import HttpsProxyAgent from "https-proxy-agent";
import fetch, { RequestInit, Response } from "node-fetch";
import * as url from "url";
import { URI } from "vscode-uri";
import { InternalError, ReportSuppressedMessages } from "../agentError";
import { MessageType } from "../api/apiProvider";
import { MarkerLocation, User } from "../api/extensions";
import { Container, SessionContainer } from "../container";
import { GitRemote, GitRemoteLike, GitRepository } from "../git/gitService";
import { Logger } from "../logger";
import { Markerish, MarkerLocationManager } from "../managers/markerLocationManager";
import { findBestMatchingLine, MAX_RANGE_VALUE } from "../markerLocation/calculator";
import {
	AddEnterpriseProviderRequest,
	AddEnterpriseProviderResponse,
	CreateThirdPartyCardRequest,
	CreateThirdPartyCardResponse,
	CreateThirdPartyPostRequest,
	CreateThirdPartyPostResponse,
	DocumentMarker,
	DocumentMarkerExternalContent,
	FetchAssignableUsersRequest,
	FetchAssignableUsersResponse,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	FetchThirdPartyCardsRequest,
	FetchThirdPartyCardsResponse,
	FetchThirdPartyCardWorkflowRequest,
	FetchThirdPartyCardWorkflowResponse,
	FetchThirdPartyChannelsRequest,
	FetchThirdPartyChannelsResponse,
	FetchThirdPartyPullRequestCommitsRequest,
	FetchThirdPartyPullRequestCommitsResponse,
	FetchThirdPartyPullRequestRequest,
	FetchThirdPartyPullRequestResponse,
	GetMyPullRequestsRequest,
	GetMyPullRequestsResponse,
	MoveThirdPartyCardRequest,
	MoveThirdPartyCardResponse,
	ProviderConfigurationData,
	RemoveEnterpriseProviderRequest,
	ThirdPartyDisconnect,
	ThirdPartyProviderConfig,
	UpdateThirdPartyStatusRequest,
	UpdateThirdPartyStatusResponse
} from "../protocol/agent.protocol";
import { CodemarkType, CSMe, CSProviderInfos, CSReferenceLocation } from "../protocol/api.protocol";
import { CodeStreamSession } from "../session";
import { Functions, Strings } from "../system";
import { log } from "../system";

export const providerDisplayNamesByNameKey = new Map<string, string>([
	["asana", "Asana"],
	["bitbucket", "Bitbucket"],
	["bitbucket_server", "Bitbucket Server"],
	["github", "GitHub"],
	["github_enterprise", "GitHub Enterprise"],
	["gitlab", "GitLab"],
	["gitlab_enterprise", "GitLab Self-Managed"],
	["jira", "Jira"],
	["jiraserver", "Jira Server"],
	["trello", "Trello"],
	["youtrack", "YouTrack"],
	["azuredevops", "Azure DevOps"],
	["slack", "Slack"],
	["msteams", "Microsoft Teams"],
	["okta", "Okta"],
	["clubhouse", "Clubhouse"],
	["linear", "Linear"],
	["newrelic", "New Relic"]
]);

export interface ThirdPartyProviderSupportsIssues {
	getBoards(request: FetchThirdPartyBoardsRequest): Promise<FetchThirdPartyBoardsResponse>;
	getCards(request: FetchThirdPartyCardsRequest): Promise<FetchThirdPartyCardsResponse>;
	getCardWorkflow(
		request: FetchThirdPartyCardWorkflowRequest
	): Promise<FetchThirdPartyCardWorkflowResponse>;
	moveCard(request: MoveThirdPartyCardRequest): Promise<MoveThirdPartyCardResponse>;
	getAssignableUsers(request: FetchAssignableUsersRequest): Promise<FetchAssignableUsersResponse>;
	createCard(request: CreateThirdPartyCardRequest): Promise<CreateThirdPartyCardResponse>;
}

export interface ThirdPartyProviderSupportsPosts {
	createPost(request: CreateThirdPartyPostRequest): Promise<CreateThirdPartyPostResponse>;
	getChannels(request: FetchThirdPartyChannelsRequest): Promise<FetchThirdPartyChannelsResponse>;
}

export interface ThirdPartyProviderSupportsStatus {
	updateStatus(request: UpdateThirdPartyStatusRequest): Promise<UpdateThirdPartyStatusResponse>;
}

export interface ThirdPartyProviderSupportsPullRequests {
	getRepoInfo(request: ProviderGetRepoInfoRequest): Promise<ProviderGetRepoInfoResponse>;
	getIsMatchingRemotePredicate(): (remoteLike: GitRemoteLike) => boolean;
	getRemotePaths(repo: GitRepository, _projectsByRemotePath: any): any;
}

export interface ThirdPartyProviderSupportsCreatingPullRequests
	extends ThirdPartyProviderSupportsPullRequests {
	createPullRequest(
		request: ProviderCreatePullRequestRequest
	): Promise<ProviderCreatePullRequestResponse | undefined>;
}

export interface ThirdPartyProviderSupportsViewingPullRequests
	extends ThirdPartyProviderSupportsPullRequests {
	getPullRequest(
		request: FetchThirdPartyPullRequestRequest
	): Promise<FetchThirdPartyPullRequestResponse>;
	getPullRequestCommits(
		request: FetchThirdPartyPullRequestCommitsRequest
	): Promise<FetchThirdPartyPullRequestCommitsResponse>;
	getMyPullRequests(
		request: GetMyPullRequestsRequest
	): Promise<GetMyPullRequestsResponse[][] | undefined>;
}

export namespace ThirdPartyIssueProvider {
	export function supportsIssues(
		provider: ThirdPartyProvider
	): provider is ThirdPartyProvider & ThirdPartyProviderSupportsIssues {
		return (
			(provider as any).getBoards !== undefined &&
			(provider as any).getAssignableUsers !== undefined &&
			(provider as any).createCard !== undefined
		);
	}

	export function supportsViewingPullRequests(
		provider: ThirdPartyProvider
	): provider is ThirdPartyProvider & ThirdPartyProviderSupportsPullRequests {
		return (provider as any).getMyPullRequests !== undefined;
	}

	export function supportsCreatingPullRequests(
		provider: ThirdPartyProvider
	): provider is ThirdPartyProvider & ThirdPartyProviderSupportsPullRequests {
		return (provider as any).createPullRequest !== undefined;
	}
}

export namespace ThirdPartyPostProvider {
	export function supportsSharing(
		provider: ThirdPartyPostProvider
	): provider is ThirdPartyPostProvider & ThirdPartyProviderSupportsPosts {
		return (provider as any).createPost !== undefined;
	}
	export function supportsStatus(
		provider: ThirdPartyProvider
	): provider is ThirdPartyProvider & ThirdPartyProviderSupportsStatus {
		return (provider as any).updateStatus !== undefined;
	}
}

export interface ThirdPartyProvider {
	readonly name: string;
	readonly displayName: string;
	readonly icon: string;
	hasTokenError?: boolean;
	connect(): Promise<void>;
	canConfigure(): boolean;
	configure(data: ProviderConfigurationData, verify?: boolean): Promise<void>;
	disconnect(request: ThirdPartyDisconnect): Promise<void>;
	addEnterpriseHost(request: AddEnterpriseProviderRequest): Promise<AddEnterpriseProviderResponse>;
	removeEnterpriseHost(request: RemoveEnterpriseProviderRequest): Promise<void>;
	getConfig(): ThirdPartyProviderConfig;
	isConnected(me: CSMe): boolean;
	ensureConnected(request?: { providerTeamId?: string }): Promise<void>;
	verifyConnection(config: ProviderConfigurationData): Promise<void>;

	/**
	 * Do any kind of pre-fetching work, like getting an API version number
	 *
	 * @return {*}  {Promise<void>}
	 * @memberof ThirdPartyProvider
	 */
	ensureInitialized(): Promise<void>;
}

export interface ThirdPartyIssueProvider extends ThirdPartyProvider {
	supportsIssues(): this is ThirdPartyIssueProvider & ThirdPartyProviderSupportsIssues;
	supportsViewingPullRequests(): this is ThirdPartyIssueProvider &
		ThirdPartyProviderSupportsViewingPullRequests;
	supportsCreatingPullRequests(): this is ThirdPartyIssueProvider &
		ThirdPartyProviderSupportsCreatingPullRequests;
}

export interface ThirdPartyPostProvider extends ThirdPartyProvider {
	supportsSharing(): this is ThirdPartyPostProvider & ThirdPartyProviderSupportsPosts;
	supportsStatus(): this is ThirdPartyPostProvider & ThirdPartyProviderSupportsStatus;
}

export interface ApiResponse<T> {
	body: T;
	response: Response;
}

// timeout for providers in minutes
export const REFRESH_TIMEOUT = 30;

interface RefreshableProviderInfo {
	expiresAt: number;
	refreshToken: string;
}

function isRefreshable<TProviderInfo extends CSProviderInfos>(
	providerInfo: TProviderInfo
): providerInfo is TProviderInfo & RefreshableProviderInfo {
	return typeof (providerInfo as any).expiresAt === "number";
}

export abstract class ThirdPartyProviderBase<
	TProviderInfo extends CSProviderInfos = CSProviderInfos
> implements ThirdPartyProvider {
	private _readyPromise: Promise<void> | undefined;
	protected _ensuringConnection: Promise<void> | undefined;
	protected _providerInfo: TProviderInfo | undefined;
	protected _httpsAgent: HttpsAgent | HttpsProxyAgent | undefined;
	protected _client: GraphQLClient | undefined;

	constructor(
		public readonly session: CodeStreamSession,
		protected readonly providerConfig: ThirdPartyProviderConfig
	) {}

	protected DEFAULT_VERSION = { version: "0.0.0", asArray: [0, 0, 0], isDefault: true };
	protected _version: ProviderVersion | undefined;

	async ensureInitialized() {}

	abstract get displayName(): string;
	abstract get name(): string;
	abstract get headers(): { [key: string]: string };
	get icon() {
		return this.name;
	}

	get accessToken() {
		return this._providerInfo && this._providerInfo.accessToken;
	}

	get apiPath() {
		return "";
	}

	get baseUrl() {
		return `${this.baseWebUrl}${this.apiPath}`;
	}

	get baseWebUrl() {
		const { host, apiHost, isEnterprise } = this.providerConfig;
		return isEnterprise ? host : `https://${apiHost}`;
	}

	async addEnterpriseHost(
		request: AddEnterpriseProviderRequest
	): Promise<AddEnterpriseProviderResponse> {
		return await this.session.api.addEnterpriseProviderHost({
			provider: this.providerConfig.name,
			teamId: this.session.teamId,
			host: request.host,
			data: request.data
		});
	}

	async removeEnterpriseHost(request: RemoveEnterpriseProviderRequest): Promise<void> {
		await this.session.api.removeEnterpriseProviderHost({
			provider: this.providerConfig.name,
			providerId: request.providerId,
			teamId: this.session.teamId
		});
	}

	isReady() {
		return !!(this._readyPromise !== undefined);
	}

	resetReady() {
		this._readyPromise = undefined;
	}

	getConfig() {
		return this.providerConfig;
	}

	isConnected(user: CSMe): boolean {
		const providerInfo = this.getProviderInfo(user);
		return this.hasAccessToken(providerInfo);
	}

	hasAccessToken(providerInfo: TProviderInfo | undefined) {
		if (!providerInfo) return false;

		const multiProviderInfo = providerInfo as { multiple: any };
		if (multiProviderInfo && multiProviderInfo.multiple) {
			for (const providerTeamId of Object.keys(multiProviderInfo.multiple)) {
				if (
					multiProviderInfo.multiple[providerTeamId] &&
					multiProviderInfo.multiple[providerTeamId].accessToken
				) {
					return true;
				}
			}
		} else {
			return !!providerInfo.accessToken;
		}

		return false;
	}

	get hasTokenError() {
		return this._providerInfo?.tokenError != null;
	}

	getConnectionData() {
		return {
			providerId: this.providerConfig.id
		};
	}

	onConnecting() {
		void this.session.api.connectThirdPartyProvider(this.getConnectionData());
	}

	async connect() {
		void this.onConnecting();

		// FIXME - this rather sucks as a way to ensure we have the access token
		this._providerInfo = await new Promise<TProviderInfo>(resolve => {
			this.session.api.onDidReceiveMessage(e => {
				if (e.type !== MessageType.Users) return;

				const me = e.data.find((u: any) => u.id === this.session.userId) as CSMe | null | undefined;
				if (me == null) return;

				const providerInfo = this.getProviderInfo(me);
				if (!this.hasAccessToken(providerInfo)) return;
				resolve(providerInfo);
			});
		});

		this._readyPromise = this.onConnected(this._providerInfo);
		await this._readyPromise;
		this.resetReady();
	}

	protected async onConnected(providerInfo?: TProviderInfo) {
		// if CodeStream is connected through a proxy, then we should be too,
		// but to make sure nothing breaks, only if the user has a preference for it
		if (this.session.proxyAgent) {
			const user = await SessionContainer.instance().users.getMe();
			if (user.preferences?.useCodestreamProxyForIntegrations) {
				Logger.log(
					`${this.providerConfig.name} provider (id:"${this.providerConfig.id}") will use CodeStream's proxy agent`
				);
				this._httpsAgent = this.session.proxyAgent;
				return;
			}
		}

		// if we are connecting with https, and if strictSSL is disabled for CodeStream,
		// assume OK to have it disabled for third-party providers as well,
		// with the one exception of on-prem CodeStream, for whom it is only disabled
		// for self-hosted providers ...
		// ... so in this case, establish our own HTTPS agent
		const info = url.parse(this.baseUrl);
		if (
			info.protocol === "https:" &&
			this.session.disableStrictSSL &&
			(!this.session.isOnPrem ||
				this.providerConfig.forEnterprise ||
				this.providerConfig.isEnterprise)
		) {
			Logger.log(
				`${this.providerConfig.name} provider (id:"${this.providerConfig.id}") will use a custom HTTPS agent with strictSSL disabled`
			);
			this._httpsAgent = new HttpsAgent({
				rejectUnauthorized: false
			});
		}
	}

	// override to allow configuration without OAuth
	canConfigure() {
		return false;
	}

	@log()
	async configure(config: ProviderConfigurationData, verify?: boolean) {
		if (verify) {
			config.pendingVerification = true;
		}
		await this.session.api.setThirdPartyProviderInfo({
			providerId: this.providerConfig.id,
			data: config
		});
		if (verify) {
			await this.verifyAndUpdate(config);
		}
		this.session.updateProviders();
	}

	async verifyAndUpdate(config: ProviderConfigurationData) {
		let tokenError;
		try {
			await this.verifyConnection(config);
		} catch (ex) {
			tokenError = {
				error: ex,
				occurredAt: Date.now(),
				isConnectionError: true,
				providerMessage: (ex as Error).message
			};
			delete config.accessToken;
		}
		config.tokenError = tokenError;
		config.pendingVerification = false;
		this.session.api.setThirdPartyProviderInfo({
			providerId: this.providerConfig.id,
			data: config
		});
	}

	protected async onConfigured() {}

	async verifyConnection(config: ProviderConfigurationData) {}

	async disconnect(request?: ThirdPartyDisconnect) {
		void (await this.session.api.disconnectThirdPartyProvider({
			providerId: this.providerConfig.id,
			providerTeamId: request && request.providerTeamId
		}));
		this._readyPromise = this._providerInfo = undefined;
		await this.onDisconnected(request);
	}

	protected async onDisconnected(request?: ThirdPartyDisconnect) {}

	async ensureConnected(request?: { providerTeamId?: string }) {
		if (this._readyPromise !== undefined) return this._readyPromise;

		if (this._providerInfo !== undefined) {
			await this.refreshToken(request);
			return;
		}
		if (this._ensuringConnection === undefined) {
			this._ensuringConnection = this.ensureConnectedCore(request);
		}
		void (await this._ensuringConnection);
	}

	async refreshToken(request?: { providerTeamId?: string }) {
		if (this._providerInfo === undefined || !isRefreshable(this._providerInfo)) {
			return;
		}

		const oneMinuteBeforeExpiration = this._providerInfo.expiresAt - 1000 * 60;
		if (oneMinuteBeforeExpiration > new Date().getTime()) return;

		try {
			const me = await this.session.api.refreshThirdPartyProvider({
				providerId: this.providerConfig.id,
				refreshToken: this._providerInfo.refreshToken,
				subId: request && request.providerTeamId
			});
			this._providerInfo = this.getProviderInfo(me);
		} catch (error) {
			await this.disconnect();
			return this.ensureConnected();
		}
	}

	private async ensureConnectedCore(request?: { providerTeamId?: string }) {
		const user = await SessionContainer.instance().users.getMe();
		this._providerInfo = this.getProviderInfo(user);
		if (this._providerInfo === undefined) {
			throw new Error(`You must authenticate with ${this.displayName} first.`);
		}

		await this.refreshToken(request);
		await this.onConnected(this._providerInfo);

		this._ensuringConnection = undefined;
	}

	protected async delete<R extends object>(
		url: string,
		headers: { [key: string]: string } = {},
		options: { [key: string]: any } = {}
	): Promise<ApiResponse<R>> {
		let resp = undefined;
		if (resp === undefined) {
			await this.ensureConnected();
			resp = this.fetch<R>(
				url,
				{
					method: "DELETE",
					headers: { ...this.headers, ...headers }
				},
				options
			);
		}
		return resp;
	}

	protected async get<R extends object>(
		url: string,
		headers: { [key: string]: string } = {},
		options: { [key: string]: any } = {}
	): Promise<ApiResponse<R>> {
		await this.ensureConnected();
		return this.fetch<R>(
			url,
			{
				method: "GET",
				headers: { ...this.headers, ...headers }
			},
			options
		);
	}

	protected async post<RQ extends object, R extends object>(
		url: string,
		body: RQ,
		headers: { [key: string]: string } = {},
		options: { [key: string]: any } = {}
	): Promise<ApiResponse<R>> {
		await this.ensureConnected();
		return this.fetch<R>(
			url,
			{
				method: "POST",
				body: JSON.stringify(body),
				headers: { ...this.headers, ...headers }
			},
			options
		);
	}

	protected async put<RQ extends object, R extends object>(
		url: string,
		body: RQ,
		headers: { [key: string]: string } = {},
		options: { [key: string]: any } = {}
	): Promise<ApiResponse<R>> {
		await this.ensureConnected();
		return this.fetch<R>(
			url,
			{
				method: "PUT",
				body: JSON.stringify(body),
				headers: { ...this.headers, ...headers }
			},
			options
		);
	}

	protected getProviderInfo(me: CSMe) {
		return User.getProviderInfo<TProviderInfo>(
			me,
			this.session.teamId,
			this.name,
			this.providerConfig.isEnterprise ? this.providerConfig.host : undefined
		);
	}

	private async fetch<R extends object>(
		url: string,
		init: RequestInit,
		options: { [key: string]: any } = {}
	): Promise<ApiResponse<R>> {
		if (this._providerInfo && this._providerInfo.tokenError) {
			throw new InternalError(ReportSuppressedMessages.AccessTokenInvalid);
		}

		const start = process.hrtime();

		let traceResult;
		let method;
		let absoluteUrl;
		try {
			if (init === undefined) {
				init = {};
			}
			if (this._httpsAgent) {
				init.agent = this._httpsAgent;
			}

			method = (init && init.method) || "GET";
			absoluteUrl = options.absoluteUrl ? url : `${this.baseUrl}${url}`;
			if (options.timeout != null) {
				init.timeout = options.timeout;
			}

			let json: Promise<R> | undefined;
			let resp: Response | undefined;
			let retryCount = 0;
			if (json === undefined) {
				[resp, retryCount] = await this.fetchCore(0, absoluteUrl, init);

				if (resp.ok) {
					traceResult = `${this.displayName}: Completed ${method} ${url}`;
					if (options?.useRawResponse) {
						json = resp.text() as any;
					} else {
						try {
							json = resp.json() as Promise<R>;
						} catch (jsonError) {
							Container.instance().errorReporter.reportBreadcrumb({
								message: `provider fetchCore parseJsonError`,
								data: {
									jsonError,
									text: resp.text() as any
								}
							});
						}
					}
				}
			}

			if (resp !== undefined && !resp.ok) {
				traceResult = `${this.displayName}: FAILED(${retryCount}x) ${method} ${absoluteUrl}`;
				const error = await this.handleErrorResponse(resp);
				Container.instance().errorReporter.reportBreadcrumb({
					message: `provider fetchCore response`,
					data: {
						error
					}
				});
				throw error;
			}

			return {
				body: await json!,
				response: resp!
			};
		} catch (ex) {
			throw ex;
		} finally {
			Logger.log(
				`${traceResult}${
					init && init.body ? ` body=${init && init.body}` : ""
				} \u2022 ${Strings.getDurationMilliseconds(start)} ms`
			);
		}
	}

	private async fetchCore(
		count: number,
		url: string,
		init?: RequestInit
	): Promise<[Response, number]> {
		try {
			const resp = await fetch(url, init);
			if (resp.status < 200 || resp.status > 299) {
				if (resp.status < 400 || resp.status >= 500) {
					count++;
					if (count <= 3) {
						await Functions.wait(250 * count);
						return this.fetchCore(count, url, init);
					}
				}
			}
			return [resp, count];
		} catch (ex) {
			Logger.error(ex);

			count++;
			if (count <= 3) {
				await Functions.wait(250 * count);
				return this.fetchCore(count, url, init);
			}
			throw ex;
		}
	}

	protected async handleErrorResponse(response: Response): Promise<Error> {
		let message = response.statusText;
		let data;
		Logger.debug("handleErrorResponse: ", JSON.stringify(response, null, 4));
		if (response.status === 401) {
			return new InternalError(ReportSuppressedMessages.Unauthorized);
		}
		if (response.status >= 400 && response.status < 500) {
			try {
				data = await response.json();
				// warn as not to trigger a sentry but still have it be in the user's log
				try {
					Logger.warn(`handleErrorResponse:json: ${JSON.stringify(data, null, 4)}`);
				} catch {}
				if (data.code) {
					message += `(${data.code})`;
				}
				if (data.message) {
					message += `: ${data.message}`;
				}
				if (data.info && data.info.name) {
					message += `\n${data.info.name}`;
				}
				if (Array.isArray(data.errors)) {
					for (const error of data.errors) {
						if (error.message) {
							message += `\n${error.message}`;
						}
						// GitHub will return these properties
						else if (error.resource && error.field && error.code) {
							message += `\n${error.resource} field ${error.field} ${error.code}`;
						} else {
							// else give _something_ to the user
							message += `\n${JSON.stringify(error)}`;
						}
					}
				}
				if (Array.isArray(data.errorMessages)) {
					for (const errorMessage of data.errorMessages) {
						message += `\n${errorMessage}`;
					}
				}
				if (data.error) {
					if (data.error.message) {
						message += `: ${data.error.message}`;
					} else {
						message += `: ${data.error}`;
					}
				}
			} catch {}
		}
		return new Error(message);
	}
}

export abstract class ThirdPartyIssueProviderBase<
	TProviderInfo extends CSProviderInfos = CSProviderInfos
> extends ThirdPartyProviderBase<TProviderInfo> implements ThirdPartyIssueProvider {
	private _pullRequestDocumentMarkersCache = new Map<
		string,
		{ documentVersion: number; promise: Promise<DocumentMarker[]> }
	>();

	protected invalidatePullRequestDocumentMarkersCache() {
		this._pullRequestDocumentMarkersCache.clear();
	}

	supportsIssues(): this is ThirdPartyIssueProvider & ThirdPartyProviderSupportsIssues {
		return ThirdPartyIssueProvider.supportsIssues(this);
	}
	supportsViewingPullRequests(): this is ThirdPartyIssueProvider &
		ThirdPartyProviderSupportsViewingPullRequests {
		return ThirdPartyIssueProvider.supportsViewingPullRequests(this);
	}
	supportsCreatingPullRequests(): this is ThirdPartyIssueProvider &
		ThirdPartyProviderSupportsCreatingPullRequests {
		return ThirdPartyIssueProvider.supportsCreatingPullRequests(this);
	}
	protected createDescription(request: ProviderCreatePullRequestRequest): string | undefined {
		if (
			!request ||
			request.description == null ||
			!request.metadata ||
			(!request.metadata.reviewPermalink && !request.metadata.addresses)
		) {
			return request.description;
		}

		if (request.metadata.reviewPermalink) {
			request.description += `\n\n\n[Changes reviewed on CodeStream](${
				request.metadata.reviewPermalink
			}?src=${encodeURIComponent(this.displayName)})`;
			if (request.metadata.reviewers) {
				request.description += ` by ${request.metadata.reviewers?.map(_ => _.name)?.join(", ")}`;
			}
			if (request.metadata.approvedAt) {
				request.description += ` on ${new Date(
					request.metadata.approvedAt
				).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;
			}
		}
		if (request.metadata.addresses) {
			let addressesText = "\n\n**This PR Addresses:**  \n";
			let foundOneWithUrl = false;
			request.metadata.addresses.forEach(issue => {
				addressesText += `[${issue.title}](${issue.url})  \n`;
				if (issue.url) foundOneWithUrl = true;
			});
			if (foundOneWithUrl) request.description += addressesText;
		}
		const codeStreamLink = `https://codestream.com/?utm_source=cs&utm_medium=pr&utm_campaign=${encodeURI(
			request.providerId
		)}`;
		let createdFrom = "";
		switch (request.ideName) {
			case "VSC":
				createdFrom = "from VS Code";
				break;
			case "JETBRAINS":
				createdFrom = "from JetBrains";
				break;
			case "VS":
				createdFrom = "from Visual Studio";
				break;
			case "ATOM":
				createdFrom = "from Atom";
				break;
		}
		let codeStreamAttribution = `Created ${createdFrom} using [CodeStream](${codeStreamLink})`;
		if (!["bitbucket*org", "bitbucket/server"].includes(request.providerId)) {
			codeStreamAttribution = `<sup> ${codeStreamAttribution}</sup>`;
		}
		request.description += `\n\n${codeStreamAttribution}`;
		return request.description;
	}

	protected async isPRApiCompatible(): Promise<boolean> {
		return true;
	}

	protected async isPRCreationApiCompatible(): Promise<boolean> {
		return true;
	}

	protected getPRExternalContent(
		comment: PullRequestComment
	): DocumentMarkerExternalContent | undefined {
		return undefined;
	}

	protected _isSuppressedException(ex: any): ReportSuppressedMessages | undefined {
		const networkErrors = [
			"ENOTFOUND",
			"ETIMEDOUT",
			"EAI_AGAIN",
			"ECONNRESET",
			"ECONNREFUSED",
			"EHOSTUNREACH",
			"ENETDOWN",
			"ENETUNREACH",
			"self signed certificate in certificate chain",
			"socket disconnected before secure",
			"socket hang up"
		];

		if (ex.message && networkErrors.some(e => ex.message.match(new RegExp(e)))) {
			return ReportSuppressedMessages.NetworkError;
		} else if (ex.message && ex.message.match(/GraphQL Error \(Code: 404\)/)) {
			return ReportSuppressedMessages.ConnectionError;
		}
		// else if (
		// 	(ex?.response?.message || ex?.message || "").indexOf(
		// 		"enabled OAuth App access restrictions"
		// 	) > -1
		// ) {
		// 	return ReportSuppressedMessages.OAuthAppAccessRestrictionError;
		// }
		else if (
			(ex.response && ex.response.message === "Bad credentials") ||
			(ex.response &&
				ex.response.errors instanceof Array &&
				ex.response.errors.find((e: any) => e.type === "FORBIDDEN"))
		) {
			return ReportSuppressedMessages.AccessTokenInvalid;
		} else if (ex.message && ex.message.match(/must accept the Terms of Service/)) {
			return ReportSuppressedMessages.GitLabTermsOfService;
		} else {
			return undefined;
		}
	}

	protected trySetThirdPartyProviderInfo(
		ex: Error,
		exType?: ReportSuppressedMessages | undefined
	): void {
		if (!ex) return;

		exType = exType || this._isSuppressedException(ex);
		if (exType !== undefined && exType !== ReportSuppressedMessages.NetworkError) {
			// we know about this error, and we want to give the user a chance to correct it
			// (but throwing up a banner), rather than logging the error to sentry
			this.session.api.setThirdPartyProviderInfo({
				providerId: this.providerConfig.id,
				data: {
					tokenError: {
						error: ex,
						occurredAt: Date.now(),
						isConnectionError: exType === ReportSuppressedMessages.ConnectionError,
						providerMessage:
							exType === ReportSuppressedMessages.OAuthAppAccessRestrictionError ? ex.message : null
					}
				}
			});
			if (this._client) {
				delete this._client;
			}
		}
	}

	getOwnerFromRemote(remote: string): { owner: string; name: string } {
		return {
			owner: "",
			name: ""
		};
	}

	/**
	 * Repos that are opened in the editor
	 * @returns array of owner/repo strings
	 */
	protected async getOpenedRepos(): Promise<string[]> {
		const repos: string[] = [];
		const { scm, providerRegistry } = SessionContainer.instance();
		const reposResponse = await scm.getRepos({ inEditorOnly: true, includeProviders: true });
		if (!reposResponse.repositories || !reposResponse.repositories.length) return repos;

		for (const repo of reposResponse.repositories) {
			if (!repo.remotes) continue;

			for (const remote of repo.remotes) {
				const urlToTest = remote.webUrl;
				const results = await providerRegistry.queryThirdParty({ url: urlToTest });
				if (results && results.providerId === this.providerConfig.id) {
					const ownerData = this.getOwnerFromRemote(urlToTest);
					if (ownerData) {
						repos.push(`${ownerData.owner}/${ownerData.name}`);
					}
				}
			}
		}

		return repos;
	}

	protected async getVersion(): Promise<ProviderVersion> {
		this._version = this.DEFAULT_VERSION;
		return this._version;
	}

	protected handleProviderError(ex: any, request: any) {
		Logger.error(ex, `${this.displayName}: handleProviderError`, {
			request
		});

		let errorMessage = undefined;
		if (ex?.info?.error?.message) {
			// this is some kind of fetch / network error
			errorMessage = ex.info.error.message;
		}
		if (ex?.response?.errors?.length) {
			// this is some kind of provider error
			errorMessage = ex.response.errors[0].message || "Unknown error";
		}
		if (!errorMessage) {
			if (ex?.message) {
				// generic error
				errorMessage = ex.message;
			} else {
				// some other kind of error
				errorMessage = ex?.toString();
			}
		}

		errorMessage = `${this.displayName}: ${errorMessage || `Unknown error`}`;
		return {
			error: {
				type: "PROVIDER",
				message: errorMessage
			}
		};
	}
}

export abstract class ThirdPartyPostProviderBase<
	TProviderInfo extends CSProviderInfos = CSProviderInfos
> extends ThirdPartyProviderBase<TProviderInfo> implements ThirdPartyPostProvider {
	supportsSharing(): this is ThirdPartyPostProvider & ThirdPartyProviderSupportsPosts {
		return ThirdPartyPostProvider.supportsSharing(this);
	}
	supportsStatus(): this is ThirdPartyPostProvider & ThirdPartyProviderSupportsStatus {
		return ThirdPartyPostProvider.supportsStatus(this);
	}
}

export interface ProviderVersion {
	/**
	 * Semantic version, aka X.Y.Z
	 *
	 * @type {string}
	 * @memberof ProviderVersion
	 */
	version: string;
	/**
	 * version as an array
	 *
	 * @type {number[]}
	 * @memberof ProviderVersion
	 */
	asArray: number[];
	/**
	 * optional revision information, GitLab has this
	 *
	 * @type {string}
	 * @memberof ProviderVersion
	 */
	revision?: string;
	/**
	 * optional edition information like "ee". Gitlab has this
	 *
	 * @type {string}
	 * @memberof ProviderVersion
	 */
	edition?: string;

	/**
	 * true if the version is 0.0.0
	 */
	isDefault?: boolean;

	/**
	 * true if we're not able to get a version from the api
	 */
	isLowestSupportedVersion?: boolean;
}

export interface PullRequestComment {
	author: {
		id: string;
		nickname: string;
		username?: string;
	};
	createdAt: number;
	id: string;
	path: string;
	pullRequest: {
		id: number;
		externalId?: string;
		title?: string;
		url: string;
		isOpen: boolean;
		targetBranch: string;
		sourceBranch: string;
	};
	text: string;
	code: string;
	url: string;

	commit: string;
	originalCommit?: string;
	line: number;
	originalLine?: number;
	diffHunk?: string;
	outdated?: boolean;
}

export async function getOpenedRepos<R>(
	predicate: (remote: GitRemote) => boolean,
	queryFn: (path: string) => Promise<ApiResponse<R>>,
	remoteRepos: Map<string, R>
): Promise<Map<string, R>> {
	const openRepos = new Map<string, R>();

	const { git } = SessionContainer.instance();
	const gitRepos = await git.getRepositories();

	for (const gitRepo of gitRepos) {
		const remotes = await git.getRepoRemotes(gitRepo.path);
		for (const remote of remotes) {
			if (!openRepos.has(remote.path) && predicate(remote)) {
				let remoteRepo = remoteRepos.get(remote.path);
				if (remoteRepo == null) {
					try {
						const response = await queryFn(remote.path);
						remoteRepo = {
							...response.body,
							path: gitRepo.path
						};
						remoteRepos.set(remote.path, remoteRepo);
					} catch (ex) {
						Logger.error(ex);
						debugger;
					}
				}

				if (remoteRepo != null) {
					openRepos.set(remote.path, remoteRepo);
				}
			}
		}
	}

	return openRepos;
}

export async function getRemotePaths<R extends { path: string }>(
	repo: GitRepository | undefined,
	predicate: (remote: GitRemote) => boolean,
	remoteRepos: Map<string, R>
): Promise<string[] | undefined> {
	try {
		if (repo === undefined) return undefined;

		const remotesPromise = repo.getRemotes();

		const remotePaths = [];
		for (const [path, remoteRepo] of remoteRepos.entries()) {
			if (remoteRepo.path === repo.path) {
				remotePaths.push(path);
			}
		}
		if (remotePaths.length) return remotePaths;

		const remotes = await remotesPromise;
		return remotes.filter(predicate).map(r => r.path);
	} catch (ex) {
		return undefined;
	}
}

export interface ProviderGetRepoInfoRequest {
	providerId: string;
	remote: string;
}

export interface ProviderPullRequestInfo {
	id: string;
	url: string;
	nameWithOwner?: string;
	baseRefName: string;
	headRefName: string;
}

export interface ProviderGetRepoInfoResponse {
	/**
	 * id of the repository from the provider
	 */
	id?: string;
	/**
	 * in github.com/TeamCodeStream/codestream this is TeamCodeStream/codestream
	 */
	nameWithOwner?: string;
	/**
	 * in github.com/TeamCodeStream/codestream this is TeamCodeStream
	 */
	owner?: string;
	/**
	 * in github.com/TeamCodeStream/codestream this is codestream
	 */
	name?: string;
	/**
	 * is this repo forked
	 */
	isFork?: boolean;
	/**
	 * defaultBranch: main, master, something else
	 */
	defaultBranch?: string;
	/**
	 * currently open pull requests
	 */
	pullRequests?: ProviderPullRequestInfo[];

	error?: { message?: string; type: string };
	// used for some providers
	key?: string;
}

export interface ProviderCreatePullRequestRequest {
	/** CodeStream providerId, aka github*com, gitlab*com, etc. */
	providerId: string;
	/** certain providers require their internal repo Id */
	providerRepositoryId?: string;
	/** is the repo a fork? */
	isFork?: boolean;
	/** to look up the repo ID on the provider  */
	remote: string;
	/** PR title */
	title: string;
	/** PR description (optional) */
	description?: string;
	/** base branch name, or the branch that will accept the PR */
	baseRefName: string;
	/** in github.com/TeamCodeStream/codestream this is TeamCodeStream/codestream */
	baseRefRepoNameWithOwner?: string;
	/** head branch name, or the branch you have been working on and want to merge somewhere */
	headRefName: string;
	/** in github.com/TeamCodeStream/codestream this is TeamCodeStream, some providers, like GitHub need this for forks */
	headRefRepoOwner?: string;
	/** in github.com/TeamCodeStream/codestream this is TeamCodeStream/codestream */
	headRefRepoNameWithOwner?: string;
	/** additional data */
	metadata: {
		reviewPermalink?: string;
		reviewers?: { name: string }[];
		approvedAt?: number;
		addresses?: { title: string; url: string }[];
	};
	/**  name of the user's IDE */
	ideName?: string;
}

export interface ProviderCreatePullRequestResponse {
	url?: string;
	title?: string;
	id?: string;
	error?: { message?: string; type: string };
}

export interface RepoPullRequestProvider {
	repo: GitRepository;
	providerId: string;
	providerName: string;
	provider: ThirdPartyProvider & ThirdPartyProviderSupportsPullRequests;
	remotes: GitRemote[];
}
