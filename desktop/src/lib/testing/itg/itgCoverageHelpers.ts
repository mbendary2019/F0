// desktop/src/lib/testing/itg/itgCoverageHelpers.ts
// Phase 139.4: Coverage Helpers for ITG
// Flexible helpers that work with any coverage snapshot format

import type { ITGTestSuggestion } from './itgTypes';

// Flexible type to work with any snapshot format
type AnyCoverageSnapshot = any;

/**
 * Clamps a value between 0 and 100
 */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/**
 * Attempts to read the overall coverage percentage from any snapshot format.
 * Supports multiple common formats:
 * - { totalCoverage: number }
 * - { overall: number }
 * - { percent: number }
 * - { summary: { percent: number } }
 * - { project: { percent: number } }
 * - { overallPercent: number }
 * - { lineCoverage: number }
 */
export function getBaselineCoveragePercent(
  coverageSnapshot: AnyCoverageSnapshot | null | undefined
): number {
  if (!coverageSnapshot) return 0;

  // Try direct properties
  const direct =
    (coverageSnapshot.totalCoverage as number | undefined) ??
    (coverageSnapshot.overall as number | undefined) ??
    (coverageSnapshot.percent as number | undefined) ??
    (coverageSnapshot.overallPercent as number | undefined) ??
    (coverageSnapshot.lineCoverage as number | undefined) ??
    (coverageSnapshot.total as number | undefined);

  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return clamp(direct);
  }

  // Try nested summary/project objects
  const summary =
    (coverageSnapshot.summary as { percent?: number } | undefined) ??
    (coverageSnapshot.project as { percent?: number } | undefined);

  if (summary && typeof summary.percent === 'number') {
    return clamp(summary.percent);
  }

  // Try to compute from files array
  const files =
    coverageSnapshot.files ||
    coverageSnapshot.fileCoverages ||
    [];

  if (Array.isArray(files) && files.length > 0) {
    let totalPercent = 0;
    let count = 0;

    for (const f of files) {
      if (!f) continue;
      const percent = f.percent ?? f.coverage ?? 0;
      if (typeof percent === 'number') {
        totalPercent += percent;
        count += 1;
      }
    }

    if (count > 0) {
      return clamp(Math.round(totalPercent / count));
    }
  }

  return 0;
}

/**
 * Estimates projected coverage after implementing ITG suggestions.
 * Uses a simple formula: baseline + (suggestions * gainPerSuggestion), capped at maxGain.
 *
 * @param baselinePercent - Current coverage percentage
 * @param suggestions - Array of ITG test suggestions
 * @param options - Optional configuration
 * @returns Projected coverage percentage
 */
export function estimateProjectedCoverage(
  baselinePercent: number,
  suggestions: ITGTestSuggestion[],
  options?: {
    gainPerSuggestion?: number; // default 1.5
    maxGain?: number;           // default 25
  }
): number {
  const gainPerSuggestion = options?.gainPerSuggestion ?? 1.5;
  const maxGain = options?.maxGain ?? 25;

  // Calculate raw gain from suggestions
  const rawGain = suggestions.length * gainPerSuggestion;

  // Also consider the estimated gains from individual suggestions
  let suggestedGain = 0;
  for (const s of suggestions) {
    if (s.estimatedCoverageGain != null && s.estimatedCoverageGain > 0) {
      suggestedGain += s.estimatedCoverageGain;
    }
  }

  // Use the higher of the two estimates
  const effectiveGain = Math.max(rawGain, suggestedGain);
  const boundedGain = Math.min(effectiveGain, maxGain);

  const projected = baselinePercent + boundedGain;

  return clamp(projected);
}

/**
 * Helper convenience function: takes snapshot + suggestions and returns baseline / projected.
 */
export function computeCoverageProjection(
  coverageSnapshot: AnyCoverageSnapshot | null | undefined,
  suggestions: ITGTestSuggestion[]
): { baseline: number; projected: number } {
  const baseline = getBaselineCoveragePercent(coverageSnapshot);
  const projected = estimateProjectedCoverage(baseline, suggestions);
  return { baseline, projected };
}

/**
 * Formats a coverage delta for display.
 * @returns String like "+5.0%" or "-2.3%"
 */
export function formatCoverageDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

/**
 * Gets a color class based on coverage percentage.
 */
export function getCoverageColorClass(percent: number): string {
  if (percent >= 80) return 'text-green-400';
  if (percent >= 50) return 'text-yellow-400';
  if (percent >= 30) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Gets a background color class based on coverage percentage.
 */
export function getCoverageBgClass(percent: number): string {
  if (percent >= 80) return 'bg-green-500/20';
  if (percent >= 50) return 'bg-yellow-500/20';
  if (percent >= 30) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}
