import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { spawn, ChildProcess } from 'child_process';

// ============================================
// Phase 170.3: Safe Console Logger
// Prevents EPIPE errors when stdout/stderr is closed
// ============================================

/* eslint-disable no-console */
const safeConsole = {
  log: (...args: unknown[]) => {
    try {
      console.log(...args);
    } catch {
      // Ignore EPIPE errors when stdout is closed
    }
  },
  warn: (...args: unknown[]) => {
    try {
      console.warn(...args);
    } catch {
      // Ignore EPIPE errors when stderr is closed
    }
  },
  error: (...args: unknown[]) => {
    try {
      console.error(...args);
    } catch {
      // Ignore EPIPE errors when stderr is closed
    }
  },
};
/* eslint-enable no-console */

// Phase 120: Project Indexer imports
import { scanAndSaveProject, loadProjectIndex } from '../indexer/scanProject';
import type { ProjectIndex, ProjectSearchType, RoutesIndex } from '../indexer/types';
// Phase 121: Search tool import
import { searchProjectIndex } from '../indexer/searchProjectIndex';
// Phase 124.3: Routes index
import { loadRoutesIndex } from '../indexer/buildRoutesIndex';
// Phase 124.5: API Debugger imports
import { debugApiEndpoint, type DebugApiEndpointInput } from '../src/lib/agent/tools/apiLogsDebugger';
// Phase 124.6.2: Issue Fixer imports
// Phase 124.7: Batch Issue Fixer imports
import {
  applyIssueFix,
  batchApplyIssueFix,
  type ApplyIssueFixInput,
  type ApplyIssueFixResult,
  type BatchApplyIssueFixInput,
  type BatchApplyIssueFixResult,
} from '../src/lib/agent/tools/issueFixer';

/**
 * Phase 109.4.0: File System Bridge
 * Phase 111.1: Local Runner Bridge
 * Electron IPC handlers for file operations and command execution
 */

// ============================================
// Phase 111.1: Local Runner Types & State
// ============================================

type RunCommandPayload = {
  id: string;                // runId
  projectPath: string;       // Project root path
  command: string;           // e.g., "pnpm dev"
};

// Track active processes for cleanup
const activeProcesses = new Map<string, ChildProcess>();

// Phase 120: Current project root for indexing
let currentProjectRoot: string | null = null;

// ============================================
// Phase 112: Runner Context Buffer
// Store last N log lines per runner for Agent context
// ============================================

type RunnerLog = {
  stream: 'stdout' | 'stderr';
  chunk: string;
  timestamp: number;
};

type RunnerContextEntry = {
  id: string;
  command: string;
  projectPath: string;
  startTime: number;
  endTime?: number;
  exitCode?: number;
  logs: RunnerLog[];
  status: 'running' | 'completed' | 'error';
  error?: string;
};

const MAX_LOG_LINES = 200; // Max lines per runner
const MAX_CONTEXT_ENTRIES = 5; // Keep last N runner contexts

// Circular buffer of runner contexts (most recent first)
const runnerContexts: RunnerContextEntry[] = [];

// Get context entry for a runner
function getRunnerContextEntry(id: string): RunnerContextEntry | undefined {
  return runnerContexts.find(c => c.id === id);
}

// Add new runner context
function createRunnerContext(id: string, command: string, projectPath: string): RunnerContextEntry {
  const entry: RunnerContextEntry = {
    id,
    command,
    projectPath,
    startTime: Date.now(),
    logs: [],
    status: 'running',
  };

  // Add to front (most recent)
  runnerContexts.unshift(entry);

  // Trim old entries
  while (runnerContexts.length > MAX_CONTEXT_ENTRIES) {
    runnerContexts.pop();
  }

  return entry;
}

// Append log to runner context
function appendRunnerLog(id: string, stream: 'stdout' | 'stderr', chunk: string) {
  const ctx = getRunnerContextEntry(id);
  if (!ctx) return;

  ctx.logs.push({
    stream,
    chunk,
    timestamp: Date.now(),
  });

  // Trim old logs
  while (ctx.logs.length > MAX_LOG_LINES) {
    ctx.logs.shift();
  }
}

// Update runner context status
function updateRunnerContextStatus(
  id: string,
  status: 'completed' | 'error',
  exitCode?: number,
  error?: string
) {
  const ctx = getRunnerContextEntry(id);
  if (!ctx) return;

  ctx.status = status;
  ctx.endTime = Date.now();
  if (exitCode !== undefined) ctx.exitCode = exitCode;
  if (error) ctx.error = error;
}

// Get formatted runner context for Agent (exported via IPC)
function getFormattedRunnerContext(lineLimit: number = 100): string {
  if (runnerContexts.length === 0) {
    return '';
  }

  const parts: string[] = [];

  for (const ctx of runnerContexts) {
    // Header
    const statusEmoji = ctx.status === 'running' ? '🔄' :
                        ctx.status === 'completed' && ctx.exitCode === 0 ? '✅' : '❌';

    parts.push(`${statusEmoji} Command: ${ctx.command}`);
    parts.push(`   Path: ${ctx.projectPath}`);
    parts.push(`   Status: ${ctx.status}${ctx.exitCode !== undefined ? ` (exit: ${ctx.exitCode})` : ''}`);

    if (ctx.error) {
      parts.push(`   Error: ${ctx.error}`);
    }

    // Logs (prioritize stderr for errors)
    const allLogs = ctx.logs.slice(-lineLimit);
    const stderrLogs = allLogs.filter(l => l.stream === 'stderr');
    const hasErrors = stderrLogs.length > 0;

    if (hasErrors) {
      parts.push('   --- stderr ---');
      for (const log of stderrLogs.slice(-50)) { // Last 50 stderr lines
        parts.push('   ' + log.chunk.trim());
      }
    }

    if (!hasErrors || allLogs.length <= 30) {
      parts.push('   --- stdout ---');
      const stdoutLogs = allLogs.filter(l => l.stream === 'stdout').slice(-30);
      for (const log of stdoutLogs) {
        parts.push('   ' + log.chunk.trim());
      }
    }

    parts.push(''); // Empty line between entries
  }

  return parts.join('\n');
}

// Whitelist of allowed command prefixes for security
// Phase 112.1: Expanded to support package management commands
// Phase 112.3: Added node, git, which, where commands
const ALLOWED_COMMAND_PREFIXES = [
  // pnpm commands
  'pnpm dev',
  'pnpm test',
  'pnpm lint',
  'pnpm build',
  'pnpm typecheck',
  'pnpm tsc',
  'pnpm run',      // Any pnpm run script
  'pnpm add',      // Install packages (pnpm add -D jest ts-jest ...)
  'pnpm remove',   // Remove packages
  'pnpm install',  // Install all deps
  'pnpm i',        // Short for install
  'pnpm exec',     // Execute binary
  'pnpm dlx',      // Download and execute

  // npm commands
  'npm run',
  'npm test',
  'npm start',
  'npm install',
  'npm i',
  'npm add',
  'npm uninstall',
  'npm exec',

  // npx commands
  'npx tsc',
  'npx eslint',
  'npx prettier',
  'npx jest',
  'npx vitest',
  'npx tsx',

  // yarn commands
  'yarn dev',
  'yarn test',
  'yarn build',
  'yarn add',
  'yarn remove',
  'yarn run',

  // bun commands
  'bun dev',
  'bun test',
  'bun run',
  'bun add',
  'bun remove',

  // Node.js runtime
  'node ',         // node script.js, node -v, etc.
  'deno ',         // deno run, deno --version
  'tsx ',          // tsx script.ts

  // Git commands (read-only safe commands)
  'git status',
  'git log',
  'git diff',
  'git branch',
  'git remote',
  'git show',
  'git ls-files',
  'git rev-parse',
  'git describe',
  'git config',    // For reading config
  'git fetch',
  'git pull',
  'git add',
  'git commit',
  'git stash',
  'git checkout',

  // Info commands
  'which ',        // which node, which pnpm
  'where ',        // where node (Windows)
];

// Dangerous patterns to block
const BLOCKED_PATTERNS = [
  /rm\s+-rf/i,
  /del\s+\/[sf]/i,
  /rmdir/i,
  />\s*\/dev\/null/i,
  /\|\s*bash/i,
  /curl.*\|.*sh/i,
  /wget.*\|.*sh/i,
];

