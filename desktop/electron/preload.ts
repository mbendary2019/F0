import { contextBridge, ipcRenderer, shell } from 'electron';

/**
 * Phase 109.4.0: File System Bridge
 * Phase 111.1: Local Runner Bridge
 * Phase 115.4: Open External for Browser Preview
 * Phase 120: Project Indexer APIs
 * Expose file system, runner, shell, and indexer APIs to renderer process
 */

// Phase 120: Import indexer types
// Phase 121: Added ProjectSearchResult and ProjectSearchType
// Phase 124.3: Added RoutesIndex
import type { ProjectIndex, ProjectSearchResult, ProjectSearchType, RoutesIndex } from '../indexer/types';
// Phase 124.5.1: API Debugger types
import type { DebugApiEndpointOutput } from '../src/lib/agent/tools/apiLogsDebugger';
// Phase 124.6.2: Issue Fixer types
// Phase 124.7: Batch Issue Fixer types
import type { ApplyIssueFixResult, BatchApplyIssueFixResult } from '../src/lib/agent/tools/issueFixer';

// File tree node type (matches main.ts)
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

// Phase 130.6.2: Debug logging for preload
console.log('[Preload] Starting f0Desktop exposure...');

// Build the API object first for debugging
const f0DesktopAPI = {
  /**
   * Open folder dialog and get file tree
   */
  openFolder: (): Promise<OpenFolderResult> =>
    ipcRenderer.invoke('f0:open-folder'),

  /**
   * Read file content
   */
  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('f0:read-file', filePath),

  /**
   * Write file content
   */
  writeFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('f0:write-file', filePath, content),

  /**
   * Phase 145.3.1: Read file content with success/error format
   * Returns { success: boolean, content?: string, error?: string }
   */
  readFileText: (filePath: string): Promise<{ success: boolean; content?: string; error?: string }> =>
    ipcRenderer.invoke('f0:read-file-text', filePath),

  // ============================================
  // Phase 111.1: Local Runner APIs
  // ============================================

  /**
   * Run a command in a project directory
   */
  runCommand: (id: string, projectPath: string, command: string): void => {
    ipcRenderer.send('f0:runner-run', { id, projectPath, command });
  },

  /**
   * Kill a running process
   */
  killRunner: (id: string): void => {
    ipcRenderer.send('f0:runner-kill', id);
  },

  /**
   * Get list of allowed commands
   */
  getAllowedCommands: (): Promise<string[]> =>
    ipcRenderer.invoke('f0:runner-allowed-commands'),

  /**
   * Subscribe to runner events
   */
  onRunnerStart: (callback: (payload: RunnerStartPayload) => void): (() => void) => {
    const handler = (_event: any, payload: RunnerStartPayload) => callback(payload);
    ipcRenderer.on('f0:runner-start', handler);
    return () => ipcRenderer.removeListener('f0:runner-start', handler);
  },

  onRunnerLog: (callback: (payload: RunnerLogPayload) => void): (() => void) => {
    const handler = (_event: any, payload: RunnerLogPayload) => callback(payload);
    ipcRenderer.on('f0:runner-log', handler);
    return () => ipcRenderer.removeListener('f0:runner-log', handler);
  },

  onRunnerEnd: (callback: (payload: RunnerEndPayload) => void): (() => void) => {
    const handler = (_event: any, payload: RunnerEndPayload) => callback(payload);
    ipcRenderer.on('f0:runner-end', handler);
    return () => ipcRenderer.removeListener('f0:runner-end', handler);
  },

  onRunnerError: (callback: (payload: RunnerErrorPayload) => void): (() => void) => {
    const handler = (_event: any, payload: RunnerErrorPayload) => callback(payload);
    ipcRenderer.on('f0:runner-error', handler);
    return () => ipcRenderer.removeListener('f0:runner-error', handler);
  },

  // ============================================
  // Phase 112: Runner Context for Agent
  // ============================================

  /**
   * Get formatted runner context for Agent
   * @param lineLimit - Max lines to include (default: 100)
   * @returns Formatted string with recent runner outputs
   */
  getRunnerContext: (lineLimit: number = 100): Promise<string> =>
    ipcRenderer.invoke('f0:runner-context', lineLimit),

  /**
   * Clear runner context history
   */
  clearRunnerContext: (): Promise<boolean> =>
    ipcRenderer.invoke('f0:runner-context-clear'),

  // ============================================
  // Phase 115.4: Shell APIs for Browser Preview
  // ============================================

  /**
   * Open URL in external browser (Safari/Chrome)
   */
  openExternal: (url: string): void => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url);
    }
  },

  // ============================================
  // Phase 124.3.1: Open File in Editor
  // ============================================

  /**
   * Open a file in the editor
   * @param filePath - Absolute or relative path to file
   * @param projectRoot - Project root (for relative paths)
   */
  openFileInEditor: (filePath: string, projectRoot?: string): void => {
    ipcRenderer.send('f0:open-file-in-editor', { filePath, projectRoot });
  },

  /**
   * Subscribe to file open requests (for editor integration)
   */
  onOpenFile: (callback: (payload: { filePath: string; projectRoot?: string }) => void): (() => void) => {
    const handler = (_event: any, payload: { filePath: string; projectRoot?: string }) => callback(payload);
    ipcRenderer.on('f0:open-file-in-editor', handler);
    return () => ipcRenderer.removeListener('f0:open-file-in-editor', handler);
  },

  // ============================================
  // Phase 120: Project Indexer APIs
  // ============================================

  /**
   * Set the current project root for indexing
   */
  setProjectRoot: (projectRoot: string): Promise<boolean> =>
    ipcRenderer.invoke('f0:set-project-root', projectRoot),

  /**
   * Scan and index the project (creates/updates .f0/index/project-index.json)
   * @param projectRoot - Optional path, uses current project root if not specified
   */
  scanProject: (projectRoot?: string): Promise<ProjectIndex> =>
    ipcRenderer.invoke('f0:index:scan-project', projectRoot),

  /**
   * Get existing project index from disk (null if not found)
   * @param projectRoot - Optional path, uses current project root if not specified
   */
  getProjectIndex: (projectRoot?: string): Promise<ProjectIndex | null> =>
    ipcRenderer.invoke('f0:index:get-project-index', projectRoot),

  // ============================================
  // Phase 121: SEARCH_PROJECT_INDEX Tool for Agent
  // ============================================

  /**
   * Search project index for files, symbols, or exports
   * @param query - Search query string
   * @param type - Search type: 'file', 'symbol', 'export', or 'all' (default)
   * @param limit - Maximum number of results (default 20)
   * @param projectRoot - Optional path, uses current project root if not specified
   */
  searchProjectIndex: (
    query: string,
    type: ProjectSearchType = 'all',
    limit: number = 20,
    projectRoot?: string
  ): Promise<ProjectSearchResult[]> =>
    ipcRenderer.invoke('f0:index:search', projectRoot, query, type, limit),

  // ============================================
  // Phase 124.5.1: API Debugger APIs
  // ============================================

  /**
   * Debug an API endpoint (combines code analysis + runtime logs)
   * @param input - Debug input with urlPath, query, projectRoot, minutesBack
   */
  debugApi: (input: {
    urlPath?: string;
    query?: string;
    projectRoot?: string;
    minutesBack?: number;
  }): Promise<DebugApiEndpointOutput> =>
    ipcRenderer.invoke('f0:debug-api', input),

  /**
   * Get routes index for the project
   * @param projectRoot - Optional path, uses current project root if not specified
   */
  getRoutesIndex: (projectRoot?: string): Promise<RoutesIndex | null> =>
    ipcRenderer.invoke('f0:get-routes-index', projectRoot),

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
  }): Promise<{
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
  }> => ipcRenderer.invoke('f0:code-review', input),

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
  }): Promise<ApplyIssueFixResult> => ipcRenderer.invoke('f0:apply-issue-fix', input),

  // ============================================
  // Phase 124.7: Batch Apply Issue Fix APIs
  // ============================================

  /**
   * Apply automatic fixes for multiple issues in a single file
   * Phase 144.1: Updated to support LLM cloud API with localOnly fallback option
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
    /** Phase 144.1: Skip cloud API and use local pattern-based fixes only */
    localOnly?: boolean;
  }): Promise<BatchApplyIssueFixResult> => ipcRenderer.invoke('f0:batch-apply-issue-fix', input),

  // ============================================
  // Phase 144.2.3: Auto-Fix Backup & Rollback APIs
  // ============================================

  /**
   * Create backup before applying patches
   */
  createAutoFixBackup: (input: {
    patches: Array<{
      filePath: string;
      before: string;
      after: string;
    }>;
    projectRoot?: string;
  }): Promise<{
    success: boolean;
    session?: {
      timestamp: string;
      projectRoot: string;
      backupDir: string;
      files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }>;
      totalFilesBackedUp: number;
    };
    error?: string;
  }> => ipcRenderer.invoke('f0:autofix-create-backup', input),

  /**
   * List available backup sessions
   */
  listAutoFixBackups: (input?: {
    projectRoot?: string;
  }): Promise<{
    success: boolean;
    sessions: Array<{
      timestamp: string;
      projectRoot: string;
      backupDir: string;
      files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }>;
      totalFilesBackedUp: number;
    }>;
    error?: string;
  }> => ipcRenderer.invoke('f0:autofix-list-backups', input),

  /**
   * Rollback to a specific backup session
   */
  rollbackAutoFix: (input: {
    backupDir: string;
  }): Promise<{
    success: boolean;
    restoredFiles: string[];
    errors: string[];
  }> => ipcRenderer.invoke('f0:autofix-rollback', input),

  /**
   * Get the most recent backup session
   */
  getLastAutoFixBackup: (input?: {
    projectRoot?: string;
  }): Promise<{
    success: boolean;
    session?: {
      timestamp: string;
      projectRoot: string;
      backupDir: string;
      files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }>;
      totalFilesBackedUp: number;
    };
    error?: string;
  }> => ipcRenderer.invoke('f0:autofix-get-last-backup', input),

  // ============================================
  // Phase 144.4.1: Nested autoFix object for cleaner API
  // ============================================
  autoFix: {
    createBackup: (payload: {
      patches: Array<{ filePath: string; before: string; after: string }>;
      projectRoot?: string;
    }) => ipcRenderer.invoke('f0:autofix-create-backup', payload),

    listBackups: (projectRoot?: string) =>
      ipcRenderer.invoke('f0:autofix-list-backups', { projectRoot }),

    rollback: (payload: { backupDir: string }) =>
      ipcRenderer.invoke('f0:autofix-rollback', payload),

    getLastBackup: (projectRoot?: string) =>
      ipcRenderer.invoke('f0:autofix-get-last-backup', { projectRoot }),
  },

  // ============================================
  // Phase 145.1: ACE Auto-Fix API
  // Phase 145.3.3: Added riskLevel support
  // ============================================

  /**
   * Call ACE backend for intelligent auto-fix
   * @param payload - ACE auto-fix request with file content and issues
   */
  callAceAutoFix: (payload: {
    filePath: string;
    language: 'ts' | 'tsx' | 'js' | 'jsx' | 'json' | 'other';
    source: string;
    issues: Array<{
      id: string;
      ruleId?: string;
      message: string;
      line: number;
      column: number;
      severity: 'low' | 'medium' | 'high';
    }>;
    /** Phase 145.3.3: Risk level from Quality Profile */
    riskLevel?: 'conservative' | 'balanced' | 'aggressive';
  }): Promise<{
    filePath: string;
    patches: Array<{
      id: string;
      description: string;
      startLine: number;
      endLine: number;
      replacement: string;
    }>;
    notes?: string[];
  }> => ipcRenderer.invoke('f0:ace-auto-fix', payload),

  // ============================================
  // Phase 124.8: Project-Wide Issues Scanner
  // ============================================

  /**
   * Scan entire project for code issues
   * @param input - Scan options with maxFiles limit
   */
  scanProjectIssues: (input?: {
    maxFiles?: number;
  }): Promise<{
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
  }> => ipcRenderer.invoke('f0:scan-project-issues', input ?? {}),

  // ============================================
  // Phase 129.7: Single File Analysis for ACE
  // ============================================

  /**
   * Analyze a single file for code issues (fast local analysis)
   * Used by ACE for getting issues before applying fixes
   * @param input - File path and source code
   */
  analyzeFile: (input: {
    filePath: string;
    source: string;
  }): Promise<{
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
  }> => ipcRenderer.invoke('f0:analyze-file', input),

  // ============================================
  // Phase 130.6: Test Runner APIs
  // ============================================

  /**
   * Run a test command with streaming output
   */
  runTests: (id: string, projectPath: string, command: string): void => {
    ipcRenderer.send('f0:tests-run', { id, projectPath, command });
  },

  /**
   * Kill a running test process
   */
  killTests: (id: string): void => {
    ipcRenderer.send('f0:tests-kill', id);
  },

  /**
   * Check if a file exists
   */
  fileExists: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('f0:file-exists', filePath),

  /**
   * Phase 168: Check if a path is a directory (for drag & drop)
   */
  isDirectory: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('f0:is-directory', filePath),

  /**
   * Phase 168: Write binary file (for drag & drop images)
   */
  writeBinaryFile: (filePath: string, base64Data: string): Promise<boolean> =>
    ipcRenderer.invoke('f0:write-binary-file', filePath, base64Data),

  /**
   * Subscribe to test runner events
   */
  onTestsStart: (callback: (payload: { id: string; pid?: number }) => void): (() => void) => {
    const handler = (_event: any, payload: { id: string; pid?: number }) => callback(payload);
    ipcRenderer.on('f0:tests-start', handler);
    return () => ipcRenderer.removeListener('f0:tests-start', handler);
  },

  onTestsOutput: (callback: (payload: { id: string; stream: 'stdout' | 'stderr'; chunk: string }) => void): (() => void) => {
    const handler = (_event: any, payload: { id: string; stream: 'stdout' | 'stderr'; chunk: string }) => callback(payload);
    ipcRenderer.on('f0:tests-output', handler);
    return () => ipcRenderer.removeListener('f0:tests-output', handler);
  },

  onTestsEnd: (callback: (payload: { id: string; exitCode: number; stdout: string; stderr: string }) => void): (() => void) => {
    const handler = (_event: any, payload: { id: string; exitCode: number; stdout: string; stderr: string }) => callback(payload);
    ipcRenderer.on('f0:tests-end', handler);
    return () => ipcRenderer.removeListener('f0:tests-end', handler);
  },

  onTestsError: (callback: (payload: { id: string; message: string }) => void): (() => void) => {
    const handler = (_event: any, payload: { id: string; message: string }) => callback(payload);
    ipcRenderer.on('f0:tests-error', handler);
    return () => ipcRenderer.removeListener('f0:tests-error', handler);
  },

  // ============================================
  // Phase 131.4: Network Addresses API (for QR Code)
  // ============================================

  /**
   * Get local network IP addresses for mobile preview QR code
   */
  getNetworkAddresses: (): Promise<string[]> =>
    ipcRenderer.invoke('f0:get-network-addresses'),

  // ============================================
  // Phase 180.1: Shell Agent API
  // ============================================

  /**
   * Run a shell command from the Agent chat
   * Only safe commands are allowed (ls, npm, pnpm, git status, etc.)
   * @param command - The shell command to execute
   * @param cwd - Working directory (optional, defaults to project root)
   * @returns Promise with output, error, and exit code
   */
  runShellCommand: (
    command: string,
    cwd?: string
  ): Promise<{ output: string; error?: string; exitCode: number }> =>
    ipcRenderer.invoke('f0:run-shell-command', command, cwd),
};

