/**
 * Phase 109.5: Editor Selection Types
 *
 * Represents user's text selection in the code editor
 * Used for selection-aware refactoring with F0 Agent
 */

export type EditorSelection = {
  /** Path to the file containing the selection */
  filePath: string;

  /** Start position in file content (0-based, inclusive) */
  startOffset: number;

  /** End position in file content (0-based, exclusive) */
  endOffset: number;

  /** The actual selected text */
  selectedText: string;
};

/**
 * FZ Context Selection - sent to backend
 * Matches the structure expected by Phase 107.1
 */
export type FzContextSelection = {
  path: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
};
