// desktop/src/hooks/useLastTestCycleSummary.ts
// Phase 140.6.3: Hook for accessing last ATP test cycle summary
// Used by PreDeployGateModal to display ATP status

import { useState, useEffect, useCallback } from 'react';
import { testCycleOrchestrator } from '../lib/atp/testCycleOrchestrator';
import type { TestCycleSummary, TestCycleSnapshot } from '../lib/atp/testCycleTypes';

/**
 * Return type for the useLastTestCycleSummary hook
 */
export interface UseLastTestCycleSummaryReturn {
  /** Last completed test cycle summary (null if no cycles have run) */
  summary: TestCycleSummary | null;
  /** Whether a test cycle is currently running */
  isRunning: boolean;
  /** Current phase of the active cycle (if running) */
  currentPhase: string | null;
  /** Trigger a new ATP cycle from Deploy Gate */
  triggerATPCycle: () => string | null;
  /** Whether ATP is enabled */
  isATPEnabled: boolean;
}

/**
 * Hook to access the last ATP test cycle summary
 *
 * This hook subscribes to the ATP orchestrator and provides:
 * - Last completed cycle summary for Deploy Gate display
 * - Current running state
 * - Ability to trigger a new cycle
 *
 * @returns UseLastTestCycleSummaryReturn
 */
export function useLastTestCycleSummary(): UseLastTestCycleSummaryReturn {
  const [summary, setSummary] = useState<TestCycleSummary | null>(
    () => testCycleOrchestrator.getLastCycleSummary()
  );
  const [isRunning, setIsRunning] = useState<boolean>(
    () => testCycleOrchestrator.isActive()
  );
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [isATPEnabled, setIsATPEnabled] = useState<boolean>(
    () => testCycleOrchestrator.getConfig().enabled
  );

  // Subscribe to orchestrator updates
  useEffect(() => {
    const unsubscribe = testCycleOrchestrator.subscribe((snapshot: TestCycleSnapshot) => {
      // Update summary from last completed cycle
      const lastSummary = snapshot.lastCompletedCycle?.metrics?.summary ?? null;
      setSummary(lastSummary);

      // Update running state
      const running = snapshot.activeCycle !== null;
      setIsRunning(running);

      // Update current phase
      setCurrentPhase(running ? snapshot.activeCycle?.phase ?? null : null);

      // Update enabled state
      setIsATPEnabled(testCycleOrchestrator.getConfig().enabled);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Trigger a new ATP cycle from Deploy Gate
  const triggerATPCycle = useCallback((): string | null => {
    return testCycleOrchestrator.startCycle({
      trigger: 'manual',
      context: { origin: 'deploy_gate' },
    });
  }, []);

  return {
    summary,
    isRunning,
    currentPhase,
    triggerATPCycle,
    isATPEnabled,
  };
}

export default useLastTestCycleSummary;
