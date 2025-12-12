// desktop/src/state/qualityMonitorContext.tsx
// Phase 132.0: Quality Monitor Context Provider
// Aggregates data from CodeHealth, ACE, Tests, and Cleanup contexts

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  QualitySummary,
  QualityEvent,
  TestsStatus,
  ScanEvent,
  AceEvent,
  TestsEvent,
  CleanupEvent,
} from '../lib/quality/qualityMonitorTypes';

// Import existing contexts
import { useCodeHealth } from './codeHealthContext';
import { useAce } from './aceContext';

/**
 * Quality Monitor Context Value
 */
interface QualityMonitorContextValue {
  /** Aggregated quality summary */
  summary: QualitySummary;
  /** Manual refresh */
  refresh: () => void;
  /** Add a custom event */
  addEvent: (event: QualityEvent) => void;
  /** Clear all events */
  clearEvents: () => void;
  /** Record a cleanup session */
  recordCleanup: (data: {
    healthBefore?: number | null;
    healthAfter?: number | null;
    filesTouched?: number;
    issuesFixed?: number;
  }) => void;
  /** Record a test run */
  recordTestRun: (data: {
    status: TestsStatus;
    passed?: number;
    failed?: number;
    skipped?: number;
    total?: number;
    durationMs?: number;
  }) => void;
}

const QualityMonitorContext = createContext<QualityMonitorContextValue | undefined>(undefined);

/**
 * Quality Monitor Provider Props
 */
interface QualityMonitorProviderProps {
  children: ReactNode;
  projectId?: string;
}

/**
 * Quality Monitor Provider
 * Aggregates data from CodeHealth, ACE, Tests, and Cleanup
 */
