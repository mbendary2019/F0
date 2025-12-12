// desktop/src/state/aceContext.tsx
// Phase 128.5: ACE (Auto Code Evolution) Context Provider
// Phase 128.5.1: Added recompute() integration with ProjectIssues
// Phase 128.6: Added metrics & history tracking
// Phase 128.7: Added alerts integration

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type {
  AceFileScore,
  AceSuggestion,
  AcePlan,
  AcePlanPhase,
} from '../lib/ace/aceTypes';
import { buildAceFileScores, calculateOverallDebtScore, getWorstFiles } from '../lib/ace/aceDebtMap';
import { buildAceSuggestions } from '../lib/ace/aceSuggestions';
import { buildAcePlanFromSuggestions, markPhaseCompleted, markPhaseInProgress, getNextPhase } from '../lib/ace/acePlanner';
import { buildDependencyGraph, analyzeAllSuggestionImpacts, sortSuggestionsByImpact, type ImpactAnalysis, type DependencyNode } from '../lib/ace/aceImpact';
import type { FileIssuesSummary } from './projectIssuesContext';
import type {
  AceRecomputeEvent,
  AcePhaseRun,
  AceMetricsState,
  AceActivityStatus,
} from '../lib/ace/aceMetricsTypes';
import {
  defaultAceMetricsState,
  calculateAceActivityStatus,
  getScoreImprovement,
} from '../lib/ace/aceMetricsTypes';
import type { AceAlert, AceAlertThresholds } from '../lib/ace/aceAlerts';
import {
  generateAceAlerts,
  defaultAceThresholds,
  getHighestSeverity,
  getActiveAlerts,
} from '../lib/ace/aceAlerts';

/**
 * ACE Context State
 */
interface AceState {
  /** Technical debt file scores */
  fileScores: AceFileScore[];
  /** Overall debt score (0-100, higher is better - health score) */
  overallDebt: number;
  /** Generated suggestions */
  suggestions: AceSuggestion[];
  /** Impact analysis per suggestion */
  impacts: Map<string, ImpactAnalysis>;
  /** Dependency graph */
  dependencyGraph: Map<string, DependencyNode>;
  /** Evolution plan */
  plan: AcePlan | null;
  /** Is scanning in progress */
  isScanning: boolean;
  /** Last scan timestamp */
  lastScan: string | null;
  /** Error message */
  error: string | null;
  /** Phase 128.6: Metrics & history tracking */
  metrics: AceMetricsState;
  /** Phase 128.6: Current activity status */
  activityStatus: AceActivityStatus;
  /** Phase 128.7: Alerts */
  alerts: AceAlert[];
  /** Phase 128.7: Alert thresholds */
  alertThresholds: AceAlertThresholds;
}

/**
 * ACE Context Actions
 */
interface AceActions {
  /** Run full ACE analysis */
  runAnalysis: (input: AceAnalysisInput) => Promise<void>;
  /** Recompute ACE data from current project issues summaries */
  recompute: (trigger?: 'manual' | 'auto_scan' | 'phase_complete') => void;
  /** Clear all ACE data */
  clearData: () => void;
  /** Mark a phase as in progress */
  startPhase: (phaseId: string) => void;
  /** Mark a phase as completed */
  completePhase: (phaseId: string) => void;
  /** Accept a suggestion (mark as acted upon) */
  acceptSuggestion: (suggestionId: string) => void;
  /** Dismiss a suggestion */
  dismissSuggestion: (suggestionId: string) => void;
  /** Get suggestions sorted by impact */
  getSortedSuggestions: () => AceSuggestion[];
  /** Get worst files */
  getWorstFiles: (n?: number) => AceFileScore[];
  /** Phase 128.6: Get recent recompute history (last N events) */
  getRecentHistory: (n?: number) => AceRecomputeEvent[];
  /** Phase 128.6: Get score improvement info */
  getScoreImprovement: () => { delta: number; improved: boolean } | null;
  /** Phase 128.7: Dismiss an alert */
  dismissAlert: (alertId: string) => void;
  /** Phase 128.7: Get active (non-dismissed) alerts */
  getActiveAlerts: () => AceAlert[];
  /** Phase 128.7: Update alert thresholds */
  setAlertThresholds: (thresholds: Partial<AceAlertThresholds>) => void;
}

/**
 * Input for ACE analysis
 */
export interface AceAnalysisInput {
  /** Project issues from scanner */
  issues: F0Issue[];
  /** File contents map (path -> content) */
  fileContents: Map<string, string>;
  /** File line counts (path -> lines) */
  fileSizes: Map<string, number>;
  /** Project root path */
  projectRoot: string;
}

