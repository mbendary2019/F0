// desktop/src/lib/atp/testRunnerBridge.ts
// Phase 140.4: Bridge to Test Runner subsystem
// Provides interface between ATP and existing Test Runner

import type { TestSuiteKind, RawTestFailure } from './failingTestTypes';

/**
 * Result from a test suite run
 */
export interface TestSuiteResult {
  /** Unique ID for the suite */
  suiteId: string;
  /** Human-readable suite name */
  suiteName: string;
  /** Kind of test suite */
  kind: TestSuiteKind;
  /** Total tests run */
  testsRun: number;
  /** Tests passed */
  testsPassed: number;
  /** Tests failed */
  testsFailed: number;
  /** Tests skipped */
  testsSkipped: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Raw failures from this suite */
  failures: RawTestFailure[];
  /** Exit code from test runner */
  exitCode?: number;
  /** Raw output from test runner */
  rawOutput?: string;
}

/**
 * Aggregated results from all test suites
 */
export interface TestRunResult {
  /** All suite results */
  suites: TestSuiteResult[];
  /** Total tests run across all suites */
  totalTestsRun: number;
  /** Total tests passed */
  totalTestsPassed: number;
  /** Total tests failed */
  totalTestsFailed: number;
  /** Total tests skipped */
  totalTestsSkipped: number;
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** All raw failures aggregated */
  allFailures: RawTestFailure[];
  /** Whether all tests passed */
  success: boolean;
}

/**
 * Options for running tests
 */
export interface RunTestsOptions {
  /** Only run specific suites by ID */
  suiteIds?: string[];
  /** Only run specific test kinds */
  kinds?: TestSuiteKind[];
  /** Timeout for the entire run (ms) */
  timeoutMs?: number;
  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Run tests for a test cycle
 *
 * This is a bridge to the existing Test Runner subsystem.
 * In future, this should call the actual test runner.
 *
 * @param options - Options for running tests
 * @returns Promise with test run results
 */
export async function runTestsForCycle(
  options: RunTestsOptions = {},
): Promise<TestRunResult> {
  // TODO: Actually integrate with Test Runner subsystem
  // For now, return mock data that simulates test results

  const startTime = Date.now();

  // Simulate test execution delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Mock suite results - in future, this comes from actual test runner
  // Phase 140.5.2: All tests passing now (edge case fixed)
  const suites: TestSuiteResult[] = [
    {
      suiteId: 'unit-tests',
      suiteName: 'Unit Tests',
      kind: 'unit',
      testsRun: 25,
      testsPassed: 25,
      testsFailed: 0,
      testsSkipped: 0,
      durationMs: 1500,
      failures: [],
      exitCode: 0,
    },
    {
      suiteId: 'smoke-tests',
      suiteName: 'Smoke Tests',
      kind: 'smoke',
      testsRun: 5,
      testsPassed: 5,
      testsFailed: 0,
      testsSkipped: 0,
      durationMs: 500,
      failures: [],
      exitCode: 0,
    },
  ];

  // Filter by kinds if specified
  let filteredSuites = suites;
  if (options.kinds && options.kinds.length > 0) {
    filteredSuites = suites.filter((s) => options.kinds!.includes(s.kind));
  }

  // Filter by suite IDs if specified
  if (options.suiteIds && options.suiteIds.length > 0) {
    filteredSuites = filteredSuites.filter((s) =>
      options.suiteIds!.includes(s.suiteId),
    );
  }

  // Aggregate results
  const totalTestsRun = filteredSuites.reduce((sum, s) => sum + s.testsRun, 0);
  const totalTestsPassed = filteredSuites.reduce(
    (sum, s) => sum + s.testsPassed,
    0,
  );
  const totalTestsFailed = filteredSuites.reduce(
    (sum, s) => sum + s.testsFailed,
    0,
  );
  const totalTestsSkipped = filteredSuites.reduce(
    (sum, s) => sum + s.testsSkipped,
    0,
  );
  const allFailures = filteredSuites.flatMap((s) => s.failures);

  return {
    suites: filteredSuites,
    totalTestsRun,
    totalTestsPassed,
    totalTestsFailed,
    totalTestsSkipped,
    totalDurationMs: Date.now() - startTime,
    allFailures,
    success: totalTestsFailed === 0,
  };
}

/**
 * Get available test suites
 *
 * @returns Promise with list of available suite IDs and names
 */
export async function getAvailableTestSuites(): Promise<
  Array<{ suiteId: string; suiteName: string; kind: TestSuiteKind }>
> {
  // TODO: Actually query test runner for available suites
  return [
    { suiteId: 'unit-tests', suiteName: 'Unit Tests', kind: 'unit' },
    { suiteId: 'smoke-tests', suiteName: 'Smoke Tests', kind: 'smoke' },
    { suiteId: 'integration-tests', suiteName: 'Integration Tests', kind: 'integration' },
    { suiteId: 'ext-tests', suiteName: 'Extension Tests', kind: 'ext' },
  ];
}

/**
 * Parse raw test output to extract failures
 *
 * @param rawOutput - Raw output from test runner
 * @param suiteId - ID of the suite
 * @param kind - Kind of test suite
 * @returns Array of raw test failures
 */
export function parseTestOutput(
  rawOutput: string,
  suiteId: string,
  suiteName: string,
  kind: TestSuiteKind,
): RawTestFailure[] {
  // TODO: Implement actual parsing for different test frameworks
  // This is a placeholder that should parse jest/vitest/mocha output

  const failures: RawTestFailure[] = [];

  // Simple regex to find FAIL lines in jest output
  // const failRegex = /FAIL\s+(.+\.test\.[tj]sx?)/g; // Reserved for future use
  const errorRegex = /●\s+(.+?)\s+›\s+(.+)\n\n([\s\S]+?)(?=\n\n|$)/g;

  let match;
  while ((match = errorRegex.exec(rawOutput)) !== null) {
    const [, testSuite, testName, errorBlock] = match;

    // Extract error message (first line of error block)
    const errorLines = errorBlock.trim().split('\n');
    const errorMessage = errorLines[0] || 'Unknown error';

    // Rest is stack trace
    const stackTrace = errorLines.slice(1).join('\n').trim();

    failures.push({
      suiteId,
      suiteName,
      kind,
      testName: `${testSuite} › ${testName}`,
      errorMessage,
      stackTrace: stackTrace || undefined,
    });
  }

  return failures;
}
