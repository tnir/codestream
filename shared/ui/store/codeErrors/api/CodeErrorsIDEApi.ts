import {
	EditorCopySymbolRequest,
	EditorCopySymbolResponse,
	EditorReplaceSymbolRequest,
	EditorReplaceSymbolResponse,
	EditorRevealRangeRequest,
	EditorRevealRangeResponse,
} from "@codestream/protocols/webview";

export interface CodeErrorsIDEApi {
	editorCopySymbol(request: EditorCopySymbolRequest): Promise<EditorCopySymbolResponse>;

	editorRevealRange(request: EditorRevealRangeRequest): Promise<EditorRevealRangeResponse>;

	editorReplaceSymbol(request: EditorReplaceSymbolRequest): Promise<EditorReplaceSymbolResponse>;
}