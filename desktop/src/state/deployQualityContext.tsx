// desktop/src/state/deployQualityContext.tsx
// Phase 134.0: Deploy Quality Gate Context
// Phase 135.0: Updated to use QualityPolicy thresholds instead of hard-coded values
// Phase 135.2: Refactored to use policyEngine with affected files tracking
// Phase 135.4: Added auto-snapshot recording to Quality History
// Phase 136.1: Added external security stats from Security Watchdog
// Phase 137.0: Added test policy placeholder fields (testsLastRunAt, testCoverage, failingTestsCount)
// Phase 137.1: Added ExternalTestStats from Test Watchdog
// Phase 137.4.1: Added ExternalCoverageStats from Coverage Watchdog
// Aggregates quality data from QualityMonitor, TestLab, HealthAlerts, and CodeHealth

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';
import type {
  DeployQualityContextValue,
  DeployQualityLevel,
  DeployQualitySnapshot,
} from '../lib/deploy/deployQualityTypes';

// Import existing contexts
import { useQualityMonitor } from './qualityMonitorContext';
import { useTestLab } from './testLabContext';
import { useHealthAlerts } from './healthAlertsContext';
import { useCodeHealth } from './codeHealthContext';
import { computeHealthScore } from '../lib/analysis/codeHealthTypes';
// Phase 135: Import Quality Policy
import { useQualityThresholds } from './qualityPolicyContext';
// Phase 135.4: Import Quality History
import { useQualityHistory } from './qualityHistoryContext';
// Phase 135.2: Import Policy Engine
import {
  evaluatePolicy,
  statusToLevel,
  type PolicyStatus,
  type PolicyReason,
  type PolicyScanInput,
  type PolicyEvaluationResult,
} from '../lib/quality/policyEngine';
// Phase 136.1: Import security types
// Phase 136.2: Import full SecurityAlert type for Security Center
import type { SecuritySeverity, SecurityAlert } from '../lib/security/securityEngine';
// Phase 137.4.1: Import coverage types
import type { CoverageSummary, FileCoverageHint } from '../lib/tests/coverageTypes';

/**
 * Phase 136.1: External security stats from Security Watchdog
 */
export type ExternalSecurityStats = {
  totalAlerts: number;
  hasBlocking: boolean;
  bySeverity: Record<SecuritySeverity, number>;
  lastScanAt: string;
};

/**
 * Phase 137.1: External test stats from Test Watchdog
 */
export type ExternalTestStats = {
  totalSuites: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  lastRunAt: string | null;
  status: 'not_run' | 'passing' | 'failing' | 'error';
};

/**
 * Phase 137.4.1: External coverage stats from Coverage Watchdog
 */
export type ExternalCoverageStats = {
  summary: CoverageSummary;
  topHints: FileCoverageHint[]; // top N high-risk files without tests
};

/**
 * Phase 138.4: External optimization stats from Cloud Functions
 * Represents the latest project optimization run results
 */
export type ExternalOptimizationStats = {
  runId: string;
  status: 'pending' | 'running' | 'collecting_signals' | 'completed' | 'failed' | 'cancelled';
  overallScore: number;         // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reliabilityScore: number;
  securityScore: number;
  coverageScore: number;
  maintainabilityScore: number;
  finishedAt: string | null;
  createdAt: string;
};

const DeployQualityContext = createContext<DeployQualityContextValue | undefined>(undefined);

/**
 * Extended snapshot with policy engine data
 */
interface ExtendedDeployQualitySnapshot extends DeployQualitySnapshot {
  /** Policy evaluation result */
  policyResult?: PolicyEvaluationResult;
  /** Affected files from policy evaluation */
  affectedFiles?: string[];
}

/**
 * Extended context value with toast callback
 */
