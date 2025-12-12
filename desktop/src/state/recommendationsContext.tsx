// desktop/src/state/recommendationsContext.tsx
// Phase 126.2: Recommendations Context for intelligent suggestions

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import {
  type CodeHealthRecommendation,
  type FileIssuesSummaryLite,
  buildCodeHealthRecommendations,
} from '../lib/analysis/codeHealthRecommendations';
import { computeHealthScore } from '../lib/analysis/codeHealthTypes';
import { useCodeHealth } from './codeHealthContext';
import { useProjectIssues } from './projectIssuesContext';

// ---------------------------------------------------------
// State & Context Types
// ---------------------------------------------------------

interface RecommendationsState {
  /** Current list of recommendations */
  recommendations: CodeHealthRecommendation[];
  /** When recommendations were last generated */
  lastGeneratedAt: string | null;
  /** IDs of dismissed recommendations (persisted during session) */
  dismissedIds: string[];
  /** Whether recommendations are being generated */
  isGenerating: boolean;
}

interface RecommendationsContextValue extends RecommendationsState {
  /** Regenerate recommendations based on current state */
  regenerate: () => void;
  /** Dismiss a recommendation by ID */
  dismiss: (id: string) => void;
  /** Clear all dismissed recommendations */
  clearDismissed: () => void;
  /** Get visible (non-dismissed) recommendations */
  visibleRecommendations: CodeHealthRecommendation[];
}

const RecommendationsContext = createContext<RecommendationsContextValue | null>(null);

// ---------------------------------------------------------
// Provider
// ---------------------------------------------------------

interface RecommendationsProviderProps {
  children: ReactNode;
}

export const RecommendationsProvider: React.FC<RecommendationsProviderProps> = ({
  children,
}) => {
  const { snapshots, runs } = useCodeHealth();
  const { summaries } = useProjectIssues();

  const [state, setState] = useState<RecommendationsState>({
    recommendations: [],
    lastGeneratedAt: null,
    dismissedIds: [],
    isGenerating: false,
  });

  // Regenerate recommendations from current data
  const regenerate = useCallback(() => {
    setState((prev) => ({ ...prev, isGenerating: true }));

    // Get latest scan snapshot
    const latestSnapshot =
      snapshots.filter((s) => s.source === 'scan').slice(0, 1)[0] ?? null;

    // Get last run
    const lastRun = runs.slice(0, 1)[0] ?? null;

    // Convert project summaries to lite format
    const fileSummaries: FileIssuesSummaryLite[] = summaries.map((s) => ({
      filePath: s.filePath,
      relativePath: s.relativePath,
      issueCount: s.issueCount,
      errors: s.errors,
      warnings: s.warnings,
      infos: s.infos,
    }));

    // Compute health score
    const healthScore = latestSnapshot
      ? computeHealthScore(latestSnapshot).score
      : undefined;

    // Build recommendations
    const recs = buildCodeHealthRecommendations({
      latestSnapshot,
      lastRun,
      fileSummaries,
      healthScore,
    });

    setState((prev) => ({
      ...prev,
      recommendations: recs,
      lastGeneratedAt: new Date().toISOString(),
      isGenerating: false,
    }));

    console.log('[Recommendations] Regenerated:', recs.length, 'recommendations');
  }, [snapshots, runs, summaries]);

  // Dismiss a recommendation
  const dismiss = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      dismissedIds: prev.dismissedIds.includes(id)
        ? prev.dismissedIds
        : [...prev.dismissedIds, id],
    }));
    console.log('[Recommendations] Dismissed:', id);
  }, []);

  // Clear all dismissed
  const clearDismissed = useCallback(() => {
    setState((prev) => ({
      ...prev,
      dismissedIds: [],
    }));
    console.log('[Recommendations] Cleared all dismissed');
  }, []);

  // Filter out dismissed recommendations
  const visibleRecommendations = useMemo(() => {
    return state.recommendations.filter(
      (r) => !state.dismissedIds.includes(r.id)
    );
  }, [state.recommendations, state.dismissedIds]);

  // Auto-regenerate when snapshots change
  useEffect(() => {
    if (snapshots.length > 0) {
      regenerate();
    }
  }, [snapshots.length]); // Only regenerate when snapshot count changes

  const value = useMemo<RecommendationsContextValue>(
    () => ({
      ...state,
      regenerate,
      dismiss,
      clearDismissed,
      visibleRecommendations,
    }),
    [state, regenerate, dismiss, clearDismissed, visibleRecommendations]
  );

  return (
    <RecommendationsContext.Provider value={value}>
      {children}
    </RecommendationsContext.Provider>
  );
};

// ---------------------------------------------------------
// Hook
// ---------------------------------------------------------

export function useRecommendations(): RecommendationsContextValue {
  const ctx = useContext(RecommendationsContext);
  if (!ctx) {
    throw new Error(
      'useRecommendations must be used within a RecommendationsProvider'
    );
  }
  return ctx;
}

export default RecommendationsProvider;
