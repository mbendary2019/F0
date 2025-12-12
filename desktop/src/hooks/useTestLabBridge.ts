// desktop/src/hooks/useTestLabBridge.ts
// Phase 182: Bridge between TestLab and DeployQuality contexts
// Syncs test results from TestLab to DeployQuality's externalTestStats
// This fixes the "Not Run Yet" issue after tests complete

import { useEffect, useRef } from 'react';
import { useTestLab } from '../state/testLabContext';
import { useDeployQuality, type ExternalTestStats } from '../state/deployQualityContext';

/**
 * Bridge hook that syncs TestLab results to DeployQuality context
 *
 * Problem: When tests run via testLabContext, the results are stored internally
 * but useQualityOverlayState reads from deployQuality.externalTestStats which
 * was never being updated.
 *
 * Solution: This bridge listens to TestLab state changes and updates
 * deployQuality.externalTestStats accordingly.
 */
export function useTestLabBridge(): void {
  const testLab = useTestLab();
  const deployQuality = useDeployQuality();

  // Track previous summary to avoid unnecessary updates
  const prevSummaryRef = useRef<string>('');

  useEffect(() => {
    const { state, isRunning } = testLab;
    const { summary, suites } = state;

    // Create a signature of current state to detect changes
    const currentSignature = JSON.stringify({
      total: summary.totalSuites,
      passing: summary.passingSuites,
      failing: summary.failingSuites,
      lastRunAt: summary.lastRunAt,
      isRunning,
    });

    // Skip if nothing changed
    if (currentSignature === prevSummaryRef.current) {
      return;
    }
    prevSummaryRef.current = currentSignature;

    // Don't update while tests are running (wait for completion)
    if (isRunning) {
      console.log('[TestLabBridge] Tests running, waiting for completion...');
      return;
    }

    // Calculate aggregated test stats
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const suite of suites) {
      if (suite.lastRun) {
        totalTests += (suite.lastRun.passed || 0) + (suite.lastRun.failed || 0) + (suite.lastRun.skipped || 0);
        passedTests += suite.lastRun.passed || 0;
        failedTests += suite.lastRun.failed || 0;
      }
    }

    // Determine status
    let status: ExternalTestStats['status'] = 'not_run';
    if (summary.lastRunAt) {
      if (summary.failingSuites > 0 || failedTests > 0) {
        status = 'failing';
      } else if (summary.passingSuites > 0 || passedTests > 0) {
        status = 'passing';
      }
    }

    // Build the ExternalTestStats object
    const externalStats: ExternalTestStats = {
      totalSuites: summary.totalSuites,
      totalTests,
      passedTests,
      failedTests,
      lastRunAt: summary.lastRunAt,
      status,
    };

    console.log('[TestLabBridge] Syncing test results to DeployQuality:', externalStats);

    // Update deployQuality context
    deployQuality.setExternalTestStats(externalStats);

  }, [testLab.state.summary, testLab.state.suites, testLab.isRunning, deployQuality]);
}

export default useTestLabBridge;
