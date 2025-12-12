// desktop/src/state/testLabContext.tsx
// Phase 133.0: Test Lab Context & Hook
// Phase 133.3: Added runTestsForFiles, runAllTests with trigger support
// Phase 139.0: Added ITG (Intelligent Test Generator) state & actions
// Phase 139.3: Connected ITG engine to generateSmartTests
// Phase 139.4: Added itgRisks to store high-risk files
// Phase 139.5: Added AI config from env, itgAiConfig exposed
// Phase 139.6: Added itgDebugSnapshot for diagnostics

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import {
  TestLabState,
  TestLabSummary,
  TestLabSuite,
  TestSuiteRun,
  SourceToTestsMap,
  TestsToSourceMap,
  TestLabStatus,
  TestRunTrigger,
  createEmptyState,
  toTestLabStatus,
} from '../lib/tests/testLabTypes';
import { getTestMeta } from '../lib/tests/testDiscoveryBrowser';
import type { TestSuite, TestHistory } from '../lib/tests/testTypes';
import type {
  ITGTestSuggestion,
  ITGGenerateRequest,
  ITGStatus,
  ITGFileRisk,
  ITGDebugSnapshot,
} from '../lib/testing/itg/itgTypes';
import { generateTestsForProject } from '../lib/testing/itg/testGeneratorEngine';
// Phase 139.5: Import AI config helper
import { createAiConfigFromEnv, ITGAiConfig } from '../lib/testing/itg/itgAiEnhancer';

/**
 * Result of running tests
 */
export interface TestRunResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  trigger: TestRunTrigger;
  filesRan: string[];
}

/**
 * Context value type
 */
interface TestLabContextValue {
  state: TestLabState;
  /** Refresh/rediscover test suites */
  refresh: () => Promise<void>;
  /** Get test suites that cover a source file */
  getSuitesForSource: (sourcePath: string) => TestLabSuite[];
  /** Get source files covered by a test file */
  getSourcesForTest: (testFilePath: string) => string[];
  /** Check if a file has failing tests */
  hasFailingTests: (filePath: string) => boolean;
  /** Check if a file has passing tests */
  hasPassingTests: (filePath: string) => boolean;
  /** Get test status for a file */
  getFileTestStatus: (filePath: string) => TestLabStatus | null;
  /** Record a test run result */
  recordTestRun: (suiteId: string, result: TestSuiteRun) => void;
  /** Phase 133.3: Run tests for specific files */
  runTestsForFiles: (files: string[], trigger?: TestRunTrigger) => Promise<TestRunResult>;
  /** Phase 133.3: Run all tests */
  runAllTests: (trigger?: TestRunTrigger) => Promise<TestRunResult>;
  /** Phase 133.3: Is currently running tests */
  isRunning: boolean;

  // Phase 139.0: ITG (Intelligent Test Generator) state & actions
  /** ITG current status */
  itgStatus: ITGStatus;
  /** ITG generated test suggestions */
  itgSuggestions: ITGTestSuggestion[];
  /** Current project coverage baseline */
  itgBaselineCoverage?: number;
  /** Projected coverage after applying suggestions */
  itgProjectedCoverage?: number;
  /** Last ITG run timestamp */
  itgLastRunAt?: string;
  /** ITG error message if any */
  itgError?: string | null;
  /** Phase 139.4: ITG analyzed high-risk files */
  itgRisks: ITGFileRisk[];
  /** Phase 139.5: AI configuration (read from env) */
  itgAiConfig: ITGAiConfig;
  /** Phase 139.6: Debug snapshot for diagnostics */
  itgDebugSnapshot?: ITGDebugSnapshot;
  /** Generate smart test suggestions */
  generateSmartTests: (request: ITGGenerateRequest) => Promise<void>;
  /** Clear all ITG suggestions */
  clearITGSuggestions: () => void;
}

const TestLabContext = createContext<TestLabContextValue | undefined>(undefined);

