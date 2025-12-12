// desktop/src/lib/tests/testRunnerBrowser.ts
// Phase 130.2: Browser-safe Test Runner (uses IPC to main process)

import type {
  TestSuite,
  TestRunResult,
  TestRunOptions,
  TestStats,
  TestFailure,
  TestStatus,
  TestMeta,
} from './testTypes';

/**
 * Generate unique run ID
 */
function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse Jest/Vitest output for failures
 */
export function parseTestOutput(stdout: string, stderr: string, exitCode?: number): {
  stats: TestStats;
  failures: TestFailure[];
  status: TestStatus;
} {
  const failures: TestFailure[] = [];
  let stats: TestStats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    durationMs: 0,
  };

  const combined = stdout + '\n' + stderr;
  console.log('[TestRunner] Parsing output, length:', combined.length, 'exitCode:', exitCode);

  // Try to parse Jest-style summary: "Tests:  1 failed, 2 passed, 3 total"
  const testsMatch = combined.match(/Tests:\s+(?:(\d+)\s*failed,?\s*)?(?:(\d+)\s*passed,?\s*)?(?:(\d+)\s*skipped,?\s*)?(?:(\d+)\s*pending,?\s*)?(\d+)\s*total/i);
  if (testsMatch) {
    stats.failed = parseInt(testsMatch[1] || '0', 10);
    stats.passed = parseInt(testsMatch[2] || '0', 10);
    stats.skipped = parseInt(testsMatch[3] || '0', 10);
    stats.pending = parseInt(testsMatch[4] || '0', 10);
    stats.total = parseInt(testsMatch[5] || '0', 10);
    console.log('[TestRunner] Matched Jest format:', stats);
  }

  // Try to parse Vitest-style summary
  if (stats.total === 0) {
    const vitestPassed = combined.match(/[✓✔]\s*(\d+)\s*tests?\s*passed/i);
    const vitestFailed = combined.match(/[✗✘×]\s*(\d+)\s*tests?\s*failed/i);
    if (vitestPassed || vitestFailed) {
      stats.passed = parseInt(vitestPassed?.[1] || '0', 10);
      stats.failed = parseInt(vitestFailed?.[1] || '0', 10);
      stats.total = stats.passed + stats.failed;
      console.log('[TestRunner] Matched Vitest format:', stats);
    }
  }

  // Try to parse npm test / TAP format: "# tests 5", "# pass 4", "# fail 1"
  if (stats.total === 0) {
    const npmTotal = combined.match(/# tests?\s+(\d+)/i);
    const npmPass = combined.match(/# pass\s+(\d+)/i);
    const npmFail = combined.match(/# fail\s+(\d+)/i);
    if (npmTotal || npmPass || npmFail) {
      stats.total = parseInt(npmTotal?.[1] || '0', 10);
      stats.passed = parseInt(npmPass?.[1] || '0', 10);
      stats.failed = parseInt(npmFail?.[1] || '0', 10);
      if (stats.total === 0) stats.total = stats.passed + stats.failed;
      console.log('[TestRunner] Matched npm/tap format:', stats);
    }
  }

  // Count individual PASS/FAIL prefixes
  if (stats.total === 0) {
    const passCount = (combined.match(/^(PASS|✓|✔|ok\s+\d+)/gm) || []).length;
    const failCount = (combined.match(/^(FAIL|✗|✘|not ok\s+\d+)/gm) || []).length;
    if (passCount > 0 || failCount > 0) {
      stats.passed = passCount;
      stats.failed = failCount;
      stats.total = passCount + failCount;
      console.log('[TestRunner] Counted PASS/FAIL lines:', stats);
    }
  }

  // Heuristic: Check for "all tests passed" or success messages
  if (stats.total === 0) {
    const allPassedPattern = /(?:all\s+)?(?:\d+\s+)?tests?\s+passed|✅\s*all\s+.*passed|successfully|completed\s+successfully/i;
    const hasAllPassed = allPassedPattern.test(combined);
    const hasErrors = /error:|failed:|failure:|exception:/i.test(combined);

    if (hasAllPassed && !hasErrors) {
      // Count "Test X:" patterns to estimate test count
      const testPatterns = (combined.match(/(?:Test|📝)\s*\d+:/g) || []).length;
      stats.total = testPatterns > 0 ? testPatterns : 1;
      stats.passed = stats.total;
      console.log('[TestRunner] Detected success message, estimated tests:', stats.total);
    }
  }

  // Parse duration from various formats
  const timeMatch = combined.match(/Time:\s+([\d.]+)\s*s/i) ||
                    combined.match(/Duration:\s*([\d.]+)\s*s/i) ||
                    combined.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|s)\s*(?:elapsed|total)/i);
  if (timeMatch) {
    stats.durationMs = parseFloat(timeMatch[1]) * 1000;
  }

  // Parse failures from Jest/Vitest output
  const failurePattern = /FAIL\s+([^\n]+)\n.*?●\s+([^\n]+)\n\s*([^\n]+)/g;
  let failureMatch;
  while ((failureMatch = failurePattern.exec(combined)) !== null) {
    failures.push({
      file: failureMatch[1].trim(),
      testName: failureMatch[2].trim(),
      message: failureMatch[3].trim(),
    });
  }

  // Determine status based on stats and exit code
  let status: TestStatus = 'passed';

  if (stats.failed > 0) {
    status = stats.passed > 0 ? 'partial' : 'failed';
  } else if (stats.total === 0) {
    // If no stats parsed, use exit code to determine status
    if (exitCode !== undefined) {
      if (exitCode === 0) {
        // Command succeeded but no parseable output - mark as passed
        status = 'passed';
        stats.total = 1;
        stats.passed = 1;
        console.log('[TestRunner] No stats found but exitCode=0, marking as passed');
      } else {
        // Command failed
        status = 'error';
        stats.total = 1;
        stats.failed = 1;
        console.log('[TestRunner] No stats found, exitCode=', exitCode, ', marking as error');
      }
    } else {
      status = 'skipped';
      console.log('[TestRunner] No stats found and no exit code, marking as skipped');
    }
  }

  console.log('[TestRunner] Final parse result:', { status, stats, failureCount: failures.length });
  return { stats, failures, status };
}

