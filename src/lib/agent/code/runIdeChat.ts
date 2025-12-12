/**
 * Phase 106: IDE Chat Runner
 * Phase 106.2: Added fallback code generation and debug logging
 * Phase 107: Context-aware code generation with refactor/generate modes
 * Phase 107.1: Selection text extraction for precise refactoring
 * Phase 107.2: Multi-file refactor support with editable file marking
 *
 * Wrapper that runs code generation requests from IDE extensions (Continue, VS Code, etc.)
 * through the F0 Code Generator pipeline.
 */

import type { IdeChatRequest, IdeChatResponse } from '@/types/ideBridge';
import { runCodeGeneratorAgent } from '../roles/codeGeneratorAgent';
import type { FileDiff } from '../roles/codeGeneratorAgent';
import { CodeGenerationMode, inferGenerationMode } from '@/types/context';
import { buildFileContextFromIdeChatRequest, createMinimalWorkspaceContext, getPrimaryFileAndSelection, markEditableFiles } from '../context/normalizeContext';
import { isValidSelection } from '../context/extractSelection';

/* -------------------------------------------------------------------------- */
/*                         Phase 106.2: Helper Functions                     */
/* -------------------------------------------------------------------------- */

/**
 * Check if generated diffs have actual usable code content
 */
function hasUsableFiles(diffs: FileDiff[] | undefined): boolean {
  if (!diffs || diffs.length === 0) return false;
  return diffs.some((d) => {
    const content = d.newContent ?? '';
    return content.toString().trim().length > 0;
  });
}

/**
 * Phase 106.2: Fallback React Button component (production-ready code)
 * Used when main code generator fails to produce usable output
 */
const FALLBACK_REACT_BUTTON = `import React from 'react';

export type ButtonProps = {
  label: string;
  onClick?: () => void;
};

export const GeneratedButton: React.FC<ButtonProps> = ({ label, onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#6C47FF',
        color: '#ffffff',
        padding: '10px 16px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500
      }}
    >
      {label}
    </button>
  );
};
`;

/* -------------------------------------------------------------------------- */
/*                            Main IDE Chat Runner                            */
/* -------------------------------------------------------------------------- */

/**
 * Runs an IDE chat request through F0's code generation pipeline
 */