/**
 * Compute summary from suites
 */
function computeSummary(suites: TestLabSuite[]): TestLabSummary {
  let passing = 0;
  let failing = 0;
  let pending = 0;
  let skipped = 0;
  let lastRunAt: string | null = null;

  for (const suite of suites) {
    const status = suite.lastRun?.status ?? 'pending';

    if (status === 'passing') passing++;
    else if (status === 'failing') failing++;
    else if (status === 'skipped') skipped++;
    else pending++;

    if (suite.lastRun?.finishedAt) {
      if (!lastRunAt || new Date(suite.lastRun.finishedAt) > new Date(lastRunAt)) {
        lastRunAt = suite.lastRun.finishedAt;
      }
    }
  }

  const total = suites.length;
  const passRate = total > 0 ? Math.round((passing / total) * 100) : 0;

  return {
    totalSuites: total,
    passingSuites: passing,
    failingSuites: failing,
    pendingSuites: pending,
    skippedSuites: skipped,
    lastRunAt,
    passRate,
  };
}

/**
 * Build bidirectional mappings
 */
function buildMappings(suites: TestLabSuite[]): {
  sourceToTests: SourceToTestsMap;
  testsToSource: TestsToSourceMap;
} {
  const sourceToTests: SourceToTestsMap = {};
  const testsToSource: TestsToSourceMap = {};

  for (const suite of suites) {
    const testPath = suite.testFilePath;

    if (!testsToSource[testPath]) {
      testsToSource[testPath] = [];
    }

    for (const src of suite.relatedSourceFiles) {
      if (!sourceToTests[src]) {
        sourceToTests[src] = [];
      }
      if (!sourceToTests[src].includes(testPath)) {
        sourceToTests[src].push(testPath);
      }
      if (!testsToSource[testPath].includes(src)) {
        testsToSource[testPath].push(src);
      }
    }
  }

  return { sourceToTests, testsToSource };
}

/**
 * Convert base TestSuite to TestLabSuite
 */
function convertToLabSuite(
  suite: TestSuite,
  projectId: string,
  testHistory?: TestHistory
): TestLabSuite {
  // Find last run for this suite
  const lastRunSummary = testHistory?.runs.find(r => r.id.includes(suite.id));

  let lastRun: TestSuiteRun | null = null;
  if (suite.lastRunAt && suite.lastStatus) {
    lastRun = {
      id: `${suite.id}-${suite.lastRunAt}`,
      startedAt: suite.lastRunAt,
      finishedAt: suite.lastRunAt,
      status: toTestLabStatus(suite.lastStatus),
      passed: lastRunSummary?.stats.passed ?? 0,
      failed: lastRunSummary?.stats.failed ?? 0,
      skipped: lastRunSummary?.stats.skipped ?? 0,
      durationMs: lastRunSummary?.durationMs ?? suite.estimatedDurationMs ?? 0,
    };
  }

  // Try to infer related source files from test file path
  const relatedSourceFiles = inferRelatedSources(suite.testPattern || suite.name);

  return {
    id: suite.id,
    projectId,
    framework: suite.framework as TestLabSuite['framework'],
    testFilePath: suite.testPattern || `**/*.test.{ts,tsx,js,jsx}`,
    name: suite.name,
    relatedSourceFiles,
    lastRun,
  };
}

/**
 * Infer related source files from test patterns
 */
function inferRelatedSources(_testPattern: string): string[] {
  // Basic inference - can be enhanced later
  // For now, return empty and let file-level mapping be built separately
  return [];
}

/**
 * Load test history from localStorage
 */