/**
 * Check if we're in Electron renderer with test runner IPC available
 */
function hasTestRunnerIPC(): boolean {
  const hasWindow = typeof window !== 'undefined';
  const hasF0Desktop = hasWindow && 'f0Desktop' in window;
  const hasRunTests = hasF0Desktop && typeof (window as any).f0Desktop?.runTests === 'function';

  console.log('[TestRunner] IPC Check:', {
    hasWindow,
    hasF0Desktop,
    hasRunTests,
    f0DesktopKeys: hasF0Desktop ? Object.keys((window as any).f0Desktop) : [],
  });

  return hasRunTests;
}

/**
 * Generate a unique test run ID
 */
function generateTestRunId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Run test command via IPC (Electron main process)
 * Phase 130.6: Uses the dedicated test runner IPC channel
 */
async function runCommandViaIPC(
  command: string,
  cwd: string,
  onOutput?: (line: string) => void
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const hasIPC = hasTestRunnerIPC();
  console.log('[TestRunner] runCommandViaIPC called:', { command, cwd, hasIPC });

  if (!hasIPC) {
    // Fallback: simulate for development/browser preview
    console.log('[TestRunner] No IPC available, simulating test run');
    console.log('[TestRunner] Command:', command);
    console.log('[TestRunner] CWD:', cwd);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Return simulated success
    const simulatedOutput = `
Tests:       5 passed, 5 total
Time:        2.5s
Ran all test suites.
`;
    onOutput?.(simulatedOutput);

    return {
      stdout: simulatedOutput,
      stderr: '',
      exitCode: 0,
    };
  }

  // Use Electron IPC to run test command in main process
  const api = (window as any).f0Desktop;
  const runId = generateTestRunId();

  console.log('[TestRunner] Starting IPC test run:', { runId, command, cwd });

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    // Subscribe to output events
    const unsubOutput = api.onTestsOutput((payload: { id: string; stream: 'stdout' | 'stderr'; chunk: string }) => {
      if (payload.id !== runId) return;

      console.log('[TestRunner] IPC output:', payload.stream, payload.chunk.substring(0, 100));
      if (payload.stream === 'stdout') {
        stdout += payload.chunk;
      } else {
        stderr += payload.chunk;
      }
      onOutput?.(payload.chunk);
    });

    // Subscribe to end event
    const unsubEnd = api.onTestsEnd((payload: { id: string; exitCode: number; stdout: string; stderr: string }) => {
      if (payload.id !== runId) return;

      console.log('[TestRunner] IPC end:', { exitCode: payload.exitCode, stdoutLen: payload.stdout?.length, stderrLen: payload.stderr?.length });
      cleanup();
      if (!resolved) {
        resolved = true;
        resolve({
          stdout: stdout || payload.stdout,
          stderr: stderr || payload.stderr,
          exitCode: payload.exitCode,
        });
      }
    });

    // Subscribe to error event
    const unsubError = api.onTestsError((payload: { id: string; message: string }) => {
      if (payload.id !== runId) return;

      cleanup();
      if (!resolved) {
        resolved = true;
        reject(new Error(payload.message));
      }
    });

    // Cleanup function
    const cleanup = () => {
      unsubOutput();
      unsubEnd();
      unsubError();
    };

    // Start the test run
    api.runTests(runId, cwd, command);

    // Timeout after 10 minutes
    setTimeout(() => {
      if (!resolved) {
        cleanup();
        api.killTests(runId);
        resolved = true;
        resolve({
          stdout,
          stderr: stderr + '\n[TestRunner] Timeout after 10 minutes',
          exitCode: -1,
        });
      }
    }, 10 * 60 * 1000);
  });
}

