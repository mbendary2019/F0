/**
 * Phase 74: Auto GitHub Push - File Types
 * Types for project file snapshots and GitHub push operations
 */

/**
 * Represents a single file in a project snapshot
 */
export interface ProjectFileSnapshot {
  /** File path relative to project root (e.g. "src/app/page.tsx") */
  path: string;

  /** File content as UTF-8 string */
  content: string;

  /** Optional flag to mark binary files (for future enhancement) */
  isBinary?: boolean;
}

/**
 * Result from pushing files to GitHub
 */
export interface GitHubPushResult {
  /** GitHub repository URL */
  repoUrl: string;

  /** Branch that was pushed to */
  branch: string;

  /** SHA of the last commit created */
  commitSha: string;

  /** Optional URL to view the commit on GitHub */
  commitUrl?: string;
}

/**
 * Request body for /api/integrations/github/push
 */
export interface GitHubPushRequest {
  /** Project ID to push files from */
  projectId: string;

  /** Optional custom commit message (defaults to "chore: sync from F0") */
  commitMessage?: string;
}

/**
 * Response from /api/integrations/github/push
 */
export interface GitHubPushResponse {
  /** Success indicator */
  ok: boolean;

  /** Push result details */
  result?: GitHubPushResult;

  /** Error message if ok is false */
  error?: string;
}
