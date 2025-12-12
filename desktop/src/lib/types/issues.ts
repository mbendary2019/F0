// desktop/src/lib/types/issues.ts
// Phase 124.6: Code Review Issues Types

export type IssueSeverity = 'info' | 'warning' | 'error';
export type IssueCategory = 'logic' | 'security' | 'performance' | 'style' | 'best-practice';

/**
 * A single code issue identified by the AI reviewer
 */
export interface F0Issue {
  /** Unique ID: "f0-issue-{random}" */
  id: string;
  /** Severity level */
  severity: IssueSeverity;
  /** Category of the issue */
  category: IssueCategory;
  /** Human-readable description */
  message: string;
  /** File path (relative to project root) */
  file: string;
  /** Start line (1-based) */
  lineStart: number;
  /** End line (1-based, inclusive) */
  lineEnd: number;
  /** Optional: prompt to send to agent for fixing */
  fixPrompt?: string;
  /** Optional: suggested fix code snippet */
  suggestedFix?: string | null;
}

/**
 * Code review request payload
 */
export interface CodeReviewRequest {
  /** File path being reviewed */
  filePath: string;
  /** Previous content (for diff-based review) */
  before?: string | null;
  /** Current content to review */
  after: string;
  /** Project root path */
  projectRoot?: string;
}

/**
 * Code review response from the agent
 */
export interface CodeReviewResponse {
  /** Whether the review completed successfully */
  success: boolean;
  /** List of issues found */
  issues: F0Issue[];
  /** Summary of the review */
  summary?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Generate a unique issue ID
 */
export function generateIssueId(): string {
  return `f0-issue-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get color class for severity
 */
export function getSeverityColor(severity: IssueSeverity): string {
  switch (severity) {
    case 'error':
      return 'f0-severity-error';
    case 'warning':
      return 'f0-severity-warning';
    case 'info':
    default:
      return 'f0-severity-info';
  }
}

/**
 * Get icon for severity
 */
export function getSeverityIcon(severity: IssueSeverity): string {
  switch (severity) {
    case 'error':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'info':
    default:
      return '🔵';
  }
}

/**
 * Get icon for category
 */
export function getCategoryIcon(category: IssueCategory): string {
  switch (category) {
    case 'security':
      return '🔒';
    case 'performance':
      return '⚡';
    case 'logic':
      return '🧠';
    case 'style':
      return '🎨';
    case 'best-practice':
      return '✨';
    default:
      return '📋';
  }
}
