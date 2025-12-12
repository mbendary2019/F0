// desktop/src/state/codeHealthContext.tsx
// Phase 125.1: Code Health Context for snapshot tracking

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  CodeHealthSnapshot,
  CodeHealthRun,
  IssueCategoryCounts,
  IssueSeverityCounts,
} from '../lib/analysis/codeHealthTypes';
import { emptyCategories, emptySeverity } from '../lib/analysis/codeHealthTypes';

// ---------------------------------------------------------
// State & Context Types
// ---------------------------------------------------------
interface CodeHealthState {
  /** All recorded snapshots, newest first */
  snapshots: CodeHealthSnapshot[];
  /** All recorded runs (before/after comparisons) */
  runs: CodeHealthRun[];
  /** Last snapshot from a normal scan (before a fix) */
  lastScanSnapshot: CodeHealthSnapshot | null;
}

interface CodeHealthContextValue extends CodeHealthState {
  /**
   * Record a new snapshot from a scan or auto-scan after fix
   */
  recordSnapshot: (
    source: 'scan' | 'auto_fix_after_scan',
    data: {
      filesScanned: number;
      totalIssues: number;
      severity: IssueSeverityCounts;
      categories: IssueCategoryCounts;
    }
  ) => CodeHealthSnapshot;

  /**
   * Record a run with before/after snapshots
   */
  recordRun: (
    beforeSnapshot: CodeHealthSnapshot | null,
    afterSnapshot: CodeHealthSnapshot | null,
    filesFixed: number,
    profileId?: string
  ) => CodeHealthRun;

  /**
   * Clear all history
   */
  clearHistory: () => void;

  /**
   * Get recent snapshots (up to N)
   */
  getRecentSnapshots: (count?: number) => CodeHealthSnapshot[];

  /**
   * Get recent runs (up to N)
   */
  getRecentRuns: (count?: number) => CodeHealthRun[];
}

const CodeHealthContext = createContext<CodeHealthContextValue | null>(null);

// ---------------------------------------------------------
// Provider
// ---------------------------------------------------------
interface CodeHealthProviderProps {
  children: ReactNode;
}

export const CodeHealthProvider: React.FC<CodeHealthProviderProps> = ({ children }) => {
  const [state, setState] = useState<CodeHealthState>({
    snapshots: [],
    runs: [],
    lastScanSnapshot: null,
  });

  // Record a new snapshot
  const recordSnapshot = useCallback(
    (
      source: 'scan' | 'auto_fix_after_scan',
      data: {
        filesScanned: number;
        totalIssues: number;
        severity: IssueSeverityCounts;
        categories: IssueCategoryCounts;
      }
    ): CodeHealthSnapshot => {
      const timestamp = new Date().toISOString();
      const snapshot: CodeHealthSnapshot = {
        id: `${source}-${timestamp}`,
        timestamp,
        source,
        filesScanned: data.filesScanned,
        totalIssues: data.totalIssues,
        severity: data.severity,
        categories: data.categories,
      };

      setState((prev) => {
        const newSnapshots = [snapshot, ...prev.snapshots].slice(0, 100); // Keep last 100
        return {
          ...prev,
          snapshots: newSnapshots,
          // Update lastScanSnapshot if this was a normal scan
          lastScanSnapshot: source === 'scan' ? snapshot : prev.lastScanSnapshot,
        };
      });

      console.log(`[CodeHealth] Recorded ${source} snapshot:`, snapshot);
      return snapshot;
    },
    []
  );

  // Record a run (before/after comparison)
  const recordRun = useCallback(
    (
      beforeSnapshot: CodeHealthSnapshot | null,
      afterSnapshot: CodeHealthSnapshot | null,
      filesFixed: number,
      profileId?: string
    ): CodeHealthRun => {
      const timestamp = new Date().toISOString();
      const run: CodeHealthRun = {
        id: `run-${timestamp}`,
        timestamp,
        before: beforeSnapshot,
        after: afterSnapshot,
        filesFixed,
        profileId,
      };

      setState((prev) => {
        const newRuns = [run, ...prev.runs].slice(0, 50); // Keep last 50 runs
        return {
          ...prev,
          runs: newRuns,
          // Clear lastScanSnapshot after recording a run
          lastScanSnapshot: null,
        };
      });

      console.log('[CodeHealth] Recorded run:', run);
      return run;
    },
    []
  );

  // Clear all history
  const clearHistory = useCallback(() => {
    setState({
      snapshots: [],
      runs: [],
      lastScanSnapshot: null,
    });
    console.log('[CodeHealth] History cleared');
  }, []);

  // Get recent snapshots
  const getRecentSnapshots = useCallback(
    (count = 10): CodeHealthSnapshot[] => {
      return state.snapshots.slice(0, count);
    },
    [state.snapshots]
  );

  // Get recent runs
  const getRecentRuns = useCallback(
    (count = 10): CodeHealthRun[] => {
      return state.runs.slice(0, count);
    },
    [state.runs]
  );

  const value = useMemo<CodeHealthContextValue>(
    () => ({
      ...state,
      recordSnapshot,
      recordRun,
      clearHistory,
      getRecentSnapshots,
      getRecentRuns,
    }),
    [state, recordSnapshot, recordRun, clearHistory, getRecentSnapshots, getRecentRuns]
  );

  return (
    <CodeHealthContext.Provider value={value}>
      {children}
    </CodeHealthContext.Provider>
  );
};

// ---------------------------------------------------------
// Hook
// ---------------------------------------------------------
export function useCodeHealth(): CodeHealthContextValue {
  const ctx = useContext(CodeHealthContext);
  if (!ctx) {
    throw new Error('useCodeHealth must be used within a CodeHealthProvider');
  }
  return ctx;
}

// ---------------------------------------------------------
// Helper: Build snapshot data from ProjectIssuesContext state
// ---------------------------------------------------------
export interface IssueForSnapshot {
  severity: 'error' | 'warning' | 'info';
  category: string;
}

export function buildSnapshotData(
  filesScanned: number,
  issues: IssueForSnapshot[]
): {
  filesScanned: number;
  totalIssues: number;
  severity: IssueSeverityCounts;
  categories: IssueCategoryCounts;
} {
  const severity = emptySeverity();
  const categories = emptyCategories();

  for (const issue of issues) {
    // Count by severity
    if (issue.severity === 'error') severity.errors++;
    else if (issue.severity === 'warning') severity.warnings++;
    else severity.infos++;

    // Count by category
    const cat = issue.category?.toLowerCase() || 'other';
    if (cat === 'logging' || cat.includes('console') || cat.includes('log')) {
      categories.logging++;
    } else if (cat === 'types' || cat.includes('type') || cat.includes('typescript')) {
      categories.types++;
    } else if (cat === 'style' || cat.includes('format') || cat.includes('indent')) {
      categories.style++;
    } else if (cat === 'deadcode' || cat.includes('dead') || cat.includes('unused')) {
      categories.deadCode++;
    } else if (cat === 'security' || cat.includes('security') || cat.includes('vuln')) {
      categories.security++;
    } else if (cat === 'performance' || cat.includes('perf') || cat.includes('optim')) {
      categories.performance++;
    } else {
      categories.other++;
    }
  }

  return {
    filesScanned,
    totalIssues: issues.length,
    severity,
    categories,
  };
}

export default CodeHealthProvider;
