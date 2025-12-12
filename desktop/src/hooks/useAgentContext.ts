// desktop/src/hooks/useAgentContext.ts
// Phase 123: Agent Context Hook
// Phase 124.2 Part 2: Enhanced with routes and dependency graph context

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ProjectSnapshot } from '../lib/agent/tools/generateProjectSnapshot';
import {
  loadSnapshotFromFirestore,
  loadSnapshotLocally,
} from '../lib/agent/saveSnapshot';
import {
  buildSnapshotContextText,
  buildSnapshotSystemMessage,
  buildSnapshotEnrichedMessages,
  enrichMessageWithSnapshot,
  isSnapshotFresh,
  getSnapshotFreshness,
  type SnapshotEnrichedResult,
} from '../lib/agent/snapshotContext';
import type { F0ChatMessage } from '../f0/apiClient';

/**
 * Agent context with snapshot and metadata
 */
export interface AgentContext {
  snapshot: ProjectSnapshot | null;
  projectRoot: string;
  projectId?: string;
  activeFile?: {
    path: string;
    content: string;
  };
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook options
 */
export interface UseAgentContextOptions {
  projectRoot: string;
  projectId?: string;
  autoLoad?: boolean;
  language?: 'ar' | 'en';
}

/**
 * Snapshot summary for quick display
 */
export interface SnapshotSummary {
  projectName: string;
  stack: string[];
  pageCount: number;
  apiCount: number;
  totalFiles: number;
  hubCount: number;
  freshness: 'fresh' | 'stale' | 'expired';
  generatedAt?: string;
}

/**
 * Build context string for agent system prompt (legacy)
 */
export function buildSnapshotContextString(
  snapshot: ProjectSnapshot,
  locale: 'ar' | 'en' = 'ar'
): string {
  // Use the new enhanced context builder
  return buildSnapshotContextText(snapshot, locale);
}

/**
 * Build full agent prompt with snapshot context injected (legacy)
 */
export function injectSnapshotIntoPrompt(
  userMessage: string,
  snapshot: ProjectSnapshot | null,
  locale: 'ar' | 'en' = 'ar'
): string {
  if (!snapshot) {
    return userMessage;
  }

  return enrichMessageWithSnapshot(userMessage, snapshot, locale);
}

/**
 * Hook for managing agent context with project snapshot
 *
 * Phase 124.2 Part 2: Enhanced with:
 * - Routes & API discovery data
 * - Dependency graph stats
 * - Snapshot freshness tracking
 * - Full F0ChatMessage building
 *
 * Usage:
 * ```tsx
 * const {
 *   snapshot,
 *   buildMessages,
 *   snapshotSummary,
 *   isFresh,
 * } = useAgentContext({
 *   projectRoot: '/path/to/project',
 *   projectId: 'abc123',
 *   language: 'ar',
 * });
 *
 * // When sending to agent:
 * const { messages, usedSnapshot } = buildMessages(userInput);
 * sendToAgent(messages);
 * ```
 */
export function useAgentContext(options: UseAgentContextOptions) {
  const { projectRoot, projectId, autoLoad = true, language = 'ar' } = options;

  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load snapshot from Firestore or local storage
   */
  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try Firestore first
      if (projectId) {
        const firestoreSnapshot = await loadSnapshotFromFirestore(projectId);
        if (firestoreSnapshot) {
          console.log('[useAgentContext] Loaded snapshot from Firestore:', firestoreSnapshot.projectName);
          setSnapshot(firestoreSnapshot);
          setIsLoading(false);
          return;
        }
      }

      // Fallback to local storage
      const localSnapshot = loadSnapshotLocally(projectRoot);
      if (localSnapshot) {
        console.log('[useAgentContext] Loaded snapshot from local:', localSnapshot.projectName);
        setSnapshot(localSnapshot);
      } else {
        console.log('[useAgentContext] No snapshot found for:', projectRoot);
      }
    } catch (err) {
      console.error('[useAgentContext] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load snapshot');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, projectRoot]);

  /**
   * Build F0ChatMessage array with snapshot context (Phase 124.2)
   */
  const buildMessages = useCallback(
    (
      userMessage: string,
      existingMessages: F0ChatMessage[] = []
    ): SnapshotEnrichedResult => {
      return buildSnapshotEnrichedMessages({
        projectRoot,
        userQuestion: userMessage,
        language,
        existingMessages,
        snapshot,
      });
    },
    [projectRoot, language, snapshot]
  );

  /**
   * Build message with snapshot context injected (legacy support)
   */
  const buildEnrichedMessage = useCallback(
    (userMessage: string, locale: 'ar' | 'en' = 'ar'): string => {
      return injectSnapshotIntoPrompt(userMessage, snapshot, locale);
    },
    [snapshot]
  );

  /**
   * Get system message with snapshot context
   */
  const getSystemMessage = useCallback(
    (locale: 'ar' | 'en' = language): string => {
      if (!snapshot) {
        return locale === 'ar'
          ? 'أنت وكيل كود F0 داخل F0 Desktop IDE. ساعد المستخدم في كتابة وتحسين الكود.'
          : 'You are the F0 Code Agent inside F0 Desktop IDE. Help the user write and improve code.';
      }
      return buildSnapshotSystemMessage(snapshot, locale);
    },
    [snapshot, language]
  );

  /**
   * Get context string for system prompt (legacy)
   */
  const getContextString = useCallback(
    (locale: 'ar' | 'en' = 'ar'): string => {
      if (!snapshot) return '';
      return buildSnapshotContextString(snapshot, locale);
    },
    [snapshot]
  );

  /**
   * Update snapshot manually
   */
  const updateSnapshot = useCallback((newSnapshot: ProjectSnapshot) => {
    console.log('[useAgentContext] Snapshot updated:', newSnapshot.projectName);
    setSnapshot(newSnapshot);
  }, []);

  /**
   * Clear snapshot
   */
  const clearSnapshot = useCallback(() => {
    setSnapshot(null);
  }, []);

  /**
   * Computed: Snapshot freshness
   */
  const freshness = useMemo(() => {
    if (!snapshot) return 'expired' as const;
    return getSnapshotFreshness(snapshot);
  }, [snapshot]);

  /**
   * Computed: Is snapshot fresh (< 1 hour old)
   */
  const isFresh = useMemo(() => {
    if (!snapshot) return false;
    return isSnapshotFresh(snapshot, 60 * 60 * 1000); // 1 hour
  }, [snapshot]);

  /**
   * Computed: Snapshot summary for quick display
   */
  const snapshotSummary = useMemo((): SnapshotSummary | null => {
    if (!snapshot) return null;

    return {
      projectName: snapshot.projectName,
      stack: snapshot.stack || [],
      pageCount: snapshot.routesStats?.pageCount || snapshot.routes?.length || 0,
      apiCount: snapshot.routesStats?.apiCount || snapshot.apis?.length || 0,
      totalFiles: snapshot.dependencyStats?.totalFiles || 0,
      hubCount: snapshot.dependencyStats?.hubCount || 0,
      freshness: getSnapshotFreshness(snapshot),
      generatedAt: snapshot.generatedAt,
    };
  }, [snapshot]);

  /**
   * Computed: Has routes data
   */
  const hasRoutesData = useMemo(() => {
    return !!(snapshot?.routesInfo?.length || snapshot?.apiRoutesInfo?.length);
  }, [snapshot]);

  /**
   * Computed: Has dependency data
   */
  const hasDependencyData = useMemo(() => {
    return !!(snapshot?.dependencyStats?.totalFiles);
  }, [snapshot]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && projectRoot) {
      loadSnapshot();
    }
  }, [autoLoad, projectRoot, loadSnapshot]);

  return {
    // Core state
    snapshot,
    isLoading,
    error,

    // Actions
    loadSnapshot,
    updateSnapshot,
    clearSnapshot,

    // Message building (Phase 124.2)
    buildMessages,
    getSystemMessage,

    // Legacy support
    buildEnrichedMessage,
    getContextString,

    // Computed values
    hasSnapshot: !!snapshot,
    snapshotSummary,
    freshness,
    isFresh,
    hasRoutesData,
    hasDependencyData,
  };
}

export default useAgentContext;
