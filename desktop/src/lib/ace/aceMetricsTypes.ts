// desktop/src/lib/ace/aceMetricsTypes.ts
// Phase 128.6: ACE Metrics & History Types

/**
 * Event recorded each time ACE recomputes
 */
export type AceRecomputeEvent = {
  id: string;
  projectRoot: string;
  timestamp: string;
  filesCount: number;
  suggestionsCount: number;
  overallDebtScore: number; // 0-100 (higher is better)
  previousScore?: number; // For tracking improvement
  trigger: 'manual' | 'auto_scan' | 'phase_complete';
};

/**
 * Status of a phase run
 */
export type AcePhaseRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Record of a phase execution
 */
export type AcePhaseRun = {
  id: string;
  planId: string;
  phaseId: string;
  phaseTitle: string;
  startedAt: string;
  finishedAt?: string;
  status: AcePhaseRunStatus;
  appliedSuggestions: string[];
  skippedSuggestions: string[];
  error?: string;
  /** Debt score before the run */
  scoreBefore?: number;
  /** Debt score after the run */
  scoreAfter?: number;
};

/**
 * ACE activity status for the header widget
 */
export type AceActivityStatus =
  | 'idle'      // Recent run, good score
  | 'attention' // Medium score, many suggestions
  | 'stale'     // No recent recompute
  | 'running';  // Currently scanning

/**
 * Full ACE metrics state
 */
export type AceMetricsState = {
  /** History of recompute events */
  recomputeHistory: AceRecomputeEvent[];
  /** History of phase runs */
  phaseRuns: AcePhaseRun[];
  /** Timestamp of last activity */
  lastActivity?: string;
};

/**
 * Default empty metrics state
 */
export const defaultAceMetricsState: AceMetricsState = {
  recomputeHistory: [],
  phaseRuns: [],
  lastActivity: undefined,
};

/**
 * Calculate activity status based on metrics
 */
export function calculateAceActivityStatus(
  metrics: AceMetricsState,
  currentScore: number,
  isScanning: boolean,
  suggestionsCount: number
): AceActivityStatus {
  if (isScanning) return 'running';

  const lastRun = metrics.recomputeHistory[0];
  if (!lastRun) return 'stale';

  // Check if stale (more than 1 hour since last run)
  const lastRunTime = new Date(lastRun.timestamp).getTime();
  const hourAgo = Date.now() - 60 * 60 * 1000;
  if (lastRunTime < hourAgo) return 'stale';

  // Check if needs attention (score < 70 or many suggestions)
  if (currentScore < 70 || suggestionsCount > 10) return 'attention';

  return 'idle';
}

/**
 * Format relative time for display
 */
export function formatRelativeTime(timestamp: string, locale: 'ar' | 'en'): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (locale === 'ar') {
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days === 1) return 'أمس';
    return `منذ ${days} يوم`;
  }

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/**
 * Get improvement delta between two scores
 */
export function getScoreImprovement(
  history: AceRecomputeEvent[]
): { delta: number; improved: boolean } | null {
  if (history.length < 2) return null;

  const current = history[0].overallDebtScore;
  const previous = history[1].overallDebtScore;
  const delta = current - previous;

  return {
    delta: Math.abs(delta),
    improved: delta > 0,
  };
}

export default {
  defaultAceMetricsState,
  calculateAceActivityStatus,
  formatRelativeTime,
  getScoreImprovement,
};
