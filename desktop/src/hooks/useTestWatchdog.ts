// desktop/src/hooks/useTestWatchdog.ts
// Phase 137.1: Test Watchdog Hook
// Monitors TestLab state and syncs with deployQualityContext
// Phase 182: Fixed to use summary data and properly detect test completion

import { useEffect, useRef } from 'react';
import { useTestLab } from '../state/testLabContext';
import { useDeployQuality, type ExternalTestStats } from '../state/deployQualityContext';

/**
 * Test Watchdog Hook
 *
 * Monitors TestLab state and updates deployQualityContext with test stats.
 * This enables the Policy Engine to make decisions based on test status.
 *
 * Phase 182: Now uses both suites AND summary data to properly detect test completion
 */
export function useTestWatchdog() {
  const { state, isRunning } = useTestLab();
  const { setExternalTestStats } = useDeployQuality();

  // Track last snapshot to avoid duplicate updates
  const lastSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    // Phase 182: Don't update while tests are running - wait for completion
    if (isRunning) {
      console.log('[TestWatchdog] Tests running, waiting for completion...');
      return;
    }

    const suites = state?.suites ?? [];
    const summary = state?.summary;

    // Phase 182.1: Use summary for lastRunAt but aggregate actual test counts from suites
    // The summary has suite-level counts, but we need individual test counts from lastRun
    if (summary?.lastRunAt) {
      // Aggregate actual test counts from each suite's lastRun
      let totalTests = 0;
      let passedTests = 0;
      let failedTests = 0;

      for (const suite of suites) {
        if (suite.lastRun) {
          const passed = suite.lastRun.passed ?? 0;
          const failed = suite.lastRun.failed ?? 0;
          const skipped = suite.lastRun.skipped ?? 0;
          totalTests += passed + failed + skipped;
          passedTests += passed;
          failedTests += failed;
        }
      }

      // Determine status from summary (more reliable for suite-level status)
      const status: ExternalTestStats['status'] =
        summary.failingSuites > 0 ? 'failing' :
        summary.passingSuites > 0 ? 'passing' : 'not_run';

      const statsObj: ExternalTestStats = {
        totalSuites: summary.totalSuites ?? suites.length,
        totalTests,
        passedTests,
        failedTests,
        lastRunAt: summary.lastRunAt,
        status,
      };

      // Create snapshot for comparison
      const snapshot = JSON.stringify(statsObj);

      // Skip if nothing changed
      if (lastSnapshotRef.current === snapshot) return;
      lastSnapshotRef.current = snapshot;

      console.log('[TestWatchdog] Updated from summary + suites:', statsObj);
      setExternalTestStats(statsObj);
      return;
    }

    // Fallback: Aggregate stats from all suites manually
    let totalSuites = suites.length;
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let lastRunAt: string | null = null;
    let status: ExternalTestStats['status'] = 'not_run';

    // If no suites exist, report not_run
    if (!suites.length) {
      const snapshot = JSON.stringify({ status: 'not_run', totalSuites: 0 });
      if (lastSnapshotRef.current === snapshot) return;

      lastSnapshotRef.current = snapshot;
      setExternalTestStats({
        totalSuites: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        lastRunAt: null,
        status: 'not_run',
      });
      return;
    }

    for (const suite of suites) {
      // Get test counts from lastRun if available
      const lastRun = suite.lastRun;
      if (lastRun) {
        const passed = lastRun.passed ?? 0;
        const failed = lastRun.failed ?? 0;
        const skipped = lastRun.skipped ?? 0;

        totalTests += passed + failed + skipped;
        passedTests += passed;
        failedTests += failed;

        // Track latest run time
        const runAt = lastRun.finishedAt ?? lastRun.startedAt;
        if (runAt) {
          if (!lastRunAt || runAt > lastRunAt) {
            lastRunAt = runAt;
          }
        }

        // Check suite status
        const suiteStatus = lastRun.status;
        if (suiteStatus === 'failing') {
          status = 'failing';
        } else if (suiteStatus === 'passing' && status === 'not_run') {
          status = 'passing';
        }
      }
    }

    // Determine overall status from aggregated data
    if (failedTests > 0) {
      status = 'failing';
    } else if (passedTests > 0) {
      status = 'passing';
    }

    // Build stats object
    const statsObj: ExternalTestStats = {
      totalSuites,
      totalTests,
      passedTests,
      failedTests,
      lastRunAt,
      status,
    };

    // Create snapshot for comparison
    const snapshot = JSON.stringify(statsObj);

    // Skip if nothing changed
    if (lastSnapshotRef.current === snapshot) return;
    lastSnapshotRef.current = snapshot;

    console.log('[TestWatchdog] Updated from suites:', statsObj);
    setExternalTestStats(statsObj);
  }, [state, state?.summary, isRunning, setExternalTestStats]);
}

export default useTestWatchdog;
