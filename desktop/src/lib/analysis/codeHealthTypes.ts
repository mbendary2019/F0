// desktop/src/lib/analysis/codeHealthTypes.ts
// Phase 125.0: Data Model for Code Health Metrics

/**
 * Counts of issues by severity level
 */
export type IssueSeverityCounts = {
  errors: number;
  warnings: number;
  infos: number;
};

/**
 * Counts of issues by category
 */
export type IssueCategoryCounts = {
  logging: number;
  types: number;
  style: number;
  deadCode: number;
  security: number;
  performance: number;
  other: number;
};

/**
 * A snapshot of code health at a point in time
 */
export type CodeHealthSnapshot = {
  id: string;            // e.g., "scan-2025-12-02T02:10:00.000Z"
  timestamp: string;     // ISO string
  source: 'scan' | 'auto_fix_after_scan';
  filesScanned: number;
  totalIssues: number;
  severity: IssueSeverityCounts;
  categories: IssueCategoryCounts;
};

/**
 * A run represents a before/after comparison from a fix operation
 */
export type CodeHealthRun = {
  id: string;
  timestamp: string;
  // Snapshot before the fix (from last scan)
  before: CodeHealthSnapshot | null;
  // Snapshot after the fix + auto-scan
  after: CodeHealthSnapshot | null;
  filesFixed: number;
  profileId?: string; // logging_only / safe_mix / all ...
};

/**
 * Computed health score with visual metadata
 */
export type CodeHealthScore = {
  score: number;       // 0 - 100
  label: string;       // "Poor" / "OK" / "Great"
  labelAr: string;     // Arabic label
  color: 'red' | 'orange' | 'yellow' | 'green';
};

/**
 * Compute a health score from a snapshot
 *
 * Simple v1 algorithm:
 * - Base score of 100
 * - Penalty for issues per file
 * - Extra penalty for errors
 */
export function computeHealthScore(snapshot: CodeHealthSnapshot | null): CodeHealthScore {
  if (!snapshot || snapshot.filesScanned === 0) {
    return { score: 50, label: 'Unknown', labelAr: 'غير معروف', color: 'yellow' };
  }

  const { totalIssues, severity } = snapshot;
  const issuePerFile = totalIssues / Math.max(snapshot.filesScanned, 1);

  // Simple v1 scoring model
  let score = 100;

  // Penalty for issues in general (up to 50 points)
  score -= Math.min(50, issuePerFile * 2);

  // Extra penalty for errors (up to 30 points)
  score -= Math.min(30, severity.errors * 0.2);

  // Clamp to 0-100
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  // Round to integer
  score = Math.round(score);

  let label: string;
  let labelAr: string;
  let color: CodeHealthScore['color'];

  if (score >= 85) {
    label = 'Great';
    labelAr = 'ممتاز';
    color = 'green';
  } else if (score >= 65) {
    label = 'Good';
    labelAr = 'جيد';
    color = 'yellow';
  } else if (score >= 40) {
    label = 'Needs work';
    labelAr = 'يحتاج تحسين';
    color = 'orange';
  } else {
    label = 'Poor';
    labelAr = 'ضعيف';
    color = 'red';
  }

  return { score, label, labelAr, color };
}

/**
 * Compute improvement between two snapshots
 */
export function computeImprovement(
  before: CodeHealthSnapshot | null,
  after: CodeHealthSnapshot | null
): { issuesReduced: number; percentReduced: number } | null {
  if (!before || !after) return null;

  const diffIssues = before.totalIssues - after.totalIssues;
  const pct = before.totalIssues > 0
    ? (diffIssues / before.totalIssues) * 100
    : 0;

  return {
    issuesReduced: diffIssues,
    percentReduced: Math.round(pct),
  };
}

/**
 * Create empty category counts
 */
export function emptyCategories(): IssueCategoryCounts {
  return {
    logging: 0,
    types: 0,
    style: 0,
    deadCode: 0,
    security: 0,
    performance: 0,
    other: 0,
  };
}

/**
 * Create empty severity counts
 */
export function emptySeverity(): IssueSeverityCounts {
  return {
    errors: 0,
    warnings: 0,
    infos: 0,
  };
}

export default {
  computeHealthScore,
  computeImprovement,
  emptyCategories,
  emptySeverity,
};
