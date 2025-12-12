// src/lib/optimization/types.ts
// Phase 138.0.1: Unified Optimization Types
// Used by both web app and cloud functions

/**
 * Source that triggered the optimization
 */
export type OptimizationSignalSource =
  | 'code_health_panel'
  | 'deploy_gate'
  | 'settings_quality_tab'
  | 'manual';

/**
 * Signal to trigger an optimization run
 */
export type OptimizationSignal = {
  projectId: string;
  triggeredByUid: string;
  source: OptimizationSignalSource;
  requestedAt: string; // ISO
};

/**
 * Evolution phase IDs (prioritized order)
 * 1 = Critical fixes (security, breaking bugs)
 * 2 = Quality improvements (tests, coverage)
 * 3 = Code health (refactoring, cleanup)
 * 4 = Nice-to-have enhancements
 */
export type EvolutionPhaseId = 1 | 2 | 3 | 4;

/**
 * Types of evolution tasks
 */
export type EvolutionTaskKind =
  | 'critical_bug_fix'
  | 'security_fix'
  | 'add_tests'
  | 'improve_coverage'
  | 'cleanup_refactor';

/**
 * A single evolution task
 */
export type EvolutionTask = {
  id: string;
  phase: EvolutionPhaseId;
  kind: EvolutionTaskKind;
  filePath: string;
  description: string;
  rationale?: string;
  estimatedImpact?: {
    healthDelta?: number;
    securityRiskDelta?: number;
    coverageDelta?: number;
  };
};

/**
 * A phase containing multiple tasks
 */
export type EvolutionPhase = {
  id: EvolutionPhaseId;
  label: string;
  tasks: EvolutionTask[];
};

/**
 * Complete evolution plan
 */
export type EvolutionPlan = {
  projectId: string;
  createdAt: string;
  createdByUid: string;
  phases: EvolutionPhase[];
};

/**
 * Status of an optimization run
 */
export type OptimizationRunStatus =
  | 'pending'
  | 'running'
  | 'collecting_signals'
  | 'planning'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Phase 138.1: V1 metrics collected during optimization
 */
export type OptimizationMetrics = {
  deploymentsCount?: number;
  liveSessionsCount?: number;
  agentTasksCount?: number;
  openIssuesCount?: number;
  filesCount?: number;
  totalLinesOfCode?: number;
};

/**
 * Phase 138.3: Detailed signals collected from project subcollections
 */
export type OptimizationSignals = {
  tests: {
    total: number;
    passed: number;
    failed: number;
    flaky: number;
    lastRunAt?: string | null;
  };
  coverage: {
    line: number;       // 0–100
    branch?: number;    // optional if available
    filesMeasured: number;
    lastReportAt?: string | null;
  };
  security: {
    totalAlerts: number;
    blockingAlerts: number;
    highSeverity: number;
    lastScanAt?: string | null;
  };
  issues: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
};

/**
 * Phase 138.3: Computed scores from signals
 */
export type OptimizationScores = {
  reliabilityScore: number;     // 0–100
  securityScore: number;        // 0–100
  coverageScore: number;        // 0–100
  maintainabilityScore: number; // 0–100
  overallScore: number;         // 0–100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
};

/**
 * An optimization run document
 * Stored at: projects/{projectId}/optimizationRuns/{runId}
 */
export type OptimizationRun = {
  id: string;
  projectId: string;
  startedByUid: string;
  status: OptimizationRunStatus;
  createdAt: string;
  updatedAt: string;

  // Phase 138.1: Timing
  startedAt?: string;  // When worker started processing
  finishedAt?: string; // When worker finished

  // Phase 138.1: V1 metrics & results
  metrics?: OptimizationMetrics;
  summary?: string;           // One-line summary of project state
  recommendations?: string[]; // List of actionable recommendations

  // Phase 138.3: Detailed signals & scores
  signals?: OptimizationSignals;
  scores?: OptimizationScores;

  // IDs linking to related system components
  baselineQualitySnapshotId?: string;
  finalQualitySnapshotId?: string;
  appliedPatchGroupId?: string; // For undo functionality

  // Evolution plan (populated in Phase 138.2+)
  plan?: EvolutionPlan;

  // Diagnostics
  errorMessage?: string;

  // Phase 138.5.0: ACE trigger metadata
  ace?: AceTriggerMeta;
};

/**
 * Phase 138.5.0: ACE (Autonomous Code Evolution) trigger level
 * Determines how strongly the system recommends automated code evolution
 */
export type AceTriggerLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * Phase 138.5.0: ACE trigger metadata
 * Computed from optimization scores and signals to determine if ACE should be suggested
 */
export type AceTriggerMeta = {
  level: AceTriggerLevel;
  reasons: string[];
};

/**
 * Response from runProjectOptimization callable
 */
export type RunProjectOptimizationResponse = {
  runId: string;
  status: OptimizationRunStatus;
  createdAt: string;
};
