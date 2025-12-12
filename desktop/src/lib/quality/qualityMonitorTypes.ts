// desktop/src/lib/quality/qualityMonitorTypes.ts
// Phase 132.0: Quality Monitor State Types

/**
 * Test run status
 */
export type TestsStatus = 'passing' | 'failing' | 'not_run';

/**
 * Quality event types
 */
export type QualityEventType = 'scan' | 'ace' | 'tests' | 'cleanup';

/**
 * Base quality event
 */
export interface QualityEventBase {
  id: string;
  type: QualityEventType;
  createdAt: string; // ISO timestamp
  projectId: string;
}

/**
 * Code Health Scan event
 */
export interface ScanEvent extends QualityEventBase {
  type: 'scan';
  healthBefore?: number | null;
  healthAfter?: number | null;
  issuesFound?: number;
  filesScanned?: number;
}

/**
 * ACE Evolution event
 */
export interface AceEvent extends QualityEventBase {
  type: 'ace';
  phaseSummary?: string;
  planId?: string;
  suggestionsCount?: number;
  overallDebt?: number;
}

/**
 * Test Run event
 */
export interface TestsEvent extends QualityEventBase {
  type: 'tests';
  status: TestsStatus;
  passed?: number;
  failed?: number;
  skipped?: number;
  total?: number;
  durationMs?: number;
}

/**
 * Cleanup Session event
 */
export interface CleanupEvent extends QualityEventBase {
  type: 'cleanup';
  healthBefore?: number | null;
  healthAfter?: number | null;
  filesTouched?: number;
  issuesFixed?: number;
}

/**
 * Union type for all quality events
 */
export type QualityEvent =
  | ScanEvent
  | AceEvent
  | TestsEvent
  | CleanupEvent;

/**
 * Quality Monitor Summary - aggregated view
 */
export interface QualitySummary {
  /** Current health score (0-100) */
  healthScore: number | null;
  /** Current tests status */
  testsStatus: TestsStatus;
  /** Last ACE run event */
  lastAceRun: AceEvent | null;
  /** Last cleanup session event */
  lastCleanup: CleanupEvent | null;
  /** Last scan timestamp (ISO) */
  lastScanAt: string | null;
  /** Recent quality events (sorted by date, newest first) */
  events: QualityEvent[];
  /** Total issues count from last scan */
  totalIssues: number | null;
  /** Test pass rate */
  testPassRate: number | null;
}

/**
 * Empty summary factory
 */
export function createEmptySummary(): QualitySummary {
  return {
    healthScore: null,
    testsStatus: 'not_run',
    lastAceRun: null,
    lastCleanup: null,
    lastScanAt: null,
    events: [],
    totalIssues: null,
    testPassRate: null,
  };
}

/**
 * Calculate health score from issues
 * Higher score = healthier code (fewer issues)
 */
export function calculateHealthScore(
  _totalIssues: number,
  filesScanned: number,
  severity: { errors: number; warnings: number; infos: number }
): number {
  if (filesScanned === 0) return 100;

  // Weight issues by severity
  const weightedIssues =
    severity.errors * 3 +
    severity.warnings * 1.5 +
    severity.infos * 0.5;

  // Calculate issues per file ratio
  const issuesPerFile = weightedIssues / filesScanned;

  // Score formula: starts at 100, decreases with issues
  // 0 issues = 100, 10+ issues/file = ~50
  const score = Math.max(0, Math.round(100 - (issuesPerFile * 5)));

  return Math.min(100, score);
}

/**
 * Get event icon for display
 */
export function getEventIcon(type: QualityEventType): string {
  switch (type) {
    case 'scan':
      return '🔍';
    case 'ace':
      return '🧬';
    case 'tests':
      return '🧪';
    case 'cleanup':
      return '🧹';
    default:
      return '•';
  }
}

/**
 * Get event title for display
 */
export function getEventTitle(type: QualityEventType): string {
  switch (type) {
    case 'scan':
      return 'Code Health Scan';
    case 'ace':
      return 'ACE Evolution';
    case 'tests':
      return 'Test Run';
    case 'cleanup':
      return 'Cleanup Session';
    default:
      return 'Event';
  }
}

/**
 * Format relative time
 */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';

  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 1000 / 60);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;

  const diffD = Math.round(diffH / 24);
  return `${diffD}d ago`;
}

/**
 * Format full datetime
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}
