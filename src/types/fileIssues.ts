// src/types/fileIssues.ts
// =============================================================================
// Phase 154 – File Issues for Web Monaco
// Types for inline issue display in the editor
// =============================================================================
// PHASE 154 – INLINE ISSUES & INLINE ACE (WEB IDE) – LOCKED
// Any major behavioural changes require Phase >= 160.
// =============================================================================

export type IssueSeverity = 'error' | 'warning' | 'info';

export type FileIssueForEditor = {
  id: string;
  filePath: string;
  line: number;
  column?: number | null;
  endLine?: number | null;
  endColumn?: number | null;
  message: string;
  rule?: string | null;
  severity: IssueSeverity;
  source?: string | null; // e.g., 'eslint', 'typescript', 'ace'
};
