// desktop/src/lib/atp/failingTestTypes.ts
// Phase 140.4: Failing Test Fixer - Types
// Types for capturing test failures and suggested fixes

/**
 * Kind of test suite
 */
export type TestSuiteKind = 'ext' | 'smoke' | 'unit' | 'integration' | 'other';

/**
 * Raw test failure from test runner
 */
export interface RawTestFailure {
  /** Unique ID for the suite */
  suiteId: string;
  /** Human-readable suite name */
  suiteName: string;
  /** Kind of test suite */
  kind: TestSuiteKind;
  /** Name of the failing test */
  testName: string;
  /** Error message from the failure */
  errorMessage: string;
  /** Stack trace if available */
  stackTrace?: string;
  /** Path to the test file */
  testFilePath?: string;
}

/**
 * Location in a file (test or source)
 */
export interface FailureLocation {
  /** File path */
  filePath: string;
  /** Line number (1-based) */
  line?: number;
  /** Column number (1-based) */
  column?: number;
}

/**
 * Status of a suggested fix
 */
export type FixStatus = 'pending' | 'ready' | 'failed' | 'applied';

/**
 * A suggested fix for a failing test
 */
export interface SuggestedFix {
  /** Unique ID */
  id: string;
  /** Suite ID this fix belongs to */
  suiteId: string;
  /** Suite name for display */
  suiteName: string;
  /** Kind of test suite */
  kind: TestSuiteKind;
  /** Name of the failing test */
  testName: string;
  /** Original error message */
  errorMessage: string;
  /** Stack trace if available */
  stackTrace?: string;
  /** Location in test file where failure occurred */
  testLocation?: FailureLocation;
  /** Location in source file that may need fixing */
  sourceLocation?: FailureLocation;
  /** Short human-readable reason for failure */
  shortReason?: string;
  /** Suggested patch content (unified diff format) */
  patch?: string;
  /** Summary of what the patch does */
  patchSummary?: string;
  /** Current status of this fix */
  status: FixStatus;
  /** Timestamp when this fix was created */
  createdAt: number;
}

/**
 * Summary of failing tests for a cycle
 */
export interface FailingTestsSummary {
  /** Total number of failures */
  totalFailures: number;
  /** List of suite IDs with failures */
  suitesWithFailures: string[];
  /** Number of suggested fixes generated */
  suggestedFixesCount: number;
}

/**
 * Result from the failing test analysis step
 */
export interface FailingTestAnalysisResult {
  /** Raw failures from test runner */
  rawFailures: RawTestFailure[];
  /** Generated suggested fixes */
  suggestedFixes: SuggestedFix[];
  /** Summary statistics */
  summary: FailingTestsSummary;
}
