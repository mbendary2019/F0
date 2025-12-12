// desktop/src/hooks/useQualityStoryEvents.ts
// Phase 140.8: Quality Story Events Hook
// Generates timeline events from quality history snapshots

import { useMemo } from 'react';
import type {
  QualityStorySnapshot,
  QualityStoryEvent,
} from '../types/qualityStory';
import { policyStatusToQualityStatus } from '../types/qualityStory';
import { useQualityHistory } from '../state/qualityHistoryContext';
import type { QualitySnapshot } from '../lib/quality/qualityHistoryTypes';

/**
 * Return type for the useQualityStoryEvents hook
 */
export interface UseQualityStoryEventsReturn {
  /** Normalized snapshots for timeline */
  snapshots: QualityStorySnapshot[];
  /** Generated events from snapshots */
  events: QualityStoryEvent[];
}

/**
 * Convert original QualitySnapshot to QualityStorySnapshot
 */
function normalizeSnapshot(snap: QualitySnapshot): QualityStorySnapshot {
  return {
    id: snap.id,
    timestamp: snap.createdAt,
    health: snap.health,
    issues: snap.totalIssues,
    status: policyStatusToQualityStatus(snap.policyStatus),
    policyStatus: snap.policyStatus,
    // Security
    securityAlerts: snap.securityAlerts ?? null,
    blockingSecurityAlerts:
      (snap.securityCriticalAlerts ?? 0) + (snap.securityHighAlerts ?? 0) || null,
    // Test info
    testPassRate: snap.testPassRate ?? null,
    failingSuites: snap.failingSuites ?? null,
  };
}

/**
 * Create story events from normalized snapshots
 */
function createEventsFromSnapshots(
  snapshots: QualityStorySnapshot[]
): QualityStoryEvent[] {
  if (!snapshots.length) return [];

  const events: QualityStoryEvent[] = [];

  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i];
    const prev = i > 0 ? snapshots[i - 1] : undefined;
    const index = i;

    const base: Partial<QualityStoryEvent> = {
      snapshotId: snap.id,
      timestamp: snap.timestamp,
      health: snap.health,
      coverage: snap.coverage ?? null,
      securityAlerts: snap.securityAlerts ?? null,
      blockingSecurityAlerts: snap.blockingSecurityAlerts ?? null,
      issues: snap.issues,
      index,
    };

    // 1) Health changes
    if (prev) {
      const healthDelta = snap.health - prev.health;
      const issuesDelta = snap.issues - prev.issues;
      const coverageDelta =
        snap.coverage != null && prev.coverage != null
          ? snap.coverage - prev.coverage
          : null;

      // Health dropped significantly
      if (healthDelta <= -5) {
        events.push({
          id: `health-drop-${snap.id}`,
          type: 'HEALTH_DROP',
          title: `Health dropped ${healthDelta.toFixed(1)} pts`,
          description: `Project health fell from ${prev.health.toFixed(
            1
          )}% to ${snap.health.toFixed(1)}%.`,
          healthDelta,
          coverageDelta: coverageDelta ?? undefined,
          issuesDelta,
          ...base,
        } as QualityStoryEvent);
      }

      // Health improved significantly
      if (healthDelta >= 5) {
        events.push({
          id: `health-rise-${snap.id}`,
          type: 'HEALTH_RISE',
          title: `Health improved +${healthDelta.toFixed(1)} pts`,
          description: `Project health increased from ${prev.health.toFixed(
            1
          )}% to ${snap.health.toFixed(1)}%.`,
          healthDelta,
          coverageDelta: coverageDelta ?? undefined,
          issuesDelta,
          ...base,
        } as QualityStoryEvent);
      }

      // Coverage changes
      if (coverageDelta != null && Math.abs(coverageDelta) >= 1) {
        events.push({
          id: `coverage-${coverageDelta > 0 ? 'rise' : 'drop'}-${snap.id}`,
          type: coverageDelta > 0 ? 'COVERAGE_RISE' : 'COVERAGE_DROP',
          title:
            coverageDelta > 0
              ? `Coverage +${coverageDelta.toFixed(1)}%`
              : `Coverage ${coverageDelta.toFixed(1)}%`,
          description:
            coverageDelta > 0
              ? 'Automated tests now cover more of the codebase.'
              : 'Some previously covered code paths are no longer tested.',
          coverageDelta,
          ...base,
        } as QualityStoryEvent);
      }

      // Issues jump
      if (Math.abs(issuesDelta) >= 50) {
        events.push({
          id: `issues-${issuesDelta > 0 ? 'up' : 'down'}-${snap.id}`,
          type: 'INFO',
          title:
            issuesDelta > 0
              ? `+${issuesDelta} new issues detected`
              : `${-issuesDelta} issues resolved`,
          description:
            issuesDelta > 0
              ? 'A recent scan found many new issues.'
              : 'Cleanup or auto-fix removed many issues.',
          issuesDelta,
          ...base,
        } as QualityStoryEvent);
      }
    }

    // 2) Security alerts
    if ((snap.blockingSecurityAlerts ?? 0) > 0) {
      events.push({
        id: `sec-block-${snap.id}`,
        type: 'SECURITY_ALERT',
        title: 'Blocking security issues detected',
        description: `${snap.blockingSecurityAlerts} blocking security alert(s) are preventing deploys.`,
        ...base,
      } as QualityStoryEvent);
    } else if ((snap.securityAlerts ?? 0) > 0) {
      events.push({
        id: `sec-alert-${snap.id}`,
        type: 'SECURITY_ALERT',
        title: 'Security issues present',
        description: `${snap.securityAlerts} security alert(s) found.`,
        ...base,
      } as QualityStoryEvent);
    }

    // 3) Source-based events
    if (snap.source === 'auto_improve') {
      events.push({
        id: `auto-improve-${snap.id}`,
        type: 'AUTO_IMPROVE',
        title: 'Auto-Improve pipeline completed',
        description:
          'F0 ran auto-fix, generated tests, and applied security improvements.',
        ...base,
      } as QualityStoryEvent);
    }

    if (snap.source === 'deploy') {
      events.push({
        id: `deploy-${snap.id}`,
        type: 'DEPLOY',
        title: `Deployment ${snap.status === 'BLOCK' ? 'blocked' : 'completed'}`,
        description:
          snap.status === 'BLOCK'
            ? 'Deploy was blocked by quality policies.'
            : 'Deploy confirmed under current quality policy.',
        ...base,
      } as QualityStoryEvent);
    }

    if (snap.label === 'ATP_RUN') {
      events.push({
        id: `atp-${snap.id}`,
        type: 'ATP_RUN',
        title: 'Autonomous Test Pipeline run',
        description:
          snap.coverageDelta && snap.coverageDelta > 0
            ? `ATP improved coverage by +${snap.coverageDelta.toFixed(1)}%.`
            : 'ATP run completed.',
        ...base,
      } as QualityStoryEvent);
    }
  }

  // Sort by timestamp descending (newest first)
  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Hook to generate quality story events from history snapshots
 *
 * @returns Normalized snapshots and generated events for timeline display
 */
export function useQualityStoryEvents(): UseQualityStoryEventsReturn {
  const { snapshots: rawSnapshots } = useQualityHistory();

  return useMemo(() => {
    // Normalize snapshots
    const snapshots = rawSnapshots.map(normalizeSnapshot);

    // Sort by timestamp ascending for event generation
    const sorted = [...snapshots].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Generate events
    const events = createEventsFromSnapshots(sorted);

    return { snapshots: sorted, events };
  }, [rawSnapshots]);
}

export default useQualityStoryEvents;