interface ExtendedDeployQualityContextValue extends DeployQualityContextValue {
  snapshot: ExtendedDeployQualitySnapshot | null;
  /** Current policy status */
  policyStatus: PolicyStatus;
  /** Policy evaluation result */
  policyResult: PolicyEvaluationResult | null;
  /** Callback to show policy toast */
  showPolicyToast: () => void;
  /** Callback to hide policy toast */
  hidePolicyToast: () => void;
  /** Whether policy toast should be shown */
  shouldShowToast: boolean;
  /** Reasons for current policy status */
  policyReasons: PolicyReason[];
  /** Phase 136.1: External security stats from Security Watchdog */
  externalSecurityStats: ExternalSecurityStats | null;
  /** Phase 136.1: Setter for external security stats */
  setExternalSecurityStats: (stats: ExternalSecurityStats) => void;
  /** Phase 136.2: Full security alerts array for Security Center */
  securityAlerts: SecurityAlert[];
  /** Phase 136.2: Setter for full security alerts */
  setSecurityAlerts: (alerts: SecurityAlert[]) => void;
  /** Phase 137.1: External test stats from Test Watchdog */
  externalTestStats: ExternalTestStats | null;
  /** Phase 137.1: Setter for external test stats */
  setExternalTestStats: (stats: ExternalTestStats | null) => void;
  /** Phase 137.4.1: External coverage stats from Coverage Watchdog */
  externalCoverageStats: ExternalCoverageStats | null;
  /** Phase 137.4.1: Setter for external coverage stats */
  setExternalCoverageStats: (stats: ExternalCoverageStats | null) => void;
  /** Phase 138.4: External optimization stats from Cloud Functions */
  externalOptimizationStats: ExternalOptimizationStats | null;
  /** Phase 138.4: Setter for external optimization stats */
  setExternalOptimizationStats: (stats: ExternalOptimizationStats | null) => void;
}

/**
 * Deploy Quality Provider Props
 */
interface DeployQualityProviderProps {
  children: React.ReactNode;
}

/**
 * Deploy Quality Provider
 * Aggregates data from QualityMonitor, TestLab, HealthAlerts, and CodeHealth
 * Phase 135.2: Uses policyEngine for evaluation
 */
