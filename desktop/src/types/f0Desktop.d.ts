/**
 * Phase 109.4.0: File System Bridge Types
 * Phase 111.1: Local Runner Bridge Types
 * Phase 112: Runner Context for Agent
 * Phase 120: Project Indexer Types
 * Phase 121: SEARCH_PROJECT_INDEX Tool Types
 * TypeScript declarations for Electron IPC APIs exposed to renderer
 */

import type { ProjectIndex, ProjectSearchResult, ProjectSearchType } from '../../indexer/types';

export type FileNode = {
  type: 'dir' | 'file';
  name: string;
  path: string;
  children?: FileNode[];
};

export type OpenFolderResult = {
  root: string;
  tree: FileNode[];
} | null;

// Phase 111.1: Runner types
export type RunnerLogPayload = {
  id: string;
  stream: 'stdout' | 'stderr';
  chunk: string;
};

export type RunnerStartPayload = {
  id: string;
  pid?: number;
};

export type RunnerEndPayload = {
  id: string;
  exitCode: number;
};

export type RunnerErrorPayload = {
  id: string;
  message: string;
};

declare global {
  interface Window {
    /**
     * F0 Desktop IDE File System API
     * Exposed by Electron preload script
     */
    f0Desktop?: {
      /**
       * Open folder dialog and scan project structure
       * @returns Project root path and file tree, or null if canceled
       */
      openFolder: () => Promise<OpenFolderResult>;

      /**
       * Read file content
       * @param filePath - Absolute path to file
       * @returns File content as UTF-8 string
       */
      readFile: (filePath: string) => Promise<string>;

      /**
       * Write file content
       * @param filePath - Absolute path to file
       * @param content - File content as UTF-8 string
       * @returns true if successful
       */
      writeFile: (filePath: string, content: string) => Promise<boolean>;

      // ============================================
      // Phase 111.1: Local Runner APIs
      // ============================================

      /**
       * Run a command in a project directory
       * @param id - Unique run ID
       * @param projectPath - Project root path
       * @param command - Command to run (e.g., "pnpm dev")
       */
      runCommand: (id: string, projectPath: string, command: string) => void;

      /**
       * Kill a running process
       * @param id - Run ID to kill
       */
      killRunner: (id: string) => void;

      /**
       * Get list of allowed commands
       * @returns Array of allowed command strings
       */
      getAllowedCommands: () => Promise<string[]>;

      /**
       * Subscribe to runner start events
       */
      onRunnerStart: (callback: (payload: RunnerStartPayload) => void) => () => void;

      /**
       * Subscribe to runner log events
       */
      onRunnerLog: (callback: (payload: RunnerLogPayload) => void) => () => void;

      /**
       * Subscribe to runner end events
       */
      onRunnerEnd: (callback: (payload: RunnerEndPayload) => void) => () => void;

      /**
       * Subscribe to runner error events
       */
      onRunnerError: (callback: (payload: RunnerErrorPayload) => void) => () => void;

      // ============================================
      // Phase 112: Runner Context for Agent
      // ============================================

      /**
       * Get formatted runner context for Agent
       * @param lineLimit - Max lines to include (default: 100)
       * @returns Formatted string with recent runner outputs
       */
      getRunnerContext: (lineLimit?: number) => Promise<string>;

      /**
       * Clear runner context history
       */
      clearRunnerContext: () => Promise<boolean>;

      // ============================================
      // Phase 115.4: Shell APIs
      // ============================================

      /**
       * Open URL in external browser
       */
      openExternal: (url: string) => void;

      // ============================================
      // Phase 124.3.1: Open File in Editor
      // ============================================

      /**
       * Open a file in the editor
       * @param filePath - Absolute or relative path to file
       * @param projectRoot - Project root (for relative paths)
       */
      openFileInEditor: (filePath: string, projectRoot?: string) => void;

      /**
       * Subscribe to file open requests (for editor integration)
       */
      onOpenFile: (callback: (payload: { filePath: string; projectRoot?: string }) => void) => () => void;

      // ============================================
      // Phase 120: Project Indexer APIs
      // ============================================

      /**
       * Set the current project root for indexing
       */
      setProjectRoot: (projectRoot: string) => Promise<boolean>;

      /**
       * Scan and index the project
       */
      scanProject: (projectRoot?: string) => Promise<ProjectIndex>;

      /**
       * Get existing project index from disk
       */
      getProjectIndex: (projectRoot?: string) => Promise<ProjectIndex | null>;

      // ============================================
      // Phase 121: SEARCH_PROJECT_INDEX Tool for Agent
      // ============================================

      /**
       * Search project index for files, symbols, exports, or text
       */
      searchProjectIndex: (
        query: string,
        type?: ProjectSearchType,
        limit?: number,
        projectRoot?: string
      ) => Promise<ProjectSearchResult[]>;

      // ============================================
      // Phase 124.6: Code Review APIs
      // ============================================

      /**
       * Run AI-powered code review on a file
       * @param input - Code review request with filePath, before, after, projectRoot
       */
      codeReview: (input: {
        filePath: string;
        before?: string | null;
        after: string;
        projectRoot?: string;
      }) => Promise<{
        success: boolean;
        issues: Array<{
          id: string;
          severity: 'info' | 'warning' | 'error';
          category: 'logic' | 'security' | 'performance' | 'style' | 'best-practice';
          message: string;
          file: string;
          lineStart: number;
          lineEnd: number;
          fixPrompt?: string;
          suggestedFix?: string | null;
        }>;
        summary?: string;
        error?: string;
      }>;

      // ============================================
      // Phase 124.6.2: Apply Issue Fix APIs
      // ============================================

      /**
       * Apply an AI-generated fix for a code issue
       * @param input - Fix request with filePath, source, issue, projectRoot
       */
      applyIssueFix: (input: {
        filePath: string;
        source: string;
        issue: {
          id: string;
          severity: 'info' | 'warning' | 'error';
          category: 'logic' | 'security' | 'performance' | 'style' | 'best-practice';
          message: string;
          file: string;
          lineStart: number;
          lineEnd: number;
          fixPrompt?: string;
          suggestedFix?: string | null;
        };
        projectRoot?: string;
      }) => Promise<{
        success: boolean;
        filePath: string;
        fixedSource?: string;
        unifiedDiff?: string;
        summary: string;
        error?: string;
      }>;

      // ============================================
      // Phase 124.7: Batch Apply Issue Fix APIs
      // ============================================

      /**
       * Apply automatic fixes for multiple issues in a single file
       * @param input - Batch fix request with filePath, source, issues array, projectRoot
       */
      batchApplyIssueFix: (input: {
        filePath: string;
        source: string;
        issues: Array<{
          id: string;
          severity: 'info' | 'warning' | 'error';
          category: 'logic' | 'security' | 'performance' | 'style' | 'best-practice';
          message: string;
          file: string;
          lineStart: number;
          lineEnd: number;
          fixPrompt?: string;
          suggestedFix?: string | null;
        }>;
        projectRoot?: string;
      }) => Promise<{
        success: boolean;
        filePath: string;
        fixedSource: string;
        appliedIssueIds: string[];
        skippedIssueIds: string[];
        summary: string;
        error?: string;
      }>;

      // ============================================
      // Phase 124.8: Project-Wide Issues Scanner
      // ============================================

      /**
       * Scan entire project for code issues
       * @param input - Scan options with maxFiles limit
       */
      scanProjectIssues: (input?: {
        maxFiles?: number;
      }) => Promise<{
        success: boolean;
        error?: string;
        result?: {
          scannedFiles: number;
          totalIssues: number;
          totalErrors: number;
          totalWarnings: number;
          totalInfos: number;
          summaries: Array<{
            filePath: string;
            relativePath: string;
            issueCount: number;
            errors: number;
            warnings: number;
            infos: number;
            categories: Record<string, number>;
            issues: Array<{
              id: string;
              severity: 'info' | 'warning' | 'error';
              category: 'logic' | 'security' | 'performance' | 'style' | 'best-practice';
              message: string;
              lineStart: number;
              lineEnd: number;
            }>;
          }>;
          skippedFiles: number;
          scanDurationMs: number;
        };
      }>;
    };
  }
}

export {};
