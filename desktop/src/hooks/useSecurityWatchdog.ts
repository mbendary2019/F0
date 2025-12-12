// desktop/src/hooks/useSecurityWatchdog.ts
// Phase 136.1: Security Watchdog Hook
// Phase 136.2: Added full SecurityAlerts array for Security Center
// Monitors project issues, runs security scan, and syncs with Policy + Health Alerts

import { useEffect, useRef } from 'react';
import {
  runSecurityScan,
  type SecurityScanResult,
  type SecuritySeverity,
} from '../lib/security/securityEngine';
import { useHealthAlerts } from '../state/healthAlertsContext';
import { useDeployQuality } from '../state/deployQualityContext';
import type { FileIssuesSummary } from '../state/projectIssuesContext';

/**
 * External security stats type for deployQualityContext
 */
export type ExternalSecurityStats = {
  totalAlerts: number;
  hasBlocking: boolean;
  bySeverity: Record<SecuritySeverity, number>;
  lastScanAt: string;
};

type UseSecurityWatchdogParams = {
  projectId?: string | null;
  /** File issue summaries from projectIssuesContext */
  summaries: FileIssuesSummary[];
  /** Whether scanning is enabled */
  enabled?: boolean;
};

/**
 * Security Watchdog Hook
 *
 * Monitors project issues and runs security scans to:
 * 1. Update deployQualityContext with security stats
 * 2. Generate health alerts for security issues
 */
export function useSecurityWatchdog({
  projectId,
  summaries,
  enabled = true,
}: UseSecurityWatchdogParams) {
  const { generateAlertsAfterSnapshot } = useHealthAlerts();
  // Phase 136.2: Get both setters for stats and full alerts
  const { setExternalSecurityStats, setSecurityAlerts } = useDeployQuality();

  // Track last scan to avoid duplicates
  const lastScanHashRef = useRef<string>('');

  useEffect(() => {
    // Skip if disabled or no project
    if (!enabled) return;
    if (!projectId) return;
    if (!summaries || summaries.length === 0) {
      // Clear security stats if no summaries
      setExternalSecurityStats?.({
        totalAlerts: 0,
        hasBlocking: false,
        bySeverity: { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
        lastScanAt: new Date().toISOString(),
      });
      // Phase 136.2: Clear full alerts array too
      setSecurityAlerts?.([]);
      return;
    }

    // Create hash of summaries to detect changes
    const summaryHash = summaries
      .map((s) => `${s.filePath}:${s.issueCount}`)
      .join('|');

    // Skip if nothing changed
    if (summaryHash === lastScanHashRef.current) {
      return;
    }

    console.log('[SecurityWatchdog] Running security scan...', {
      projectId,
      summariesCount: summaries.length,
    });

    // Convert file summaries to security scan input
    const existingIssues = summaries.flatMap((summary) =>
      summary.issues.map((issue) => ({
        id: issue.id,
        filePath: summary.filePath,
        line: issue.lineStart,
        column: undefined,
        message: issue.message,
        severity:
          issue.severity === 'error'
            ? ('high' as const)
            : issue.severity === 'warning'
            ? ('medium' as const)
            : ('low' as const),
        tags:
          issue.category === 'security'
            ? ['security']
            : issue.category === 'best-practice'
            ? ['best-practice']
            : undefined,
      }))
    );

    // Run security scan
    const result: SecurityScanResult = runSecurityScan({ existingIssues });

    console.log('[SecurityWatchdog] Security scan result:', {
      total: result.total,
      hasBlocking: result.hasBlocking,
      bySeverity: result.bySeverity,
    });

    // Update last scan hash
    lastScanHashRef.current = summaryHash;

    // 1) Update deployQualityContext with security stats
    setExternalSecurityStats?.({
      totalAlerts: result.total,
      hasBlocking: result.hasBlocking,
      bySeverity: result.bySeverity,
      lastScanAt: new Date().toISOString(),
    });

    // Phase 136.2: Update full alerts array for Security Center
    setSecurityAlerts?.(result.alerts);

    // 2) Generate health alerts if security issues found
    if (result.total > 0) {
      console.log(
        '[SecurityWatchdog] Security issues found, generating health alerts...'
      );
      // The health alerts will be generated when snapshot is recorded
      // For now, trigger a manual generation if critical issues exist
      if (result.hasBlocking) {
        generateAlertsAfterSnapshot?.();
      }
    }
  }, [
    projectId,
    summaries,
    enabled,
    setExternalSecurityStats,
    setSecurityAlerts,
    generateAlertsAfterSnapshot,
  ]);
}

export default useSecurityWatchdog;
