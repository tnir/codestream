package com.codestream.actions

import com.codestream.codeStream
import com.codestream.editorService
import com.codestream.extensions.inlineTextFieldManager
import com.codestream.extensions.selectionOrCurrentLine
import com.codestream.extensions.uri
import com.codestream.protocols.CodemarkType
import com.codestream.protocols.webview.CodemarkNotifications
import com.codestream.webViewService
import com.intellij.codeInsight.intention.IntentionAction
import com.intellij.codeInsight.intention.LowPriorityAction
import com.intellij.openapi.actionSystem.ActionPlaces
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.Iconable
import com.intellij.psi.PsiFile
import java.awt.event.KeyEvent

abstract class NewCodemark(val name: String, val type: CodemarkType) : AnAction(name), IntentionAction, LowPriorityAction, Iconable {

    override fun getText(): String = name

    var telemetrySource: String? = null

    private fun execute(project: Project, source: String) {
        project.editorService?.activeEditor?.run {
            if (!this.selectionModel.hasSelection()) {
                val startOffset = this.document.getLineStartOffset(selectionOrCurrentLine.start.line)
                val endOffset = this.document.getLineEndOffset(selectionOrCurrentLine.start.line)
                this.selectionModel.setSelection(startOffset, endOffset)
            }
            this.inlineTextFieldManager?.showTextField(false)
                ?: project.codeStream?.show {
                    project.webViewService?.postNotification(
                        CodemarkNotifications.New(
                            document.uri,
                            selectionOrCurrentLine,
                            type,
                            telemetrySource ?: source
                        )
                    )
                }
        }
    }

    override fun actionPerformed(e: AnActionEvent) {
        val source = when {
            ActionPlaces.isPopupPlace(e.place) -> "Context Menu"
            e.inputEvent is KeyEvent -> "Shortcut"
            else -> "Action List"
        }
        e.project?.let { execute(it, source) }
    }

    override fun invoke(project: Project, editor: Editor?, file: PsiFile?) {
        execute(project, "Lightbulb Menu")
    }

    override fun startInWriteAction() = true

    override fun getFamilyName() = "CodeStream"

    override fun isAvailable(project: Project, editor: Editor?, file: PsiFile?) = true
}

class AddComment : NewCodemark("Add comment", CodemarkType.COMMENT) {
    override fun getIcon(flags: Int) = IconLoader.getIcon("/images/marker-comment.svg")
}

class CreateIssue : NewCodemark("Create issue", CodemarkType.ISSUE) {
    override fun getIcon(flags: Int) = IconLoader.getIcon("/images/marker-issue.svg")

    override fun update(e: AnActionEvent) {
        val virtualFile = CommonDataKeys.VIRTUAL_FILE.getData(e.dataContext)
        e.presentation.isVisible = virtualFile?.isInLocalFileSystem == true
    }
}

class GetPermalink : NewCodemark("Get permalink", CodemarkType.LINK) {
    override fun getIcon(flags: Int) = IconLoader.getIcon("/images/marker-permalink.svg")

    override fun update(e: AnActionEvent) {
        val virtualFile = CommonDataKeys.VIRTUAL_FILE.getData(e.dataContext)
        e.presentation.isVisible = virtualFile?.isInLocalFileSystem == true
    }
}
