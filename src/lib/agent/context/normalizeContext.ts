/**
 * Phase 107: Context Normalization Layer
 * Phase 107.1: Selection Text Extraction
 *
 * Converts various context formats (Phase 106 legacy, Phase 107 new format)
 * into unified F0ContextFile[] format for use in code generation.
 */

import type { F0ContextFile, F0WorkspaceContext, F0Selection } from '@/types/context';
import type { F0ChatCompletionRequest } from '@/types/openaiCompat';
import type { IdeChatRequest } from '@/types/ideBridge';
import { extractSelectionFromContent, type ExtractedSelection } from './extractSelection';

/**
 * Extract file context from OpenAI-compatible request
 * Supports both legacy `files` format (Phase 106) and new `fz_context` format (Phase 107)
 */
export function buildFileContextFromOpenAIRequest(
  req: F0ChatCompletionRequest
): {
  contextFiles: F0ContextFile[];
  primaryFilePath?: string;
  workspaceContext?: F0WorkspaceContext;
} {
  // Phase 107: New context format (preferred)
  if (req.fz_context) {
    return buildFromWorkspaceContext(req.fz_context);
  }

  // Phase 106: Legacy files format (fallback)
  if (req.files && req.files.length > 0) {
    return buildFromLegacyFiles(req.files);
  }

  // No context provided
  return {
    contextFiles: [],
    primaryFilePath: undefined,
    workspaceContext: undefined,
  };
}

/**
 * Extract file context from IDE chat request
 * Handles Phase 107 contextFiles and legacy fileContext formats
 */
export function buildFileContextFromIdeChatRequest(
  req: IdeChatRequest
): {
  contextFiles: F0ContextFile[];
  primaryFilePath?: string;
} {
  // Phase 107: New contextFiles format (preferred)
  if (req.contextFiles && req.contextFiles.length > 0) {
    return {
      contextFiles: req.contextFiles,
      primaryFilePath: req.primaryFilePath,
    };
  }

  // Phase 106: Legacy fileContext format (fallback)
  if (req.fileContext && req.fileContext.length > 0) {
    const contextFiles: F0ContextFile[] = req.fileContext.map((f) => ({
      path: f.path ?? f.filePath ?? 'unknown',
      content: f.content,
      languageId: f.languageId,
      isOpen: f.isOpen,
      selection: f.selection
        ? {
            start: 0, // Legacy selection uses line/col, we use char positions
            end: 0,   // For now, just mark presence
          }
        : null,
    }));

    // Try to infer primary file from first file in context
    const primaryFilePath = req.primaryFilePath ?? contextFiles[0]?.path;

    return {
      contextFiles,
      primaryFilePath,
    };
  }

  // No context provided
  return {
    contextFiles: [],
    primaryFilePath: req.primaryFilePath,
  };
}

/**
 * Build context from Phase 107 workspace context format
 */
function buildFromWorkspaceContext(ctx: F0WorkspaceContext): {
  contextFiles: F0ContextFile[];
  primaryFilePath?: string;
  workspaceContext: F0WorkspaceContext;
} {
  const contextFiles: F0ContextFile[] = [];

  // Add current file (primary file being edited)
  if (ctx.currentFile) {
    contextFiles.push(ctx.currentFile);
  }

  // Add open files (additional context)
  if (ctx.openFiles && ctx.openFiles.length > 0) {
    contextFiles.push(...ctx.openFiles);
  }

  return {
    contextFiles,
    primaryFilePath: ctx.currentFile?.path,
    workspaceContext: ctx,
  };
}

/**
 * Build context from Phase 106 legacy files format
 */
function buildFromLegacyFiles(
  files: Array<{
    path: string;
    content: string;
    languageId?: string;
    isOpen?: boolean;
  }>
): {
  contextFiles: F0ContextFile[];
  primaryFilePath?: string;
} {
  const contextFiles: F0ContextFile[] = files.map((f) => ({
    path: f.path,
    content: f.content,
    languageId: f.languageId,
    isOpen: f.isOpen ?? false,
    selection: null,
  }));

  // Assume first file is primary (best guess)
  const primaryFilePath = contextFiles[0]?.path;

  return {
    contextFiles,
    primaryFilePath,
  };
}

/**
 * Create a minimal workspace context from file list
 * Used when we have files but no explicit workspace context
 */
export function createMinimalWorkspaceContext(
  contextFiles: F0ContextFile[],
  primaryFilePath?: string
): F0WorkspaceContext | undefined {
  if (contextFiles.length === 0) {
    return undefined;
  }

  // Find primary file
  const currentFile = primaryFilePath
    ? contextFiles.find((f) => f.path === primaryFilePath)
    : contextFiles[0];

  // Other files are open files
  const openFiles = contextFiles.filter((f) => f !== currentFile);

  return {
    currentFile,
    openFiles: openFiles.length > 0 ? openFiles : undefined,
  };
}

/**
 * Phase 107.1: Get primary file and extract selection text
 *
 * Combines file context with selection info to provide:
 * - Primary file being edited
 * - Selection info (if any)
 * - Extracted selection text (before/selected/after)
 */
export function getPrimaryFileAndSelection(
  contextFiles: F0ContextFile[],
  primaryFilePath?: string,
  selection?: F0Selection
): {
  primaryFile?: F0ContextFile;
  selection?: F0Selection;
  extracted?: ExtractedSelection;
} {
  if (!contextFiles || contextFiles.length === 0) {
    return {
      primaryFile: undefined,
      selection: undefined,
      extracted: undefined,
    };
  }

  // Find primary file (prioritize primaryFilePath, then file with selection, then first file)
  const primaryFile =
    (primaryFilePath && contextFiles.find((f) => f.path === primaryFilePath)) ||
    (selection && contextFiles.find((f) => f.selection)) ||
    contextFiles[0];

  // Use selection from file if not provided as parameter
  const actualSelection = selection || primaryFile?.selection || undefined;

  // Extract selection text if we have both file and selection
  if (!actualSelection || !primaryFile) {
    return {
      primaryFile,
      selection: actualSelection,
      extracted: undefined,
    };
  }

  const extracted = extractSelectionFromContent(primaryFile.content, actualSelection);

  return {
    primaryFile,
    selection: actualSelection,
    extracted,
  };
}

/**
 * Phase 107.2: Mark files as editable for multi-file refactoring
 *
 * Logic:
 * 1. Primary file is always editable
 * 2. Open files up to maxEditable limit are editable
 * 3. Other files are context-only (read-only)
 *
 * This prevents the agent from modifying too many files and losing focus.
 */
export function markEditableFiles(
  files: F0ContextFile[],
  primaryFilePath?: string,
  maxEditable: number = 3
): F0ContextFile[] {
  if (!files || files.length === 0) return [];

  // Clone files to avoid mutation
  const cloned = files.map((f) => ({ ...f, allowEdit: false }));

  // 1) Primary file is always editable
  const primaryIndex = primaryFilePath
    ? cloned.findIndex((f) => f.path === primaryFilePath)
    : cloned.findIndex((f) => f.selection); // Or file with selection

  if (primaryIndex >= 0) {
    cloned[primaryIndex].allowEdit = true;
  }

  // 2) Allow additional open files up to maxEditable limit
  let editableCount = cloned.filter((f) => f.allowEdit).length;

  for (const f of cloned) {
    if (editableCount >= maxEditable) break;
    if (!f.allowEdit && f.isOpen) {
      f.allowEdit = true;
      editableCount++;
    }
  }

  return cloned;
}
