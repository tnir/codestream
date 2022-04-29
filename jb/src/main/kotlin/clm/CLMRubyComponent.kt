package com.codestream.clm

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.psi.NavigatablePsiElement
import com.intellij.psi.PsiFile
import org.jetbrains.plugins.ruby.ruby.lang.psi.impl.RFileImpl
import org.jetbrains.plugins.ruby.ruby.lang.psi.impl.controlStructures.classes.RClassImpl
import org.jetbrains.plugins.ruby.ruby.lang.psi.impl.controlStructures.methods.RMethodImpl

class CLMRubyComponent(project: Project) :
    CLMLanguageComponent<CLMRubyEditorManager>(project, RFileImpl::class.java, ::CLMRubyEditorManager) {

    private val logger = Logger.getInstance(CLMRubyComponent::class.java)

    init {
        logger.info("Initializing code level metrics for Ruby")
    }
}

class CLMRubyEditorManager(editor: Editor) : CLMEditorManager(editor, "ruby", false) {

    override fun getLookupClassName(psiFile: PsiFile): String? {
        return null
    }

    override fun findClassFunctionFromFile(
        psiFile: PsiFile,
        className: String,
        functionName: String
    ): NavigatablePsiElement? {
        if (psiFile !is RFileImpl) return null
        val clazz = psiFile.structureElements.find { it is RClassImpl && it.name == className }
            ?: return null
        val rClazz = clazz as RClassImpl
        return rClazz.findMethodByName(functionName)
    }

    override fun findTopLevelFunction(psiFile: PsiFile, functionName: String): NavigatablePsiElement? {
        if (psiFile !is RFileImpl) return null
        return psiFile.structureElements.find { it is RMethodImpl && it.name == functionName }
    }
}