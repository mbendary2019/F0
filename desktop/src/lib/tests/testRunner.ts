// desktop/src/lib/tests/testRunner.ts
// Phase 130.2: Test Run Orchestrator

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type {
  TestSuite,
  TestRunResult,
  TestRunOptions,
  TestStats,
  TestFailure,
  TestStatus,
  TestMeta,
} from './testTypes';
import { findTestsForFiles } from './testDiscovery';

/**
 * Generate unique run ID
 */
function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse Jest/Vitest output for failures
 */
function parseTestOutput(stdout: string, stderr: string): {
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

  // Try to parse Jest-style summary
  // Tests:       2 failed, 10 passed, 12 total
  const testsMatch = combined.match(/Tests:\s+(?:(\d+) failed,?\s*)?(?:(\d+) passed,?\s*)?(?:(\d+) skipped,?\s*)?(?:(\d+) pending,?\s*)?(\d+) total/i);
  if (testsMatch) {
    stats.failed = parseInt(testsMatch[1] || '0', 10);
    stats.passed = parseInt(testsMatch[2] || '0', 10);
    stats.skipped = parseInt(testsMatch[3] || '0', 10);
    stats.pending = parseInt(testsMatch[4] || '0', 10);
    stats.total = parseInt(testsMatch[5] || '0', 10);
  }

  // Try to parse Vitest-style summary
  // ✓ 10 tests passed
  // ✗ 2 tests failed
  const vitestPassed = combined.match(/[✓✔]\s*(\d+)\s*tests?\s*passed/i);
  const vitestFailed = combined.match(/[✗✘×]\s*(\d+)\s*tests?\s*failed/i);
  if (vitestPassed || vitestFailed) {
    stats.passed = parseInt(vitestPassed?.[1] || '0', 10);
    stats.failed = parseInt(vitestFailed?.[1] || '0', 10);
    stats.total = stats.passed + stats.failed;
  }

  // Parse duration
  // Time:        5.234 s
  const timeMatch = combined.match(/Time:\s+([\d.]+)\s*s/i);
  if (timeMatch) {
    stats.durationMs = parseFloat(timeMatch[1]) * 1000;
  }

  // Parse individual failures
  // FAIL src/utils/test.ts
  //   ● Test suite name › test name
  //     Expected: ...
  //     Received: ...
  const failBlocks = combined.split(/(?=FAIL\s)/);
  for (const block of failBlocks) {
    if (!block.startsWith('FAIL')) continue;

    const fileMatch = block.match(/FAIL\s+(.+\.(?:ts|tsx|js|jsx))/);
    if (!fileMatch) continue;

    const file = fileMatch[1];

    // Find individual test failures in this file
    const testMatches = block.matchAll(/●\s+(.+?)\s*›\s*(.+?)(?:\n|$)([\s\S]*?)(?=●|\n\n|$)/g);
    for (const match of testMatches) {
      const suiteName = match[1].trim();
      const testName = match[2].trim();
      const details = match[3] || '';

      // Extract expected/received
      const expectedMatch = details.match(/Expected:?\s*(.+)/);
      const receivedMatch = details.match(/Received:?\s*(.+)/);

      failures.push({
        file,
        testName,
        suiteName,
        message: `${suiteName} › ${testName}`,
        expected: expectedMatch?.[1],
        actual: receivedMatch?.[1],
        snippet: details.trim().slice(0, 200),
      });
    }
  }

  // Determine status
  let status: TestStatus = 'passed';
  if (stats.failed > 0) {
    status = stats.passed > 0 ? 'partial' : 'failed';
  } else if (stats.total === 0) {
    status = 'skipped';
  }

  return { stats, failures, status };
}

/**
 * Run a test command
 */
export function runTestCommand(
  command: string,
  cwd: string,
  options: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    onExit?: (code: number) => void;
    timeout?: number;
  } = {}
): { process: ChildProcess; promise: Promise<{ stdout: string; stderr: string; exitCode: number }> } {
  const [cmd, ...args] = command.split(' ').filter(Boolean);

  // Use shell on Windows
  const isWindows = process.platform === 'win32';
  const spawnOptions = {
    cwd,
    shell: isWindows,
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      CI: 'true', // Many test runners behave better in CI mode
    },
  };

  let stdout = '';
  let stderr = '';

  const childProcess = spawn(cmd, args, spawnOptions);

  const promise = new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;

    if (options.timeout) {
      timeoutId = setTimeout(() => {
        childProcess.kill('SIGTERM');
        reject(new Error('Test run timed out'));
      }, options.timeout);
    }

    childProcess.stdout?.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      options.onStdout?.(str);
    });

    childProcess.stderr?.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      options.onStderr?.(str);
    });

    childProcess.on('error', (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });

    childProcess.on('close', (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      const exitCode = code ?? 1;
      options.onExit?.(exitCode);
      resolve({ stdout, stderr, exitCode });
    });
  });

  return { process: childProcess, promise };
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
  if (options.updateSnapshots) {
    command += ' --updateSnapshot';
  }
  if (options.testNamePattern) {
    command += ` --testNamePattern="${options.testNamePattern}"`;
  }
  if (options.files && options.files.length > 0) {
    command += ' ' + options.files.join(' ');
  }

  try {
    const { promise } = runTestCommand(command, projectRoot, {
      onStdout: (data) => callbacks.onOutput?.(data),
      onStderr: (data) => callbacks.onOutput?.(data),
      timeout: 5 * 60 * 1000, // 5 minute timeout
    });

    const { stdout, stderr, exitCode } = await promise;
    const { stats, failures, status } = parseTestOutput(stdout, stderr);

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
  const testFiles = findTestsForFiles(files, meta.fileTestMap);

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
    const { promise } = runTestCommand(command, projectRoot, {
      onStdout: (data) => callbacks.onOutput?.(data),
      onStderr: (data) => callbacks.onOutput?.(data),
      timeout: 5 * 60 * 1000,
    });

    const { stdout, stderr, exitCode } = await promise;
    const { stats, failures, status } = parseTestOutput(stdout, stderr);

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
 * Load test history from .f0/test-history.json
 */
export function loadTestHistory(projectRoot: string): TestRunResult[] {
  const historyPath = path.join(projectRoot, '.f0', 'test-history.json');

  if (!fs.existsSync(historyPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(historyPath, 'utf-8');
    const data = JSON.parse(content);
    return data.runs || [];
  } catch {
    return [];
  }
}

/**
 * Save test result to history
 */
export function saveToHistory(projectRoot: string, result: TestRunResult): void {
  const f0Dir = path.join(projectRoot, '.f0');
  const historyPath = path.join(f0Dir, 'test-history.json');

  if (!fs.existsSync(f0Dir)) {
    fs.mkdirSync(f0Dir, { recursive: true });
  }

  let history = loadTestHistory(projectRoot);

  // Keep only last 50 runs
  history = [result, ...history].slice(0, 50);

  const data = {
    projectRoot,
    updatedAt: new Date().toISOString(),
    runs: history,
  };

  fs.writeFileSync(historyPath, JSON.stringify(data, null, 2));
}

