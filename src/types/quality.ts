// src/types/quality.ts
// =============================================================================
// Phase 150.2 – Shared Quality Types (Web & Desktop sync)
// =============================================================================

export type QualityStatus = 'good' | 'caution' | 'needs_work' | 'blocked';

export interface QualitySnapshot {
  /** Health score 0-100 */
  score: number;
  /** Status based on policy thresholds */
  status: QualityStatus;
  /** Total number of issues detected */
  totalIssues?: number;
  /** ISO timestamp of last scan */
  lastScanAt?: string | null;
  /** Number of files scanned */
  filesScanned?: number;
  /** Security alerts count */
  securityAlerts?: number;
  /** Test status */
  testsStatus?: 'passing' | 'failing' | 'not_run';
}

/**
 * Maps a numeric score to a status
 */
export function scoreToStatus(score: number): QualityStatus {
  if (score >= 80) return 'good';
  if (score >= 60) return 'caution';
  if (score >= 40) return 'needs_work';
  return 'blocked';
}

/**
 * Status display configuration
 */
export const STATUS_CONFIG: Record<QualityStatus, {
  label: string;
  labelAr: string;
  bgClass: string;
  textClass: string;
}> = {
  good: {
    label: 'Good',
    labelAr: 'جيد',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-300',
  },
  caution: {
    label: 'Caution',
    labelAr: 'تحذير',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-300',
  },
  needs_work: {
    label: 'Needs work',
    labelAr: 'يحتاج عمل',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-300',
  },
  blocked: {
    label: 'Blocked',
    labelAr: 'محظور',
    bgClass: 'bg-red-600/15',
    textClass: 'text-red-400',
  },
};