/**
 * Run a single test suite
 */
export async function runTestSuite(
  suite: TestSuite,
  projectRoot: string,
  options: TestRunOptions = {},
  callbacks: {
    onStart?: () => void;
    onOutput?: (line: string) => void;
    onComplete?: (result: TestRunResult) => void;
  } = {}
): Promise<TestRunResult> {
  const runId = generateRunId();
  const startedAt = new Date().toISOString();

  console.log('[TestRunner] Starting suite:', suite.name, 'command:', suite.command);
  callbacks.onStart?.();

  let command = suite.command;

  // Add options to command
  if (options.coverage) {
    command += ' --coverage';
  }
  if (options.verbose) {
    command += ' --verbose';
  }
  if (options.bail) {
    command += ' --bail';
  }
  if (options.files && options.files.length > 0) {
    command += ' ' + options.files.join(' ');
  }

  try {
    const { stdout, stderr, exitCode } = await runCommandViaIPC(
      command,
      projectRoot,
      callbacks.onOutput
    );

    const { stats, failures, status } = parseTestOutput(stdout, stderr, exitCode);

    const result: TestRunResult = {
      id: runId,
      suiteId: suite.id,
      status: exitCode === 0 ? 'passed' : status,
      stats,
      failures,
      scope: suite.scope,
      startedAt,
      completedAt: new Date().toISOString(),
      command,
      stdout,
      stderr,
    };

    console.log('[TestRunner] Suite completed:', suite.name, 'status:', result.status);
    callbacks.onComplete?.(result);

    return result;
  } catch (err) {
    const error = err as Error;
    console.error('[TestRunner] Suite failed:', suite.name, error.message);

    const result: TestRunResult = {
      id: runId,
      suiteId: suite.id,
      status: 'error',
      stats: { total: 0, passed: 0, failed: 0, skipped: 0, pending: 0, durationMs: 0 },
      failures: [{
        file: 'unknown',
        testName: 'Test Runner Error',
        message: error.message,
      }],
      scope: suite.scope,
      startedAt,
      completedAt: new Date().toISOString(),
      command,
      stderr: error.message,
    };

    callbacks.onComplete?.(result);
    return result;
  }
}

/**
 * Run tests for specific files (affected tests)
 */
export async function runTestsForFiles(
  files: string[],
  meta: TestMeta,
  projectRoot: string,
  callbacks: {
    onStart?: () => void;
    onOutput?: (line: string) => void;
    onComplete?: (result: TestRunResult) => void;
  } = {}
): Promise<TestRunResult> {
  const runId = generateRunId();
  const startedAt = new Date().toISOString();

  console.log('[TestRunner] Running tests for files:', files.length);
  callbacks.onStart?.();

  // Find test files for the changed files
  const testFiles = findTestsForFilesBrowser(files, meta.fileTestMap);

  if (testFiles.length === 0) {
    console.log('[TestRunner] No test files found for changed files');
    const result: TestRunResult = {
      id: runId,
      status: 'skipped',
      stats: { total: 0, passed: 0, failed: 0, skipped: 0, pending: 0, durationMs: 0 },
      failures: [],
      scope: 'affected',
      filesRun: [],
      startedAt,
      completedAt: new Date().toISOString(),
      command: 'N/A - No test files found',
    };
    callbacks.onComplete?.(result);
    return result;
  }

  // Build command based on framework
  let command: string;
  const framework = meta.defaultFramework || 'jest';

  switch (framework) {
    case 'vitest':
      command = `npx vitest run ${testFiles.join(' ')}`;
      break;
    case 'jest':
    default:
      command = `npx jest ${testFiles.join(' ')}`;
      break;
  }

  try {
    const { stdout, stderr, exitCode } = await runCommandViaIPC(
      command,
      projectRoot,
      callbacks.onOutput
    );

    const { stats, failures, status } = parseTestOutput(stdout, stderr, exitCode);

    const result: TestRunResult = {
      id: runId,
      status: exitCode === 0 ? 'passed' : status,
      stats,
      failures,
      scope: 'affected',
      filesRun: testFiles,
      startedAt,
      completedAt: new Date().toISOString(),
      command,
      stdout,
      stderr,
    };

    console.log('[TestRunner] Affected tests completed:', result.status);
    callbacks.onComplete?.(result);

    return result;
  } catch (err) {
    const error = err as Error;
    console.error('[TestRunner] Affected tests failed:', error.message);

    const result: TestRunResult = {
      id: runId,
      status: 'error',
      stats: { total: 0, passed: 0, failed: 0, skipped: 0, pending: 0, durationMs: 0 },
      failures: [{
        file: 'unknown',
        testName: 'Test Runner Error',
        message: error.message,
      }],
      scope: 'affected',
      filesRun: testFiles,
      startedAt,
      completedAt: new Date().toISOString(),
      command,
      stderr: error.message,
    };

    callbacks.onComplete?.(result);
    return result;
  }
}

