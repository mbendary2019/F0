// desktop/src/lib/atp/TestCycleContext.tsx
// Phase 140.1: Autonomous Test Pipeline - React Context Provider
// Provides ATP state and controls to React components

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import { testCycleOrchestrator } from './testCycleOrchestrator';
import type {
  StartTestCycleOptions,
  TestCycleSnapshot,
  TestCyclePhase,
  ATPConfig,
} from './testCycleTypes';

/**
 * Context value shape
 */
interface TestCycleContextValue extends TestCycleSnapshot {
  /** Start a new test cycle */
  startCycle: (options: StartTestCycleOptions) => string | null;
  /** Start a cycle only if no cycle is active */
  startIfIdle: (options: StartTestCycleOptions) => string | null;
  /** Cancel the currently active cycle */
  cancelActiveCycle: (reason?: string) => void;
  /** Check if a cycle is currently running */
  isActive: boolean;
  /** Clear cycle history */
  clearHistory: () => void;
  /** Get current configuration */
  config: ATPConfig;
  /** Update configuration */
  updateConfig: (partial: Partial<ATPConfig>) => void;
}

const TestCycleContext = createContext<TestCycleContextValue | undefined>(
  undefined,
);

/**
 * TestCycleProvider
 * Wraps the app to provide ATP state and controls
 */
export const TestCycleProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [snapshot, setSnapshot] = useState<TestCycleSnapshot>(
    () => testCycleOrchestrator.getSnapshot(),
  );
  const [config, setConfig] = useState<ATPConfig>(
    () => testCycleOrchestrator.getConfig(),
  );

  useEffect(() => {
    const unsubscribe = testCycleOrchestrator.subscribe(setSnapshot);
    return unsubscribe;
  }, []);

  const startCycle = useCallback((options: StartTestCycleOptions) => {
    return testCycleOrchestrator.startCycle(options);
  }, []);

  const startIfIdle = useCallback((options: StartTestCycleOptions) => {
    return testCycleOrchestrator.startIfIdle(options);
  }, []);

  const cancelActiveCycle = useCallback((reason?: string) => {
    testCycleOrchestrator.cancelActiveCycle(
      reason ?? 'Canceled from TestCycleContext',
    );
  }, []);

  const clearHistory = useCallback(() => {
    testCycleOrchestrator.clearHistory();
  }, []);

  const updateConfig = useCallback((partial: Partial<ATPConfig>) => {
    testCycleOrchestrator.updateConfig(partial);
    setConfig(testCycleOrchestrator.getConfig());
  }, []);

  const value = useMemo<TestCycleContextValue>(
    () => ({
      ...snapshot,
      startCycle,
      startIfIdle,
      cancelActiveCycle,
      isActive: snapshot.activeCycle !== null,
      clearHistory,
      config,
      updateConfig,
    }),
    [snapshot, startCycle, startIfIdle, cancelActiveCycle, clearHistory, config, updateConfig],
  );

  return (
    <TestCycleContext.Provider value={value}>
      {children}
    </TestCycleContext.Provider>
  );
};

/**
 * useTestCycle hook
 * Access ATP state and controls from any component
 */
export const useTestCycle = (): TestCycleContextValue => {
  const ctx = useContext(TestCycleContext);
  if (!ctx) {
    throw new Error('useTestCycle must be used within TestCycleProvider');
  }
  return ctx;
};

/**
 * useTestCyclePhase hook
 * Get just the current phase (for UI indicators)
 */
export const useTestCyclePhase = (): TestCyclePhase => {
  const { activeCycle } = useTestCycle();
  return activeCycle?.phase ?? 'idle';
};

/**
 * useTestCycleLogs hook
 * Get logs from the active cycle
 */
export const useTestCycleLogs = () => {
  const { activeCycle, lastCompletedCycle } = useTestCycle();
  return activeCycle?.logs ?? lastCompletedCycle?.logs ?? [];
};

/**
 * useTestCycleMetrics hook
 * Get metrics from the active or last completed cycle
 */
export const useTestCycleMetrics = () => {
  const { activeCycle, lastCompletedCycle } = useTestCycle();
  return activeCycle?.metrics ?? lastCompletedCycle?.metrics ?? {};
};

/**
 * Helper to check if a specific trigger should auto-fire
 */
export const useATPTrigger = (trigger: 'save' | 'commit' | 'run') => {
  const { config, startIfIdle } = useTestCycle();

  const triggerCycle = useCallback(
    (context?: Record<string, unknown>) => {
      // Check if trigger is enabled
      if (trigger === 'save' && !config.triggerOnSave) return null;
      if (trigger === 'commit' && !config.triggerOnCommit) return null;
      if (trigger === 'run' && !config.triggerOnRun) return null;

      return startIfIdle({
        trigger,
        context,
        timeoutMs: config.defaultTimeoutMs,
      });
    },
    [trigger, config, startIfIdle],
  );

  return { triggerCycle, isEnabled: config.enabled };
};

export default TestCycleProvider;
