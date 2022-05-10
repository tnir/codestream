package com.codestream.editor

import com.codestream.extensions.file
import com.codestream.review.ReviewDiffVirtualFile
import com.codestream.settings.ApplicationSettingsService
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.event.EditorMouseEvent
import com.intellij.openapi.editor.event.EditorMouseEventArea
import com.intellij.openapi.editor.event.EditorMouseMotionListener
import com.intellij.openapi.editor.event.SelectionEvent
import com.intellij.openapi.editor.event.SelectionListener
import com.intellij.openapi.editor.ex.EditorEx
import com.intellij.openapi.editor.ex.MarkupModelEx
import com.intellij.openapi.editor.markup.GutterIconRenderer
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.util.Processor
import kotlin.math.min

class NewCodemarkGutterIconManager(val editor: Editor) : EditorMouseMotionListener, SelectionListener {

    val settingsService = ServiceManager.getService(ApplicationSettingsService::class.java)
    private val isCSDiff = editor.document.file is ReviewDiffVirtualFile

    init {
        editor.selectionModel.addSelectionListener(this)
        val appSettings = ServiceManager.getService(ApplicationSettingsService::class.java)
        editor.addEditorMouseMotionListener(this)
        if (isCSDiff && appSettings.showNewCodemarkGutterIconOnHover) {
            (editor as EditorEx).gutterComponentEx.setInitialIconAreaWidth(20)
        }
    }

    private var lastHighlightedLine: Int? = null
    private val lineHighlighters = mutableMapOf<Int, RangeHighlighter>()
    private var isDragging = false
    private val renderer = NewCodemarkGutterIconRenderer(
        editor,
        1,
        { disableCurrentRenderer() },
        { isDragging = true },
        { isDragging = false })

    override fun mouseMoved(e: EditorMouseEvent) {
        if (e.area == EditorMouseEventArea.LINE_MARKERS_AREA) {
            val line = editor.xyToLogicalPosition(e.mouseEvent.point).line
            if (line != lastHighlightedLine && !editor.selectionModel.hasSelection() && line < editor.document.lineCount) {
                disableCurrentRenderer()
                if (isCSDiff && settingsService.state.showNewCodemarkGutterIconOnHover) enableRenderer(line)
            }
        } else if (!editor.selectionModel.hasSelection()) {
            disableCurrentRenderer()
        }
    }

    override fun selectionChanged(e: SelectionEvent) {
        if (isDragging) return

        disableCurrentRenderer()
        if (!e.newRange.isEmpty) {
            val offset = min(e.newRange.startOffset, e.newRange.endOffset)
            val line = editor.document.getLineNumber(offset)
            enableRenderer(line)
        }
    }

    private fun disableCurrentRenderer() {
            lastHighlightedLine?.let {
                lineHighlighters[it]?.updateRenderer(null)
            lastHighlightedLine = null
        }
    }

    private val highlighterProcessor = CodeStreamHighlighterProcessor()

    private fun enableRenderer(line: Int) {
        val startOffset = editor.document.getLineStartOffset(line)
        val endOffset = editor.document.getLineEndOffset(line)
        highlighterProcessor.startOffset = startOffset
        highlighterProcessor.endOffset = endOffset
        val canAddHighlighter = (editor.markupModel as? MarkupModelEx)?.processRangeHighlightersOverlappingWith(
            startOffset, endOffset, highlighterProcessor
        ) ?: false
        if (!canAddHighlighter) return

        lineHighlighters.getOrPut(line) {
            editor.markupModel.addLineHighlighter(line, HighlighterLayer.LAST, null)
        }.updateRenderer(renderer.also { it.line = line })
        lastHighlightedLine = line
    }

    private fun RangeHighlighter.updateRenderer(renderer: GutterIconRenderer?) {
        try {
            this.gutterIconRenderer = renderer
        } catch (ex: Exception) {
            // ignore
        }
    }
}

class CodeStreamHighlighterProcessor : Processor<RangeHighlighter> {
    var startOffset: Int = 0
    var endOffset: Int = 0

    override fun process(highlighter: RangeHighlighter?): Boolean {
        return highlighter?.let {
            val minOffset = min(it.startOffset, it.endOffset)
            it.getUserData(CODESTREAM_HIGHLIGHTER) != true || minOffset < startOffset || minOffset > endOffset
        } ?: true
    }
}