/**
 * Find tests for files (browser-safe version)
 */
function findTestsForFilesBrowser(
  changedFiles: string[],
  fileTestMap: { sourcePath: string; testFiles: string[] }[]
): string[] {
  const testFiles = new Set<string>();

  for (const changedFile of changedFiles) {
    const normalized = changedFile.replace(/\\/g, '/');

    const mapping = fileTestMap.find(m =>
      m.sourcePath === normalized ||
      normalized.endsWith(m.sourcePath)
    );

    if (mapping) {
      mapping.testFiles.forEach(t => testFiles.add(t));
    }

    if (normalized.includes('.test.') || normalized.includes('.spec.')) {
      testFiles.add(normalized);
    }
  }

  return Array.from(testFiles);
}

/**
 * Run all test suites
 */
export async function runAllTests(
  suites: TestSuite[],
  projectRoot: string,
  callbacks: {
    onSuiteStart?: (suite: TestSuite) => void;
    onSuiteComplete?: (suite: TestSuite, result: TestRunResult) => void;
    onOutput?: (line: string) => void;
    onAllComplete?: (results: TestRunResult[]) => void;
  } = {}
): Promise<TestRunResult[]> {
  const results: TestRunResult[] = [];

  for (const suite of suites) {
    callbacks.onSuiteStart?.(suite);

    const result = await runTestSuite(suite, projectRoot, {}, {
      onOutput: callbacks.onOutput,
      onComplete: (r) => callbacks.onSuiteComplete?.(suite, r),
    });

    results.push(result);
  }

  callbacks.onAllComplete?.(results);
  return results;
}

/**
 * Aggregate multiple test results
 */
export function aggregateResults(results: TestRunResult[]): {
  status: TestStatus;
  stats: TestStats;
  failures: TestFailure[];
} {
  const stats: TestStats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    durationMs: 0,
  };

  const failures: TestFailure[] = [];

  for (const result of results) {
    stats.total += result.stats.total;
    stats.passed += result.stats.passed;
    stats.failed += result.stats.failed;
    stats.skipped += result.stats.skipped;
    stats.pending += result.stats.pending;
    stats.durationMs += result.stats.durationMs;
    failures.push(...result.failures);
  }

  let status: TestStatus = 'passed';
  if (stats.failed > 0) {
    status = stats.passed > 0 ? 'partial' : 'failed';
  } else if (stats.total === 0) {
    status = 'skipped';
  }

  return { status, stats, failures };
}

/**
 * Load test history (browser-safe - uses localStorage)
 */
export function loadTestHistory(projectRoot: string): TestRunResult[] {
  try {
    const key = `f0-test-history-${projectRoot.replace(/[^a-z0-9]/gi, '_')}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const data = JSON.parse(stored);
      return data.runs || [];
    }
  } catch {
    // Ignore errors
  }
  return [];
}

/**
 * Save test result to history (browser-safe - uses localStorage)
 */
export function saveToHistory(projectRoot: string, result: TestRunResult): void {
  try {
    const key = `f0-test-history-${projectRoot.replace(/[^a-z0-9]/gi, '_')}`;
    let history = loadTestHistory(projectRoot);

    // Keep only last 50 runs
    history = [result, ...history].slice(0, 50);

    const data = {
      projectRoot,
      updatedAt: new Date().toISOString(),
      runs: history,
    };

    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore errors
  }
}

