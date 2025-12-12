// desktop/src/contexts/diagnosticsContext.tsx
// Phase 146.2 – Diagnostics Context
// Central state management for file-level diagnostics aggregation
// Allows watchdogs (issues, security, coverage, ACE, tests) to feed data

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';

import type {
  ProjectDiagnostics,
  FileDiagnostics,
  DiagnosticsSummaryStats,
} from '../lib/quality/diagnosticsTypes';
import { computeDiagnosticsSummary } from '../lib/quality/diagnosticsTypes';
import {
  buildProjectDiagnostics,
  getHighRiskFiles,
  getWorstFiles,
  type DiagnosticsEngineInput,
} from '../lib/quality/diagnosticsEngine';

// ============================================
// Context Types
// ============================================

interface DiagnosticsContextValue {
  /** Full project diagnostics (null if not yet computed) */
  projectDiagnostics: ProjectDiagnostics | null;
  /** Summary stats for quick display */
  summaryStats: DiagnosticsSummaryStats | null;
  /** Files with high/critical risk level */
  highRiskFiles: FileDiagnostics[];
  /** Top N worst files by risk score */
  worstFiles: FileDiagnostics[];
  /** Whether diagnostics are currently being computed */
  loading: boolean;
  /** ISO timestamp of last update */
  lastUpdated: string | null;
  /** Update diagnostics with new input data */
  updateDiagnostics: (input: DiagnosticsEngineInput) => void;
  /** Clear all diagnostics */
  clearDiagnostics: () => void;
  /** Get diagnostics for a specific file */
  getFileDiagnostics: (filePath: string) => FileDiagnostics | null;
}

const DiagnosticsContext = createContext<DiagnosticsContextValue | undefined>(
  undefined
);

// ============================================
// Configuration
// ============================================

const WORST_FILES_DEFAULT_LIMIT = 20;

// ============================================
// Provider Component
// ============================================

interface DiagnosticsProviderProps {
  children: ReactNode;
  /** Optional limit for worst files list */
  worstFilesLimit?: number;
}

export function DiagnosticsProvider({
  children,
  worstFilesLimit = WORST_FILES_DEFAULT_LIMIT,
}: DiagnosticsProviderProps): JSX.Element {
  const [projectDiagnostics, setProjectDiagnostics] =
    useState<ProjectDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  /**
   * Update diagnostics with new input data
   * This is the main entry point for watchdogs to feed data
   */
  const updateDiagnostics = useCallback((input: DiagnosticsEngineInput) => {
    setLoading(true);
    try {
      const diag = buildProjectDiagnostics(input);
      setProjectDiagnostics(diag);
      setLastUpdated(diag.generatedAt);
      console.log(
        '[DiagnosticsContext] Updated diagnostics:',
        diag.files.length,
        'files analyzed'
      );
    } catch (err) {
      console.error('[DiagnosticsContext] Failed to build diagnostics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Clear all diagnostics (e.g., when project changes)
   */
  const clearDiagnostics = useCallback(() => {
    setProjectDiagnostics(null);
    setLastUpdated(null);
    console.log('[DiagnosticsContext] Cleared diagnostics');
  }, []);

  /**
   * Get diagnostics for a specific file
   */
  const getFileDiagnostics = useCallback(
    (filePath: string): FileDiagnostics | null => {
      if (!projectDiagnostics) return null;
      return (
        projectDiagnostics.files.find((f) => f.path === filePath) || null
      );
    },
    [projectDiagnostics]
  );

  /**
   * Compute derived values (memoized for performance)
   */
  const { highRiskFiles, worstFiles, summaryStats } = useMemo(() => {
    if (!projectDiagnostics) {
      return {
        highRiskFiles: [] as FileDiagnostics[],
        worstFiles: [] as FileDiagnostics[],
        summaryStats: null,
      };
    }

    const highRisk = getHighRiskFiles(projectDiagnostics, 'high');
    const worst = getWorstFiles(projectDiagnostics, worstFilesLimit);
    const stats = computeDiagnosticsSummary(projectDiagnostics);

    return {
      highRiskFiles: highRisk,
      worstFiles: worst,
      summaryStats: stats,
    };
  }, [projectDiagnostics, worstFilesLimit]);

  // Debug logging when diagnostics change
  useEffect(() => {
    if (projectDiagnostics && summaryStats) {
      console.log('[DiagnosticsContext] Summary:', {
        totalFiles: summaryStats.totalFiles,
        critical: summaryStats.criticalCount,
        high: summaryStats.highCount,
        averageRisk: summaryStats.averageRiskScore,
        worstFile: summaryStats.worstFile?.path,
      });
    }
  }, [projectDiagnostics, summaryStats]);

  const value: DiagnosticsContextValue = useMemo(
    () => ({
      projectDiagnostics,
      summaryStats,
      highRiskFiles,
      worstFiles,
      loading,
      lastUpdated,
      updateDiagnostics,
      clearDiagnostics,
      getFileDiagnostics,
    }),
    [
      projectDiagnostics,
      summaryStats,
      highRiskFiles,
      worstFiles,
      loading,
      lastUpdated,
      updateDiagnostics,
      clearDiagnostics,
      getFileDiagnostics,
    ]
  );

  return (
    <DiagnosticsContext.Provider value={value}>
      {children}
    </DiagnosticsContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useDiagnostics(): DiagnosticsContextValue {
  const ctx = useContext(DiagnosticsContext);
  if (!ctx) {
    throw new Error('useDiagnostics must be used within DiagnosticsProvider');
  }
  return ctx;
}

// ============================================
// Optional Hook: Safe version that doesn't throw
// Returns a default object with empty arrays when outside provider
// ============================================

const DEFAULT_DIAGNOSTICS_VALUE: DiagnosticsContextValue = {
  projectDiagnostics: null,
  summaryStats: null,
  highRiskFiles: [],
  worstFiles: [],
  loading: false,
  lastUpdated: null,
  updateDiagnostics: () => {},
  clearDiagnostics: () => {},
  getFileDiagnostics: () => null,
};

export function useDiagnosticsSafe(): DiagnosticsContextValue {
  const ctx = useContext(DiagnosticsContext);
  return ctx ?? DEFAULT_DIAGNOSTICS_VALUE;
}

export default DiagnosticsProvider;
