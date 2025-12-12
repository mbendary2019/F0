// desktop/src/lib/tests/testLabTypes.ts
// Phase 133.0: Test Lab State & Mapping Types
// Phase 133.3: Added TestRunTrigger for auto-run tracking

import type { TestStatus as BaseTestStatus, TestSuite as BaseTestSuite, TestStats } from './testTypes';

/**
 * Test Lab specific status (simplified)
 */
export type TestLabStatus = 'pending' | 'passing' | 'failing' | 'skipped';

/**
 * Phase 133.3: What triggered the test run
 */
export type TestRunTrigger =
  | 'manual'        // User clicked Run
  | 'ace_auto'      // After ACE applied fixes
  | 'generate_tests' // After generating new tests
  | 'pre_deploy'    // Before deployment
  | 'watch';        // File watcher

/**
 * A single test run record
 */
export interface TestSuiteRun {
  id: string;
  startedAt: string;   // ISO
  finishedAt: string;  // ISO
  status: TestLabStatus;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  trigger?: TestRunTrigger; // Phase 133.3: What triggered this run
}

/**
 * Enhanced test suite for Test Lab
 */
export interface TestLabSuite {
  id: string;
  projectId: string;
  framework: 'vitest' | 'jest' | 'playwright' | 'cypress' | 'mocha' | 'unknown';
  testFilePath: string;          // path to *.test.ts / *.spec.ts
  name: string;
  relatedSourceFiles: string[];  // files that this test covers
  lastRun: TestSuiteRun | null;
}

/**
 * Mapping from source file to test files
 */
export type SourceToTestsMap = Record<string, string[]>;

/**
 * Mapping from test file to source files
 */
export type TestsToSourceMap = Record<string, string[]>;

/**
 * Test Lab summary
 */
export interface TestLabSummary {
  totalSuites: number;
  passingSuites: number;
  failingSuites: number;
  pendingSuites: number;
  skippedSuites: number;
  lastRunAt: string | null;
  passRate: number;
}

/**
 * Complete Test Lab state
 */
export interface TestLabState {
  projectId: string | null;
  projectRoot: string | null;
  suites: TestLabSuite[];
  sourceToTests: SourceToTestsMap;
  testsToSource: TestsToSourceMap;
  summary: TestLabSummary;
  isLoading: boolean;
  lastDiscoveryAt: string | null;
}

/**
 * Convert base TestStatus to TestLabStatus
 */
export function toTestLabStatus(status: BaseTestStatus | undefined): TestLabStatus {
  if (!status) return 'pending';
  switch (status) {
    case 'passed':
      return 'passing';
    case 'failed':
    case 'error':
    case 'partial':
      return 'failing';
    case 'skipped':
      return 'skipped';
    case 'running':
    default:
      return 'pending';
  }
}

/**
 * Normalize any raw status string to TestLabStatus
 * Handles variations like 'pass', 'passed', 'passing', 'error', etc.
 */
export function normalizeRawStatus(raw: string | undefined | null): TestLabStatus {
  if (!raw) return 'pending';
  const s = raw.toLowerCase().trim();

  // Passing variants
  if (s === 'pass' || s === 'passed' || s === 'passing' || s === 'success') {
    return 'passing';
  }

  // Failing variants (including error)
  if (s === 'fail' || s === 'failed' || s === 'failing' || s === 'error' || s === 'partial') {
    return 'failing';
  }

  // Skipped variants
  if (s === 'skip' || s === 'skipped' || s === 'ignored' || s === 'todo') {
    return 'skipped';
  }

  // Default to pending
  return 'pending';
}

/**
 * Create empty summary
 */
export function createEmptySummary(): TestLabSummary {
  return {
    totalSuites: 0,
    passingSuites: 0,
    failingSuites: 0,
    pendingSuites: 0,
    skippedSuites: 0,
    lastRunAt: null,
    passRate: 0,
  };
}

/**
 * Create empty state
 */
export function createEmptyState(): TestLabState {
  return {
    projectId: null,
    projectRoot: null,
    suites: [],
    sourceToTests: {},
    testsToSource: {},
    summary: createEmptySummary(),
    isLoading: false,
    lastDiscoveryAt: null,
  };
}
