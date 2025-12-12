// desktop/src/lib/tests/testTypes.ts
// Phase 130.1: Test Types & Interfaces

/**
 * Supported test frameworks
 */
export type TestFramework = 'jest' | 'vitest' | 'playwright' | 'cypress' | 'mocha' | 'unknown';

/**
 * Test suite scope
 */
export type TestScope = 'unit' | 'integration' | 'e2e' | 'all';

/**
 * Test run status
 */
export type TestStatus = 'passed' | 'failed' | 'partial' | 'skipped' | 'running' | 'error';

/**
 * A test suite definition
 */
export interface TestSuite {
  id: string;
  name: string;
  framework: TestFramework;
  command: string;
  scope: TestScope;
  configFile?: string;
  testPattern?: string;
  estimatedDurationMs?: number;
  lastStatus?: TestStatus;
  lastRunAt?: string;
}

/**
 * Mapping between source files and their test files
 */
export interface FileTestMapping {
  sourcePath: string;
  testFiles: string[];
}

/**
 * A single test failure
 */
export interface TestFailure {
  file: string;
  testName: string;
  suiteName?: string;
  message: string;
  snippet?: string;
  line?: number;
  column?: number;
  expected?: string;
  actual?: string;
  duration?: number;
}

/**
 * Statistics from a test run
 */
export interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  durationMs: number;
}

/**
 * Result of a test run
 */
export interface TestRunResult {
  id: string;
  suiteId?: string;
  status: TestStatus;
  stats: TestStats;
  failures: TestFailure[];
  scope: TestScope | 'affected';
  filesRun?: string[];
  startedAt: string;
  completedAt?: string;
  command: string;
  stdout?: string;
  stderr?: string;
}

/**
 * Summary of a test run (for history)
 */
export interface TestRunSummary {
  id: string;
  status: TestStatus;
  scope: TestScope | 'affected';
  stats: TestStats;
  failureCount: number;
  runAt: string;
  durationMs: number;
  triggeredBy?: 'manual' | 'ace' | 'cleanup' | 'watch';
}

/**
 * Test meta stored in .f0/test-meta.json
 */
export interface TestMeta {
  projectRoot: string;
  detectedAt: string;
  suites: TestSuite[];
  fileTestMap: FileTestMapping[];
  defaultFramework?: TestFramework;
  hasTests: boolean;
}

/**
 * Test history stored in .f0/test-history.json
 */
export interface TestHistory {
  projectRoot: string;
  runs: TestRunSummary[];
  lastRun?: TestRunSummary;
  totalRuns: number;
  passRate: number;
}

/**
 * Options for running tests
 */
export interface TestRunOptions {
  watch?: boolean;
  coverage?: boolean;
  verbose?: boolean;
  updateSnapshots?: boolean;
  bail?: boolean;
  maxWorkers?: number;
  files?: string[];
  testNamePattern?: string;
}

/**
 * Test discovery config
 */
export interface TestDiscoveryConfig {
  projectRoot: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
}

/**
 * Framework detection result
 */
export interface FrameworkDetection {
  framework: TestFramework;
  confidence: number;
  configFile?: string;
  command?: string;
  version?: string;
}

/**
 * Package.json test scripts
 */
export interface PackageTestScripts {
  test?: string;
  'test:unit'?: string;
  'test:integration'?: string;
  'test:e2e'?: string;
  'test:watch'?: string;
  'test:coverage'?: string;
  [key: string]: string | undefined;
}