// Phase 112.3: Regex patterns for version/info commands
const VERSION_COMMAND_PATTERNS = [
  // Version checks: node -v, npm --version, etc.
  /^(node|npm|pnpm|yarn|bun|npx|git|deno|tsx)\s+(-v|--version)$/i,
  // Also allow just the flag after the command
  /^(node|npm|pnpm|yarn|bun|npx|git|deno|tsx)\s+-v$/i,
];

// Check if command is allowed (prefix match + regex patterns)
function isCommandAllowed(command: string): boolean {
  const trimmed = command.trim();

  // Block dangerous patterns first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      safeConsole.warn('[F0 Desktop] Blocked dangerous command:', trimmed);
      return false;
    }
  }

  // Phase 112.3: Check version command patterns first
  for (const pattern of VERSION_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  // Check if starts with any allowed prefix
  for (const prefix of ALLOWED_COMMAND_PREFIXES) {
    // If prefix ends with space, it's a "starts with" check
    if (prefix.endsWith(' ')) {
      if (trimmed.startsWith(prefix) || trimmed + ' ' === prefix) {
        return true;
      }
    } else {
      // Exact match or prefix + space
      if (trimmed === prefix || trimmed.startsWith(prefix + ' ')) {
        return true;
      }
    }
  }

  return false;
}

// File tree node type
type FileNode = {
  type: 'dir' | 'file';
  name: string;
  path: string;
  children?: FileNode[];
};

/**
 * Recursively walk directory and build file tree
 */
