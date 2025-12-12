// desktop/src/lib/quality/useQualityWatchdog.ts
// Phase 132.3: Quality Watchdog - Auto monitoring for quality issues

import { useEffect, useCallback, useRef } from 'react';
import { useQualityMonitor } from '../../state/qualityMonitorContext';
import { useHealthAlerts } from '../../state/healthAlertsContext';

/**
 * Watchdog configuration
 */
interface WatchdogConfig {
  /** Check interval in ms (default: 10 minutes) */
  intervalMs?: number;
  /** Stale scan threshold in minutes (default: 30) */
  staleScanMinutes?: number;
  /** Minimum health score threshold (default: 80) */
  minHealthScore?: number;
  /** Enable auto-check (default: true) */
  enabled?: boolean;
}

const DEFAULT_CONFIG: Required<WatchdogConfig> = {
  intervalMs: 10 * 60 * 1000, // 10 minutes
  staleScanMinutes: 30,
  minHealthScore: 80,
  enabled: true,
};

/**
 * Quality Watchdog Hook
 * Monitors project quality and logs warnings for:
 * - Stale or missing scans
 * - Low health score
 * - Failing tests
 *
 * Note: This watchdog uses console.log for alerts since the healthAlertsContext
 * generates alerts from snapshots, not direct pushes. Future versions could
 * extend the alerts context to support custom alerts.
 */
export function useQualityWatchdog(config: WatchdogConfig = {}): void {
  const { summary } = useQualityMonitor();
  const { generateAlertsAfterSnapshot } = useHealthAlerts();

  const settings = { ...DEFAULT_CONFIG, ...config };
  const lastCheckRef = useRef<number>(0);
  const warnedRef = useRef<Set<string>>(new Set());

  // Phase 181: Track previous state to avoid repetitive logging
  const lastStateRef = useRef<{ score: number | null; issues: number | null } | null>(null);

  // Warn helper (avoids duplicate console warnings)
  const warn = useCallback((key: string, message: string, level: 'info' | 'warn' | 'error' = 'warn') => {
    if (warnedRef.current.has(key)) {
      return;
    }
    warnedRef.current.add(key);

    const prefix = '[QualityWatchdog]';
    if (level === 'error') {
      console.error(`${prefix} ❌ ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ⚠️ ${message}`);
    } else {
      console.log(`${prefix} ℹ️ ${message}`);
    }
  }, []);

  // Reset warnings when conditions change significantly
  const resetWarnings = useCallback(() => {
    warnedRef.current.clear();
  }, []);

  // Main check function
  const runCheck = useCallback(() => {
    const now = Date.now();

    // Throttle checks to avoid spam (min 5 seconds between checks)
    if (now - lastCheckRef.current < 5000) {
      return;
    }
    lastCheckRef.current = now;

    // Phase 181: Skip logging if state hasn't changed
    const currentScore = summary.healthScore;
    const currentIssues = summary.totalIssues;
    const lastState = lastStateRef.current;

    if (lastState &&
        lastState.score === currentScore &&
        lastState.issues === currentIssues) {
      // State unchanged - skip this check entirely to reduce log spam
      return;
    }

    // Update last known state
    lastStateRef.current = { score: currentScore, issues: currentIssues };

    // Phase 185: Enhanced logging - differentiate between improvements and drops
    if (lastState) {
      const scoreDelta = (currentScore ?? 0) - (lastState.score ?? 0);
      const issuesDelta = (currentIssues ?? 0) - (lastState.issues ?? 0);

      // Health score change
      if (scoreDelta > 0) {
        console.log(`[QualityWatchdog] ✅ Project health improved: ${lastState.score ?? 0}% → ${currentScore ?? 0}% (+${scoreDelta}%)`);
      } else if (scoreDelta < 0) {
        console.log(`[QualityWatchdog] ❌ Project health dropped: ${lastState.score ?? 0}% → ${currentScore ?? 0}% (${scoreDelta}%)`);
      }

      // Issue count change
      if (issuesDelta < 0) {
        console.log(`[QualityWatchdog] ✅ Issues reduced: ${lastState.issues ?? 0} → ${currentIssues ?? 0} (${issuesDelta})`);
      } else if (issuesDelta > 0) {
        console.log(`[QualityWatchdog] ❌ Issues increased: ${lastState.issues ?? 0} → ${currentIssues ?? 0} (+${issuesDelta})`);
      }

      // Summary log only if no change (quiet mode)
      if (scoreDelta === 0 && issuesDelta === 0) {
        console.log('[QualityWatchdog] No change in quality metrics');
      }
    } else {
      console.log('[QualityWatchdog] Initial quality check:', {
        healthScore: currentScore ?? 'N/A',
        totalIssues: currentIssues ?? 'N/A',
      });
    }

    // 1. Check for stale or missing scan
    if (summary.lastScanAt) {
      const lastScanTime = new Date(summary.lastScanAt).getTime();
      const diffMin = (now - lastScanTime) / 1000 / 60;

      if (diffMin > settings.staleScanMinutes) {
        const hours = Math.round(diffMin / 60);
        if (hours > 1) {
          warn(
            `stale-scan-${Math.floor(hours)}h`,
            `Last Code Health scan was ${hours}+ hours ago. Run a fresh scan to update your quality baseline.`,
            'info'
          );
        }
      }
    } else {
      // No scan ever
      warn(
        'no-scan-ever',
        'No Code Health scan found for this project. Run Scan + Tests to initialize your quality baseline.',
        'info'
      );
    }

    // 2. Check for low health score
    if (summary.healthScore !== null) {
      if (summary.healthScore < 60) {
        warn(
          `critical-health`,
          `Project health dropped to ${summary.healthScore}%! Run ACE fix + Cleanup immediately to address critical issues.`,
          'error'
        );
        // Trigger alerts generation
        generateAlertsAfterSnapshot();
      } else if (summary.healthScore < settings.minHealthScore) {
        warn(
          `low-health`,
          `Project health is at ${summary.healthScore}%. Consider running ACE + Cleanup to keep things healthy.`,
          'warn'
        );
      }
    }

    // 3. Check for failing tests
    if (summary.testsStatus === 'failing') {
      warn(
        'tests-failing',
        'Tests are failing! Fix failing tests before your next commit to maintain code quality.',
        'error'
      );
    }

    // 4. Check for high issue count
    if (summary.totalIssues !== null && summary.totalIssues > 100) {
      warn(
        `high-issues-${Math.floor(summary.totalIssues / 100) * 100}`,
        `${summary.totalIssues} issues detected. Use ACE Auto-Fix or Guided Cleanup to reduce technical debt.`,
        summary.totalIssues > 200 ? 'error' : 'warn'
      );
    }
  }, [summary, settings, warn, generateAlertsAfterSnapshot]);

  // Run check on mount and interval
  useEffect(() => {
    if (!settings.enabled) {
      return;
    }

    // Initial check after a short delay
    const initialTimeout = setTimeout(() => {
      runCheck();
    }, 3000);

    // Periodic check
    const intervalId = setInterval(() => {
      resetWarnings(); // Allow re-warning on interval
      runCheck();
    }, settings.intervalMs);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [runCheck, resetWarnings, settings.enabled, settings.intervalMs]);

  // Also run check when health score changes significantly
  useEffect(() => {
    if (!settings.enabled) {
      return;
    }

    // Only check on significant health changes
    if (summary.healthScore !== null && summary.healthScore < 70) {
      const timeout = setTimeout(() => {
        runCheck();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [summary.healthScore, runCheck, settings.enabled]);
}

export default useQualityWatchdog;