/**
 * Combined context value
 */
type AceContextValue = AceState & AceActions;

/**
 * Default state
 */
const defaultState: AceState = {
  fileScores: [],
  overallDebt: 0,
  suggestions: [],
  impacts: new Map(),
  dependencyGraph: new Map(),
  plan: null,
  isScanning: false,
  lastScan: null,
  error: null,
  metrics: defaultAceMetricsState,
  activityStatus: 'stale',
  alerts: [],
  alertThresholds: defaultAceThresholds,
};

/**
 * Create context
 */
const AceContext = createContext<AceContextValue | null>(null);

/**
 * ACE Provider Props
 */
interface AceProviderProps {
  children: React.ReactNode;
  /** Project issues summaries from ProjectIssuesContext */
  summaries?: FileIssuesSummary[];
  /** Indexed files from project (file paths) */
  indexedFiles?: string[];
  /** Project root path */
  projectRoot?: string;
  /** File contents getter (for dependency graph) */
  getFileContent?: (filePath: string) => Promise<string | null>;
}

/**
 * ACE Context Provider
 */
export const AceProvider: React.FC<AceProviderProps> = ({
  children,
  summaries = [],
  indexedFiles = [],
  projectRoot = '',
  getFileContent,
}) => {
  const [state, setState] = useState<AceState>(defaultState);

  /**
   * Run full ACE analysis
   */
  const runAnalysis = useCallback(async (input: AceAnalysisInput) => {
    setState((s) => ({ ...s, isScanning: true, error: null }));

    try {
      // 1. Build debt map (file scores)
      const fileScores = buildAceFileScores({
        issues: input.issues,
        fileSizes: input.fileSizes,
        projectRoot: input.projectRoot,
      });

      // 2. Calculate overall debt
      const overallDebt = calculateOverallDebtScore(fileScores);

      // 3. Build dependency graph
      const dependencyGraph = buildDependencyGraph(input.fileContents);

      // 4. Build suggestions
      const suggestions = buildAceSuggestions({
        fileScores,
        projectRoot: input.projectRoot,
      });

      // 5. Analyze impact for each suggestion
      const impacts = analyzeAllSuggestionImpacts(suggestions, dependencyGraph, fileScores);

      // 6. Build evolution plan
      const plan = buildAcePlanFromSuggestions(suggestions);

      setState({
        fileScores,
        overallDebt,
        suggestions,
        impacts,
        dependencyGraph,
        plan,
        isScanning: false,
        lastScan: new Date().toISOString(),
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        isScanning: false,
        error: err instanceof Error ? err.message : 'Unknown error during ACE analysis',
      }));
    }
  }, []);

  /**
   * Phase 128.5.1: Recompute ACE from project issues summaries
   * Phase 128.6: Added metrics & history tracking
   * This builds ACE data from the current summaries without needing full file contents
   */
  const recompute = useCallback((trigger: 'manual' | 'auto_scan' | 'phase_complete' = 'auto_scan') => {
    if (!summaries.length && !indexedFiles.length) {
      console.log('[ACE] recompute: No summaries or files, skipping');
      return;
    }

    console.log('[ACE] Recomputing from summaries...', {
      summariesCount: summaries.length,
      indexedFilesCount: indexedFiles.length,
      trigger,
    });

    setState((s) => ({ ...s, isScanning: true, error: null, activityStatus: 'running' }));

    try {
      // 1. Build debt map (file scores) directly from summaries
      // buildAceFileScores expects FileIssuesSummary[] which we have from props
      const fileScores = buildAceFileScores({
        issueSummaries: summaries,
        projectRoot,
      });

      // 2. Calculate overall debt (health score 0-100, higher is better)
      const overallDebt = calculateOverallDebtScore(fileScores);

      // 3. Build suggestions
      const suggestions = buildAceSuggestions({
        fileScores,
        projectRoot,
      });

      // 4. Build evolution plan
      const plan = buildAcePlanFromSuggestions(suggestions);

      // Note: dependency graph and impact analysis require file contents
      // For recompute, we skip those and use empty maps
      const dependencyGraph = new Map<string, DependencyNode>();
      const impacts = new Map<string, ImpactAnalysis>();

      const now = new Date().toISOString();

      setState((s) => {
        // Phase 128.6: Create recompute event for history
        const previousScore = s.metrics.recomputeHistory[0]?.overallDebtScore;
        const recomputeEvent: AceRecomputeEvent = {
          id: `ace-${Date.now()}`,
          projectRoot,
          timestamp: now,
          filesCount: fileScores.length,
          suggestionsCount: suggestions.length,
          overallDebtScore: overallDebt,
          previousScore,
          trigger,
        };

        // Keep only last 20 events in history
        const newHistory = [recomputeEvent, ...s.metrics.recomputeHistory].slice(0, 20);
        const newMetrics: AceMetricsState = {
          ...s.metrics,
          recomputeHistory: newHistory,
          lastActivity: now,
        };

        // Calculate new activity status
        const activityStatus = calculateAceActivityStatus(
          newMetrics,
          overallDebt,
          false, // not scanning anymore
          suggestions.length
        );

        // Phase 128.7: Generate alerts based on current state
        const alerts = generateAceAlerts(
          newMetrics,
          overallDebt,
          suggestions.length,
          false, // not scanning
          s.alertThresholds
        );

        return {
          fileScores,
          overallDebt,
          suggestions,
          impacts,
          dependencyGraph,
          plan,
          isScanning: false,
          lastScan: now,
          error: null,
          metrics: newMetrics,
          activityStatus,
          alerts,
          alertThresholds: s.alertThresholds,
        };
      });

      console.log('[ACE] Recomputed with metrics', {
        scoresCount: fileScores.length,
        suggestionsCount: suggestions.length,
        overallDebt,
        trigger,
      });
    } catch (err) {
      console.error('[ACE] Recompute error:', err);
      setState((s) => ({
        ...s,
        isScanning: false,
        activityStatus: 'attention',
        error: err instanceof Error ? err.message : 'Unknown error during ACE recompute',
      }));
    }
  }, [summaries, indexedFiles, projectRoot]);

  /**
   * Clear all ACE data
   */
  const clearData = useCallback(() => {
    setState(defaultState);
  }, []);

  /**
   * Mark a phase as in progress
   */
  const startPhase = useCallback((phaseId: string) => {
    setState((s) => {
      if (!s.plan) return s;
      return { ...s, plan: markPhaseInProgress(s.plan, phaseId) };
    });
  }, []);

  /**
   * Mark a phase as completed
   */
  const completePhase = useCallback((phaseId: string) => {
    setState((s) => {
      if (!s.plan) return s;
      return { ...s, plan: markPhaseCompleted(s.plan, phaseId) };
    });
  }, []);

  /**
   * Accept a suggestion (remove from list)
   */
  const acceptSuggestion = useCallback((suggestionId: string) => {
    setState((s) => ({
      ...s,
      suggestions: s.suggestions.filter((sg) => sg.id !== suggestionId),
    }));
  }, []);

  /**
   * Dismiss a suggestion (remove from list)
   */
  const dismissSuggestion = useCallback((suggestionId: string) => {
    setState((s) => ({
      ...s,
      suggestions: s.suggestions.filter((sg) => sg.id !== suggestionId),
    }));
  }, []);

  /**
   * Get suggestions sorted by impact (safest first)
   */
  const getSortedSuggestions = useCallback(() => {
    return sortSuggestionsByImpact(state.suggestions, state.impacts);
  }, [state.suggestions, state.impacts]);

  /**
   * Get worst files
   */
  const getWorstFilesFunc = useCallback(
    (n: number = 10) => {
      return getWorstFiles(state.fileScores, n);
    },
    [state.fileScores]
  );

  /**
   * Phase 128.6: Get recent recompute history
   */
  const getRecentHistory = useCallback(
    (n: number = 3) => {
      return state.metrics.recomputeHistory.slice(0, n);
    },
    [state.metrics.recomputeHistory]
  );

  /**
   * Phase 128.6: Get score improvement from last run
   */
  const getScoreImprovementFunc = useCallback(() => {
    return getScoreImprovement(state.metrics.recomputeHistory);
  }, [state.metrics.recomputeHistory]);

  /**
   * Phase 128.7: Dismiss an alert
   */
  const dismissAlert = useCallback((alertId: string) => {
    setState((s) => ({
      ...s,
      alerts: s.alerts.map((a) =>
        a.id === alertId ? { ...a, dismissed: true } : a
      ),
    }));
  }, []);

  /**
   * Phase 128.7: Get active (non-dismissed) alerts
   */
  const getActiveAlertsFunc = useCallback(() => {
    return getActiveAlerts(state.alerts);
  }, [state.alerts]);

  /**
   * Phase 128.7: Update alert thresholds
   */
  const setAlertThresholds = useCallback((thresholds: Partial<AceAlertThresholds>) => {
    setState((s) => ({
      ...s,
      alertThresholds: { ...s.alertThresholds, ...thresholds },
    }));
  }, []);

  /**
   * Combined context value
   */
  const contextValue = useMemo<AceContextValue>(
    () => ({
      ...state,
      runAnalysis,
      recompute,
      clearData,
      startPhase,
      completePhase,
      acceptSuggestion,
      dismissSuggestion,
      getSortedSuggestions,
      getWorstFiles: getWorstFilesFunc,
      getRecentHistory,
      getScoreImprovement: getScoreImprovementFunc,
      dismissAlert,
      getActiveAlerts: getActiveAlertsFunc,
      setAlertThresholds,
    }),
    [
      state,
      runAnalysis,
      recompute,
      clearData,
      startPhase,
      completePhase,
      acceptSuggestion,
      dismissSuggestion,
      getSortedSuggestions,
      getWorstFilesFunc,
      getRecentHistory,
      getScoreImprovementFunc,
      dismissAlert,
      getActiveAlertsFunc,
      setAlertThresholds,
    ]
  );

  return <AceContext.Provider value={contextValue}>{children}</AceContext.Provider>;
};