function walkDirectory(dir: string): FileNode[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    return entries
      .filter((entry) => {
        // Skip hidden files and common ignore patterns
        const name = entry.name;
        return (
          !name.startsWith('.') &&
          name !== 'node_modules' &&
          name !== 'dist' &&
          name !== 'build' &&
          name !== 'coverage'
        );
      })
      .map((entry) => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          return {
            type: 'dir' as const,
            name: entry.name,
            path: fullPath,
            children: walkDirectory(fullPath),
          };
        }

        return {
          type: 'file' as const,
          name: entry.name,
          path: fullPath,
        };
      })
      .sort((a, b) => {
        // Directories first, then files, both alphabetically
        if (a.type === 'dir' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    safeConsole.error(`[F0 Desktop] Error walking directory ${dir}:`, error);
    return [];
  }
}

/**
 * Register IPC handlers - called after app is ready
 */
function registerIpcHandlers() {
  // IPC Handler: Open folder dialog
  ipcMain.handle('f0:open-folder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Open Project Folder',
      });

      if (result.canceled || !result.filePaths[0]) {
        return null;
      }

      const rootPath = result.filePaths[0];
      safeConsole.log('[F0 Desktop] Opening folder:', rootPath);

      const tree = walkDirectory(rootPath);

      return {
        root: rootPath,
        tree,
      };
    } catch (error) {
      safeConsole.error('[F0 Desktop] Error opening folder:', error);
      throw error;
    }
  });

  // IPC Handler: Read file content
  ipcMain.handle('f0:read-file', async (_event, filePath: string) => {
    try {
      safeConsole.log('[F0 Desktop] Reading file:', filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      return content;
    } catch (error) {
      safeConsole.error('[F0 Desktop] Error reading file:', error);
      throw error;
    }
  });

  // Phase 145.3.1: IPC Handler: Read file content with success/error format
  ipcMain.handle('f0:read-file-text', async (_event, filePath: string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      safeConsole.error('[F0 Desktop] Error reading file text:', filePath, message);
      return { success: false, error: message };
    }
  });

  // IPC Handler: Write file content
  ipcMain.handle('f0:write-file', async (_event, filePath: string, content: string) => {
    try {
      safeConsole.log('[F0 Desktop] Writing file:', filePath);

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      safeConsole.error('[F0 Desktop] Error writing file:', error);
      throw error;
    }
  });

  // ============================================
  // Phase 111.1: Local Runner IPC Handlers
  // ============================================

  // IPC Handler: Run command
  ipcMain.on('f0:runner-run', (event, payload: RunCommandPayload) => {
    const { id, projectPath, command } = payload;

    safeConsole.log('[F0 Desktop] Runner request:', { id, projectPath, command });

    // Security: Check if command is allowed
    if (!isCommandAllowed(command)) {
      safeConsole.warn('[F0 Desktop] Command not allowed:', command);
      event.sender.send('f0:runner-error', {
        id,
        message: `Command not allowed: ${command}. Use pnpm/npm/yarn/npx/bun commands.`,
      });
      return;
    }

    // Validate project path exists
    if (!fs.existsSync(projectPath)) {
      event.sender.send('f0:runner-error', {
        id,
        message: `Project path does not exist: ${projectPath}`,
      });
      return;
    }

    // Phase 112: Create runner context entry
    createRunnerContext(id, command, projectPath);

    // Parse command
    const [cmd, ...args] = command.split(' ');

    // Spawn the process
    const child = spawn(cmd, args, {
      cwd: projectPath,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' }, // Enable colors in output
    });

    // Track the process
    activeProcesses.set(id, child);

    // Notify start
    event.sender.send('f0:runner-start', { id, pid: child.pid });
    safeConsole.log('[F0 Desktop] Runner started:', { id, pid: child.pid, command });

    // Stream stdout
    child.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      // Phase 112: Buffer the log
      appendRunnerLog(id, 'stdout', chunk);
      event.sender.send('f0:runner-log', {
        id,
        stream: 'stdout',
        chunk,
      });
    });

    // Stream stderr
    child.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      // Phase 112: Buffer the log
      appendRunnerLog(id, 'stderr', chunk);
      event.sender.send('f0:runner-log', {
        id,
        stream: 'stderr',
        chunk,
      });
    });

    // Handle process end
    child.on('close', (code: number | null) => {
      activeProcesses.delete(id);
      // Phase 112: Update context status
      updateRunnerContextStatus(id, 'completed', code ?? -1);
      event.sender.send('f0:runner-end', {
        id,
        exitCode: code ?? -1,
      });
      safeConsole.log('[F0 Desktop] Runner ended:', { id, exitCode: code });
    });

    // Handle error (e.g., command not found)
    child.on('error', (err: Error) => {
      activeProcesses.delete(id);
      // Phase 112: Update context status
      updateRunnerContextStatus(id, 'error', undefined, err.message);
      event.sender.send('f0:runner-error', {
        id,
        message: err.message,
      });
      safeConsole.error('[F0 Desktop] Runner error:', { id, error: err.message });
    });
  });

  // IPC Handler: Kill running process
  ipcMain.on('f0:runner-kill', (_event, id: string) => {
    const child = activeProcesses.get(id);
    if (child) {
      safeConsole.log('[F0 Desktop] Killing runner:', id);
      child.kill('SIGTERM');
      // Phase 112: Mark as terminated
      updateRunnerContextStatus(id, 'completed', -2); // -2 = killed
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (activeProcesses.has(id)) {
          child.kill('SIGKILL');
          activeProcesses.delete(id);
        }
      }, 5000);
    }
  });

  // IPC Handler: Get allowed commands list
  ipcMain.handle('f0:runner-allowed-commands', async () => {
    return ALLOWED_COMMAND_PREFIXES;
  });

  // ============================================
  // Phase 112: Runner Context for Agent
  // ============================================

  // IPC Handler: Get formatted runner context for Agent
  ipcMain.handle('f0:runner-context', async (_event, lineLimit: number = 100) => {
    return getFormattedRunnerContext(lineLimit);
  });

  // IPC Handler: Clear runner context
  ipcMain.handle('f0:runner-context-clear', async () => {
    runnerContexts.length = 0;
    safeConsole.log('[F0 Desktop] Runner context cleared');
    return true;
  });

  // ============================================
  // Phase 120: Project Indexer IPC Handlers
  // ============================================

  // IPC Handler: Set project root (for indexing)
  ipcMain.handle('f0:set-project-root', async (_event, projectRoot: string) => {
    if (!fs.existsSync(projectRoot)) {
      throw new Error(`Project root does not exist: ${projectRoot}`);
    }
    currentProjectRoot = projectRoot;
    safeConsole.log('[F0 Desktop] Project root set:', projectRoot);
    return true;
  });

  // IPC Handler: Scan and index project
  ipcMain.handle('f0:index:scan-project', async (_event, projectRoot?: string) => {
    const root = projectRoot || currentProjectRoot;
    safeConsole.log('[IPC] scan-project called with:', { projectRoot, currentProjectRoot, root });

    if (!root) {
      safeConsole.error('[IPC] scan-project called with NO currentProjectRoot');
      throw new Error('No project root set. Call f0:set-project-root first.');
    }

    if (!fs.existsSync(root)) {
      safeConsole.error('[IPC] scan-project: path does not exist:', root);
      throw new Error(`Project root does not exist: ${root}`);
    }

    safeConsole.log('[IPC] Scanning project at', root);
    const index = await scanAndSaveProject(root);
    safeConsole.log('[IPC] ✅ Scan complete:', index.totalFiles, 'files indexed');
    return index;
  });

  // IPC Handler: Get existing project index (from .f0/index/project-index.json)
  ipcMain.handle('f0:index:get-project-index', async (_event, projectRoot?: string) => {
    const root = projectRoot || currentProjectRoot;
    safeConsole.log('[IPC] get-project-index called with:', { projectRoot, currentProjectRoot, root });

    if (!root) {
      safeConsole.warn('[IPC] get-project-index with NO currentProjectRoot');
      return null;
    }

    const index = await loadProjectIndex(root);
    safeConsole.log('[IPC] get-project-index result:', index ? `${index.totalFiles} files` : 'no index found');
    return index; // null if not found
  });

  // ============================================
  // Phase 121: SEARCH_PROJECT_INDEX Tool for Agent
  // ============================================

  // IPC Handler: Search project index (files, symbols, exports)
  ipcMain.handle(
    'f0:index:search',
    async (
      _event,
      projectRoot: string | undefined,
      query: string,
      type: ProjectSearchType = 'all',
      limit: number = 20
    ) => {
      const root = projectRoot || currentProjectRoot;
      if (!root) {
        throw new Error('No project root set. Call f0:set-project-root first.');
      }

      safeConsole.log(`[F0 Desktop] Searching index: query="${query}", type=${type}, limit=${limit}`);
      const results = await searchProjectIndex(root, query, type, limit);
      safeConsole.log(`[F0 Desktop] Search found ${results.length} results`);

      return results;
    }
  );

  // ============================================
  // Phase 124.5.1: API Debugger IPC Handler
  // ============================================

  // IPC Handler: Debug API endpoint (combines code analysis + logs)
  ipcMain.handle(
    'f0:debug-api',
    async (
      _event,
      input: {
        urlPath?: string;
        query?: string;
        projectRoot?: string;
        minutesBack?: number;
      }
    ) => {
      const root = input.projectRoot || currentProjectRoot;
      if (!root) {
        return {
          success: false,
          reason: 'No project root set. Call f0:set-project-root first.',
        };
      }

      safeConsole.log(`[F0 Desktop] Debugging API: urlPath="${input.urlPath}", query="${input.query}"`);

      // Load routes index
      const routesIndex = loadRoutesIndex(root);
      if (!routesIndex) {
        return {
          success: false,
          reason: 'Routes index not found. Run indexer first.',
        };
      }

      // Create readFile function for the debugger
      const readFile = async (filePath: string): Promise<string> => {
        const fullPath = filePath.startsWith(root) ? filePath : path.join(root, filePath);
        return fs.readFileSync(fullPath, 'utf-8');
      };

      try {
        const result = await debugApiEndpoint({
          urlPath: input.urlPath,
          query: input.query,
          minutesBack: input.minutesBack || 60,
          routesIndex,
          projectRoot: root,
          readFile,
        });

        safeConsole.log(`[F0 Desktop] Debug result: success=${result.success}`);
        return result;
      } catch (error) {
        safeConsole.error('[F0 Desktop] Debug API error:', error);
        return {
          success: false,
          reason: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // IPC Handler: Get routes index
  ipcMain.handle('f0:get-routes-index', async (_event, projectRoot?: string) => {
    const root = projectRoot || currentProjectRoot;
    if (!root) {
      return null;
    }

    const routesIndex = loadRoutesIndex(root);
    return routesIndex;
  });

  // ============================================
  // Phase 124.6: Code Review IPC Handler
  // ============================================

  ipcMain.handle(
    'f0:code-review',
    async (
      _event,
      input: {
        filePath: string;
        before?: string | null;
        after: string;
        projectRoot?: string;
      }
    ) => {
      const root = input.projectRoot || currentProjectRoot;
      safeConsole.log(`[F0 Desktop] Code review requested for: ${input.filePath}`);

      // For now, return mock issues as the backend is not yet implemented
      // TODO: Connect to actual LLM-based code review endpoint
      const mockIssues = analyzeCodeLocally(input.filePath, input.after);

      return {
        success: true,
        issues: mockIssues,
        summary: mockIssues.length > 0
          ? `Found ${mockIssues.length} potential issue(s)`
          : 'No issues found',
      };
    }
  );

  // ============================================
  // Phase 124.6.2: Apply Issue Fix IPC Handler
  // ============================================

  ipcMain.handle(
    'f0:apply-issue-fix',
    async (
      _event,
      input: {
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
      }
    ): Promise<ApplyIssueFixResult> => {
      const root = input.projectRoot || currentProjectRoot;
      safeConsole.log(`[F0 Desktop] Apply issue fix requested for: ${input.filePath}`);
      safeConsole.log(`[F0 Desktop] Issue: ${input.issue.message} (${input.issue.severity}/${input.issue.category})`);

      try {
        // Use the issueFixer tool (currently uses local pattern matching, future: LLM)
        const result = await applyIssueFix({
          filePath: input.filePath,
          source: input.source,
          issue: input.issue,
          projectRoot: root || undefined,
        });

        safeConsole.log(`[F0 Desktop] Fix result: success=${result.success}, summary=${result.summary}`);
        return result;
      } catch (error) {
        safeConsole.error('[F0 Desktop] Apply issue fix error:', error);
        return {
          success: false,
          filePath: input.filePath,
          summary: 'Failed to generate fix',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // Phase 124.7: Batch Apply Issue Fix IPC Handler
  // Phase 144.1: Updated to use Cloud LLM API with local fallback
  // ============================================

  ipcMain.handle(
    'f0:batch-apply-issue-fix',
    async (
      _event,
      input: {
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
        /** Phase 144.1: Skip cloud API and use local fixes only */
        localOnly?: boolean;
      }
    ): Promise<BatchApplyIssueFixResult> => {
      const root = input.projectRoot || currentProjectRoot;
      safeConsole.log(`[F0 Desktop] Batch apply issue fix requested for: ${input.filePath}`);
      safeConsole.log(`[F0 Desktop] Issues count: ${input.issues.length}`);

      try {
        // Phase 144.1: Try cloud LLM API first (unless localOnly is set)
        if (!input.localOnly) {
          safeConsole.log(`[F0 Desktop] Trying cloud LLM auto-fix API...`);

          const cloudResult = await callCloudAutoFix({
            filePath: input.filePath,
            source: input.source,
            issueIds: input.issues.map(i => i.id),
            issues: input.issues.map(i => ({
              id: i.id,
              message: i.message,
              line: i.lineStart,
              severity: i.severity,
              category: i.category,
            })),
          });

          if (cloudResult?.ok && cloudResult.fixedSource) {
            safeConsole.log(`[F0 Desktop] Cloud auto-fix successful!`);
            return {
              success: true,
              filePath: input.filePath,
              fixedSource: cloudResult.fixedSource,
              appliedIssueIds: cloudResult.appliedIssueIds || input.issues.map(i => i.id),
              skippedIssueIds: cloudResult.skippedIssueIds || [],
              summary: `LLM fixed ${cloudResult.appliedIssueIds?.length || input.issues.length} issue(s)${cloudResult.notes ? ` - ${cloudResult.notes}` : ''}`,
            };
          }

          if (cloudResult && !cloudResult.ok) {
            safeConsole.log(`[F0 Desktop] Cloud auto-fix returned error: ${cloudResult.notes}`);
          }

          safeConsole.log(`[F0 Desktop] Cloud API unavailable, falling back to local fixes...`);
        }

        // Fall back to local pattern-based fixes
        const result = await batchApplyIssueFix({
          filePath: input.filePath,
          source: input.source,
          issues: input.issues,
          projectRoot: root || undefined,
        });

        safeConsole.log(`[F0 Desktop] Local batch fix result: success=${result.success}, ${result.summary}`);
        return result;
      } catch (error) {
        safeConsole.error('[F0 Desktop] Batch apply issue fix error:', error);
        return {
          success: false,
          filePath: input.filePath,
          fixedSource: input.source,
          appliedIssueIds: [],
          skippedIssueIds: input.issues.map(i => i.id),
          summary: 'Failed to generate batch fix',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // Phase 144.2.3: Auto-Fix Backup & Rollback IPC Handlers
  // ============================================

  /**
   * Create backup before applying patches
   */
  ipcMain.handle(
    'f0:autofix-create-backup',
    async (
      _event,
      input: {
        patches: Array<{
          filePath: string;
          before: string;
          after: string;
        }>;
        projectRoot?: string;
      }
    ): Promise<{
      success: boolean;
      session?: {
        timestamp: string;
        projectRoot: string;
        backupDir: string;
        files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }>;
        totalFilesBackedUp: number;
      };
      error?: string;
    }> => {
      const root = input.projectRoot || currentProjectRoot;
      if (!root) {
        return { success: false, error: 'No project root specified' };
      }

      safeConsole.log(`[F0 Desktop] Creating auto-fix backup for ${input.patches.length} files`);

      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(root, '.f0', 'auto-fix-backups', timestamp);

        // Create backup directory
        await fs.promises.mkdir(backupDir, { recursive: true });

        const files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }> = [];

        for (const patch of input.patches) {
          const relPath = path.relative(root, patch.filePath);
          const backupFilePath = path.join(backupDir, relPath);

          // Create subdirectory for file if needed
          const fileDir = path.dirname(backupFilePath);
          await fs.promises.mkdir(fileDir, { recursive: true });

          // Write original content to backup
          await fs.promises.writeFile(backupFilePath, patch.before, 'utf-8');

          files.push({
            path: relPath,
            sizeBefore: patch.before.length,
            sizeAfter: patch.after.length,
            issuesFixed: 0,
          });

          safeConsole.log(`[F0 Desktop] Backed up: ${relPath}`);
        }

        // Write manifest
        const session = {
          timestamp: new Date().toISOString(),
          projectRoot: root,
          backupDir,
          files,
          totalFilesBackedUp: files.length,
        };

        await fs.promises.writeFile(
          path.join(backupDir, 'manifest.json'),
          JSON.stringify(session, null, 2),
          'utf-8'
        );

        safeConsole.log(`[F0 Desktop] Created backup: ${timestamp} (${files.length} files)`);

        return { success: true, session };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        safeConsole.error('[F0 Desktop] Failed to create backup:', error);
        return { success: false, error: message };
      }
    }
  );

  /**
   * List available backup sessions
   */
  ipcMain.handle(
    'f0:autofix-list-backups',
    async (
      _event,
      input?: { projectRoot?: string }
    ): Promise<{
      success: boolean;
      sessions: Array<{
        timestamp: string;
        projectRoot: string;
        backupDir: string;
        files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }>;
        totalFilesBackedUp: number;
      }>;
      error?: string;
    }> => {
      const root = input?.projectRoot || currentProjectRoot;
      if (!root) {
        return { success: false, sessions: [], error: 'No project root specified' };
      }

      const backupsDir = path.join(root, '.f0', 'auto-fix-backups');

      try {
        // Check if backups directory exists
        try {
          await fs.promises.access(backupsDir);
        } catch {
          return { success: true, sessions: [] };
        }

        const folders = await fs.promises.readdir(backupsDir);
        const sessions: Array<{
          timestamp: string;
          projectRoot: string;
          backupDir: string;
          files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }>;
          totalFilesBackedUp: number;
        }> = [];

        for (const folder of folders) {
          try {
            const manifestPath = path.join(backupsDir, folder, 'manifest.json');
            const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
            const session = JSON.parse(manifestContent);
            sessions.push(session);
          } catch {
            // Skip invalid backup folders
          }
        }

        // Sort by timestamp (newest first)
        sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        return { success: true, sessions };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, sessions: [], error: message };
      }
    }
  );

  /**
   * Rollback to a specific backup session
   */
  ipcMain.handle(
    'f0:autofix-rollback',
    async (
      _event,
      input: {
        backupDir: string;
      }
    ): Promise<{
      success: boolean;
      restoredFiles: string[];
      errors: string[];
    }> => {
      safeConsole.log(`[F0 Desktop] Rolling back to: ${input.backupDir}`);

      const restoredFiles: string[] = [];
      const errors: string[] = [];

      try {
        // Read manifest
        const manifestPath = path.join(input.backupDir, 'manifest.json');
        const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
        const session = JSON.parse(manifestContent) as {
          timestamp: string;
          projectRoot: string;
          files: Array<{ path: string }>;
        };

        for (const file of session.files) {
          try {
            const backupFilePath = path.join(input.backupDir, file.path);
            const content = await fs.promises.readFile(backupFilePath, 'utf-8');

            // Restore the original file
            const originalFilePath = path.join(session.projectRoot, file.path);
            await fs.promises.writeFile(originalFilePath, content, 'utf-8');

            restoredFiles.push(file.path);
            safeConsole.log(`[F0 Desktop] Restored: ${file.path}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            errors.push(`Failed to restore ${file.path}: ${message}`);
            safeConsole.error(`[F0 Desktop] Failed to restore: ${file.path}`, err);
          }
        }

        const success = errors.length === 0;
        safeConsole.log(
          `[F0 Desktop] Rollback ${success ? 'successful' : 'completed with errors'}: ` +
          `${restoredFiles.length} restored, ${errors.length} errors`
        );

        return { success, restoredFiles, errors };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        safeConsole.error('[F0 Desktop] Rollback failed:', error);
        return { success: false, restoredFiles: [], errors: [message] };
      }
    }
  );

  /**
   * Get the most recent backup session
   */
  ipcMain.handle(
    'f0:autofix-get-last-backup',
    async (
      _event,
      input?: { projectRoot?: string }
    ): Promise<{
      success: boolean;
      session?: {
        timestamp: string;
        projectRoot: string;
        backupDir: string;
        files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }>;
        totalFilesBackedUp: number;
      };
      error?: string;
    }> => {
      const root = input?.projectRoot || currentProjectRoot;
      if (!root) {
        return { success: false, error: 'No project root specified' };
      }

      const backupsDir = path.join(root, '.f0', 'auto-fix-backups');

      try {
        // Check if backups directory exists
        try {
          await fs.promises.access(backupsDir);
        } catch {
          return { success: true, session: undefined };
        }

        const folders = await fs.promises.readdir(backupsDir);
        let latestSession: {
          timestamp: string;
          projectRoot: string;
          backupDir: string;
          files: Array<{ path: string; sizeBefore: number; sizeAfter?: number; issuesFixed: number }>;
          totalFilesBackedUp: number;
        } | undefined;

        for (const folder of folders) {
          try {
            const manifestPath = path.join(backupsDir, folder, 'manifest.json');
            const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
            const session = JSON.parse(manifestContent);
            if (!latestSession || session.timestamp > latestSession.timestamp) {
              latestSession = session;
            }
          } catch {
            // Skip invalid backup folders
          }
        }

        return { success: true, session: latestSession };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );

  // ============================================
  // Phase 145.1: ACE Auto-Fix IPC Handler
  // ============================================

  /**
   * ACE Auto-Fix - Call backend for intelligent auto-fix suggestions
   */
  ipcMain.handle(
    'f0:ace-auto-fix',
    async (
      _event,
      input: {
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
      }
    ): Promise<{
      filePath: string;
      patches: Array<{
        id: string;
        description: string;
        startLine: number;
        endLine: number;
        replacement: string;
      }>;
      notes?: string[];
    }> => {
      safeConsole.log(`[F0 Desktop] ACE Auto-Fix requested for: ${input.filePath}`);
      safeConsole.log(`[F0 Desktop] Issues count: ${input.issues.length}`);

      try {
        // Call the ACE backend
        const result = await callAceBackendForAutoFix(input);
        safeConsole.log(`[F0 Desktop] ACE Auto-Fix result: ${result.patches.length} patches`);
        return result;
      } catch (error) {
        safeConsole.error('[F0 Desktop] ACE Auto-Fix error:', error);
        return {
          filePath: input.filePath,
          patches: [],
          notes: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        };
      }
    }
  );

  // ============================================
  // Phase 129.7: Single File Analysis IPC Handler for ACE
  // ============================================

  ipcMain.handle(
    'f0:analyze-file',
    async (
      _event,
      input: {
        filePath: string;
        source: string;
      }
    ): Promise<{
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
    }> => {
      safeConsole.log(`[F0 Desktop] Analyzing file: ${input.filePath}`);
      try {
        const rawIssues = analyzeCodeLocally(input.filePath, input.source);
        safeConsole.log(`[F0 Desktop] Found ${rawIssues.length} issues`);
        return { success: true, issues: rawIssues };
      } catch (err) {
        safeConsole.error('[F0 Desktop] File analysis error:', err);
        return { success: false, issues: [] };
      }
    }
  );

  // ============================================
  // Phase 130.6: Test Runner IPC Handlers
  // ============================================

  // IPC Handler: Run test command with streaming output
  ipcMain.on('f0:tests-run', (event, payload: {
    id: string;
    projectPath: string;
    command: string;
  }) => {
    const { id, projectPath, command } = payload;

    safeConsole.log('[F0 Desktop] Test run request:', { id, projectPath, command });

    // Validate project path exists
    if (!fs.existsSync(projectPath)) {
      event.sender.send('f0:tests-error', {
        id,
        message: `Project path does not exist: ${projectPath}`,
      });
      return;
    }

    // Parse command
    const [cmd, ...args] = command.split(' ');

    // Spawn the process
    const child = spawn(cmd, args, {
      cwd: projectPath,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1', CI: 'true' }, // Enable colors, CI mode for cleaner output
    });

    // Track the process
    activeProcesses.set(`test-${id}`, child);

    // Notify start
    event.sender.send('f0:tests-start', { id, pid: child.pid });
    safeConsole.log('[F0 Desktop] Test started:', { id, pid: child.pid, command });

    let stdout = '';
    let stderr = '';

    // Stream stdout
    child.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      event.sender.send('f0:tests-output', {
        id,
        stream: 'stdout',
        chunk,
      });
    });

    // Stream stderr
    child.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      event.sender.send('f0:tests-output', {
        id,
        stream: 'stderr',
        chunk,
      });
    });

    // Handle process end
    child.on('close', (code: number | null) => {
      activeProcesses.delete(`test-${id}`);
      event.sender.send('f0:tests-end', {
        id,
        exitCode: code ?? -1,
        stdout,
        stderr,
      });
      safeConsole.log('[F0 Desktop] Test ended:', { id, exitCode: code });
    });

    // Handle error (e.g., command not found)
    child.on('error', (err: Error) => {
      activeProcesses.delete(`test-${id}`);
      event.sender.send('f0:tests-error', {
        id,
        message: err.message,
      });
      safeConsole.error('[F0 Desktop] Test error:', { id, error: err.message });
    });
  });

  // IPC Handler: Kill test process
  ipcMain.on('f0:tests-kill', (_event, id: string) => {
    const child = activeProcesses.get(`test-${id}`);
    if (child) {
      safeConsole.log('[F0 Desktop] Killing test:', id);
      child.kill('SIGTERM');
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (activeProcesses.has(`test-${id}`)) {
          child.kill('SIGKILL');
          activeProcesses.delete(`test-${id}`);
        }
      }, 5000);
    }
  });

  // IPC Handler: Check if file exists (for test discovery)
  ipcMain.handle('f0:file-exists', async (_event, filePath: string) => {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  });

  // ============================================
  // Phase 168: Check if path is a directory (for drag & drop)
  // ============================================
  ipcMain.handle('f0:is-directory', async (_event, filePath: string) => {
    try {
      const stats = fs.statSync(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  });

  // ============================================
  // Phase 168: Write binary file (for drag & drop images)
  // ============================================
  ipcMain.handle('f0:write-binary-file', async (_event, filePath: string, base64Data: string) => {
    try {
      safeConsole.log('[F0 Desktop] Writing binary file:', filePath);

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert base64 to buffer and write
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);

      return true;
    } catch (error) {
      safeConsole.error('[F0 Desktop] Error writing binary file:', filePath, error);
      return false;
    }
  });

  // ============================================
  // Phase 131.4: Network Addresses IPC Handler (for QR Code)
  // ============================================

  ipcMain.handle('f0:get-network-addresses', async () => {
    try {
      const interfaces = os.networkInterfaces();
      const addresses: string[] = [];

      for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (!iface) continue;

        for (const info of iface) {
          // Skip internal (loopback) and non-IPv4 addresses
          if (info.internal || info.family !== 'IPv4') continue;
          addresses.push(info.address);
        }
      }

      // Add localhost as fallback
      if (addresses.length === 0) {
        addresses.push('localhost');
      }

      safeConsole.log('[F0 Desktop] Network addresses:', addresses);
      return addresses;
    } catch (err) {
      safeConsole.error('[F0 Desktop] Error getting network addresses:', err);
      return ['localhost'];
    }
  });

  // ============================================
  // Phase 180.1: Shell Agent IPC Handler
  // ============================================

  /**
   * Run a shell command from the Agent chat
   * Only safe commands are allowed based on SHELL_AGENT_ALLOWED_PREFIXES
   */
  ipcMain.handle(
    'f0:run-shell-command',
    async (
      _event,
      command: string,
      cwd?: string
    ): Promise<{ output: string; error?: string; exitCode: number }> => {
      safeConsole.log(`[F0 Desktop] Shell Agent command request: "${command}" in ${cwd || 'default dir'}`);

      // Use the project root or provided cwd
      const workingDir = cwd || currentProjectRoot || process.cwd();

      // Validate working directory exists
      if (!fs.existsSync(workingDir)) {
        safeConsole.warn(`[F0 Desktop] Shell Agent: cwd does not exist: ${workingDir}`);
        return {
          output: '',
          error: `Working directory does not exist: ${workingDir}`,
          exitCode: 1,
        };
      }

      // Security check: Validate command is in allowed list
      // Phase 180.1: Shell Agent has its own whitelist (ls, npm, git status, etc.)
      const SHELL_AGENT_ALLOWED_PREFIXES = [
        // File listing (read-only, safe)
        'ls ',
        'ls',
        'dir ',  // Windows
        'dir',

        // Package info (read-only)
        'npm list',
        'npm ls',
        'npm view',
        'npm info',
        'npm outdated',
        'npm audit',
        'pnpm list',
        'pnpm ls',
        'pnpm why',
        'pnpm outdated',
        'yarn list',
        'yarn why',

        // Testing & Scripts (Phase 180.8)
        'npm test',
        'npm run ',  // npm run <script>
        'pnpm test',
        'pnpm run ',  // pnpm run <script>
        'yarn test',
        'yarn run ',  // yarn run <script>
        'bun test',
        'bun run ',  // bun run <script>

        // Git status commands (read-only)
        'git status',
        'git log',
        'git diff',
        'git branch',
        'git remote',
        'git show',
        'git ls-files',
        'git rev-parse',

        // Node/runtime version checks
        'node -v',
        'node --version',
        'npm -v',
        'npm --version',
        'pnpm -v',
        'pnpm --version',
        'yarn -v',
        'yarn --version',
        'bun -v',
        'bun --version',

        // Type checking (read-only analysis)
        'npx tsc --noEmit',
        'pnpm tsc --noEmit',
        'npm run typecheck',
        'pnpm typecheck',

        // Linting (read-only analysis)
        'npm run lint',
        'pnpm lint',
        'npx eslint',
        'pnpm eslint',

        // Package.json info
        'cat package.json',
        'head package.json',

        // Environment info
        'pwd',
        'which ',
        'where ',
        'echo $',
      ];

      const trimmedCommand = command.trim();

      // Check if command starts with any allowed prefix
      let isAllowed = false;
      for (const prefix of SHELL_AGENT_ALLOWED_PREFIXES) {
        if (prefix.endsWith(' ')) {
          if (trimmedCommand.startsWith(prefix) || trimmedCommand === prefix.trim()) {
            isAllowed = true;
            break;
          }
        } else {
          if (trimmedCommand === prefix || trimmedCommand.startsWith(prefix + ' ')) {
            isAllowed = true;
            break;
          }
        }
      }

      if (!isAllowed) {
        safeConsole.warn(`[F0 Desktop] Shell Agent: Command not allowed: ${trimmedCommand}`);
        return {
          output: '',
          error: `Command not allowed by Shell Agent. Allowed: ls, git status, npm list, etc.`,
          exitCode: 1,
        };
      }

      // Execute the command
      return new Promise((resolve) => {
        const child = spawn(trimmedCommand, [], {
          cwd: workingDir,
          shell: true,
          env: { ...process.env, FORCE_COLOR: '0' }, // Disable colors for cleaner output
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        child.on('close', (code: number | null) => {
          const exitCode = code ?? 0;
          safeConsole.log(`[F0 Desktop] Shell Agent command completed: exit=${exitCode}`);

          // Combine output, truncate if too long
          let output = stdout;
          if (stderr && exitCode !== 0) {
            output += stderr ? `\n--- stderr ---\n${stderr}` : '';
          }

          // Truncate if output is too long (max 10KB)
          const MAX_OUTPUT = 10 * 1024;
          if (output.length > MAX_OUTPUT) {
            output = output.slice(0, MAX_OUTPUT) + '\n... [output truncated]';
          }

          resolve({
            output,
            error: exitCode !== 0 ? stderr || 'Command failed' : undefined,
            exitCode,
          });
        });

        child.on('error', (err: Error) => {
          safeConsole.error(`[F0 Desktop] Shell Agent command error: ${err.message}`);
          resolve({
            output: '',
            error: err.message,
            exitCode: 1,
          });
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGTERM');
            resolve({
              output: stdout,
              error: 'Command timed out (30 seconds)',
              exitCode: 124,
            });
          }
        }, 30000);
      });
    }
  );

  // ============================================
  // Phase 124.8: Project-Wide Issues Scanner IPC Handler
  // ============================================

  ipcMain.handle(
    'f0:scan-project-issues',
    async (
      _event,
      input: {
        projectRoot?: string;
        maxFiles?: number;
      }
    ): Promise<{
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
    }> => {
      const projectRoot = input.projectRoot || currentProjectRoot;

      if (!projectRoot) {
        safeConsole.warn('[F0 Desktop] Scan project issues: no project root');
        return { success: false, error: 'NO_PROJECT_ROOT' };
      }

      safeConsole.log(`[F0 Desktop] Starting project scan at: ${projectRoot} (max ${input.maxFiles ?? 200} files)`);

      try {
        const result = await scanProjectForIssuesMain({
          projectRoot,
          maxFiles: input.maxFiles ?? 200,
        });

        safeConsole.log(`[F0 Desktop] Scan complete: ${result.scannedFiles} files, ${result.totalIssues} issues`);

        return { success: true, result };
      } catch (error) {
        safeConsole.error('[F0 Desktop] Scan project issues error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}

// ============================================
// Phase 144.1: Cloud Auto-Fix API Helper
// ============================================

/**
 * Phase 144.1: Cloud LLM Auto-Fix API
 * Calls the backend /api/ide/auto-fix endpoint for LLM-powered code fixes
 */
interface CloudAutoFixInput {
  projectId?: string;
  filePath: string;
  source: string;
  issueIds: string[];
  issues: Array<{
    id: string;
    message: string;
    line?: number;
    severity?: string;
    category?: string;
  }>;
}

interface CloudAutoFixResponse {
  ok: boolean;
  fixedSource?: string;
  notes?: string;
  appliedIssueIds?: string[];
  skippedIssueIds?: string[];
}

/**
 * Get the backend URL from environment or use default
 */
function getBackendUrl(): string {
  // In development, use localhost:3030
  // In production, could read from app config or environment
  return process.env.F0_BACKEND_URL || 'http://localhost:3030';
}

/**
 * Call the cloud auto-fix API
 * Returns null if the API is unavailable or fails
 */
async function callCloudAutoFix(input: CloudAutoFixInput): Promise<CloudAutoFixResponse | null> {
  const backendUrl = getBackendUrl();
  const endpoint = `${backendUrl}/api/ide/auto-fix`;

  safeConsole.log(`[CloudAutoFix] Calling ${endpoint} for ${input.filePath}`);
  safeConsole.log(`[CloudAutoFix] Issues: ${input.issues.length}`);

  try {
    // Use native fetch (available in Node 18+)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: input.projectId || 'desktop-ide',
        filePath: input.filePath,
        source: input.source,
        issueIds: input.issueIds,
        issues: input.issues,
      }),
      // 30 second timeout
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      safeConsole.warn(`[CloudAutoFix] HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const result = await response.json() as CloudAutoFixResponse;
    safeConsole.log(`[CloudAutoFix] Result: ok=${result.ok}, applied=${result.appliedIssueIds?.length || 0}`);

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    safeConsole.warn(`[CloudAutoFix] API call failed: ${message}`);
    // Return null to fall back to local fix
    return null;
  }
}

// ============================================
// Phase 145.1: ACE Auto-Fix Backend Helper
// ============================================

/**
 * ACE Auto-Fix input type
 */
interface AceAutoFixInput {
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
}

/**
 * ACE Auto-Fix response type
 */
interface AceAutoFixResponse {
  filePath: string;
  patches: Array<{
    id: string;
    description: string;
    startLine: number;
    endLine: number;
    replacement: string;
  }>;
  notes?: string[];
}

/**
 * Phase 147: Call the ACE Auto-Fix Cloud Function
 * Uses OpenAI to generate intelligent code fix patches
 */
async function callAceBackendForAutoFix(input: AceAutoFixInput): Promise<AceAutoFixResponse> {
  // Firebase Cloud Function URL for ACE Auto-Fix
  // In production, this is the deployed Firebase function
  // In development, can use emulator URL
  const cloudFunctionUrl = process.env.ACE_AUTOFIX_URL ||
    'https://us-central1-from-zero-84253.cloudfunctions.net/aceAutoFix';

  safeConsole.log(`[ACE AutoFix] Calling Cloud Function for ${input.filePath}`);
  safeConsole.log(`[ACE AutoFix] Issues: ${input.issues.length}`);

  try {
    // Map input to Cloud Function request format
    const requestBody = {
      filePath: input.filePath,
      fileRole: `${input.language} file`,
      code: input.source,
      issues: input.issues.map((issue) => ({
        id: issue.id,
        message: issue.message,
        line: issue.line,
        column: issue.column,
        severity: issue.severity === 'high' ? 'high' : issue.severity === 'medium' ? 'medium' : 'low',
        ruleId: issue.ruleId,
      })),
      riskLevel: 'balanced' as const,
      language: input.language,
      dryRun: false,
    };

    const response = await fetch(cloudFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      // 120 second timeout (Cloud Function has 120s timeout)
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      safeConsole.warn(`[ACE AutoFix] HTTP ${response.status}: ${response.statusText}`);
      return {
        filePath: input.filePath,
        patches: [],
        notes: [`ACE Cloud Function returned HTTP ${response.status}`],
      };
    }

    // Parse Cloud Function response
    const cloudResult = await response.json() as {
      patches: Array<{
        filePath?: string;
        start: { line: number; column: number };
        end: { line: number; column: number };
        replacement: string;
        reason?: string;
      }>;
      summary?: string;
      success: boolean;
      error?: string;
    };

    safeConsole.log(`[ACE AutoFix] Cloud Function result: success=${cloudResult.success}, patches=${cloudResult.patches?.length || 0}`);

    if (!cloudResult.success) {
      return {
        filePath: input.filePath,
        patches: [],
        notes: [cloudResult.error || 'Cloud Function returned success=false'],
      };
    }

    // Map Cloud Function patches to Desktop format
    const mappedPatches = (cloudResult.patches || []).map((patch, index) => ({
      id: `ace-patch-${index + 1}`,
      description: patch.reason || `Fix at line ${patch.start.line}`,
      startLine: patch.start.line,
      endLine: patch.end.line,
      replacement: patch.replacement,
      // Store original patch info for precise application
      _start: patch.start,
      _end: patch.end,
    }));

    safeConsole.log(`[ACE AutoFix] Mapped ${mappedPatches.length} patches for ${input.filePath}`);

    return {
      filePath: input.filePath,
      patches: mappedPatches,
      notes: cloudResult.summary ? [cloudResult.summary] : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    safeConsole.warn(`[ACE AutoFix] Cloud Function call failed: ${message}`);

    // Return empty patches as fallback - ACE is optional
    return {
      filePath: input.filePath,
      patches: [],
      notes: [`ACE Cloud Function unavailable: ${message}`],
    };
  }
}

/**
 * Phase 124.6: Local code analysis (placeholder for LLM-based review)
 * This performs basic static analysis until the full LLM backend is ready
 */
function analyzeCodeLocally(filePath: string, code: string): Array<{
  id: string;
  severity: 'info' | 'warning' | 'error';
  category: 'logic' | 'security' | 'performance' | 'style' | 'best-practice';
  message: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  fixPrompt?: string;
  suggestedFix?: string | null;
}> {
  const issues: Array<{
    id: string;
    severity: 'info' | 'warning' | 'error';
    category: 'logic' | 'security' | 'performance' | 'style' | 'best-practice';
    message: string;
    file: string;
    lineStart: number;
    lineEnd: number;
    fixPrompt?: string;
    suggestedFix?: string | null;
  }> = [];

  const lines = code.split('\n');
  const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  const isJavaScript = filePath.endsWith('.js') || filePath.endsWith('.jsx') || isTypeScript;
  const isTestFile = filePath.includes('test') || filePath.includes('spec') || filePath.includes('__tests__');
  const isJson = filePath.endsWith('.json');
  // JSONC files allow comments (tsconfig.json, jsconfig.json, etc.)
  const isJsonc = filePath.endsWith('tsconfig.json') ||
                  filePath.endsWith('jsconfig.json') ||
                  filePath.includes('.vscode/') ||
                  filePath.endsWith('.jsonc');

  // Phase 124.7.2: JSON file analysis
  if (isJson) {
    // Try to parse JSON to check for syntax errors (skip JSONC files)
    if (!isJsonc) {
      try {
        JSON.parse(code);
      } catch (e: unknown) {
        const error = e as SyntaxError;
        // Extract line number from error message if possible
        const posMatch = error.message.match(/position\s+(\d+)/i);
        let errorLine = 1;
        if (posMatch) {
          const pos = parseInt(posMatch[1]);
          let charCount = 0;
          for (let i = 0; i < lines.length; i++) {
            charCount += lines[i].length + 1; // +1 for newline
            if (charCount >= pos) {
              errorLine = i + 1;
              break;
            }
          }
        }
        issues.push({
          id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
          severity: 'error',
          category: 'logic',
          message: `JSON Syntax Error: ${error.message}`,
          file: filePath,
          lineStart: errorLine,
          lineEnd: errorLine,
          fixPrompt: 'Fix the JSON syntax error',
        });
      }
    }

    // Check for trailing commas (invalid in standard JSON, but OK in JSONC)
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      // Check for trailing comma before } or ] (skip JSONC files)
      if (!isJsonc && /,\s*$/.test(line)) {
        const nextLine = lines[index + 1]?.trim();
        if (nextLine === '}' || nextLine === ']' || nextLine === '},' || nextLine === '],') {
          issues.push({
            id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
            severity: 'error',
            category: 'logic',
            message: 'Trailing comma is not allowed in JSON',
            file: filePath,
            lineStart: lineNum,
            lineEnd: lineNum,
            fixPrompt: 'Remove the trailing comma',
          });
        }
      }

      // Check for comments (not allowed in standard JSON, but OK in JSONC files)
      if (!isJsonc && (/^\s*\/\//.test(line) || /^\s*\/\*/.test(line))) {
        issues.push({
          id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
          severity: 'error',
          category: 'logic',
          message: 'Comments are not allowed in standard JSON',
          file: filePath,
          lineStart: lineNum,
          lineEnd: lineNum,
          fixPrompt: 'Remove the comment or use JSONC format',
        });
      }

      // Check for single quotes (should be double quotes)
      if (/:\s*'[^']*'/.test(line) || /^\s*'[^']*'\s*:/.test(line)) {
        issues.push({
          id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
          severity: 'error',
          category: 'logic',
          message: 'JSON requires double quotes, not single quotes',
          file: filePath,
          lineStart: lineNum,
          lineEnd: lineNum,
          fixPrompt: 'Replace single quotes with double quotes',
        });
      }

      // Check for unquoted keys
      if (/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*:/.test(line) && !/^\s*"/.test(line)) {
        issues.push({
          id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
          severity: 'error',
          category: 'logic',
          message: 'JSON keys must be quoted with double quotes',
          file: filePath,
          lineStart: lineNum,
          lineEnd: lineNum,
          fixPrompt: 'Add double quotes around the key',
        });
      }
    });

    // Check for duplicate keys (parse and look for duplicates)
    const keyOccurrences = new Map<string, number[]>();
    lines.forEach((line, index) => {
      const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
      if (keyMatch) {
        const key = keyMatch[1];
        const existing = keyOccurrences.get(key) || [];
        existing.push(index + 1);
        keyOccurrences.set(key, existing);
      }
    });
    keyOccurrences.forEach((lineNumbers, key) => {
      if (lineNumbers.length > 1) {
        issues.push({
          id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
          severity: 'warning',
          category: 'logic',
          message: `Duplicate key "${key}" found on lines ${lineNumbers.join(', ')}`,
          file: filePath,
          lineStart: lineNumbers[0],
          lineEnd: lineNumbers[0],
          fixPrompt: 'Remove or rename duplicate keys',
        });
      }
    });

    return issues;
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
      return;
    }

    // Check for safeConsole.log in production code
    // Phase 129.8: Detect actual safeConsole.log( calls, not comments like /* safeConsole.log removed */
    // Must check for safeConsole.log followed by ( to avoid false positives on already-fixed lines
    if (/console\.log\s*\(/.test(line) && !line.includes('/* safeConsole.log removed */') && !isTestFile) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'best-practice',
        message: 'safeConsole.log() should be removed in production',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Remove this safeConsole.log statement',
        suggestedFix: '',
      });
    }

    // Check for safeConsole.error/warn that might need attention
    // Phase 129.8: Detect actual safeConsole.error/warn( calls, not comments
    if ((/console\.error\s*\(/.test(line) || /console\.warn\s*\(/.test(line)) && !isTestFile) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'info',
        category: 'best-practice',
        message: 'safeConsole.log/error/warn should be reviewed for production',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }

    // Check for TODO/FIXME comments
    if (/\/\/\s*(TODO|FIXME|HACK|XXX)/i.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'info',
        category: 'style',
        message: 'Found TODO/FIXME comment that needs attention',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }

    // Check for potential SQL injection (very basic)
    if (/query\s*\(\s*['"`].*\$\{/.test(line) || /execute\s*\(\s*['"`].*\+/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'error',
        category: 'security',
        message: 'Potential SQL injection vulnerability - use parameterized queries',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Use parameterized queries instead of string concatenation',
      });
    }

    // Check for any type usage in TypeScript
    if (/:\s*any\b/.test(line) && isTypeScript) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'style',
        message: 'Avoid using "any" type - prefer specific types for better type safety',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Replace "any" with a more specific type',
        suggestedFix: line.replace(/:\s*any\b/, ': unknown'),
      });
    }

    // Check for hardcoded secrets (very basic patterns)
    if (/(?:password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]+['"]/i.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'error',
        category: 'security',
        message: 'Potential hardcoded secret detected - use environment variables',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Move this secret to an environment variable',
      });
    }

    // Phase 124.7.1: Additional patterns for better detection

    // Check for empty catch blocks
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line) || (trimmedLine === 'catch {' || trimmedLine === 'catch (e) {' || trimmedLine === 'catch (err) {')) {
      // Look ahead for empty block
      const nextLine = lines[index + 1]?.trim();
      if (nextLine === '}') {
        issues.push({
          id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
          severity: 'warning',
          category: 'logic',
          message: 'Empty catch block - errors should be handled or logged',
          file: filePath,
          lineStart: lineNum,
          lineEnd: lineNum + 1,
          fixPrompt: 'Add error handling or at minimum log the error',
        });
      }
    }

    // Check for debugger statements
    if (/\bdebugger\b/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'error',
        category: 'best-practice',
        message: 'Remove debugger statement before production',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Remove debugger statement',
        suggestedFix: line.replace(/\bdebugger;?\s*/, ''),
      });
    }

    // Check for == instead of === (non-strict equality)
    if (isJavaScript && /[^!=]==[^=]/.test(line) && !/['"]/.test(line.split('==')[0])) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'best-practice',
        message: 'Use === instead of == for strict equality comparison',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Replace == with ===',
        suggestedFix: line.replace(/([^!=])={2}([^=])/g, '$1===$2'),
      });
    }

    // Check for != instead of !== (non-strict inequality)
    if (isJavaScript && /[^!]!=[^=]/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'best-practice',
        message: 'Use !== instead of != for strict inequality comparison',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Replace != with !==',
        suggestedFix: line.replace(/([^!])!={1}([^=])/g, '$1!==$2'),
      });
    }

    // Check for var instead of let/const
    if (isJavaScript && /\bvar\s+\w/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'best-practice',
        message: 'Use let or const instead of var for better scoping',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Replace var with let or const',
        suggestedFix: line.replace(/\bvar\s+/, 'const '),
      });
    }

    // Check for alert() calls
    if (/\balert\s*\(/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'best-practice',
        message: 'Avoid using alert() - use proper UI notifications instead',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Replace alert with a proper notification system',
      });
    }

    // Check for eval() usage
    if (/\beval\s*\(/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'error',
        category: 'security',
        message: 'eval() is dangerous and can lead to XSS vulnerabilities',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Avoid using eval - find a safer alternative',
      });
    }

    // Check for innerHTML usage
    if (/\.innerHTML\s*=/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'security',
        message: 'innerHTML can lead to XSS - use textContent or sanitize input',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Use textContent for text or sanitize HTML input',
      });
    }

    // Check for document.write
    if (/document\.write\s*\(/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'error',
        category: 'best-practice',
        message: 'document.write() is outdated and blocks page rendering',
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        fixPrompt: 'Use DOM manipulation methods instead',
      });
    }

    // Check for synchronous XMLHttpRequest
    if (/new\s+XMLHttpRequest\s*\(\)/.test(line) || /\.open\s*\([^,]+,\s*[^,]+,\s*false\)/.test(line)) {
      if (/\.open\s*\([^,]+,\s*[^,]+,\s*false\)/.test(line)) {
        issues.push({
          id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
          severity: 'error',
          category: 'performance',
          message: 'Synchronous XHR blocks the main thread - use async or fetch()',
          file: filePath,
          lineStart: lineNum,
          lineEnd: lineNum,
          fixPrompt: 'Use async/await with fetch() instead',
        });
      }
    }

    // Check for missing return type in TypeScript functions
    if (isTypeScript && /^(export\s+)?(async\s+)?function\s+\w+\s*\([^)]*\)\s*\{/.test(trimmedLine)) {
      if (!/\)\s*:\s*\w/.test(line)) {
        issues.push({
          id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
          severity: 'info',
          category: 'style',
          message: 'Consider adding explicit return type for better type safety',
          file: filePath,
          lineStart: lineNum,
          lineEnd: lineNum,
          fixPrompt: 'Add explicit return type annotation',
        });
      }
    }

    // Check for magic numbers (numbers not assigned to constants)
    if (isJavaScript && /[^0-9a-zA-Z_]\d{2,}[^0-9a-zA-Z_]/.test(line)) {
      // Skip common cases like array indices, ports, line numbers in comments
      if (!/\[\d+\]/.test(line) && !/:\s*\d+/.test(line) && !/\/\/.*\d+/.test(line) && !/line\s*\d+/i.test(line)) {
        const match = line.match(/\b(\d{3,})\b/);
        if (match && parseInt(match[1]) > 10 && !line.includes('1000') && !line.includes('60') && !line.includes('24') && !line.includes('365')) {
          issues.push({
            id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
            severity: 'info',
            category: 'style',
            message: `Magic number ${match[1]} - consider using a named constant`,
            file: filePath,
            lineStart: lineNum,
            lineEnd: lineNum,
            fixPrompt: 'Extract magic number to a named constant',
          });
        }
      }
    }
  });

  return issues;
}

