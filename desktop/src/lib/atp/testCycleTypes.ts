// desktop/src/lib/atp/testCycleTypes.ts
// Phase 140.1: Autonomous Test Pipeline - Type Definitions
// Phase 140.2: Added coverage delta summary types
// Phase 140.3: Added AMTG (Autonomous Missing Test Generator) types
// Phase 140.4: Added failing test fixer types
// Core types for the ATP Orchestrator

import type { CoverageDeltaSummary } from './coverageDeltaTypes';
import type { GeneratedTestSuggestion } from './amtgTypes';
import type { SuggestedFix, FailingTestsSummary, RawTestFailure } from './failingTestTypes';

/**
 * What triggered the test cycle
 */
export type TestCycleTrigger = 'save' | 'commit' | 'run' | 'manual';

/**
 * Phase 140.6: Origin of the test cycle for Deploy Gate integration
 */
export type TestCycleOrigin = 'manual' | 'deploy_gate' | 'auto_schedule';

/**
 * Phase 140.6: Summary of a completed test cycle for Deploy Gate
 * This is a lightweight snapshot that can be displayed in the PreDeployGateModal
 */
export interface TestCycleSummary {
  /** Unique cycle ID */
  id: string;
  /** When the cycle started (ISO string) */
  startedAt: string;
  /** When the cycle finished (ISO string) */
  finishedAt: string;
  /** What triggered this cycle */
  origin: TestCycleOrigin;
  /** Coverage delta percentage (positive = improvement, negative = regression) */
  coverageDelta: number;
  /** Total number of tests run */
  totalTests: number;
  /** Number of failing tests */
  failingTests: number;
  /** Number of auto-generated tests this cycle */
  autoTestsGenerated: number;
  /** Number of suggested fixes generated */
  suggestedFixes: number;
}

/**
 * Current phase of the test cycle
 */
export type TestCyclePhase =
  | 'idle'
  | 'queued'
  | 'running'
  | 'analyzing'
  | 'finished'
  | 'error'
  | 'canceled';

/**
 * Log entry severity level
 */
export type TestCycleLogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Single log entry in the test cycle
 */
export interface TestCycleLogEntry {
  id: string;
  ts: number; // Date.now()
  level: TestCycleLogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

/**
 * Metrics collected during the test cycle
 * Phase 140.2: Extended with full coverage delta summary
 */
export interface TestCycleMetrics {
  testsRun?: number;
  testsPassed?: number;
  testsFailed?: number;
  testsSkipped?: number;
  coverageBefore?: number; // %
  coverageAfter?: number;  // %
  coverageDeltaPct?: number;  // % change (positive = improvement)
  riskScoreBefore?: number;
  riskScoreAfter?: number;
  durationMs?: number;
  filesAnalyzed?: number;
  suggestionsGenerated?: number;

  // Phase 140.2: Full coverage delta analysis
  /** Full coverage delta summary with per-file breakdown */
  coverageDeltaSummary?: CoverageDeltaSummary;
  /** Count of files with coverage regression */
  coverageRegressionCount?: number;
  /** Count of files with coverage improvement */
  coverageImprovementCount?: number;
  /** Count of high-risk files still untested */
  highRiskUntestedCount?: number;

  // Phase 140.3: AMTG - Auto-generated test metrics
  /** Number of tests auto-generated this cycle */
  autoTestsGeneratedCount?: number;
  /** Generated test suggestions */
  autoTestsGenerated?: GeneratedTestSuggestion[];

  // Phase 140.4: Failing Test Fixer metrics
  /** Raw test failures from the test runner */
  rawFailures?: RawTestFailure[];
  /** Suggested fixes for failing tests */
  suggestedFixes?: SuggestedFix[];
  /** Summary of failing tests */
  failingTestsSummary?: FailingTestsSummary;

  // Phase 140.6: Deploy Gate integration
  /** Lightweight summary for Deploy Gate display */
  summary?: TestCycleSummary;
}

/**
 * Full state of a single test cycle
 */
export interface TestCycleState {
  id: string;
  trigger: TestCycleTrigger;
  phase: TestCyclePhase;
  startedAt: number;
  finishedAt?: number;
  canceledAt?: number;
  errorMessage?: string;
  logs: TestCycleLogEntry[];
  metrics: TestCycleMetrics;
  /** Optional context from the trigger */
  context?: Record<string, unknown>;
}

/**
 * Options for starting a new test cycle
 */
export interface StartTestCycleOptions {
  trigger: TestCycleTrigger;
  /** Context from trigger (e.g., file path for save, commit message for commit) */
  context?: Record<string, unknown>;
  /** Timeout for the entire cycle (ms) - default 60000 */
  timeoutMs?: number;
  /** Skip certain pipeline steps */
  skipSteps?: ('discovery' | 'tests' | 'analysis' | 'llm')[];
}

/**
 * Snapshot of current and last completed cycle
 */
export interface TestCycleSnapshot {
  activeCycle: TestCycleState | null;
  lastCompletedCycle: TestCycleState | null;
  cycleHistory: TestCycleState[];
}

/**
 * Pipeline step result
 */
export interface PipelineStepResult {
  success: boolean;
  durationMs: number;
  error?: string;
  data?: Record<string, unknown>;
}

/**
 * Configuration for the ATP orchestrator
 */
export interface ATPConfig {
  /** Enable/disable ATP globally */
  enabled: boolean;
  /** Auto-trigger on file save */
  triggerOnSave: boolean;
  /** Auto-trigger on git commit */
  triggerOnCommit: boolean;
  /** Auto-trigger on project run */
  triggerOnRun: boolean;
  /** Default timeout for cycles (ms) */
  defaultTimeoutMs: number;
  /** Max cycles to keep in history */
  maxHistorySize: number;
  /** Debounce delay for save triggers (ms) */
  saveDebounceMs: number;
}

/**
 * Default ATP configuration
 */
export const DEFAULT_ATP_CONFIG: ATPConfig = {
  enabled: true,
  triggerOnSave: true,
  triggerOnCommit: true,
  triggerOnRun: true,
  defaultTimeoutMs: 60_000,
  maxHistorySize: 10,
  saveDebounceMs: 2000,
};
