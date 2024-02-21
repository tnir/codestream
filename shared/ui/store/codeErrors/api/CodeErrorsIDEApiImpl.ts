import {
	EditorCopySymbolRequest,
	EditorCopySymbolResponse,
	EditorCopySymbolType,
	EditorReplaceSymbolRequest,
	EditorReplaceSymbolResponse,
	EditorReplaceSymbolType,
	EditorRevealRangeRequest,
	EditorRevealRangeRequestType,
	EditorRevealRangeResponse,
} from "@codestream/protocols/webview";
import { CodeErrorsIDEApi } from "@codestream/webview/store/codeErrors/api/CodeErrorsIDEApi";
import { HostApi } from "@codestream/webview/webview-api";

export class CodeErrorsIDEApiImpl implements CodeErrorsIDEApi {
	async editorCopySymbol(request: EditorCopySymbolRequest): Promise<EditorCopySymbolResponse> {
		return HostApi.instance.send(EditorCopySymbolType, request);
	}

	async editorReplaceSymbol(
		request: EditorReplaceSymbolRequest
	): Promise<EditorReplaceSymbolResponse> {
		return HostApi.instance.send(EditorReplaceSymbolType, request);
	}

	async editorRevealRange(request: EditorRevealRangeRequest): Promise<EditorRevealRangeResponse> {
		return HostApi.instance.send(EditorRevealRangeRequestType, request);
	}
}