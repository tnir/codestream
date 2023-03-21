"use strict";
import { ReviewDiffContentProvider } from "./providers/diffContentProvider";
import { ExtensionContext, languages, workspace } from "vscode";
import { WebviewLike } from "./webviews/webviewLike";
import { GitContentProvider } from "./providers/gitContentProvider";
import { InstrumentableCodeLensController } from "./controllers/instrumentableCodeLensController";
import { BaseAgentOptions, CodeStreamAgentConnection } from "./agent/agentConnection";
import { CodeStreamSession, SessionStatus } from "./api/session";
import { Commands } from "./commands";
import {
	Config,
	configuration,
	ConfigurationWillChangeEvent,
	ConfigSettingsNeedingReload
} from "./configuration";
import { NotificationsController } from "./controllers/notificationsController";
import { StatusBarController } from "./controllers/statusBarController";
import { SidebarController } from "./controllers/sidebarController";
import { Logger, TraceLevel } from "./logger";
import { CodeStreamCodeActionProvider } from "./providers/codeActionProvider";
import { CodemarkDecorationProvider } from "./providers/markerDecorationProvider";
import { CodemarkPatchContentProvider } from "./providers/patchContentProvider";
import { SetServerUrlRequestType } from "@codestream/protocols/agent";
import { EditorController } from "./controllers/editorController";
import { NrqlCodeLensController } from "./controllers/nrqlCodeLensController";
import { PanelController } from "./controllers/panelController";
import { NrqlDocumentSymbolProvider } from "./providers/nrqlDocumentSymbolProvider";
import { CodeStreamInlayHintsProvider } from "providers/inlayHintProvider";

export class Container {
	static telemetryOptions?: TelemetryOptions;

	static async initialize(
		context: ExtensionContext,
		config: Config,
		agentOptions: BaseAgentOptions,
		sidebar?: WebviewLike,
		telemetryOptions?: TelemetryOptions
	) {
		this._context = context;
		this._config = config;
		Container.telemetryOptions = telemetryOptions;

		this._version = agentOptions.extension.version;
		this._versionBuild = agentOptions.extension.build;
		this._versionFormatted = agentOptions.extension.versionFormatted;
		this._agent = new CodeStreamAgentConnection(context, agentOptions);
		// populate the initial values for the config items we care about.
		Container.interestedConfigurationItems.forEach(element => {
			try {
				element.value = element.getValue() as any;
			} catch {}
		});

		context.subscriptions.push((this._session = new CodeStreamSession(config.serverUrl)));
		context.subscriptions.push((this._notifications = new NotificationsController()));
		context.subscriptions.push((this._commands = new Commands()));
		context.subscriptions.push((this._codeActions = new CodeStreamCodeActionProvider()));
		context.subscriptions.push((this._diffContents = new ReviewDiffContentProvider()));
		context.subscriptions.push((this._gitContents = new GitContentProvider()));
		context.subscriptions.push((this._markerDecorations = new CodemarkDecorationProvider()));
		context.subscriptions.push(
			(this._instrumentableCodeLensController = new InstrumentableCodeLensController())
		);
		context.subscriptions.push((this._inlayHintsProvider = new CodeStreamInlayHintsProvider()));
		context.subscriptions.push(new CodemarkPatchContentProvider());
		context.subscriptions.push((this._statusBar = new StatusBarController()));

		context.subscriptions.push(
			(this._sidebar = new SidebarController(context, this._session, sidebar))
		);
		context.subscriptions.push((this._panel = new PanelController(context, this._session)));
		context.subscriptions.push(configuration.onWillChange(this.onConfigurationChanging, this));
		context.subscriptions.push(configuration.onDidChangeAny(this.onConfigurationChangeAny, this));

		// we want this to be created even before a user logs in
		// there is a non-authed codelens
		this._nrqlCodeLensController = new NrqlCodeLensController(this._session);
		this._nrqlCodeLensController.create();

		context.subscriptions.push(this._nrqlCodeLensController);
		const onDidStartDisposable = this._session.onDidChangeSessionStatus(e => {
			const status = e.getStatus();
			this._nrqlCodeLensController?.update(status);
			this._nrqlDocumentSymbolProvider?.update(status);

			if (status === SessionStatus.SignedIn) {
				// only create this once!
				// _nrqlDocumentSymbolProvider requires a working lsp agent connection
				// and we won't have that until the user auths
				if (!this._nrqlDocumentSymbolProvider && !this._nrqlDocumentSymbolProvider) {
					this._nrqlDocumentSymbolProvider = new NrqlDocumentSymbolProvider(
						this._session,
						Container._agent
					);

					context.subscriptions.push(
						languages.registerDocumentSymbolProvider(
							{ scheme: "file", language: "nrql" },
							this._nrqlDocumentSymbolProvider
						)
					);
				}
			}
		});

		context.subscriptions.push(onDidStartDisposable);

		await this._agent.start();
	}