// Phase 130.6.2: Debug logging - verify the API object
console.log('[Preload] f0DesktopAPI keys:', Object.keys(f0DesktopAPI));
console.log('[Preload] typeof runTests:', typeof f0DesktopAPI.runTests);

// Expose the API to renderer
contextBridge.exposeInMainWorld('f0Desktop', f0DesktopAPI);
console.log('[Preload] f0Desktop exposed successfully');

/**
 * TypeScript declarations for window.f0Desktop
 * This will be available in renderer process
 */
declare global {
  interface Window {
    f0Desktop?: {
      // File system APIs
      openFolder: () => Promise<OpenFolderResult>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      // Phase 145.3.1: Read file with success/error format
      readFileText?: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;

      // Phase 111.1: Runner APIs
      runCommand: (id: string, projectPath: string, command: string) => void;
      killRunner: (id: string) => void;
      getAllowedCommands: () => Promise<string[]>;
      onRunnerStart: (callback: (payload: RunnerStartPayload) => void) => () => void;
      onRunnerLog: (callback: (payload: RunnerLogPayload) => void) => () => void;
      onRunnerEnd: (callback: (payload: RunnerEndPayload) => void) => () => void;
      onRunnerError: (callback: (payload: RunnerErrorPayload) => void) => () => void;

      // Phase 112: Runner Context for Agent
      getRunnerContext: (lineLimit?: number) => Promise<string>;
      clearRunnerContext: () => Promise<boolean>;

      // Phase 115.4: Shell APIs
      openExternal: (url: string) => void;

      // Phase 124.3.1: Open File in Editor
      openFileInEditor: (filePath: string, projectRoot?: string) => void;
      onOpenFile: (callback: (payload: { filePath: string; projectRoot?: string }) => void) => () => void;

      // Phase 120: Project Indexer APIs
      setProjectRoot: (projectRoot: string) => Promise<boolean>;
      scanProject: (projectRoot?: string) => Promise<ProjectIndex>;
      getProjectIndex: (projectRoot?: string) => Promise<ProjectIndex | null>;

      // Phase 121: SEARCH_PROJECT_INDEX Tool for Agent
      searchProjectIndex: (
        query: string,
        type?: ProjectSearchType,
        limit?: number,
        projectRoot?: string
      ) => Promise<ProjectSearchResult[]>;

      // Phase 124.5.1: API Debugger APIs
      debugApi: (input: {
        urlPath?: string;
        query?: string;
        projectRoot?: string;
        minutesBack?: number;
      }) => Promise<DebugApiEndpointOutput>;
      getRoutesIndex: (projectRoot?: string) => Promise<RoutesIndex | null>;

      // Phase 124.6: Code Review APIs
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

      // Phase 124.6.2: Apply Issue Fix APIs
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
      }) => Promise<ApplyIssueFixResult>;

      // Phase 124.7: Batch Apply Issue Fix APIs
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
      }) => Promise<BatchApplyIssueFixResult>;

      // Phase 124.8: Project-Wide Issues Scanner
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

      // Phase 129.7: Single File Analysis for ACE
      analyzeFile: (input: {
        filePath: string;
        source: string;
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
      }>;

      // Phase 130.6: Test Runner APIs
      runTests: (id: string, projectPath: string, command: string) => void;
      killTests: (id: string) => void;
      fileExists: (filePath: string) => Promise<boolean>;
      // Phase 168: Check if path is directory (for drag & drop)
      isDirectory: (filePath: string) => Promise<boolean>;
      // Phase 168: Write binary file (for drag & drop images)
      writeBinaryFile: (filePath: string, base64Data: string) => Promise<boolean>;
      onTestsStart: (callback: (payload: { id: string; pid?: number }) => void) => () => void;
      onTestsOutput: (callback: (payload: { id: string; stream: 'stdout' | 'stderr'; chunk: string }) => void) => () => void;
      onTestsEnd: (callback: (payload: { id: string; exitCode: number; stdout: string; stderr: string }) => void) => () => void;
      onTestsError: (callback: (payload: { id: string; message: string }) => void) => () => void;

      // Phase 131.4: Network Addresses API (for QR Code)
      getNetworkAddresses: () => Promise<string[]>;

      // Phase 180.1: Shell Agent API
      runShellCommand: (
        command: string,
        cwd?: string
      ) => Promise<{ output: string; error?: string; exitCode: number }>;

      // Phase 144.4.1: Nested autoFix object for cleaner API
      autoFix?: {
        createBackup: (payload: {
          patches: Array<{ filePath: string; before: string; after: string }>;
          projectRoot?: string;
        }) => Promise<{
          success: boolean;
          session?: {
            timestamp: string;
            projectRoot: string;
            backupDir: string;
            files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }>;
            totalFilesBackedUp: number;
          };
          error?: string;
        }>;
        listBackups: (projectRoot?: string) => Promise<{
          success: boolean;
          sessions: Array<{
            timestamp: string;
            projectRoot: string;
            backupDir: string;
            files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }>;
            totalFilesBackedUp: number;
          }>;
          error?: string;
        }>;
        rollback: (payload: { backupDir: string }) => Promise<{
          success: boolean;
          restoredFiles: string[];
          errors: string[];
        }>;
        getLastBackup: (projectRoot?: string) => Promise<{
          success: boolean;
          session?: {
            timestamp: string;
            projectRoot: string;
            backupDir: string;
            files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }>;
            totalFilesBackedUp: number;
          };
          error?: string;
        }>;
      };

      // Phase 145.1: ACE Auto-Fix API
      // Phase 145.3.3: Added riskLevel support
      callAceAutoFix?: (payload: {
        filePath: string;
        language: 'ts' | 'tsx' | 'js' | 'jsx' | 'json' | 'other';
        source: string;
        issues: Array<{
          id: string;
          ruleId?: string;
          message: string;
          line: number;
          column: number;
          severity: 'low' | 'medium' | 'high';
        }>;
        /** Phase 145.3.3: Risk level from Quality Profile */
        riskLevel?: 'conservative' | 'balanced' | 'aggressive';
      }) => Promise<{
        filePath: string;
        patches: Array<{
          id: string;
          description: string;
          startLine: number;
          endLine: number;
          replacement: string;
        }>;
        notes?: string[];
      }>;
    };
  }
}

export {};