// ============================================
// Phase 124.8: Project-Wide Scanner Function
// ============================================

// Phase 148.3 B2: Directories to exclude from scanning
// Added dist-electron, .backup folders to avoid scanning build outputs
const EXCLUDED_SCAN_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'dist-electron',  // Phase 148.3 B2: Electron build output
  'build',
  'coverage',
  '.git',
  '.f0',
  'out',
  '__pycache__',
  '.cache',
  '.turbo',
  '.vercel',
  '.nuxt',
  '.output',
  'public',
  'static',
  '.idea',
  '.vscode',
  '.backup',        // Phase 148.3 B2: Backup folders
  'backups',        // Phase 148.3 B2: Backup folders
]);

// File extensions to scan
const SCANNABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

// Files to exclude
const EXCLUDED_SCAN_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.DS_Store',
]);

function shouldScanFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  if (EXCLUDED_SCAN_FILES.has(fileName)) return false;
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(fileName)) return false;

  return SCANNABLE_EXTENSIONS.has(ext);
}

function collectScannableFiles(dir: string, files: string[] = [], maxFiles: number = 200): string[] {
  if (files.length >= maxFiles) return files;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) break;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDED_SCAN_DIRS.has(entry.name)) {
          collectScannableFiles(fullPath, files, maxFiles);
        }
      } else if (entry.isFile() && shouldScanFile(fullPath)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    safeConsole.warn(`[projectIssuesScanner] Cannot read directory: ${dir}`);
  }

  return files;
}

