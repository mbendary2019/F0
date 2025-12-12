// desktop/src/hooks/useDiagnosticsWire.ts
// Phase 146.4 – Wire Watchdogs to DiagnosticsContext
// Phase 146.4.1 – Fixed infinite loop by using stable comparison key
// Collects data from ProjectIssues, DeployQuality, AceTelemetry and feeds DiagnosticsEngine

import { useEffect, useMemo, useRef } from 'react';
import { useDiagnosticsSafe } from '../contexts/diagnosticsContext';
import { useProjectIssues } from '../state/projectIssuesContext';
import { useDeployQuality } from '../state/deployQualityContext';
import { useAceTelemetry } from '../contexts/aceTelemetryContext';
import type { DiagnosticsEngineInput, IssueRecord, SecurityAlert as DiagSecurityAlert, TestRecord } from '../lib/quality/diagnosticsEngine';

/**
 * Create a stable hash key from the input data to detect real changes
 */
function createInputHash(
  projectRoot: string | null,
  summariesLength: number,
  summariesTotalErrors: number,
  summariesTotalWarnings: number,
  securityAlertsLength: number,
  coverageHintsLength: number,
  aceRunsLength: number
): string {
  return `${projectRoot}-${summariesLength}-${summariesTotalErrors}-${summariesTotalWarnings}-${securityAlertsLength}-${coverageHintsLength}-${aceRunsLength}`;
}

/**
 * Hook that wires watchdog data to the DiagnosticsContext
 * Should be called once in the App component tree
 */
export function useDiagnosticsWire(projectRoot: string | null) {
  const diagnosticsCtx = useDiagnosticsSafe();
  const projectIssues = useProjectIssues();
  const deployQuality = useDeployQuality();
  const aceTelemetry = useAceTelemetry();

  // Track previous hash to avoid unnecessary updates
  const prevHashRef = useRef<string | null>(null);

  // Compute stable values for comparison
  const summariesLength = projectIssues.summaries?.length ?? 0;
  const summariesTotalErrors = projectIssues.summaries?.reduce((sum, s) => sum + (s.errors ?? 0), 0) ?? 0;
  const summariesTotalWarnings = projectIssues.summaries?.reduce((sum, s) => sum + (s.warnings ?? 0), 0) ?? 0;
  const securityAlertsLength = deployQuality.securityAlerts?.length ?? 0;
  const coverageHintsLength = deployQuality.externalCoverageStats?.topHints?.length ?? 0;
  const aceRunsLength = aceTelemetry.runs?.length ?? 0;

  // Create stable hash
  const currentHash = useMemo(
    () => createInputHash(
      projectRoot,
      summariesLength,
      summariesTotalErrors,
      summariesTotalWarnings,
      securityAlertsLength,
      coverageHintsLength,
      aceRunsLength
    ),
    [projectRoot, summariesLength, summariesTotalErrors, summariesTotalWarnings, securityAlertsLength, coverageHintsLength, aceRunsLength]
  );

  // Build engine input from all sources - only when hash changes
  const engineInput: DiagnosticsEngineInput | null = useMemo(() => {
    if (!projectRoot) return null;

    // 1) Issues from ProjectIssuesContext
    const issues: IssueRecord[] = [];
    const allFilePaths: string[] = [];

    for (const summary of projectIssues.summaries) {
      allFilePaths.push(summary.relativePath || summary.filePath);

      // Map errors as 'high', warnings as 'medium', info as 'low'
      for (let i = 0; i < summary.errors; i++) {
        issues.push({
          filePath: summary.relativePath || summary.filePath,
          severity: 'high',
        });
      }
      for (let i = 0; i < summary.warnings; i++) {
        issues.push({
          filePath: summary.relativePath || summary.filePath,
          severity: 'medium',
        });
      }
      for (let i = 0; i < (summary.infos ?? 0); i++) {
        issues.push({
          filePath: summary.relativePath || summary.filePath,
          severity: 'low',
        });
      }
    }

    // 2) Security alerts from DeployQualityContext
    const securityAlerts: DiagSecurityAlert[] = [];
    if (deployQuality.securityAlerts) {
      for (const alert of deployQuality.securityAlerts) {
        // Map to file path (security alerts may have different structure)
        const filePath = (alert as any).file || (alert as any).filePath || 'unknown';
        securityAlerts.push({
          filePath,
          blocking: alert.severity === 'critical' || alert.severity === 'high',
        });
      }
    }

    // 3) Coverage from DeployQualityContext.externalCoverageStats
    const coverage: { filePath: string; coveragePercent: number }[] = [];
    if (deployQuality.externalCoverageStats?.topHints) {
      for (const hint of deployQuality.externalCoverageStats.topHints) {
        // topHints are files WITHOUT tests - mark as 0% coverage
        coverage.push({
          filePath: hint.filePath || (hint as any).path || 'unknown',
          coveragePercent: 0,
        });
      }
    }

    // 4) ACE runs from AceTelemetryContext
    const aceRuns: { filePath: string; runAt: string; applied: number; errors: number; result: 'success' | 'partial' | 'no_changes' | 'failed' }[] = [];
    // ACE telemetry is project-level, not file-level for now
    // We'll mark project root as having ACE activity
    if (aceTelemetry.runs && aceTelemetry.runs.length > 0) {
      // For now, we don't have file-level ACE data, so we skip this
      // In future phases, ACE could track per-file fixes
    }

    // 5) Test records from DeployQualityContext.externalTestStats
    const testRecords: TestRecord[] = [];
    // Test stats are project-level currently, not file-level
    // In future phases, we could add per-file test tracking

    return {
      projectRoot,
      allFiles: allFilePaths,
      issues,
      securityAlerts,
      coverage,
      aceRuns,
      testRecords,
    };
  }, [
    projectRoot,
    currentHash, // Use hash as dependency instead of raw objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
    projectIssues.summaries,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deployQuality.securityAlerts,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deployQuality.externalCoverageStats,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    aceTelemetry.runs,
  ]);

  // Update diagnostics when input changes - with hash check to prevent loops
  useEffect(() => {
    if (!diagnosticsCtx) return;

    // Skip if hash hasn't changed (prevents infinite loops)
    if (prevHashRef.current === currentHash) {
      return;
    }

    // Update the hash ref
    prevHashRef.current = currentHash;

    if (!engineInput) {
      diagnosticsCtx.clearDiagnostics();
      return;
    }

    // Only update if we have files to analyze
    if (engineInput.allFiles.length === 0) {
      diagnosticsCtx.clearDiagnostics();
      return;
    }

    console.log('[useDiagnosticsWire] Updating diagnostics, hash:', currentHash);
    diagnosticsCtx.updateDiagnostics(engineInput);
  }, [currentHash, diagnosticsCtx, engineInput]);
}

export default useDiagnosticsWire;
