// desktop/src/contexts/aceTelemetryContext.tsx
// =============================================================================
// Phase 149 – Desktop Quality & Deploy Gate v1 (LOCKED)
// =============================================================================
// NOTE: This file is part of the locked Quality pipeline.
// Any major behavioral changes should be done in a new Phase (>= 150).
// =============================================================================
// Phase 145.5 – ACE Telemetry Context
// Phase 147.2 – Added targetedIssues for per-run issue tracking
// Tracks and persists ACE run history in localStorage

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ============================================
// Constants
// ============================================

const ACE_STORAGE_KEY = 'f0_ace_telemetry';
const MAX_ACE_RUNS = 10; // Keep last 10 runs per project

// ============================================
// Types
// ============================================

export type AceRunSource = 'manual' | 'guided' | 'auto';

export type AceRun = {
  id: string;
  startedAt: string;      // ISO string
  finishedAt: string;     // ISO string
  filesProcessed: number;
  totalApplied: number;
  totalErrors: number;
  projectRoot: string;
  source: AceRunSource;
  /** Phase 147.2: Total issues targeted in this run's plan */
  targetedIssues?: number;
  /** Phase 147.2: Total issues skipped (couldn't be auto-fixed) */
  totalSkipped?: number;
  /** Phase 147.3: Issues count before the run (from scanner) */
  issuesBefore?: number;
  /** Phase 147.3: Issues count after the run (from re-scan) */
  issuesAfter?: number;
  /** Phase 147.3: Debt delta = issuesBefore - issuesAfter (positive = improvement) */
  debtDelta?: number;
};

export type AceTelemetryContextValue = {
  runs: AceRun[];
  recordRun: (run: AceRun) => void;
  clearProjectRuns: (projectRoot: string) => void;
};

// ============================================
// Context
// ============================================

const AceTelemetryContext = createContext<AceTelemetryContextValue | undefined>(undefined);

// ============================================
// Provider
// ============================================

interface AceTelemetryProviderProps {
  children: ReactNode;
}

export function AceTelemetryProvider({ children }: AceTelemetryProviderProps) {
  const [runs, setRuns] = useState<AceRun[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ACE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AceRun[];
        if (Array.isArray(parsed)) {
          setRuns(parsed);
          console.log('[AceTelemetry] Loaded', parsed.length, 'runs from localStorage');
        }
      }
    } catch (err) {
      console.warn('[AceTelemetry] Failed to load from localStorage:', err);
    }
  }, []);

  // Persist to localStorage whenever runs change
  useEffect(() => {
    try {
      localStorage.setItem(ACE_STORAGE_KEY, JSON.stringify(runs));
    } catch (err) {
      console.warn('[AceTelemetry] Failed to save to localStorage:', err);
    }
  }, [runs]);

  // Record a new ACE run
  // Phase 145.5.1: Enhanced debug logging to verify recordRun is being called
  // Phase 147.3: Auto-calculate debtDelta if issuesBefore and issuesAfter are provided
  const recordRun = useCallback((run: AceRun) => {
    // Phase 147.3: Normalize and calculate debtDelta
    const normalized: AceRun = {
      ...run,
      debtDelta:
        run.debtDelta ??
        (run.issuesBefore != null && run.issuesAfter != null
          ? run.issuesBefore - run.issuesAfter
          : undefined),
    };

    console.log('[ACE Telemetry] recordRun CALLED with:', normalized);

    setRuns((prev) => {
      // Filter out duplicate (same id) and keep recent runs for this project
      const filtered = prev.filter((r) => r.id !== normalized.id);
      const next = [normalized, ...filtered].slice(0, MAX_ACE_RUNS);

      console.log('[ACE Telemetry] about to save runs to localStorage (count =', next.length, ')');

      try {
        localStorage.setItem(ACE_STORAGE_KEY, JSON.stringify(next));
        console.log('[ACE Telemetry] saved to localStorage under key', ACE_STORAGE_KEY);
      } catch (err) {
        console.warn('[ACE Telemetry] FAILED to save to localStorage', err);
      }

      return next;
    });
  }, []);

  // Clear all runs for a specific project
  const clearProjectRuns = useCallback((projectRoot: string) => {
    setRuns((prev) => {
      const filtered = prev.filter((r) => r.projectRoot !== projectRoot);
      console.log('[AceTelemetry] Cleared runs for', projectRoot, '| Remaining:', filtered.length);
      return filtered;
    });
  }, []);

  const value: AceTelemetryContextValue = {
    runs,
    recordRun,
    clearProjectRuns,
  };

  return (
    <AceTelemetryContext.Provider value={value}>
      {children}
    </AceTelemetryContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useAceTelemetry(): AceTelemetryContextValue {
  const context = useContext(AceTelemetryContext);
  if (!context) {
    throw new Error('useAceTelemetry must be used within an AceTelemetryProvider');
  }
  return context;
}

// ============================================
// Helper: Get runs for specific project
// ============================================

export function getProjectRuns(runs: AceRun[], projectRoot: string): AceRun[] {
  return runs.filter((r) => r.projectRoot === projectRoot);
}

// ============================================
// Helper: Generate unique run ID
// ============================================

export function generateAceRunId(): string {
  return `ace-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default AceTelemetryProvider;