/**
 * Hook to use ACE context
 */
export function useAce(): AceContextValue {
  const context = useContext(AceContext);
  if (!context) {
    throw new Error('useAce must be used within an AceProvider');
  }
  return context;
}

/**
 * Hook for ACE plan only
 */
export function useAcePlan(): {
  plan: AcePlan | null;
  currentPhase: AcePlanPhase | null;
  progress: number;
  startPhase: (phaseId: string) => void;
  completePhase: (phaseId: string) => void;
} {
  const { plan, startPhase, completePhase } = useAce();

  const currentPhase = plan ? getNextPhase(plan) : null;
  const progress = plan?.progress ?? 0;

  return { plan, currentPhase, progress, startPhase, completePhase };
}

/**
 * Hook for ACE suggestions only
 */
export function useAceSuggestions(): {
  suggestions: AceSuggestion[];
  sortedSuggestions: AceSuggestion[];
  impacts: Map<string, ImpactAnalysis>;
  acceptSuggestion: (id: string) => void;
  dismissSuggestion: (id: string) => void;
} {
  const { suggestions, impacts, acceptSuggestion, dismissSuggestion, getSortedSuggestions } = useAce();

  return {
    suggestions,
    sortedSuggestions: getSortedSuggestions(),
    impacts,
    acceptSuggestion,
    dismissSuggestion,
  };
}

