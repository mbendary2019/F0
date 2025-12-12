// desktop/src/state/testResultsContext.tsx
// Phase 130.3: Test Results Context & State Management

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type {
  TestMeta,
  TestSuite,
  TestRunResult,
  TestRunSummary,
  TestStats,
  TestStatus,
  TestRunOptions,
} from '../lib/tests/testTypes';
import {
  getTestMeta,
  discoverAndCacheTests,
  runTestSuite,
  runTestsForFiles,
  runAllTests as runAllTestsCore,
  aggregateResults,
  loadTestHistory,
  saveToHistory,
} from '../lib/tests';

interface TestResultsState {
  // Meta & Discovery
  meta: TestMeta | null;
  isDiscovering: boolean;
  hasTests: boolean;

  // Current Run
  isRunning: boolean;
  currentRun: TestRunResult | null;
  currentOutput: string[];
  progress: number;

  // History
  runs: TestRunSummary[];
  lastRun: TestRunSummary | null;

  // Stats
  passRate: number;
  totalRuns: number;
  lastStatus: TestStatus | null;
}

interface TestResultsActions {
  // Discovery
  discoverTests: () => Promise<void>;
  refreshTests: () => Promise<void>;

  // Running
  runAllTests: () => Promise<TestRunResult[]>;
  runSuite: (suiteId: string) => Promise<TestRunResult>;
  runAffectedTests: (filesChanged: string[]) => Promise<TestRunResult>;
  cancelRun: () => void;

  // Utilities
  getSuiteById: (id: string) => TestSuite | undefined;
  clearHistory: () => void;
}

interface TestResultsContextValue extends TestResultsState, TestResultsActions {}

const TestResultsContext = createContext<TestResultsContextValue | null>(null);

interface Props {
  children: React.ReactNode;
  projectRoot: string | null;
}

