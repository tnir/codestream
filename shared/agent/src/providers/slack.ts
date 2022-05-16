"use strict";
import { CodeStreamApiProvider } from "api/codestream/codestreamApi";
import { flatten, sortBy } from "lodash";
import { SlackSharingApiProvider } from "../api/slack/slackSharingApi";
import { SessionContainer } from "../container";
import {
	CreateThirdPartyPostRequest,
	CreateThirdPartyPostResponse,
	FetchThirdPartyChannelsRequest,
	FetchThirdPartyChannelsResponse,
	ThirdPartyDisconnect,
	UpdateThirdPartyStatusRequest,
	UpdateThirdPartyStatusResponse
} from "../protocol/agent.protocol";
import {
	CSChannelStream,
	CSDirectStream,
	CSSlackProviderInfo,
	StreamType
} from "../protocol/api.protocol";
import { log, lspProvider } from "../system";
import { ThirdPartyPostProviderBase, ThirdPartyProviderSupportsStatus } from "./provider";

@lspProvider("slack")
export class SlackProvider extends ThirdPartyPostProviderBase<CSSlackProviderInfo>
	implements ThirdPartyProviderSupportsStatus {
	get displayName() {
		return "Slack";
	}

	get name() {
		return "slack";
	}

	get headers() {
		return {
			Authorization: `Bearer ${this.accessToken}`
		};
	}

	private _clientCache: { [key: string]: SlackSharingApiProvider } | undefined;
	private _lastTeamId: string | undefined;
	private _multiProviderInfo: CSSlackProviderInfo | undefined;

	async connect() {
		if (this._multiProviderInfo !== undefined && super.isReady()) {
			this._multiProviderInfo = undefined;
			this._clientCache = undefined;
			this.resetReady();
		}
		super.connect();
	}

	private createClient(providerInfo: CSSlackProviderInfo): SlackSharingApiProvider {
		const session = SessionContainer.instance().session;
		const slackApi = new SlackSharingApiProvider(
			session.api as CodeStreamApiProvider,
			{
				accessToken: providerInfo.accessToken!,
				teamId: session.api.teamId,
				// this is the slack userId
				userId: providerInfo && providerInfo!.data && providerInfo!.data.user_id // session.api.userId
			},
			// codestream teamId
			session.api.teamId,
			SessionContainer.instance().session.proxyAgent
		);
		return slackApi;
	}

	protected async onConnected(providerInfo: CSSlackProviderInfo) {
		super.onConnected(providerInfo);
		this._multiProviderInfo = providerInfo;
	}

	protected async onDisconnected(request?: ThirdPartyDisconnect) {
		if (!request || !request.providerTeamId) return;

		if (this._clientCache) {
			const client = this._clientCache[request.providerTeamId];
			if (client) {
				if (client.dispose) {
					await client.dispose();
				}
				delete this._clientCache[request.providerTeamId];
			}
		}
		if (this._multiProviderInfo && this._multiProviderInfo.multiple) {
			delete this._multiProviderInfo.multiple[request.providerTeamId];
		}
	}

	private getClient(providerTeamId: string) {
		if (!this._multiProviderInfo) return undefined;

		if (!this._clientCache) {
			this._clientCache = {};
		}
		let cachedClient = this._clientCache![providerTeamId];
		if (!cachedClient) {
			cachedClient = this._clientCache[providerTeamId] = this.createClient(
				this._multiProviderInfo!.multiple![providerTeamId]!
			);
		}

		return cachedClient;
	}

	getConnectionData() {
		const data = super.getConnectionData();
		return { ...data, sharing: true };
	}

	@log()
	async getChannels(
		request: FetchThirdPartyChannelsRequest
	): Promise<FetchThirdPartyChannelsResponse> {
		await this.ensureConnected();
		this._lastTeamId = request.providerTeamId;

		const slackClient = this.getClient(request.providerTeamId);
		if (!slackClient) {
			return {
				channels: []
			};
		}
		const streams = await slackClient.fetchStreams({});
		const channels = sortBy(
			streams.streams
				.filter(s => s.type !== StreamType.Object)
				.map(s => {
					const _ = s as CSChannelStream | CSDirectStream;
					return {
						id: _.id,
						name: _.name!,
						type: _.type,
						order: _.type === StreamType.Channel ? 0 : _.type === StreamType.Direct ? 2 : 1
					};
				}),
			[_ => _.order, _ => _.name]
		);
		return {
			channels: channels
		};
	}

	// this needs the users.profile:write scope
	@log()
	async updateStatus(
		request: UpdateThirdPartyStatusRequest
	): Promise<UpdateThirdPartyStatusResponse> {
		await this.ensureConnected();
		this._lastTeamId = request.providerTeamId;

		const slackClient = this.getClient(request.providerTeamId);
		if (!slackClient) {
			return { status: undefined };
		}
		const status = await slackClient.updateStatus(request);
		return status;
	}

	@log()
	async createPost(request: CreateThirdPartyPostRequest): Promise<CreateThirdPartyPostResponse> {
		await this.ensureConnected();
		this._lastTeamId = request.providerTeamId;

		const slackClient = this.getClient(request.providerTeamId);
		if (!slackClient) {
			return { post: undefined };
		}
		if (request.codemark && request.codemark.markers) {
			if (request.remotes == undefined) {
				request.remotes = flatten(
					await Promise.all(
						request.codemark.markers.map(async m => {
							return (await SessionContainer.instance().repos.getById(m.repoId)).remotes.map(
								r => r.url
							);
						})
					)
				);
			}
		}
		const post = await slackClient.createExternalPost(request);
		return post;
	}
}
