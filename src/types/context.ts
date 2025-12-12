/**
 * Phase 107: Context-Aware Code Generation
 *
 * Types for handling workspace context from Continue.dev and other IDEs.
 * Supports both refactoring existing code and generating new code.
 */

/**
 * Text selection within a file (character positions)
 */
export type F0Selection = {
  /** Start position (character offset) */
  start: number;
  /** End position (character offset) */
  end: number;
  /** Selected text content (optional, can be inferred from content + positions) */
  text?: string;
};

/**
 * File context from IDE (open file, current file, or reference file)
 */
export type F0ContextFile = {
  /** Absolute or relative file path */
  path: string;
  /** Full file content */
  content: string;
  /** Programming language ID (e.g., "typescript", "javascript", "python") */
  languageId?: string;
  /** Whether this file is currently open in the IDE */
  isOpen?: boolean;
  /** Active selection within this file (if any) */
  selection?: F0Selection | null;
  /** Phase 107.2: Whether the agent is allowed to modify this file in multi-file refactor */
  allowEdit?: boolean;
};

/**
 * Complete workspace context from IDE
 * Used to distinguish between refactoring and generation modes
 */
export type F0WorkspaceContext = {
  /**
   * The primary file being edited/focused
   * If this has a selection, we're in REFACTOR mode
   * If no selection, we're in GENERATION mode (create new code in this file)
   */
  currentFile?: F0ContextFile;

  /**
   * Additional open files for context
   * Helps LLM understand project structure and dependencies
   */
  openFiles?: F0ContextFile[];

  /**
   * Workspace root path (optional)
   * Used for resolving relative paths
   */
  workspaceRoot?: string;

  /**
   * Project type hint (optional)
   * e.g., "nextjs", "react", "node", "python"
   */
  projectType?: string;
};

/**
 * Code generation mode based on context
 */
export enum CodeGenerationMode {
  /** User has selected code → refactor/modify existing code */
  REFACTOR = 'REFACTOR',

  /** No selection → generate new code */
  GENERATE = 'GENERATE',

  /** Fallback when context is unclear */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Helper to determine generation mode from workspace context
 */
export function inferGenerationMode(context?: F0WorkspaceContext): CodeGenerationMode {
  if (!context || !context.currentFile) {
    return CodeGenerationMode.UNKNOWN;
  }

  const { currentFile } = context;

  // If there's a selection with meaningful range, it's refactor mode
  if (
    currentFile.selection &&
    currentFile.selection.start < currentFile.selection.end
  ) {
    return CodeGenerationMode.REFACTOR;
  }

  // Otherwise, it's generation mode (create new code)
  return CodeGenerationMode.GENERATE;
}

/**
 * Extract selected text from file content and selection
 */
export function extractSelectionText(
  content: string,
  selection: F0Selection
): string {
  if (selection.text) {
    return selection.text;
  }
  return content.substring(selection.start, selection.end);
}
