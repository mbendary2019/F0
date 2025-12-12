// desktop/src/features/quality/useQualityOverlayState.ts
// Phase 138.6.0: Unified hook for Quality Overlay Bar data
// Phase 148.2: Unified issues count from projectIssuesContext (single source of truth)
// Aggregates data from multiple contexts for display in the global quality bar

import { useMemo } from 'react';
import type {
  QualityOverlayState,
  QualityOverlaySnapshot,
  QualityRiskLevel,
  QualityAceLevel,
  QualityTestsStatus,
} from './qualityOverlayModel';

// Context imports
import { useDeployQuality } from '../../state/deployQualityContext';
import { useHealthAlerts } from '../../state/healthAlertsContext';
import { useTestLab } from '../../state/testLabContext';
import { useAce } from '../../state/aceContext';
// Phase 148.2: Import projectIssuesContext for unified issues count
import { useProjectIssues } from '../../state/projectIssuesContext';

// Stale threshold: 48 hours
const STALE_HOURS = 48;

/**
 * Calculate if a timestamp is stale (older than 48 hours)
 */
function calculateIsStale(lastSnapshotAt: string | null): boolean {
  if (!lastSnapshotAt) return false;
  const ts = new Date(lastSnapshotAt).getTime();
  if (Number.isNaN(ts)) return false;
  const diffMs = Date.now() - ts;
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= STALE_HOURS;
}

/**
 * Normalize risk level from various sources
 */
function normalizeRiskLevel(overallRisk?: string | null): QualityRiskLevel {
  switch (overallRisk) {
    case 'low':
    case 'medium':
    case 'high':
    case 'critical':
      return overallRisk;
    default:
      return 'none';
  }
}

/**
 * Normalize deploy quality level to risk level
 */
function deployLevelToRisk(level?: string | null): QualityRiskLevel {
  // DeployQualityLevel: 'ship_it' | 'review' | 'wait' | 'stop'
  switch (level) {
    case 'stop':
      return 'critical';
    case 'wait':
      return 'high';
    case 'review':
      return 'medium';
    case 'ship_it':
      return 'low';
    default:
      return 'none';
  }
}

/**
 * Unified hook that aggregates quality data from multiple contexts
 * for display in the global Quality Overlay Bar
 */
export function useQualityOverlayState(): QualityOverlayState {
  // Get data from existing contexts
  const deployQuality = useDeployQuality();
  const healthAlerts = useHealthAlerts();
  const testLab = useTestLab();
  const ace = useAce();
  // Phase 148.2: Get totalIssues from projectIssuesContext (single source of truth)
  const { totalIssues: projectTotalIssues, isScanning: projectIsScanning, lastScanTime } = useProjectIssues();

  return useMemo<QualityOverlayState>(() => {
    // Project ID from deploy quality or null
    const projectId = null; // Will be set by parent component

    // Health score: prioritize optimization stats, then ACE overall debt
    const optimizationStats = deployQuality.externalOptimizationStats;
    const health = optimizationStats?.overallScore ?? ace.overallDebt ?? null;

    // Phase 148.2: Issues count from projectIssuesContext (single source of truth)
    // Fallback to security stats or health alerts only if project issues not available
    const securityStats = deployQuality.externalSecurityStats;
    const issuesCount = projectTotalIssues ?? securityStats?.totalAlerts ?? healthAlerts.alerts.length ?? null;

    // Tests status from external test stats
    // Phase 182.2: Prioritize status field over totalTests count to properly detect test completion
    const testStats = deployQuality.externalTestStats;
    let testsStatus: QualityTestsStatus = 'unknown';
    let lastTestsAt: string | null = null;

    if (testStats) {
      lastTestsAt = testStats.lastRunAt ?? null;
      // Phase 182.2: Check status first, only fall back to totalTests if status is not set
      if (testStats.status === 'failing' || testStats.failedTests > 0) {
        testsStatus = 'failing';
      } else if (testStats.status === 'passing' || testStats.passedTests > 0) {
        testsStatus = 'passing';
      } else if (testStats.status === 'not_run' || !testStats.lastRunAt) {
        testsStatus = 'not_run';
      }
    } else if (testLab.isRunning) {
      testsStatus = 'running';
    }

    // Security alerts from external stats or context
    const securityAlerts = {
      total: securityStats?.totalAlerts ?? deployQuality.securityAlerts?.length ?? 0,
      blocking: securityStats?.hasBlocking ? 1 : 0,
    };

    // ACE level from ACE context activity status or alerts
    let aceLevel: QualityAceLevel = 'none';
    if (ace.activityStatus === 'attention') {
      aceLevel = 'high';
    } else if (ace.suggestions.length > 10) {
      aceLevel = 'medium';
    } else if (ace.suggestions.length > 0) {
      aceLevel = 'low';
    }

    // Risk level from optimization stats or deploy quality snapshot (level → riskLevel)
    const riskLevel: QualityRiskLevel = normalizeRiskLevel(
      optimizationStats?.riskLevel
    ) || deployLevelToRisk(deployQuality.snapshot?.level);

    // Last snapshot timestamp
    const lastSnapshotAt =
      optimizationStats?.finishedAt ??
      optimizationStats?.createdAt ??
      ace.lastScan ??
      null;

    // Build snapshot
    const snapshot: QualityOverlaySnapshot = {
      health,
      issuesCount,
      testsStatus,
      lastTestsAt,
      securityAlerts,
      aceLevel,
      riskLevel,
      lastSnapshotAt,
      isStale: calculateIsStale(lastSnapshotAt),
    };

    // Loading state: any context is loading
    const loading = ace.isScanning || testLab.isRunning || false;

    return {
      projectId,
      loading,
      snapshot,
    };
  }, [deployQuality, healthAlerts, testLab, ace, projectTotalIssues]);
}

export default useQualityOverlayState;