export const DeployQualityProvider: React.FC<DeployQualityProviderProps> = ({
  children,
}) => {
  // Get data from existing contexts
  const { summary: qualitySummary } = useQualityMonitor();
  const { state: testLabState } = useTestLab();
  const { alerts } = useHealthAlerts();
  const { snapshots } = useCodeHealth();
  // Phase 135: Get policy thresholds
  const thresholds = useQualityThresholds();
  // Phase 135.4: Get quality history for auto-snapshot
  const { addSnapshot: addHistorySnapshot } = useQualityHistory();

  const [isLoading, setIsLoading] = useState(false);
  const [shouldShowToast, setShouldShowToast] = useState(false);
  // Phase 136.1: External security stats from Security Watchdog
  const [externalSecurityStats, setExternalSecurityStats] = useState<ExternalSecurityStats | null>(null);
  // Phase 136.2: Full security alerts array for Security Center
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  // Phase 137.1: External test stats from Test Watchdog
  const [externalTestStats, setExternalTestStats] = useState<ExternalTestStats | null>(null);
  // Phase 137.4.1: External coverage stats from Coverage Watchdog
  const [externalCoverageStats, setExternalCoverageStats] = useState<ExternalCoverageStats | null>(null);
  // Phase 138.4: External optimization stats from Cloud Functions
  const [externalOptimizationStats, setExternalOptimizationStats] = useState<ExternalOptimizationStats | null>(null);

  // Track previous status to detect changes
  const prevStatusRef = useRef<PolicyStatus>('OK');

  // Get latest code health snapshot
  const latestSnapshot = snapshots.length > 0 ? snapshots[0] : null;

  // Refresh function (currently relies on live context data)
  const refresh = useCallback(() => {
    setIsLoading(true);
    // Data is already reactive from contexts
    // In future, could trigger explicit re-scan here
    setTimeout(() => setIsLoading(false), 100);
  }, []);

  // Phase 135.2: Build scan input for policy engine
  const scanInput: PolicyScanInput = useMemo(() => {
    // Get health score
    const computedHealth = latestSnapshot ? computeHealthScore(latestSnapshot).score : null;
    const effectiveHealth = qualitySummary.healthScore ?? computedHealth ?? null;

    // Get test summary
    const testSummary = testLabState.summary;
    const failingSuites = testSummary.failingSuites ?? 0;

    // Analyze alerts (combine external security stats with health alerts)
    const healthSecurityAlerts = (alerts ?? []).filter(
      (a) => a.type === 'security_issues_present'
    );
    const criticalAlerts = (alerts ?? []).filter(
      (a) => a.level === 'critical'
    );
    // Phase 136.1: Prefer external security stats from Security Watchdog
    const externalSecurityCount = externalSecurityStats?.totalAlerts ?? 0;
    const hasSecurityFromWatchdog = externalSecurityStats?.hasBlocking ?? false;

    // Get timestamp
    const lastScanAt =
      qualitySummary.lastScanAt ??
      latestSnapshot?.timestamp ??
      null;

    // Get affected files from test lab (failing tests)
    const filesWithFailingTests = testLabState.suites
      .filter((s) => s.status === 'failed')
      .map((s) => s.testFilePath);

    // Get files with issues from code health
    const filesWithIssues = latestSnapshot?.fileCount
      ? [] // Would need to extract from snapshot data
      : [];

    // Phase 136.4: Extract granular security counts from watchdog stats
    const securityCriticalCount = externalSecurityStats?.bySeverity?.critical ?? 0;
    const securityHighCount = externalSecurityStats?.bySeverity?.high ?? 0;

    // Get files with security alerts from the full securityAlerts array
    const filesWithSecurityAlertsSet = new Set<string>();
    securityAlerts.forEach((alert) => {
      if (alert.filePath) {
        filesWithSecurityAlertsSet.add(alert.filePath);
      }
    });

    return {
      healthScore: effectiveHealth,
      lastScanAt,
      testsStatus: qualitySummary.testsStatus,
      failingSuites,
      // Phase 136.1: Use external security stats when available
      hasSecurityAlerts: externalSecurityCount > 0 || healthSecurityAlerts.length > 0,
      criticalAlertCount: criticalAlerts.length,
      totalIssues: qualitySummary.totalIssues,
      filesWithIssues,
      filesWithFailingTests,
      filesWithSecurityAlerts: Array.from(filesWithSecurityAlertsSet),
      // Phase 136.4: Granular security counts for Policy Engine
      securityAlertCount: externalSecurityCount,
      securityCriticalCount,
      securityHighCount,

      // Phase 137.1: Test policy fields from Test Watchdog
      testsLastRunAt: externalTestStats?.lastRunAt ?? testSummary.lastRunAt ?? null,
      testCoverage: null, // TODO: Get from test coverage tool when available
      failingTestsCount: externalTestStats?.failedTests ?? 0,
      totalTestsCount: externalTestStats?.totalTests ?? 0,
    };
  }, [qualitySummary, testLabState, alerts, latestSnapshot, externalSecurityStats, securityAlerts, externalTestStats]);

  // Phase 135.2: Evaluate policy
  const policyResult = useMemo(() => {
    return evaluatePolicy(scanInput, thresholds);
  }, [scanInput, thresholds]);

  // Phase 135.2: Convert to legacy level
  const level = statusToLevel(policyResult.status);

  // Phase 135.2: Show toast when status changes to CAUTION or BLOCK
  useEffect(() => {
    if (
      policyResult.status !== 'OK' &&
      prevStatusRef.current === 'OK'
    ) {
      // Status changed from OK to non-OK → show toast
      setShouldShowToast(true);
      console.log('[PolicyEngine] Status changed to', policyResult.status, '→ showing toast');
    }
    prevStatusRef.current = policyResult.status;
  }, [policyResult.status]);

  // Debug log
  useEffect(() => {
    console.log('[DeployGate][PolicyEngine]', {
      thresholds,
      scanInput: {
        health: scanInput.healthScore,
        totalIssues: scanInput.totalIssues,
        hasSecurityAlerts: scanInput.hasSecurityAlerts,
        testsStatus: scanInput.testsStatus,
      },
      result: {
        status: policyResult.status,
        reasonsCount: policyResult.reasons.length,
        affectedFiles: policyResult.affectedFiles.length,
      },
    });
  }, [policyResult, thresholds, scanInput]);

  // Phase 135.4: Auto-record snapshot to quality history when policy changes
  // Phase 136.4: Added granular security tracking
  useEffect(() => {
    // Only record if we have meaningful data (health score exists)
    if (scanInput.healthScore == null) return;

    // Get security alerts count
    const securityAlertsCount = scanInput.securityAlertCount ??
      (alerts ?? []).filter((a) => a.type === 'security_issues_present').length;

    // Get test info
    const testSummary = testLabState.summary;
    const failingSuites = testSummary.failingSuites ?? 0;
    const testPassRate = qualitySummary.testPassRate;

    // Phase 136.4: Check if blocked by security policy
    const blockedBySecurityPolicy = policyResult.reasons.some(
      (r) => r.code === 'security_critical_present' || r.code === 'security_too_many_alerts'
    );

    // Record the snapshot with Phase 136.4 fields
    addHistorySnapshot({
      health: scanInput.healthScore,
      totalIssues: scanInput.totalIssues ?? 0,
      securityAlerts: securityAlertsCount,
      policyStatus: policyResult.status,
      testPassRate,
      failingSuites,
      // Phase 136.4: Granular security tracking
      securityCriticalAlerts: scanInput.securityCriticalCount,
      securityHighAlerts: scanInput.securityHighCount,
      blockedBySecurityPolicy,
    });
  }, [
    scanInput.healthScore,
    scanInput.totalIssues,
    scanInput.securityAlertCount,
    scanInput.securityCriticalCount,
    scanInput.securityHighCount,
    policyResult.status,
    policyResult.reasons,
    alerts,
    testLabState.summary,
    qualitySummary.testPassRate,
    addHistorySnapshot,
  ]);

  // Compute the quality snapshot
  const snapshot: ExtendedDeployQualitySnapshot | null = useMemo(() => {
    const testSummary = testLabState.summary;
    const totalSuites = testSummary.totalSuites ?? 0;
    const failingSuites = testSummary.failingSuites ?? 0;

    const securityAlerts = (alerts ?? []).filter(
      (a) => a.type === 'security_issues_present'
    );
    const criticalAlerts = (alerts ?? []).filter(
      (a) => a.level === 'critical'
    );

    // Convert policy reasons to legacy format
    const reasons = policyResult.reasons.map((r) => ({
      code: r.code,
      label: r.label,
      labelAr: r.labelAr,
      severity: r.severity === 'critical' ? 'critical' as const : 'warning' as const,
    }));

    return {
      healthScore: scanInput.healthScore,
      lastScanAt: scanInput.lastScanAt,
      lastAceRunAt: qualitySummary.lastAceRun?.createdAt ?? null,
      lastCleanupAt: qualitySummary.lastCleanup?.createdAt ?? null,
      testsStatus: qualitySummary.testsStatus,
      totalSuites,
      failingSuites,
      testPassRate: qualitySummary.testPassRate,
      hasSecurityAlerts: securityAlerts.length > 0,
      criticalAlertCount: criticalAlerts.length,
      totalIssues: qualitySummary.totalIssues,
      level,
      reasons,
      generatedAt: policyResult.evaluatedAt,
      // Phase 135.2: Extended fields
      policyResult,
      affectedFiles: policyResult.affectedFiles,
    };
  }, [qualitySummary, testLabState.summary, alerts, scanInput, policyResult, level]);

  // Check if deploy is allowed (not blocked)
  const canDeploy = useCallback(() => {
    return policyResult.status !== 'BLOCK';
  }, [policyResult]);

  // Get deploy button style based on level
  const getDeployButtonStyle = useCallback(() => {
    switch (policyResult.status) {
      case 'OK':
        return {
          bgColor: 'bg-emerald-500/20',
          hoverColor: 'hover:bg-emerald-500/30',
          icon: '✅',
        };
      case 'CAUTION':
        return {
          bgColor: 'bg-amber-500/20',
          hoverColor: 'hover:bg-amber-500/30',
          icon: '⚠️',
        };
      case 'BLOCK':
        return {
          bgColor: 'bg-red-500/20',
          hoverColor: 'hover:bg-red-500/30',
          icon: '🚫',
        };
    }
  }, [policyResult]);

  // Toast control
  const showPolicyToast = useCallback(() => {
    if (policyResult.status !== 'OK') {
      setShouldShowToast(true);
    }
  }, [policyResult]);

  const hidePolicyToast = useCallback(() => {
    setShouldShowToast(false);
  }, []);

  const value: ExtendedDeployQualityContextValue = {
    snapshot,
    isLoading,
    refresh,
    canDeploy,
    getDeployButtonStyle,
    // Phase 135.2: Extended fields
    policyStatus: policyResult.status,
    policyResult,
    showPolicyToast,
    hidePolicyToast,
    shouldShowToast,
    policyReasons: policyResult.reasons,
    // Phase 136.1: External security stats
    externalSecurityStats,
    setExternalSecurityStats,
    // Phase 136.2: Full security alerts for Security Center
    securityAlerts,
    setSecurityAlerts,
    // Phase 137.1: External test stats
    externalTestStats,
    setExternalTestStats,
    // Phase 137.4.1: External coverage stats
    externalCoverageStats,
    setExternalCoverageStats,
    // Phase 138.4: External optimization stats
    externalOptimizationStats,
    setExternalOptimizationStats,
  };

  return (
    <DeployQualityContext.Provider value={value as DeployQualityContextValue}>
      {children}
    </DeployQualityContext.Provider>
  );
};

/**
 * Hook to access deploy quality context
 */
export function useDeployQuality(): ExtendedDeployQualityContextValue {
  const ctx = useContext(DeployQualityContext);
  if (!ctx) {
    throw new Error('useDeployQuality must be used within a DeployQualityProvider');
  }
  return ctx as ExtendedDeployQualityContextValue;
}

export default DeployQualityProvider;
