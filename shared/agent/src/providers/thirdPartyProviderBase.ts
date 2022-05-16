import { GraphQLClient } from "graphql-request";
import { Agent as HttpsAgent } from "https";
import HttpsProxyAgent from "https-proxy-agent";
import fetch, { RequestInit, Response } from "node-fetch";
import url from "url";
import { InternalError, ReportSuppressedMessages } from "../agentError";
import { MessageType } from "../api/apiProvider";
import { User } from "../api/extensions";
import { Container, SessionContainer } from "../container";
import { Logger } from "../logger";
import {
	AddEnterpriseProviderRequest,
	AddEnterpriseProviderResponse,
	ProviderConfigurationData,
	RemoveEnterpriseProviderRequest,
	ThirdPartyDisconnect,
	ThirdPartyProviderConfig
} from "../protocol/agent.protocol.providers";
import { CSMe, CSProviderInfos } from "../protocol/api.protocol.models";
import { CodeStreamSession } from "../session";
// import { log } from "../system/decorators/log";
import { Functions } from "../system/function";
import { Strings } from "../system/string";
import { ApiResponse, ThirdPartyProvider } from "./provider";
import { ProviderVersion } from "./types";

interface RefreshableProviderInfo {
	expiresAt: number;
	refreshToken: string;
}

function isRefreshable<TProviderInfo extends CSProviderInfos>(
	providerInfo: TProviderInfo
): providerInfo is TProviderInfo & RefreshableProviderInfo {
	return typeof (providerInfo as any).expiresAt === "number";
}

export abstract class ThirdPartyProviderBase<TProviderInfo extends CSProviderInfos>
	implements ThirdPartyProvider {
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
				if (!providerInfo) return;
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

	// @log()
	async configure(config: ProviderConfigurationData, verify?: boolean): Promise<boolean> {
		if (verify) {
			config.pendingVerification = true;
		}
		await this.session.api.setThirdPartyProviderInfo({
			providerId: this.providerConfig.id,
			data: config
		});
		let result = true;
		if (verify) {
			result = await this.verifyAndUpdate(config);
		}
		this.session.updateProviders();
		return result;
	}

	async verifyAndUpdate(config: ProviderConfigurationData): Promise<boolean> {
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
		return !tokenError;
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
		this._readyPromise = this.onConnected(this._providerInfo);
		await this._readyPromise;
		this.resetReady();
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
