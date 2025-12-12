/**
 * Phase 107.1: Selection Text Extraction
 *
 * Utilities for extracting selected code from file content
 * for precise refactoring operations.
 */

import type { F0Selection } from '@/types/context';

/**
 * Extracted selection with surrounding context
 */
export interface ExtractedSelection {
  /** Text before the selection */
  before: string;
  /** The selected text */
  selected: string;
  /** Text after the selection */
  after: string;
}

/**
 * Safely extract before/selected/after from file content using selection indexes.
 *
 * @param content - Full file content
 * @param selection - Selection with start/end character positions
 * @returns Extracted selection with before/selected/after parts
 *
 * @example
 * ```typescript
 * const content = "function add(a, b) { return a + b; }";
 * const selection = { start: 0, end: 22 };
 * const { before, selected, after } = extractSelectionFromContent(content, selection);
 * // before: ""
 * // selected: "function add(a, b) { "
 * // after: "return a + b; }"
 * ```
 */
export function extractSelectionFromContent(
  content: string,
  selection: F0Selection
): ExtractedSelection {
  // Safely clamp selection bounds to content length
  const safeStart = Math.max(0, Math.min(selection.start, content.length));
  const safeEnd = Math.max(safeStart, Math.min(selection.end, content.length));

  const before = content.slice(0, safeStart);
  const selected = content.slice(safeStart, safeEnd);
  const after = content.slice(safeEnd);

  return { before, selected, after };
}

/**
 * Check if a selection is meaningful (non-empty and has actual content)
 */
export function isValidSelection(extracted: ExtractedSelection): boolean {
  return extracted.selected.trim().length > 0;
}

/**
 * Get line number information for a selection
 * Useful for error messages and debugging
 */
export function getSelectionLineInfo(
  content: string,
  selection: F0Selection
): {
  startLine: number;
  endLine: number;
  totalLines: number;
} {
  const lines = content.split('\n');
  let charCount = 0;
  let startLine = 1;
  let endLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline

    if (charCount <= selection.start && selection.start < charCount + lineLength) {
      startLine = i + 1;
    }

    if (charCount <= selection.end && selection.end < charCount + lineLength) {
      endLine = i + 1;
      break;
    }

    charCount += lineLength;
  }

  return {
    startLine,
    endLine,
    totalLines: lines.length,
  };
}