function loadTestHistory(projectRoot: string): TestHistory | null {
  try {
    const key = `f0-test-history-${projectRoot.replace(/[^a-z0-9]/gi, '_')}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Test Lab Provider
 */
export const TestLabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TestLabState>(createEmptyState());
  const [isRunning, setIsRunning] = useState(false);

  // Phase 139.0: ITG state
  const [itgStatus, setItgStatus] = useState<ITGStatus>('idle');
  const [itgSuggestions, setItgSuggestions] = useState<ITGTestSuggestion[]>([]);
  const [itgBaselineCoverage, setItgBaselineCoverage] = useState<number | undefined>(undefined);
  const [itgProjectedCoverage, setItgProjectedCoverage] = useState<number | undefined>(undefined);
  const [itgLastRunAt, setItgLastRunAt] = useState<string | undefined>(undefined);
  const [itgError, setItgError] = useState<string | null>(null);
  // Phase 139.4: ITG risks
  const [itgRisks, setItgRisks] = useState<ITGFileRisk[]>([]);
  // Phase 139.6: ITG debug snapshot
  const [itgDebugSnapshot, setItgDebugSnapshot] = useState<ITGDebugSnapshot | undefined>(undefined);

  // Phase 139.5: AI config from env (memoized - read once)
  const itgAiConfig = useMemo<ITGAiConfig>(() => createAiConfigFromEnv(), []);

  // Get project info from global state or localStorage
  const getProjectInfo = useCallback(() => {
    // Try to get from f0Desktop API
    if (typeof window !== 'undefined' && (window as any).f0Desktop?.getProjectRoot) {
      return (window as any).f0Desktop.getProjectRoot();
    }
    // Fallback to localStorage
    const stored = localStorage.getItem('f0-current-project');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { projectId: parsed.id, projectRoot: parsed.root };
      } catch {
        // Ignore
      }
    }
    return { projectId: null, projectRoot: null };
  }, []);

  // Discover and build state
  // Phase 133.4: Added forceRefresh parameter for user-initiated refresh
  const discover = useCallback(async (forceRefresh = false) => {
    const { projectId, projectRoot } = getProjectInfo();

    if (!projectRoot) {
      console.log('[TestLab] No project root, using empty state');
      setState(createEmptyState());
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    console.log('[TestLab] Discovering tests for:', projectRoot, 'forceRefresh:', forceRefresh);

    try {
      // Get test meta (cached or fresh based on forceRefresh)
      const meta = await getTestMeta(projectRoot, forceRefresh);
      const history = loadTestHistory(projectRoot);

      // Convert to TestLabSuites
      const suites: TestLabSuite[] = meta.suites.map(s =>
        convertToLabSuite(s, projectId || 'unknown', history || undefined)
      );

      // Build mappings from fileTestMap
      const sourceToTests: SourceToTestsMap = {};
      const testsToSource: TestsToSourceMap = {};

      for (const mapping of meta.fileTestMap) {
        sourceToTests[mapping.sourcePath] = mapping.testFiles;
        for (const testFile of mapping.testFiles) {
          if (!testsToSource[testFile]) {
            testsToSource[testFile] = [];
          }
          if (!testsToSource[testFile].includes(mapping.sourcePath)) {
            testsToSource[testFile].push(mapping.sourcePath);
          }
        }
      }

      // Also add from suites
      const suiteMappings = buildMappings(suites);
      for (const [src, tests] of Object.entries(suiteMappings.sourceToTests)) {
        if (!sourceToTests[src]) sourceToTests[src] = [];
        for (const t of tests) {
          if (!sourceToTests[src].includes(t)) sourceToTests[src].push(t);
        }
      }
      for (const [test, srcs] of Object.entries(suiteMappings.testsToSource)) {
        if (!testsToSource[test]) testsToSource[test] = [];
        for (const s of srcs) {
          if (!testsToSource[test].includes(s)) testsToSource[test].push(s);
        }
      }

      const summary = computeSummary(suites);

      setState({
        projectId,
        projectRoot,
        suites,
        sourceToTests,
        testsToSource,
        summary,
        isLoading: false,
        lastDiscoveryAt: new Date().toISOString(),
      });

      console.log('[TestLab] Discovered', suites.length, 'suites, summary:', summary);
    } catch (error) {
      console.error('[TestLab] Discovery error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [getProjectInfo]);

  // Initial discovery
  useEffect(() => {
    discover();
  }, [discover]);

  // Listen for project changes
  useEffect(() => {
    const handleProjectChange = () => {
      console.log('[TestLab] Project changed, rediscovering...');
      discover();
    };

    window.addEventListener('f0-project-changed', handleProjectChange);
    return () => window.removeEventListener('f0-project-changed', handleProjectChange);
  }, [discover]);

  // Helper functions
  const getSuitesForSource = useCallback(
    (sourcePath: string): TestLabSuite[] => {
      const testPaths = state.sourceToTests[sourcePath] || [];
      return state.suites.filter(s =>
        testPaths.some(tp => s.testFilePath.includes(tp) || tp.includes(s.testFilePath))
      );
    },
    [state.sourceToTests, state.suites]
  );

  const getSourcesForTest = useCallback(
    (testFilePath: string): string[] => {
      return state.testsToSource[testFilePath] || [];
    },
    [state.testsToSource]
  );

  const hasFailingTests = useCallback(
    (filePath: string): boolean => {
      const suites = getSuitesForSource(filePath);
      return suites.some(s => s.lastRun?.status === 'failing');
    },
    [getSuitesForSource]
  );

  const hasPassingTests = useCallback(
    (filePath: string): boolean => {
      const suites = getSuitesForSource(filePath);
      return suites.length > 0 && suites.every(s => s.lastRun?.status === 'passing');
    },
    [getSuitesForSource]
  );

  const getFileTestStatus = useCallback(
    (filePath: string): TestLabStatus | null => {
      const suites = getSuitesForSource(filePath);
      if (suites.length === 0) return null;

      // If any failing, return failing
      if (suites.some(s => s.lastRun?.status === 'failing')) return 'failing';
      // If all passing, return passing
      if (suites.every(s => s.lastRun?.status === 'passing')) return 'passing';
      // If all skipped, return skipped
      if (suites.every(s => s.lastRun?.status === 'skipped')) return 'skipped';
      // Otherwise pending
      return 'pending';
    },
    [getSuitesForSource]
  );

  const recordTestRun = useCallback(
    (suiteId: string, result: TestSuiteRun) => {
      setState(prev => {
        const suites = prev.suites.map(s =>
          s.id === suiteId ? { ...s, lastRun: result } : s
        );
        return {
          ...prev,
          suites,
          summary: computeSummary(suites),
        };
      });
    },
    []
  );

  // Phase 133.3: Run tests for specific files
  const runTestsForFiles = useCallback(
    async (files: string[], trigger: TestRunTrigger = 'manual'): Promise<TestRunResult> => {
      if (isRunning || files.length === 0) {
        return { success: false, passed: 0, failed: 0, skipped: 0, trigger, filesRan: [] };
      }

      setIsRunning(true);
      console.log('[TestLab] Running tests for files:', files, 'trigger:', trigger);

      try {
        // Find test files that cover the given source files
        const testFiles = new Set<string>();
        for (const file of files) {
          // Check if this is already a test file
          if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(file)) {
            testFiles.add(file);
          } else {
            // Look up test files for this source
            const mapped = state.sourceToTests[file] || [];
            mapped.forEach(t => testFiles.add(t));
          }
        }

        if (testFiles.size === 0) {
          console.log('[TestLab] No test files found for:', files);
          setIsRunning(false);
          return { success: true, passed: 0, failed: 0, skipped: 0, trigger, filesRan: [] };
        }

        // Use f0Desktop to run tests if available
        const f0Desktop = (window as any).f0Desktop;
        if (f0Desktop?.runTests) {
          const result = await f0Desktop.runTests(Array.from(testFiles));

          // Record results for each suite
          const now = new Date().toISOString();
          for (const suite of state.suites) {
            if (testFiles.has(suite.testFilePath)) {
              const run: TestSuiteRun = {
                id: `${suite.id}-${now}`,
                startedAt: now,
                finishedAt: now,
                status: result.failed > 0 ? 'failing' : 'passing',
                passed: result.passed || 0,
                failed: result.failed || 0,
                skipped: result.skipped || 0,
                durationMs: result.durationMs || 0,
                trigger,
              };
              recordTestRun(suite.id, run);
            }
          }

          setIsRunning(false);
          return {
            success: result.failed === 0,
            passed: result.passed || 0,
            failed: result.failed || 0,
            skipped: result.skipped || 0,
            trigger,
            filesRan: Array.from(testFiles),
          };
        }

        // Fallback: dispatch event for external test runner
        window.dispatchEvent(new CustomEvent('f0-run-tests', {
          detail: { files: Array.from(testFiles), trigger }
        }));

        setIsRunning(false);
        return { success: true, passed: 0, failed: 0, skipped: 0, trigger, filesRan: Array.from(testFiles) };
      } catch (err) {
        console.error('[TestLab] Error running tests:', err);
        setIsRunning(false);
        return { success: false, passed: 0, failed: 0, skipped: 0, trigger, filesRan: [] };
      }
    },
    [isRunning, state.sourceToTests, state.suites, recordTestRun]
  );

  // Phase 133.3: Run all tests
  const runAllTests = useCallback(
    async (trigger: TestRunTrigger = 'manual'): Promise<TestRunResult> => {
      if (isRunning) {
        return { success: false, passed: 0, failed: 0, skipped: 0, trigger, filesRan: [] };
      }

      const allTestFiles = state.suites.map(s => s.testFilePath);
      return runTestsForFiles(allTestFiles, trigger);
    },
    [isRunning, state.suites, runTestsForFiles]
  );

  // Phase 133.4: Create a refresh function that forces refresh
  const forceRefresh = useCallback(() => discover(true), [discover]);

  // Phase 139.3: ITG actions - connected to ITG engine
  const generateSmartTests = useCallback(
    async (_request: ITGGenerateRequest) => {
      setItgStatus('running');
      setItgError(null);

      try {
        console.debug('[ITG] generateSmartTests starting...');

        // Get project index snapshot from f0Desktop API if available
        let projectIndexSnapshot: any = null;
        let codeHealthSnapshot: any = null;
        let coverageSnapshot: any = null;

        const f0Desktop = (window as any).f0Desktop;
        if (f0Desktop) {
          // Try to get project index
          if (f0Desktop.getProjectIndex) {
            try {
              projectIndexSnapshot = await f0Desktop.getProjectIndex();
              console.debug('[ITG] Got project index with', projectIndexSnapshot?.files?.length ?? 0, 'files');
            } catch (e) {
              console.warn('[ITG] Could not get project index:', e);
            }
          }

          // Try to get code health snapshot
          if (f0Desktop.getCodeHealthSnapshot) {
            try {
              codeHealthSnapshot = await f0Desktop.getCodeHealthSnapshot();
              console.debug('[ITG] Got code health snapshot');
            } catch (e) {
              console.warn('[ITG] Could not get code health:', e);
            }
          }

          // Try to get coverage snapshot
          if (f0Desktop.getCoverageSnapshot) {
            try {
              coverageSnapshot = await f0Desktop.getCoverageSnapshot();
              console.debug('[ITG] Got coverage snapshot');
            } catch (e) {
              console.warn('[ITG] Could not get coverage:', e);
            }
          }
        }

        // If no project index from API, try to build a minimal one from test lab state
        if (!projectIndexSnapshot && state.suites.length > 0) {
          const allFiles = new Set<string>();
          // Collect all source files from mappings
          Object.keys(state.sourceToTests).forEach(f => allFiles.add(f));
          Object.values(state.testsToSource).flat().forEach(f => allFiles.add(f));
          state.suites.forEach(s => {
            allFiles.add(s.testFilePath);
            s.relatedSourceFiles.forEach(f => allFiles.add(f));
          });

          projectIndexSnapshot = {
            files: Array.from(allFiles).map(path => ({
              path,
              sizeBytes: 0,
              lastModifiedMs: Date.now(),
            })),
          };
          console.debug('[ITG] Built minimal project index from test lab state with', allFiles.size, 'files');
        }

        // Phase 139.5: Call the ITG engine with AI config
        const result = await generateTestsForProject(
          {
            projectIndexSnapshot,
            codeHealthSnapshot,
            coverageSnapshot,
          },
          { aiConfig: itgAiConfig }
        );

        console.debug('[ITG] Generated', result.suggestions.length, 'suggestions');
        console.debug('[ITG] Coverage:', result.baselineCoverage, '% →', result.projectedCoverage, '%');

        // Update state with results
        setItgSuggestions(result.suggestions);
        setItgBaselineCoverage(result.baselineCoverage);
        setItgProjectedCoverage(result.projectedCoverage);
        setItgRisks(result.risks ?? []);
        // Phase 139.6: Store debug snapshot
        setItgDebugSnapshot(result.debug);
        setItgStatus('success');
        setItgLastRunAt(new Date().toISOString());
      } catch (err) {
        console.error('[ITG] generateSmartTests error:', err);
        setItgStatus('error');
        setItgError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [state.suites, state.sourceToTests, state.testsToSource, itgAiConfig]
  );

  const clearITGSuggestions = useCallback(() => {
    setItgSuggestions([]);
    setItgBaselineCoverage(undefined);
    setItgProjectedCoverage(undefined);
    setItgRisks([]);
    setItgDebugSnapshot(undefined); // Phase 139.6
    setItgError(null);
    setItgStatus('idle');
  }, []);

  const value = useMemo<TestLabContextValue>(
    () => ({
      state,
      refresh: forceRefresh,
      getSuitesForSource,
      getSourcesForTest,
      hasFailingTests,
      hasPassingTests,
      getFileTestStatus,
      recordTestRun,
      runTestsForFiles,
      runAllTests,
      isRunning,
      // Phase 139.0: ITG state & actions
      itgStatus,
      itgSuggestions,
      itgBaselineCoverage,
      itgProjectedCoverage,
      itgLastRunAt,
      itgError,
      itgRisks,
      itgAiConfig,
      itgDebugSnapshot, // Phase 139.6
      generateSmartTests,
      clearITGSuggestions,
    }),
    [
      state,
      forceRefresh,
      getSuitesForSource,
      getSourcesForTest,
      hasFailingTests,
      hasPassingTests,
      getFileTestStatus,
      recordTestRun,
      runTestsForFiles,
      runAllTests,
      isRunning,
      // Phase 139.0: ITG dependencies
      itgStatus,
      itgSuggestions,
      itgBaselineCoverage,
      itgProjectedCoverage,
      itgLastRunAt,
      itgError,
      itgRisks,
      itgAiConfig,
      itgDebugSnapshot, // Phase 139.6
      generateSmartTests,
      clearITGSuggestions,
    ]
  );

  return (
    <TestLabContext.Provider value={value}>
      {children}
    </TestLabContext.Provider>
  );
};

/**
 * Hook to access Test Lab
 */
export function useTestLab(): TestLabContextValue {
  const context = useContext(TestLabContext);
  if (!context) {
    throw new Error('useTestLab must be used within a TestLabProvider');
  }
  return context;
}

/**
 * Convenience hook for just the summary
 */
export function useTestLabSummary(): TestLabSummary {
  const { state } = useTestLab();
  return state.summary;
}

/**
 * Convenience hook for file test status
 */
export function useFileTestStatus(filePath: string): TestLabStatus | null {
  const { getFileTestStatus } = useTestLab();
  return getFileTestStatus(filePath);
}

export default TestLabProvider;
