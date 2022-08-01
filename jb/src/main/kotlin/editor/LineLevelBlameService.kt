package com.codestream.editor

import com.codestream.agentService
import com.codestream.extensions.uri
import com.codestream.protocols.agent.GetBlameParams
import com.codestream.protocols.agent.GetBlameResultLineInfo
import com.codestream.settings.ApplicationSettingsService
import com.intellij.codeInsight.hints.presentation.InlayTextMetricsStorage
import com.intellij.codeInsight.hints.presentation.PresentationFactory
import com.intellij.codeInsight.hints.presentation.PresentationRenderer
import com.intellij.ide.plugins.PluginManager
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.event.CaretEvent
import com.intellij.openapi.editor.event.CaretListener
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.editor.event.SelectionListener
import com.intellij.openapi.editor.impl.EditorImpl
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.project.Project
import com.intellij.psi.PsiDocumentManager
import com.intellij.util.io.HttpRequests
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import java.awt.Image
import java.util.concurrent.CompletableFuture
import javax.swing.Icon
import javax.swing.ImageIcon

private val logger = Logger.getInstance(LineLevelBlameService::class.java)

class LineLevelBlameService(val project: Project) : SelectionListener {
    private val gitToolboxInstalled = PluginManager.isPluginInstalled(PluginId.getId("zielu.gittoolbox"))
    private val iconsCache = IconsCache()
    private val blameManagers = mutableMapOf<Editor, BlameManager>()

    fun add(editor: Editor) {
        if (gitToolboxInstalled) return
        if (editor !is EditorImpl) return
        blameManagers[editor] = BlameManager(editor, iconsCache)
    }

    fun remove(editor: Editor) {
        blameManagers.remove(editor)
    }

    fun resetCache() {
        blameManagers.values.forEach { it.clearCache() }
    }
}

private class BlameManager(private val editor: EditorImpl, private val iconsCache: IconsCache) : CaretListener, DocumentListener {
    private val uri = editor.document.uri
    private val agent = editor.project?.agentService
    private val settingsService = ServiceManager.getService(ApplicationSettingsService::class.java)
    private val presentationFactory = PresentationFactory(editor)
    private val csPresentationFactory = CodeStreamPresentationFactory(editor)
    private val textMetricsStorage = InlayTextMetricsStorage(editor)
    private val lineBlames = mutableMapOf<Int, GetBlameResultLineInfo>()
    private var isLoadingBlame: CompletableFuture<Unit>? = null
    private var inlay: Disposable? = null
    private var lastLine: Int = -1
    init {
        editor.caretModel.addCaretListener(this)
        editor.document.addDocumentListener(this)
    }

    private fun setInlay(line: Int, renderer: PresentationRenderer) {
        ApplicationManager.getApplication().invokeLater {
            synchronized(this) {
                inlay?.dispose()
                inlay = editor.inlayModel.addAfterLineEndElement(editor.visualLineStartOffset(line), false, renderer)
            }
        }
    }

    private suspend fun getBlame(line: Int): GetBlameResultLineInfo? {
        if (uri == null || agent == null) return null
        isLoadingBlame?.await()
        if (!lineBlames.containsKey(line)) {
            isLoadingBlame = CompletableFuture<Unit>()
            try {
                var lineStart = line
                var lineEnd = line
                if (lineBlames.containsKey(line - 1)) {
                    lineEnd = line + 10
                } else if (lineBlames.contains(line + 1)) {
                    lineStart = line - 10
                } else {
                    lineStart = line - 5
                    lineEnd = line + 5
                }
                lineStart = lineStart.coerceAtLeast(0)
                lineEnd = lineEnd.coerceAtMost(editor.document.lineCount - 1)

                val blameResult = agent.getBlame(GetBlameParams(
                    uri,
                    lineStart,
                    lineEnd
                ))
                blameResult.blame.forEachIndexed { index, lineBlame ->
                    lineBlames[index + lineStart] = lineBlame
                    iconsCache.load(lineBlame.gravatarUrl)
                }
            } catch (ex: Exception) {
                logger.warn(ex)
            } finally {
                isLoadingBlame?.complete(Unit)
            }
        }

        return lineBlames[line]
    }

    override fun caretPositionChanged(e: CaretEvent) {
        if (!settingsService.showGitBlame) {
            inlay?.dispose()
            return
        }
        if (e.newPosition.line != lastLine) {
            lastLine = e.newPosition.line
            val project = editor.project ?: return
            val psiFile = PsiDocumentManager.getInstance(project).getPsiFile(editor.document) ?: return
            GlobalScope.launch {
                try {
                    val blame = getBlame(lastLine) ?: return@launch
                    val textPresentation = presentationFactory.smallText(blame.formattedBlame)
                    val insetPresentation = presentationFactory.inset(textPresentation, 0, 0, textMetricsStorage.getFontMetrics(true).offsetFromTop(), 0)
                    val presentation = if (!blame.isUncommitted) {
                        val blameHover = BlameHover().also {
                            it.configure(project, editor, psiFile, blame, iconsCache)
                        }
                        csPresentationFactory.withTooltip(blameHover, insetPresentation)
                    } else {
                        insetPresentation
                    }
                    val renderer = PresentationRenderer(presentation)
                    setInlay(e.newPosition.line, renderer)
                } catch (ex: Exception) {
                    logger.error(ex)
                }
            }
        }
    }

    override fun documentChanged(event: DocumentEvent) {
        lineBlames.clear()
    }

    fun clearCache() {
        lineBlames.clear()
    }
}

class IconsCache {
    private val cache = mutableMapOf<String, CompletableFuture<Icon?>>()
    fun load(url: String) {
        cache.getOrPut(url) {
            val iconFuture = CompletableFuture<Icon?>()
            GlobalScope.launch {
                try {
                    val bytes: ByteArray = HttpRequests.request(url).readBytes(null)
                    val tempIcon = ImageIcon(bytes)
                    val image: Image = tempIcon.image
                    val resizedImage: Image = image.getScaledInstance(20, 20, Image.SCALE_SMOOTH)
                    iconFuture.complete(ImageIcon(resizedImage))
                } catch (e: Exception) {
                    logger.warn(e)
                    iconFuture.complete(null)
                }
            }
            iconFuture
        }
    }

    fun get(url: String): CompletableFuture<Icon?>? {
        return cache[url]
    }
}
