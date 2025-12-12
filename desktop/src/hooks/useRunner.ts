/**
 * Phase 111.2: useRunner Hook
 *
 * React hook for running commands in Desktop IDE
 * Subscribes to runner IPC events and manages state
 */

import { useEffect, useState, useCallback, useRef } from 'react';

// ============================================
// Types
// ============================================

export type RunnerLog = {
  stream: 'stdout' | 'stderr';
  chunk: string;
  timestamp: number;
};

export type RunnerStatus = 'idle' | 'running' | 'success' | 'failed' | 'killed';

export interface RunnerState {
  logs: RunnerLog[];
  status: RunnerStatus;
  exitCode: number | null;
  pid: number | null;
  error: string | null;
  startedAt: number | null;
  endedAt: number | null;
}

export interface UseRunnerReturn extends RunnerState {
  run: (projectPath: string, command: string) => void;
  kill: () => void;
  clear: () => void;
  duration: number | null;
}

// ============================================
// Helper: Generate unique run ID
// ============================================

let runIdCounter = 0;
function generateRunId(): string {
  runIdCounter++;
  return `run-${Date.now()}-${runIdCounter}`;
}

// ============================================
// Hook: useRunner
// ============================================

/**
 * Hook to run commands and track their output
 */
export function useRunner(): UseRunnerReturn {
  const [state, setState] = useState<RunnerState>({
    logs: [],
    status: 'idle',
    exitCode: null,
    pid: null,
    error: null,
    startedAt: null,
    endedAt: null,
  });

  const currentRunId = useRef<string | null>(null);
  const unsubscribers = useRef<(() => void)[]>([]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      unsubscribers.current.forEach((unsub) => unsub());
      unsubscribers.current = [];
    };
  }, []);

  /**
   * Run a command
   */
  const run = useCallback((projectPath: string, command: string) => {
    const api = window.f0Desktop;
    if (!api) {
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: 'Desktop API not available (running in browser?)',
      }));
      return;
    }

    // Kill previous run if still running
    if (currentRunId.current && state.status === 'running') {
      api.killRunner(currentRunId.current);
    }

    // Cleanup previous subscriptions
    unsubscribers.current.forEach((unsub) => unsub());
    unsubscribers.current = [];

    // Generate new run ID
    const runId = generateRunId();
    currentRunId.current = runId;

    // Reset state
    setState({
      logs: [],
      status: 'running',
      exitCode: null,
      pid: null,
      error: null,
      startedAt: Date.now(),
      endedAt: null,
    });

    // Subscribe to events
    const unsubStart = api.onRunnerStart((payload) => {
      if (payload.id !== runId) return;
      setState((prev) => ({
        ...prev,
        pid: payload.pid ?? null,
      }));
    });

    const unsubLog = api.onRunnerLog((payload) => {
      if (payload.id !== runId) return;
      setState((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          {
            stream: payload.stream,
            chunk: payload.chunk,
            timestamp: Date.now(),
          },
        ],
      }));
    });

    const unsubEnd = api.onRunnerEnd((payload) => {
      if (payload.id !== runId) return;
      setState((prev) => ({
        ...prev,
        status: payload.exitCode === 0 ? 'success' : 'failed',
        exitCode: payload.exitCode,
        endedAt: Date.now(),
      }));
      // Cleanup subscriptions after end
      unsubscribers.current.forEach((unsub) => unsub());
      unsubscribers.current = [];
    });

    const unsubError = api.onRunnerError((payload) => {
      if (payload.id !== runId) return;
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: payload.message,
        endedAt: Date.now(),
      }));
      // Cleanup subscriptions after error
      unsubscribers.current.forEach((unsub) => unsub());
      unsubscribers.current = [];
    });

    unsubscribers.current = [unsubStart, unsubLog, unsubEnd, unsubError];

    // Start the command
    api.runCommand(runId, projectPath, command);
  }, [state.status]);

  /**
   * Kill the current running process
   */
  const kill = useCallback(() => {
    const api = window.f0Desktop;
    if (!api || !currentRunId.current) return;

    api.killRunner(currentRunId.current);
    setState((prev) => ({
      ...prev,
      status: 'killed',
      endedAt: Date.now(),
    }));
  }, []);

  /**
   * Clear logs and reset state
   */
  const clear = useCallback(() => {
    setState({
      logs: [],
      status: 'idle',
      exitCode: null,
      pid: null,
      error: null,
      startedAt: null,
      endedAt: null,
    });
    currentRunId.current = null;
  }, []);

  // Calculate duration
  const duration =
    state.startedAt && state.endedAt
      ? state.endedAt - state.startedAt
      : state.startedAt && state.status === 'running'
        ? Date.now() - state.startedAt
        : null;

  return {
    ...state,
    run,
    kill,
    clear,
    duration,
  };
}

// ============================================
// Helper: Get allowed commands
// ============================================

export async function getAllowedCommands(): Promise<string[]> {
  const api = window.f0Desktop;
  if (!api) return [];
  return api.getAllowedCommands();
}

// ============================================
// Helper: Format duration
// ============================================

export function formatDuration(ms: number | null): string {
  if (ms === null) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

// ============================================
// Phase 112: Runner Context for Agent
// ============================================

/**
 * Get formatted runner context for Agent prompt enrichment
 * @param lineLimit - Max lines to include (default: 100)
 * @returns Formatted string with recent runner outputs, or empty string if not in desktop
 */
export async function getRunnerContext(lineLimit: number = 100): Promise<string> {
  const api = window.f0Desktop;
  if (!api?.getRunnerContext) return '';
  return api.getRunnerContext(lineLimit);
}

/**
 * Clear runner context history
 * @returns true if cleared, false if not in desktop
 */
export async function clearRunnerContext(): Promise<boolean> {
  const api = window.f0Desktop;
  if (!api?.clearRunnerContext) return false;
  return api.clearRunnerContext();
}

/**
 * Check if user message indicates they want help with runner errors
 * Used for automatic prompt enrichment
 */
export function shouldEnrichWithRunnerContext(message: string): boolean {
  const triggers = [
    // English triggers
    'fix test',
    'fix error',
    'solve error',
    'why fail',
    'what happened',
    'debug this',
    'help me fix',
    'fix the build',
    'fix lint',
    'solve this',
    'error in console',
    'console error',
    // Arabic triggers
    'صلح الخطأ',
    'صلح التست',
    'ليه فشل',
    'إيه الخطأ',
    'ساعدني أصلح',
    'الخطأ ده',
    'حل المشكلة',
  ];

  const lowerMessage = message.toLowerCase();
  return triggers.some((trigger) => lowerMessage.includes(trigger.toLowerCase()));
}

/**
 * Enrich user message with runner context if relevant
 * Returns the original message + context block if context exists
 */
export async function enrichMessageWithRunnerContext(
  message: string,
  forceInclude: boolean = false
): Promise<string> {
  // Only enrich if triggers detected or forced
  if (!forceInclude && !shouldEnrichWithRunnerContext(message)) {
    return message;
  }

  const context = await getRunnerContext(100);
  if (!context) {
    return message;
  }

  return `${message}

---
📟 **آخر نتائج الـ Runner:**
\`\`\`
${context}
\`\`\``;
}
