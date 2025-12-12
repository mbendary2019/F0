// src/lib/quality/qualityHistoryTypes.ts
// Phase 135.4: Quality History Types

import type { PolicyStatus } from './policyEngine';

/**
 * A snapshot of project quality at a point in time
 * Phase 136.4: Added granular security counts
 * Phase 148.1: Added source field for delta calculation
 */
export type QualitySnapshot = {
  /** Unique identifier (timestamp-based) */
  id: string;
  /** ISO timestamp when snapshot was taken */
  createdAt: string;
  /** Project health score (0-100) */
  health: number;
  /** Total number of issues */
  totalIssues: number;
  /** Number of security alerts */
  securityAlerts: number;
  /** Policy status at time of snapshot */
  policyStatus: PolicyStatus;
  /** Optional project ID for multi-project support */
  projectId?: string;
  /** Optional: Test pass rate at time of snapshot */
  testPassRate?: number;
  /** Optional: Number of failing test suites */
  failingSuites?: number;

  // --- Phase 136.4: Granular security tracking ---
  /** Number of critical security alerts */
  securityCriticalAlerts?: number;
  /** Number of high severity security alerts */
  securityHighAlerts?: number;
  /** Whether deployment was blocked due to security */
  blockedBySecurityPolicy?: boolean;

  // --- Phase 148.1: Source tracking for accurate delta calculation ---
  /**
   * Source of this snapshot:
   * - 'scan': From project scan (before auto-fix)
   * - 'auto_fix_after_scan': After ACE auto-fix run
   * - 'manual': Manual snapshot
   */
  source?: 'scan' | 'auto_fix_after_scan' | 'manual';
};

/**
 * Quality history state
 */
export type QualityHistoryState = {
  snapshots: QualitySnapshot[];
};

/**
 * Context value for quality history
 */
export type QualityHistoryContextValue = {
  /** All snapshots for current project */
  snapshots: QualitySnapshot[];
  /** Add a new snapshot */
  addSnapshot: (snapshot: Omit<QualitySnapshot, 'id' | 'createdAt'>) => void;
  /** Clear history for a specific project */
  clearHistoryForProject: (projectId?: string) => void;
  /** Get the latest snapshot */
  latestSnapshot: QualitySnapshot | null;
  /** Get trend direction */
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
};

/**
 * Calculate trend from snapshots
 */
export function calculateTrend(
  snapshots: QualitySnapshot[]
): 'improving' | 'stable' | 'declining' | 'unknown' {
  if (snapshots.length < 2) return 'unknown';

  // Sort by createdAt
  const sorted = [...snapshots].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Compare health scores with a 2% threshold
  if (last.health > first.health + 2) return 'improving';
  if (last.health < first.health - 2) return 'declining';
  return 'stable';
}

/**
 * Format date as relative time
 */
export function formatDateAgo(dateStr: string, locale: 'en' | 'ar'): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / (60000 * 60));
  const diffDays = Math.round(diffMs / (60000 * 60 * 24));

  if (diffMin < 1) {
    return locale === 'ar' ? 'منذ لحظات' : 'just now';
  }
  if (diffMin < 60) {
    return locale === 'ar'
      ? `منذ ${diffMin} دقيقة`
      : `${diffMin} min ago`;
  }
  if (diffHours < 24) {
    return locale === 'ar'
      ? `منذ ${diffHours} ساعة`
      : `${diffHours}h ago`;
  }
  return locale === 'ar'
    ? `منذ ${diffDays} يوم`
    : `${diffDays} day(s) ago`;
}