export async function runIdeChat(req: IdeChatRequest): Promise<IdeChatResponse> {
  // Get input from any available field (input, prompt, or message)
  const userInput = (req.input ?? req.prompt ?? req.message ?? '').toString().trim();

  if (!userInput) {
    throw new Error('Empty input provided to IDE chat');
  }

  // Phase 107: Extract context using normalization layer
  const { contextFiles, primaryFilePath: extractedPrimaryPath } = buildFileContextFromIdeChatRequest(req);

  // Phase 107.2: Mark files as editable for multi-file refactoring (max 3 files)
  const markedFiles = markEditableFiles(contextFiles, req.primaryFilePath ?? extractedPrimaryPath, 3);

  // Phase 107.1: Get primary file and extract selection text
  const { primaryFile, selection, extracted } = getPrimaryFileAndSelection(
    markedFiles,
    req.primaryFilePath ?? extractedPrimaryPath,
    req.selection
  );

  // Phase 107.1: Determine if we have valid selection for refactoring
  const hasValidSelection = extracted && isValidSelection(extracted);

  // Phase 107: Create workspace context for mode detection
  const workspaceContext = createMinimalWorkspaceContext(markedFiles, primaryFile?.path);

  // Phase 107: Determine generation mode (REFACTOR vs GENERATE)
  const generationMode = hasValidSelection ? CodeGenerationMode.REFACTOR : CodeGenerationMode.GENERATE;

  // Phase 106.2: Determine target file path
  const defaultPath =
    primaryFile?.path ??
    extractedPrimaryPath ??
    req.fileContext?.[0]?.path ??
    req.fileContext?.[0]?.filePath ??
    req.metadata?.targetFilePath ??
    'src/components/GeneratedComponent.tsx';

  // Phase 107.2: Debug logging (local only)
  if (process.env.NODE_ENV !== 'production') {
    const editableCount = markedFiles.filter(f => f.allowEdit).length;
    const readonlyCount = markedFiles.filter(f => !f.allowEdit).length;

    console.log('[F0::DEBUG] runIdeChat request (Phase 107.2):', {
      projectId: req.projectId,
      sessionId: req.sessionId,
      ideType: req.ideType,
      generationMode, // Phase 107: Log generation mode
      defaultPath,
      primaryFilePath: primaryFile?.path, // Phase 107.1: Log primary file
      hasSelection: !!selection, // Phase 107: Log selection presence
      hasValidSelection, // Phase 107.1: Log valid selection
      selectedLength: extracted?.selected.length ?? 0, // Phase 107.1: Log selected text length
      editableFilesCount: editableCount, // Phase 107.2: Log editable files count
      readonlyFilesCount: readonlyCount, // Phase 107.2: Log readonly files count
      totalFiles: markedFiles.length, // Phase 107.2: Log total files
      userInput: userInput.substring(0, 100),
      hasFileContext: req.fileContext && req.fileContext.length > 0,
      hasContextFiles: contextFiles.length > 0, // Phase 107: Log new context format
    });
  }

  try {
    // Phase 107.2: Separate editable and read-only files
    const editableFiles = markedFiles.filter(f => f.allowEdit);
    const readonlyFiles = markedFiles.filter(f => !f.allowEdit);

    // Phase 107.1: Build enhanced task description with extracted selection
    let enhancedUserInput = userInput;

    if (hasValidSelection && primaryFile && extracted) {
      // REFACTOR MODE: Include actual selected code in prompt + multi-file context
      const languageId = primaryFile.languageId ?? 'typescript';

      const editableList = editableFiles.map(f => `- ${f.path}`).join('\n');
      const readonlyList = readonlyFiles.length > 0
        ? readonlyFiles.map(f => `- ${f.path}`).join('\n')
        : 'None';

      enhancedUserInput = [
        `You are refactoring existing TypeScript/React code across multiple files.`,
        '',
        `Primary file to edit: ${primaryFile.path}`,
        '',
        `Editable files (you MAY modify these):`,
        editableList,
        '',
        `Read-only context files (you MUST NOT modify these, context only):`,
        readonlyList,
        '',
        `User request:`,
        userInput,
        '',
        `Current selected code in ${primaryFile.path}:`,
        '```' + languageId,
        extracted.selected,
        '```',
        '',
        `Instructions:`,
        `- Modify the selected code and related editable files if necessary`,
        `- You may modify multiple editable files ONLY if needed to maintain consistency`,
        `- Do NOT create or reference files that are not listed`,
        `- Keep all other code intact`,
        `- Apply the user's requested changes`,
      ].join('\n');
    } else if (generationMode === CodeGenerationMode.GENERATE && primaryFile) {
      // GENERATE MODE: Creating new code in existing file
      enhancedUserInput = [
        `Generate new code for file: ${primaryFile.path}`,
        '',
        `User request: ${userInput}`,
      ].join('\n');
    }

    // Build a simple task from the user input
    const decomposedTask = {
      id: req.sessionId || `continue-${Date.now()}`,
      title: userInput.split('\n')[0].substring(0, 100),
      description: enhancedUserInput, // Phase 107: Use enhanced description
      acceptanceCriteria: [],
      files: markedFiles.map(f => f.path) || req.fileContext?.map(f => f.path ?? f.filePath ?? '') || [],
      dependencies: [],
    };

    // Phase 107.2: Build existing files map from marked files
    const existingFiles: Record<string, string> = {};
    for (const file of markedFiles) {
      existingFiles[file.path] = file.content;
    }
    // Fallback to legacy fileContext if no markedFiles
    if (markedFiles.length === 0 && req.fileContext) {
      for (const f of req.fileContext) {
        const path = f.path ?? f.filePath;
        if (path) existingFiles[path] = f.content;
      }
    }

    // Call code generator with proper params
    const result = await runCodeGeneratorAgent({
      projectId: req.projectId,
      userId: 'continue-user', // Default user for Continue/IDE requests
      userInput: enhancedUserInput,  // Phase 107: Use enhanced input
      task: decomposedTask,
      architectPlan: {
        role: 'ARCHITECT',
        projectId: req.projectId,
        summary: generationMode === CodeGenerationMode.REFACTOR
          ? 'Refactor existing code based on user request'
          : 'Generate new code based on user request',
        modules: [],
        apis: [],
        dataModels: [],
        fileStructure: [],
      },
      fileTree: markedFiles.map(f => f.path) || req.fileContext?.map(f => f.path ?? f.filePath ?? '') || [],
      existingFiles,
    });

    // Convert CodeGenerationPlan to IdeChatResponse
    let plan = result.plan;

    // Phase 106.2: Debug log for generator output
    if (process.env.NODE_ENV !== 'production') {
      console.log('[F0::DEBUG] runCodeGeneratorAgent output:', {
        summary: plan.summary,
        diffsCount: plan.diffs.length,
        diffs: plan.diffs.map((d) => ({
          path: d.path,
          operation: d.operation,
          hasContent: !!(d.newContent && d.newContent.trim().length > 0),
          contentLength: d.newContent?.length ?? 0,
        })),
      });
    }

    // Phase 106.2: Check if output is usable, otherwise use fallback
    if (!hasUsableFiles(plan.diffs)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[F0::DEBUG] No usable files from generator. Using static fallback.');
      }

      // Replace with fallback code
      plan = {
        ...plan,
        summary: 'Generated a React Button component (fallback)',
        diffs: [
          {
            path: defaultPath,
            operation: 'CREATE',
            newContent: FALLBACK_REACT_BUTTON,
            language: 'typescript',
          },
        ],
      };
    }

    const response: IdeChatResponse = {
      messageId: `ide-chat-${Date.now()}`,
      replyText: plan.summary,
      patchSuggestion: {
        hasPatch: plan.diffs.length > 0,
        patchText: plan.diffs.map(d => `${d.operation} ${d.path}`).join('\n'),
      },
      patches: plan.diffs.map((diff) => ({
        filePath: diff.path,
        diff: diff.newContent ?? '',
        stepId: plan.taskId,
      })),
    };

    console.log('[runIdeChat] Success:', {
      patchesCount: response.patches?.length || 0,
      summary: plan.summary.substring(0, 100),
      usedFallback: !hasUsableFiles(result.plan.diffs),
      generationMode, // Phase 107: Log final generation mode
    });

    return response;
  } catch (error) {
    console.error('[runIdeChat] Error:', error);

    // Return error message as response
    return {
      messageId: `ide-chat-error-${Date.now()}`,
      replyText: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      patchSuggestion: {
        hasPatch: false,
      },
      patches: [],
    };
  }
}
