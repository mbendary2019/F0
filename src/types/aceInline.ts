// src/types/aceInline.ts
// =============================================================================
// Phase 153.1 + 153.2 – Inline ACE Types
// Shared types for Ask ACE inline functionality
// =============================================================================

import type { SelectedRangeInfo } from '@/hooks/useSelectedRange';

/**
 * Context passed when user clicks "Ask ACE" inline button
 */
export type InlineAceRequestContext = {
  /** Current selection/cursor info */
  selectedRange: SelectedRangeInfo | null;
  /** Full file content */
  fullContent: string;
  /** File language (e.g., 'typescript', 'javascript') */
  language: string;
  /** File path (optional) */
  filePath?: string | null;
};

// =============================================================================
// Phase 153.2 – Request/Response Types
// =============================================================================

/**
 * Payload sent to the backend /api/ace/inline
 */
export type AceInlineRequest = {
  filePath?: string | null;
  language: string;
  fullContent: string;
  selectedText: string | null;
  cursorLine: number | null;
  cursorColumn: number | null;
  selectionStartLine: number | null;
  selectionEndLine: number | null;
};

/**
 * A single patch returned by ACE
 */
export type AceInlinePatch = {
  id: string;
  title?: string;
  explanation?: string;
  beforeRange: {
    startLine: number;
    endLine: number;
  };
  afterText: string;
};

/**
 * Response from ACE inline API
 */
export type AceInlineResponse = {
  patch?: AceInlinePatch | null;
  message?: string;
  raw?: unknown;
};

export default InlineAceRequestContext;
