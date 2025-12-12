// desktop/src/hooks/useAceJobWatcher.ts
// =============================================================================
// Phase 150.3.9 – React hook for ACE Job Watcher
// Provides easy integration of Web-Desktop ACE job bridge in React components
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { getFirestore } from 'firebase/firestore';
import {
  AceJobWatcher,
  createAceJobWatcher,
  defaultAceJobExecutor,
  type AceJobDocument,
  type AceJobExecutionResult,
  type AceJobExecutorFn,
  type AceJobWatcherState,
} from '../lib/ace/aceJobWatcher';

export interface UseAceJobWatcherOptions {
  /** Project ID to watch */
  projectId: string | null;
  /** Custom executor function (optional) */
  executor?: AceJobExecutorFn;
  /** Auto-start watching when projectId is set */
  autoStart?: boolean;
}

export interface UseAceJobWatcherResult {
  /** Current watcher state */
  state: AceJobWatcherState;
  /** Is watcher active */
  isWatching: boolean;
  /** Currently executing job */
  activeJob: AceJobDocument | null;
  /** Pending jobs count */
  pendingCount: number;
  /** Last completed job result */
  lastResult: AceJobExecutionResult | null;
  /** Start watching */
  start: () => void;
  /** Stop watching */
  stop: () => void;
}

const initialState: AceJobWatcherState = {
  isWatching: false,
  projectId: null,
  activeJobId: null,
  pendingJobs: [],
};

/**
 * Hook to use ACE Job Watcher in React components
 */
export function useAceJobWatcher(
  options: UseAceJobWatcherOptions,
): UseAceJobWatcherResult {
  const { projectId, executor = defaultAceJobExecutor, autoStart = true } = options;

  const [state, setState] = useState<AceJobWatcherState>(initialState);
  const [lastResult, setLastResult] = useState<AceJobExecutionResult | null>(null);
  const watcherRef = useRef<AceJobWatcher | null>(null);

  // Find active job from state
  const activeJob = state.activeJobId
    ? state.pendingJobs.find((j) => j.id === state.activeJobId) || null
    : null;

  // Handle state changes from watcher
  const handleStateChange = useCallback((newState: AceJobWatcherState) => {
    console.log('[150.3.9][useAceJobWatcher] State changed', {
      isWatching: newState.isWatching,
      pendingCount: newState.pendingJobs.length,
      activeJobId: newState.activeJobId,
    });
    setState(newState);
  }, []);

  // Handle job completion
  const handleJobComplete = useCallback(
    (job: AceJobDocument, result: AceJobExecutionResult) => {
      console.log('[150.3.9][useAceJobWatcher] Job completed', {
        jobId: job.id,
        success: result.success,
        runId: result.runId,
      });
      setLastResult(result);
    },
    [],
  );

  // Start watching
  const start = useCallback(() => {
    if (!projectId) {
      console.warn('[150.3.9][useAceJobWatcher] Cannot start: no projectId');
      return;
    }

    if (watcherRef.current) {
      console.warn('[150.3.9][useAceJobWatcher] Already watching');
      return;
    }

    console.log('[150.3.9][useAceJobWatcher] Starting watcher...', { projectId });

    try {
      const db = getFirestore();
      const watcher = createAceJobWatcher({
        db,
        projectId,
        executor,
        onStateChange: handleStateChange,
        onJobComplete: handleJobComplete,
      });

      watcher.start();
      watcherRef.current = watcher;
    } catch (error) {
      console.error('[150.3.9][useAceJobWatcher] Failed to start:', error);
    }
  }, [projectId, executor, handleStateChange, handleJobComplete]);

  // Stop watching
  const stop = useCallback(() => {
    if (watcherRef.current) {
      console.log('[150.3.9][useAceJobWatcher] Stopping watcher...');
      watcherRef.current.stop();
      watcherRef.current = null;
      setState(initialState);
    }
  }, []);

  // Auto-start when projectId changes
  useEffect(() => {
    if (autoStart && projectId) {
      start();
    }

    return () => {
      stop();
    };
  }, [projectId, autoStart, start, stop]);

  return {
    state,
    isWatching: state.isWatching,
    activeJob,
    pendingCount: state.pendingJobs.length,
    lastResult,
    start,
    stop,
  };
}

export default useAceJobWatcher;