/**
 * Hook for ACE debt overview
 */
export function useAceDebt(): {
  fileScores: AceFileScore[];
  overallDebt: number;
  worstFiles: AceFileScore[];
} {
  const { fileScores, overallDebt, getWorstFiles } = useAce();

  return {
    fileScores,
    overallDebt,
    worstFiles: getWorstFiles(10),
  };
}

/**
 * Phase 128.6: Hook for ACE metrics & history
 */
export function useAceMetrics(): {
  metrics: AceMetricsState;
  activityStatus: AceActivityStatus;
  recentHistory: AceRecomputeEvent[];
  improvement: { delta: number; improved: boolean } | null;
  isScanning: boolean;
  lastScan: string | null;
} {
  const { metrics, activityStatus, isScanning, lastScan, getRecentHistory, getScoreImprovement } = useAce();

  return {
    metrics,
    activityStatus,
    recentHistory: getRecentHistory(3),
    improvement: getScoreImprovement(),
    isScanning,
    lastScan,
  };
}

/**
 * Phase 128.7: Hook for ACE alerts
 */
export function useAceAlerts(): {
  alerts: AceAlert[];
  activeAlerts: AceAlert[];
  highestSeverity: 'info' | 'warning' | 'critical' | null;
  alertThresholds: AceAlertThresholds;
  dismissAlert: (alertId: string) => void;
  setAlertThresholds: (thresholds: Partial<AceAlertThresholds>) => void;
} {
  const { alerts, alertThresholds, dismissAlert, getActiveAlerts, setAlertThresholds } = useAce();
  const activeAlerts = getActiveAlerts();
  const highestSeverity = getHighestSeverity(activeAlerts);

  return {
    alerts,
    activeAlerts,
    highestSeverity,
    alertThresholds,
    dismissAlert,
    setAlertThresholds,
  };
}

export default AceProvider;