export const TestResultsProvider: React.FC<Props> = ({ children, projectRoot }) => {
  // State
  const [meta, setMeta] = useState<TestMeta | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<TestRunResult | null>(null);
  const [currentOutput, setCurrentOutput] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [runs, setRuns] = useState<TestRunSummary[]>([]);

  // Computed
  const hasTests = meta?.hasTests ?? false;
  const lastRun = runs[0] ?? null;
  const lastStatus = lastRun?.status ?? null;
  const totalRuns = runs.length;

  const passRate = useMemo(() => {
    if (runs.length === 0) return 100;
    const passed = runs.filter(r => r.status === 'passed').length;
    return Math.round((passed / runs.length) * 100);
  }, [runs]);

  // Discover tests on mount or projectRoot change
  useEffect(() => {
    if (!projectRoot) {
      setMeta(null);
      setRuns([]);
      return;
    }

    const loadData = async () => {
      setIsDiscovering(true);
      try {
        const testMeta = await getTestMeta(projectRoot);
        setMeta(testMeta);

        const history = loadTestHistory(projectRoot);
        const summaries: TestRunSummary[] = history.map(r => ({
          id: r.id,
          status: r.status,
          scope: r.scope,
          stats: r.stats,
          failureCount: r.failures.length,
          runAt: r.startedAt,
          durationMs: r.stats.durationMs,
          triggeredBy: 'manual',
        }));
        setRuns(summaries);
      } catch (err) {
        console.error('[TestResults] Failed to load test meta:', err);
      } finally {
        setIsDiscovering(false);
      }
    };

    loadData();
  }, [projectRoot]);

  // Discover tests
  const discoverTests = useCallback(async () => {
    if (!projectRoot) return;

    setIsDiscovering(true);
    try {
      const testMeta = await discoverAndCacheTests(projectRoot);
      setMeta(testMeta);
    } catch (err) {
      console.error('[TestResults] Discovery failed:', err);
    } finally {
      setIsDiscovering(false);
    }
  }, [projectRoot]);

  // Refresh tests
  const refreshTests = useCallback(async () => {
    if (!projectRoot) return;

    setIsDiscovering(true);
    try {
      const testMeta = await getTestMeta(projectRoot, true);
      setMeta(testMeta);
    } catch (err) {
      console.error('[TestResults] Refresh failed:', err);
    } finally {
      setIsDiscovering(false);
    }
  }, [projectRoot]);

  // Add result to history
  const addToHistory = useCallback((result: TestRunResult, triggeredBy: 'manual' | 'ace' | 'cleanup' | 'watch' = 'manual') => {
    const summary: TestRunSummary = {
      id: result.id,
      status: result.status,
      scope: result.scope,
      stats: result.stats,
      failureCount: result.failures.length,
      runAt: result.startedAt,
      durationMs: result.stats.durationMs,
      triggeredBy,
    };

    setRuns(prev => [summary, ...prev].slice(0, 50));

    if (projectRoot) {
      saveToHistory(projectRoot, result);
    }
  }, [projectRoot]);

  // Run all tests
  const runAllTests = useCallback(async (): Promise<TestRunResult[]> => {
    if (!projectRoot || !meta || isRunning) return [];

    setIsRunning(true);
    setCurrentOutput([]);
    setProgress(0);

    try {
      const results = await runAllTestsCore(meta.suites, projectRoot, {
        onSuiteStart: (suite) => {
          setCurrentOutput(prev => [...prev, `\n▶ Running: ${suite.name}\n`]);
        },
        onSuiteComplete: (suite, result) => {
          const statusIcon = result.status === 'passed' ? '✓' : '✗';
          setCurrentOutput(prev => [...prev, `${statusIcon} ${suite.name}: ${result.stats.passed}/${result.stats.total} passed\n`]);
          addToHistory(result);
        },
        onOutput: (line) => {
          setCurrentOutput(prev => [...prev, line]);
        },
      });

      const aggregated = aggregateResults(results);
      setCurrentRun(results[0] || null);

      return results;
    } catch (err) {
      console.error('[TestResults] Run all failed:', err);
      return [];
    } finally {
      setIsRunning(false);
      setProgress(100);
    }
  }, [projectRoot, meta, isRunning, addToHistory]);

  // Run single suite
  const runSuite = useCallback(async (suiteId: string): Promise<TestRunResult> => {
    if (!projectRoot || !meta || isRunning) {
      throw new Error('Cannot run tests: missing project or already running');
    }

    const suite = meta.suites.find(s => s.id === suiteId);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteId}`);
    }

    setIsRunning(true);
    setCurrentOutput([`▶ Running: ${suite.name}\n`]);
    setProgress(0);

    try {
      const result = await runTestSuite(suite, projectRoot, {}, {
        onStart: () => {
          setProgress(10);
        },
        onOutput: (line) => {
          setCurrentOutput(prev => [...prev, line]);
        },
        onComplete: (r) => {
          setProgress(100);
          addToHistory(r);
        },
      });

      setCurrentRun(result);
      return result;
    } catch (err) {
      console.error('[TestResults] Run suite failed:', err);
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, [projectRoot, meta, isRunning, addToHistory]);

  // Run affected tests
  const runAffectedTests = useCallback(async (filesChanged: string[]): Promise<TestRunResult> => {
    if (!projectRoot || !meta || isRunning) {
      throw new Error('Cannot run tests: missing project or already running');
    }

    setIsRunning(true);
    setCurrentOutput([`▶ Running affected tests for ${filesChanged.length} files\n`]);
    setProgress(0);

    try {
      const result = await runTestsForFiles(filesChanged, meta, projectRoot, {
        onStart: () => {
          setProgress(10);
        },
        onOutput: (line) => {
          setCurrentOutput(prev => [...prev, line]);
        },
        onComplete: (r) => {
          setProgress(100);
          addToHistory(r, 'ace');
        },
      });

      setCurrentRun(result);
      return result;
    } catch (err) {
      console.error('[TestResults] Run affected failed:', err);
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, [projectRoot, meta, isRunning, addToHistory]);

  // Cancel run (stub - full implementation would require process tracking)
  const cancelRun = useCallback(() => {
    console.log('[TestResults] Cancel requested');
    // In a full implementation, we'd kill the child process
    setIsRunning(false);
  }, []);

  // Get suite by ID
  const getSuiteById = useCallback((id: string): TestSuite | undefined => {
    return meta?.suites.find(s => s.id === id);
  }, [meta]);

  // Clear history
  const clearHistory = useCallback(() => {
    setRuns([]);
  }, []);

  const value: TestResultsContextValue = {
    // State
    meta,
    isDiscovering,
    hasTests,
    isRunning,
    currentRun,
    currentOutput,
    progress,
    runs,
    lastRun,
    passRate,
    totalRuns,
    lastStatus,

    // Actions
    discoverTests,
    refreshTests,
    runAllTests,
    runSuite,
    runAffectedTests,
    cancelRun,
    getSuiteById,
    clearHistory,
  };

  return (
    <TestResultsContext.Provider value={value}>
      {children}
    </TestResultsContext.Provider>
  );
};

/**
 * Hook to access test results context
 */
export function useTests(): TestResultsContextValue {
  const context = useContext(TestResultsContext);
  if (!context) {
    throw new Error('useTests must be used within TestResultsProvider');
  }
  return context;
}

/**
 * Hook for test history only
 */
export function useTestHistory() {
  const { runs, lastRun, passRate, totalRuns, lastStatus } = useTests();
  return { runs, lastRun, passRate, totalRuns, lastStatus };
}

/**
 * Hook for test suites only
 */
export function useTestSuites() {
  const { meta, hasTests, isDiscovering, discoverTests, refreshTests, getSuiteById } = useTests();
  return {
    suites: meta?.suites ?? [],
    hasTests,
    isDiscovering,
    discoverTests,
    refreshTests,
    getSuiteById,
  };
}

/**
 * Hook for current test run
 */
export function useCurrentTestRun() {
  const { isRunning, currentRun, currentOutput, progress, cancelRun } = useTests();
  return { isRunning, currentRun, currentOutput, progress, cancelRun };
}

