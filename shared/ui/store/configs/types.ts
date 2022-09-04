import { WebviewConfigs } from "@codestream/protocols/webview";

export interface ConfigsState extends WebviewConfigs {}

export enum ConfigsActionsType {
	Update = "UPDATE_CONFIGS",
}