type FileIssuesSummary = {
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
};

type ProjectScanResult = {
  scannedFiles: number;
  totalIssues: number;
  totalErrors: number;
  totalWarnings: number;
  totalInfos: number;
  summaries: FileIssuesSummary[];
  skippedFiles: number;
  scanDurationMs: number;
};

async function scanProjectForIssuesMain(options: {
  projectRoot: string;
  maxFiles?: number;
}): Promise<ProjectScanResult> {
  const { projectRoot, maxFiles = 200 } = options;
  const startTime = Date.now();

  safeConsole.log(`[projectIssuesScanner] Starting scan at: ${projectRoot} (max ${maxFiles} files)`);

  const files = collectScannableFiles(projectRoot, [], maxFiles);
  const totalFiles = files.length;
  safeConsole.log(`[projectIssuesScanner] Found ${totalFiles} files to scan`);

  const summaries: FileIssuesSummary[] = [];
  let totalIssues = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfos = 0;
  let skippedFiles = 0;

  for (const filePath of files) {
    const relativePath = path.relative(projectRoot, filePath);

    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const rawIssues = analyzeCodeLocally(filePath, code);

      if (rawIssues.length > 0) {
        const errors = rawIssues.filter((i) => i.severity === 'error').length;
        const warnings = rawIssues.filter((i) => i.severity === 'warning').length;
        const infos = rawIssues.filter((i) => i.severity === 'info').length;

        const categories: Record<string, number> = {};
        rawIssues.forEach((issue) => {
          categories[issue.category] = (categories[issue.category] || 0) + 1;
        });

        // Map issues to simpler format
        const issues = rawIssues.map((i) => ({
          id: i.id,
          severity: i.severity,
          category: i.category,
          message: i.message,
          lineStart: i.lineStart,
          lineEnd: i.lineEnd,
        }));

        summaries.push({
          filePath,
          relativePath,
          issueCount: rawIssues.length,
          errors,
          warnings,
          infos,
          categories,
          issues,
        });

        totalIssues += rawIssues.length;
        totalErrors += errors;
        totalWarnings += warnings;
        totalInfos += infos;
      }
    } catch (err) {
      safeConsole.warn(`[projectIssuesScanner] Failed to scan: ${relativePath}`);
      skippedFiles++;
    }
  }

  const scanDurationMs = Date.now() - startTime;

  // Sort by issue count (most issues first)
  summaries.sort((a, b) => b.issueCount - a.issueCount);

  safeConsole.log(
    `[projectIssuesScanner] Scan complete: ${totalFiles} files, ${totalIssues} issues, ${scanDurationMs}ms`
  );

  return {
    scannedFiles: totalFiles - skippedFiles,
    totalIssues,
    totalErrors,
    totalWarnings,
    totalInfos,
    summaries,
    skippedFiles,
    scanDurationMs,
  };
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  // Phase 130.6.3: Debug preload path
  const preloadPath = path.join(__dirname, 'preload.js');
  safeConsole.log('[Main] Preload path:', preloadPath);
  safeConsole.log('[Main] Preload exists:', require('fs').existsSync(preloadPath));

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Phase 130.6.4: Disable sandbox to allow preload script to use contextBridge
      // Without this, preload scripts have limited capabilities since Electron 20+
      sandbox: false,
      // Phase 115.2: Enable webview tag for Browser Preview (like VS Code/Cursor)
      webviewTag: true,
      // Disable web security in dev to allow CORS requests to localhost
      webSecurity: !isDev,
    },
  });

  // In development, load from Vite dev server
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Register IPC handlers first
  registerIpcHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
