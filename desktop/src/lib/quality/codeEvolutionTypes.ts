// desktop/src/lib/quality/codeEvolutionTypes.ts
// Phase 149: Code Evolution Engine Types
// Tracks quality improvements across ACE runs and Code Health snapshots

/**
 * Status of a single evolution run
 */
export type EvolutionRunStatus = 'IMPROVED' | 'NO_CHANGE' | 'REGRESSION' | 'INCOMPLETE';

/**
 * Trend direction for overall evolution
 */
export type EvolutionTrend = 'UP' | 'DOWN' | 'FLAT';

/**
 * Insight data for a single ACE run in the evolution timeline
 */
export interface CodeEvolutionRunInsight {
  /** Unique ACE run ID */
  aceRunId: string;
  /** ISO timestamp when run started */
  startedAt: string;
  /** ISO timestamp when run finished */
  finishedAt: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Number of issues targeted for fixing */
  targetedIssues: number;
  /** Number of patches actually applied */
  appliedPatches: number;
  /** Issues count before the run (from snapshot) */
  issuesBefore: number | null;
  /** Issues count after the run (from snapshot) */
  issuesAfter: number | null;
  /** Delta (negative = improvement) */
  delta: number | null;
  /** Computed status for this run */
  status: EvolutionRunStatus;
}

/**
 * Aggregated summary of code evolution across multiple runs
 */
export interface CodeEvolutionSummary {
  /** All runs in chronological order */
  runs: CodeEvolutionRunInsight[];
  /** Total number of ACE runs */
  totalRuns: number;
  /** Number of runs that improved the codebase */
  improvedRuns: number;
  /** Total delta across all runs (negative = net improvement) */
  totalDelta: number;
  /** Best single-run delta (most negative) */
  bestDelta: number;
  /** Overall trend direction */
  trend: EvolutionTrend;
  /** Most recent run insight */
  lastRun?: CodeEvolutionRunInsight;
}

/**
 * Suggestion for improving code evolution
 */
export interface EvolutionSuggestion {
  /** Unique suggestion ID */
  id: string;
  /** Type of suggestion */
  type: 'run_ace' | 'review_regressions' | 'target_files' | 'schedule_scan';
  /** Human-readable title */
  title: string;
  /** Arabic title */
  titleAr: string;
  /** Detailed description */
  description: string;
  /** Arabic description */
  descriptionAr: string;
  /** Priority level */
  priority: 'low' | 'medium' | 'high';
  /** Optional action to execute */
  action?: string;
}

/**
 * Evolution plan step
 */
export interface EvolutionPlanStep {
  /** Step number */
  step: number;
  /** Step title */
  title: string;
  /** Arabic title */
  titleAr: string;
  /** Step description */
  description: string;
  /** Arabic description */
  descriptionAr: string;
  /** Whether this step is completed */
  completed: boolean;
  /** Optional metric for this step */
  metric?: {
    label: string;
    labelAr: string;
    value: number | string;
  };
}

/**
 * Full evolution plan
 */
export interface EvolutionPlan {
  /** Plan steps */
  steps: EvolutionPlanStep[];
  /** Overall progress percentage */
  progress: number;
  /** Target health score */
  targetHealth: number;
  /** Current health score */
  currentHealth: number;
  /** Estimated runs to reach target */
  estimatedRunsToTarget: number;
}
