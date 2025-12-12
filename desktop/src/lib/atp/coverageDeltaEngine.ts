// desktop/src/lib/atp/coverageDeltaEngine.ts
// Phase 140.2: Coverage Delta Engine for ATP
// Computes coverage changes between before/after snapshots

import type {
  CoverageDeltaSummary,
  FileCoverageDelta,
  FileCoverageInfo,
  CoverageSnapshot,
  CoverageDeltaOptions,
} from './coverageDeltaTypes';

const DEFAULT_OPTIONS: Required<CoverageDeltaOptions> = {
  // Risk score >= 4 (out of 5) is considered high risk
  // Since riskScore is 1-5, we use 0.8 (4/5) as threshold
  highRiskThreshold: 0.8,
  // 2% drop counts as significant regression
  significantRegressionPct: 2,
};

/**
 * Compute the coverage delta between two snapshots
 *
 * @param before - Coverage snapshot before the test cycle
 * @param after - Coverage snapshot after the test cycle
 * @param options - Configuration options
 * @returns Summary of coverage changes with per-file breakdown
 */
export function computeCoverageDelta(
  before: CoverageSnapshot | null,
  after: CoverageSnapshot | null,
  options?: CoverageDeltaOptions,
): CoverageDeltaSummary {
  const opts = { ...DEFAULT_OPTIONS, ...(options ?? {}) };

  // Build maps for quick lookup
  const byFileBefore = new Map<string, FileCoverageInfo>();
  const byFileAfter = new Map<string, FileCoverageInfo>();

  if (before) {
    for (const f of before.files) {
      byFileBefore.set(f.filePath, f);
    }
  }
  if (after) {
    for (const f of after.files) {
      byFileAfter.set(f.filePath, f);
    }
  }

  // Collect all unique file paths
  const allFilePaths = new Set<string>([
    ...byFileBefore.keys(),
    ...byFileAfter.keys(),
  ]);

  const fileDeltas: FileCoverageDelta[] = [];

  for (const filePath of allFilePaths) {
    const b = byFileBefore.get(filePath) ?? {
      filePath,
      coveragePct: null,
      riskScore: undefined,
    };
    const a = byFileAfter.get(filePath) ?? {
      filePath,
      coveragePct: null,
      riskScore: b.riskScore,
    };

    const beforePct = b.coveragePct;
    const afterPct = a.coveragePct;
    const delta =
      beforePct == null || afterPct == null
        ? null
        : Number((afterPct - beforePct).toFixed(2));

    // Use risk score from after snapshot, or fallback to before
    const riskScore = a.riskScore ?? b.riskScore;

    // High risk if score >= threshold (4 out of 5 = 0.8)
    // Risk scores are 1-5, so convert to 0-1 scale
    const normalizedRisk = typeof riskScore === 'number' ? riskScore / 5 : 0;
    const isHighRisk = normalizedRisk >= opts.highRiskThreshold;

    // Untested = null coverage or 0%
    const isUntestedAfter = afterPct == null || afterPct === 0;

    // Regression if delta is negative and exceeds threshold
    const isRegression =
      delta !== null &&
      delta < 0 &&
      Math.abs(delta) >= opts.significantRegressionPct;

    // Improvement if delta is positive
    const isImprovement = delta !== null && delta > 0;

    fileDeltas.push({
      filePath,
      before: beforePct,
      after: afterPct,
      delta,
      riskScore,
      isRegression,
      isImprovement,
      isHighRiskUntested: isHighRisk && isUntestedAfter,
    });
  }

  // Categorize files
  const regressions = fileDeltas.filter((f) => f.isRegression);
  const improvements = fileDeltas.filter((f) => f.isImprovement);
  const untestedHighRiskFiles = fileDeltas.filter((f) => f.isHighRiskUntested);

  // Calculate total delta
  const totalBefore = before?.totalPct ?? null;
  const totalAfter = after?.totalPct ?? null;
  const totalDelta =
    totalBefore == null || totalAfter == null
      ? null
      : Number((totalAfter - totalBefore).toFixed(2));

  return {
    totalBefore,
    totalAfter,
    totalDelta,
    regressions,
    improvements,
    untestedHighRiskFiles,
  };
}

/**
 * Format a coverage delta for logging
 */
export function formatCoverageDelta(delta: number | null): string {
  if (delta === null) return 'N/A';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}%`;
}

/**
 * Get severity level for a regression
 */
export function getRegressionSeverity(
  delta: number | null,
  riskScore?: number,
): 'critical' | 'warning' | 'info' {
  if (delta === null) return 'info';

  const isHighRisk = typeof riskScore === 'number' && riskScore >= 4;
  const absDelta = Math.abs(delta);

  // Critical: high-risk file with > 5% drop, or any file with > 10% drop
  if ((isHighRisk && absDelta > 5) || absDelta > 10) {
    return 'critical';
  }

  // Warning: any regression >= 2%
  if (absDelta >= 2) {
    return 'warning';
  }

  return 'info';
}
