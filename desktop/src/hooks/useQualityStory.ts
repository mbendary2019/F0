// desktop/src/hooks/useQualityStory.ts
// Phase 140.7: Quality Story Hook
// Aggregates quality data from multiple watchdogs for Pre-Deploy summary
// Used by PreDeployQualityStory component for "at a glance" view

import { useMemo } from 'react';
import { useDeployQuality } from '../state/deployQualityContext';
import { useCodeHealth } from '../state/codeHealthContext';
import { useQualityHistory } from '../state/qualityHistoryContext';
import { useLastTestCycleSummary } from './useLastTestCycleSummary';

/**
 * Quality story status - matches Policy Engine status
 */
export type QualityStoryStatus = 'BLOCK' | 'CAUTION' | 'OK' | 'UNKNOWN';

/**
 * Aggregated quality story for pre-deploy display
 */
export interface QualityStory {
  /** Overall status from policy engine */
  status: QualityStoryStatus;
  /** Health score percentage (0-100) */
  health: number | null;
  /** Total code issues count */
  issues: number | null;
  /** Security summary */
  security: {
    totalAlerts: number;
    blocking: number;
  } | null;
  /** Coverage summary from Coverage Watchdog */
  coverage: {
    percent: number | null;
    testedFiles: number | null;
    totalFiles: number | null;
    highRiskUntested: number | null;
    lastDelta: number | null;
  } | null;
  /** Whether F0 is actively orchestrating quality */
  isOrchestrated: boolean;
}

/**
 * Parse percentage value from string or number
 */
function parsePercent(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const trimmed = String(value).replace('%', '').trim();
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Hook to aggregate quality data into a single story for pre-deploy display
 *
 * Pulls data from:
 * - deployQualityContext (policy status, security stats, coverage stats)
 * - codeHealthContext (last scan snapshot)
 * - qualityHistoryContext (latest snapshot for status)
 * - useLastTestCycleSummary (ATP last delta)
 *
 * @returns QualityStory or null if no data available
 */
export function useQualityStory(): QualityStory | null {
  // Get data from contexts
  const {
    externalSecurityStats,
    externalCoverageStats,
    policyStatus,
    snapshot: deploySnapshot,
  } = useDeployQuality();
  const { lastScanSnapshot } = useCodeHealth();
  const { latestSnapshot } = useQualityHistory();
  const { summary: atpSummary } = useLastTestCycleSummary();

  return useMemo(() => {
    // Get health from deploy snapshot or quality history
    const health = deploySnapshot?.healthScore ?? latestSnapshot?.health ?? null;

    // Get issues from deploy snapshot or code health
    const issues =
      deploySnapshot?.totalIssues ??
      latestSnapshot?.totalIssues ??
      lastScanSnapshot?.totalIssues ??
      null;

    // Map policy status to story status
    const status: QualityStoryStatus =
      policyStatus === 'OK'
        ? 'OK'
        : policyStatus === 'CAUTION'
        ? 'CAUTION'
        : policyStatus === 'BLOCK'
        ? 'BLOCK'
        : 'UNKNOWN';

    // Build security summary from external security stats
    const security =
      externalSecurityStats && typeof externalSecurityStats.totalAlerts === 'number'
        ? {
            totalAlerts: externalSecurityStats.totalAlerts,
            blocking: externalSecurityStats.hasBlocking
              ? externalSecurityStats.bySeverity?.critical ?? 0 +
                (externalSecurityStats.bySeverity?.high ?? 0)
              : 0,
          }
        : null;

    // Build coverage summary from external coverage stats + ATP
    const coverage =
      externalCoverageStats && externalCoverageStats.summary
        ? {
            percent: parsePercent(externalCoverageStats.summary.estimatedCoveragePercent),
            testedFiles: externalCoverageStats.summary.filesWithAnyTests ?? null,
            totalFiles: externalCoverageStats.summary.totalSourceFiles ?? null,
            highRiskUntested: externalCoverageStats.summary.highRiskUntestedCount ?? null,
            lastDelta: atpSummary?.coverageDelta ?? null,
          }
        : null;

    // Check if we have any meaningful data
    const hasAny =
      health != null || issues != null || security != null || coverage != null;

    if (!hasAny) return null;

    // Determine if F0 is orchestrating (we have coverage/ATP/security stats)
    const isOrchestrated =
      externalCoverageStats != null ||
      externalSecurityStats != null ||
      atpSummary != null;

    return {
      status,
      health,
      issues,
      security,
      coverage,
      isOrchestrated,
    };
  }, [
    externalSecurityStats,
    externalCoverageStats,
    policyStatus,
    deploySnapshot,
    lastScanSnapshot,
    latestSnapshot,
    atpSummary,
  ]);
}

export default useQualityStory;