	// these are config items that we want to know about (if they change)
	static interestedConfigurationItems = [
		{
			getValue: () => workspace.getConfiguration("workbench.sideBar").get("location") || "left",
			value: ""
		}
	];

	static setServerUrl(serverUrl: string, disableStrictSSL: boolean, environment?: string) {
		this._pendingServerUrl = serverUrl;
		this._session.setServerUrl(serverUrl, environment);
		this._agent.sendRequest(SetServerUrlRequestType, { serverUrl, disableStrictSSL, environment });
		this._agent.setServerUrl(serverUrl);
		this._statusBar.update();
	}

	private static onConfigurationChanging(e: ConfigurationWillChangeEvent) {
		this._config = undefined;

		if (configuration.changed(e.change, configuration.name("traceLevel").value)) {
			Logger.level = configuration.get<TraceLevel>(configuration.name("traceLevel").value);
		}

		const needReload = ConfigSettingsNeedingReload.find(config => {
			const configName = configuration.name(config as keyof Config).value;
			const isChanging = configuration.changed(e.change, configName);
			const changedTo = configuration.get<string>(configName);
			const changingToPendingServerUrl =
				configName === "serverUrl" && changedTo === this._pendingServerUrl;
			if (changingToPendingServerUrl) {
				delete this._pendingServerUrl;
			}
			return isChanging && !changingToPendingServerUrl;
		});
		if (needReload) {
			Logger.log(`Config value ${needReload} changed, prompting IDE reload...`);
			this._sidebar!.onConfigChangeReload();
		}
	}

	private static onConfigurationChangeAny() {
		let requiresUpdate = false;
		for (const item of Container.interestedConfigurationItems) {
			const currentValue = item.value;

			let newValue;
			try {
				newValue = item.getValue();
			} catch {}
			if (!requiresUpdate) {
				requiresUpdate = currentValue !== newValue;
			}
			item.value = newValue as any;
		}
		if (requiresUpdate) {
			void this.sidebar.layoutChanged();
		}
	}

	private static _agent: CodeStreamAgentConnection;
	static get agent() {
		return this._agent;
	}

	private static _inlayHintsProvider: CodeStreamInlayHintsProvider;
	static get inlayHintsProvider() {
		return this._inlayHintsProvider;
	}

	private static _codeActions: CodeStreamCodeActionProvider;
	static get codeActions() {
		return this._codeActions;
	}

	private static _commands: Commands;
	static get commands() {
		return this._commands;
	}

	private static _config: Config | undefined;
	static get config() {
		if (this._config === undefined) {
			this._config = configuration.get<Config>();
		}
		return this._config;
	}

	private static _diffContents: ReviewDiffContentProvider;
	static get diffContents() {
		return this._diffContents;
	}

	private static _gitContents: GitContentProvider;
	static get gitContents() {
		return this._gitContents;
	}

	private static _context: ExtensionContext;
	static get context() {
		return this._context;
	}

	private static _markerDecorations: CodemarkDecorationProvider;
	static get markerDecorations() {
		return this._markerDecorations;
	}

	private static _instrumentableCodeLensController: InstrumentableCodeLensController;
	static get instrumentableCodeLensController() {
		return this._instrumentableCodeLensController;
	}
	private static _nrqlCodeLensController: NrqlCodeLensController;
	static get nrqlCodeLensController() {
		return this._nrqlCodeLensController;
	}

	private static _nrqlDocumentSymbolProvider: NrqlDocumentSymbolProvider;
	static get nrqlDocumentSymbolProvider() {
		return this._nrqlDocumentSymbolProvider;
	}

	private static _notifications: NotificationsController;
	static get notifications() {
		return this._notifications;
	}

	private static _statusBar: StatusBarController;
	static get statusBar() {
		return this._statusBar;
	}

	private static _session: CodeStreamSession;
	static get session(): CodeStreamSession {
		return this._session;
	}

	private static _version: string;
	static get version(): string {
		return this._version;
	}

	private static _versionBuild: string;
	static get versionBuild(): string {
		return this._versionBuild;
	}

	private static _versionFormatted: string;
	static get versionFormatted(): string {
		return this._versionFormatted;
	}

	private static _sidebar: SidebarController;
	static get sidebar() {
		return this._sidebar;
	}
	private static _panel: PanelController;
	static get panel() {
		return this._panel;
	}

	private static _editor: EditorController;
	static get editor() {
		return this._editor;
	}

	private static _pendingServerUrl: string | undefined;
	static setPendingServerUrl(url: string) {
		this._pendingServerUrl = url;
	}
}

export interface TelemetryOptions {
	error?: string;
	telemetryEndpoint?: string;
	browserIngestKey?: string;
	licenseIngestKey?: string;
	accountId?: string;
	webviewAgentId?: string;
	webviewAppId?: string;
}