export const QualityMonitorProvider: React.FC<QualityMonitorProviderProps> = ({
  children,
  projectId = 'default',
}) => {
  // Get data from existing contexts
  const codeHealth = useCodeHealth();
  const ace = useAce();

  // Local state for events and manual tracking
  const [customEvents, setCustomEvents] = useState<QualityEvent[]>([]);
  const [lastTestRun, setLastTestRun] = useState<TestsEvent | null>(null);
  const [lastCleanup, setLastCleanup] = useState<CleanupEvent | null>(null);

  // Build summary from all sources
  const summary = useMemo<QualitySummary>(() => {
    const events: QualityEvent[] = [];

    // 1. Add scan events from CodeHealth snapshots
    const recentSnapshots = codeHealth.getRecentSnapshots(5);
    for (const snapshot of recentSnapshots) {
      const scanEvent: ScanEvent = {
        id: `scan-${snapshot.id}`,
        type: 'scan',
        projectId,
        createdAt: snapshot.timestamp,
        healthBefore: null, // Could track previous if needed
        healthAfter: calculateHealthFromSnapshot(snapshot),
        issuesFound: snapshot.totalIssues,
        filesScanned: snapshot.filesScanned,
      };
      events.push(scanEvent);
    }

    // 2. Add ACE events from metrics history
    const aceHistory = ace.getRecentHistory(5);
    for (const aceRun of aceHistory) {
      const aceEvent: AceEvent = {
        id: aceRun.id,
        type: 'ace',
        projectId,
        createdAt: aceRun.timestamp,
        phaseSummary: `${aceRun.suggestionsCount} suggestions`,
        overallDebt: aceRun.overallDebtScore,
        suggestionsCount: aceRun.suggestionsCount,
      };
      events.push(aceEvent);
    }

    // 3. Add test run event if exists
    if (lastTestRun) {
      events.push(lastTestRun);
    }

    // 4. Add cleanup event if exists
    if (lastCleanup) {
      events.push(lastCleanup);
    }

    // 5. Add custom events
    events.push(...customEvents);

    // Sort by date (newest first)
    events.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Keep only last 20 events
    const trimmedEvents = events.slice(0, 20);

    // Calculate current health score
    const latestSnapshot = recentSnapshots[0];
    const healthScore = latestSnapshot
      ? calculateHealthFromSnapshot(latestSnapshot)
      : (ace.overallDebt || null);

    // Get tests status
    const testsStatus: TestsStatus = lastTestRun?.status ?? 'not_run';

    // Find last scan timestamp
    const lastScanAt = latestSnapshot?.timestamp ?? null;

    // Get last ACE event
    const lastAceRun = trimmedEvents.find((e): e is AceEvent => e.type === 'ace') ?? null;

    // Get last cleanup event
    const lastCleanupEvent = trimmedEvents.find((e): e is CleanupEvent => e.type === 'cleanup') ?? null;

    // Calculate total issues
    const totalIssues = latestSnapshot?.totalIssues ?? null;

    // Calculate test pass rate
    const testPassRate = lastTestRun && lastTestRun.total
      ? Math.round(((lastTestRun.passed ?? 0) / lastTestRun.total) * 100)
      : null;

    return {
      healthScore,
      testsStatus,
      lastAceRun,
      lastCleanup: lastCleanupEvent,
      lastScanAt,
      events: trimmedEvents,
      totalIssues,
      testPassRate,
    };
  }, [codeHealth, ace, lastTestRun, lastCleanup, customEvents, projectId]);

  // Refresh function
  const refresh = useCallback(() => {
    // Trigger ACE recompute which will cascade updates
    ace.recompute('manual');
    console.log('[QualityMonitor] Manual refresh triggered');
  }, [ace]);

  // Add custom event
  const addEvent = useCallback((event: QualityEvent) => {
    setCustomEvents((prev) => [event, ...prev].slice(0, 10));
  }, []);

  // Clear all events
  const clearEvents = useCallback(() => {
    setCustomEvents([]);
    setLastTestRun(null);
    setLastCleanup(null);
  }, []);

  // Record a cleanup session
  const recordCleanup = useCallback((data: {
    healthBefore?: number | null;
    healthAfter?: number | null;
    filesTouched?: number;
    issuesFixed?: number;
  }) => {
    const cleanupEvent: CleanupEvent = {
      id: `cleanup-${Date.now()}`,
      type: 'cleanup',
      projectId,
      createdAt: new Date().toISOString(),
      ...data,
    };
    setLastCleanup(cleanupEvent);
    console.log('[QualityMonitor] Cleanup recorded:', cleanupEvent);
  }, [projectId]);

  // Record a test run
  const recordTestRun = useCallback((data: {
    status: TestsStatus;
    passed?: number;
    failed?: number;
    skipped?: number;
    total?: number;
    durationMs?: number;
  }) => {
    const testEvent: TestsEvent = {
      id: `tests-${Date.now()}`,
      type: 'tests',
      projectId,
      createdAt: new Date().toISOString(),
      ...data,
    };
    setLastTestRun(testEvent);
    console.log('[QualityMonitor] Test run recorded:', testEvent);
  }, [projectId]);

  // Context value
  const value = useMemo<QualityMonitorContextValue>(
    () => ({
      summary,
      refresh,
      addEvent,
      clearEvents,
      recordCleanup,
      recordTestRun,
    }),
    [summary, refresh, addEvent, clearEvents, recordCleanup, recordTestRun]
  );

  return (
    <QualityMonitorContext.Provider value={value}>
      {children}
    </QualityMonitorContext.Provider>
  );
};

/**
 * Hook to use Quality Monitor context
 */
export function useQualityMonitor(): QualityMonitorContextValue {
  const ctx = useContext(QualityMonitorContext);
  if (!ctx) {
    throw new Error('useQualityMonitor must be used within a QualityMonitorProvider');
  }
  return ctx;
}

/**
 * Hook for summary only
 */
export function useQualitySummary(): QualitySummary {
  const { summary } = useQualityMonitor();
  return summary;
}

/**
 * Hook for events only
 */
export function useQualityEvents(): QualityEvent[] {
  const { summary } = useQualityMonitor();
  return summary.events;
}

/**
 * Helper: Calculate health score from snapshot
 */
function calculateHealthFromSnapshot(snapshot: {
  totalIssues: number;
  filesScanned: number;
  severity: { errors: number; warnings: number; infos: number };
}): number {
  if (snapshot.filesScanned === 0) return 100;

  // Weight issues by severity
  const weightedIssues =
    snapshot.severity.errors * 3 +
    snapshot.severity.warnings * 1.5 +
    snapshot.severity.infos * 0.5;

  // Calculate issues per file ratio
  const issuesPerFile = weightedIssues / snapshot.filesScanned;

  // Score formula: starts at 100, decreases with issues
  const score = Math.max(0, Math.round(100 - (issuesPerFile * 5)));

  return Math.min(100, score);
}

export default QualityMonitorProvider;
