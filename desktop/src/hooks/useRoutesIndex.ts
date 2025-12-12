// desktop/src/hooks/useRoutesIndex.ts
// Phase 124.3: Routes Index Hook for Smart Route-Aware Agent
// Loads and manages the routes index for agent context

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { RoutesIndex, IndexedRoute, RouteSearchResult } from '../../indexer/types';
import {
  resolveRouteQuery,
  findApiByPath,
  findPageByPath,
  type RouteResolverResult,
} from '../lib/agent/tools/routeResolver';
import {
  planOpsPermissions,
  type OpsPermissionsPlan,
} from '../lib/agent/tools/opsPermissionsPlanner';
import {
  buildRouteAwareSystemMessage,
  isRouteQuery,
  getSuggestedRoutes,
} from '../lib/agent/prompts/routeAwarePrompt';

/**
 * Hook options
 */
export interface UseRoutesIndexOptions {
  projectRoot: string;
  autoLoad?: boolean;
  language?: 'ar' | 'en';
}

/**
 * Routes index state
 */
export interface RoutesIndexState {
  routesIndex: RoutesIndex | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

/**
 * Hook for managing routes index and route-aware agent features
 */
export function useRoutesIndex(options: UseRoutesIndexOptions) {
  const { projectRoot, autoLoad = true, language = 'ar' } = options;

  const [state, setState] = useState<RoutesIndexState>({
    routesIndex: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
  });

  /**
   * Load routes index from .f0/index/routes-index.json
   */
  const loadRoutesIndex = useCallback(async () => {
    if (!projectRoot) return;

    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      // Check if f0Desktop bridge is available
      if (typeof window !== 'undefined' && (window as any).f0Desktop?.readFile) {
        const indexPath = `${projectRoot}/.f0/index/routes-index.json`;

        try {
          const content = await (window as any).f0Desktop.readFile(indexPath);
          if (content) {
            const index = JSON.parse(content) as RoutesIndex;
            console.log('[useRoutesIndex] Loaded routes index:', index.stats);

            setState({
              routesIndex: index,
              isLoading: false,
              error: null,
              lastUpdated: index.indexedAt,
            });
            return;
          }
        } catch (readErr) {
          console.log('[useRoutesIndex] No routes index found, will need to build');
        }
      }

      // Fallback: Try localStorage
      const cacheKey = `f0-routes-index-${btoa(projectRoot)}`;
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        const index = JSON.parse(cached) as RoutesIndex;
        console.log('[useRoutesIndex] Loaded from localStorage:', index.stats);

        setState({
          routesIndex: index,
          isLoading: false,
          error: null,
          lastUpdated: index.indexedAt,
        });
        return;
      }

      // No index found
      console.log('[useRoutesIndex] No routes index found');
      setState(s => ({
        ...s,
        isLoading: false,
        error: 'Routes index not found. Run indexer first.',
      }));
    } catch (err) {
      console.error('[useRoutesIndex] Load error:', err);
      setState(s => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load routes index',
      }));
    }
  }, [projectRoot]);

  /**
   * Save routes index to localStorage (for caching)
   */
  const cacheRoutesIndex = useCallback((index: RoutesIndex) => {
    try {
      const cacheKey = `f0-routes-index-${btoa(projectRoot)}`;
      localStorage.setItem(cacheKey, JSON.stringify(index));
    } catch (err) {
      console.warn('[useRoutesIndex] Cache save error:', err);
    }
  }, [projectRoot]);

  /**
   * Update routes index
   */
  const updateRoutesIndex = useCallback((index: RoutesIndex) => {
    console.log('[useRoutesIndex] Index updated:', index.stats);
    setState({
      routesIndex: index,
      isLoading: false,
      error: null,
      lastUpdated: index.indexedAt,
    });
    cacheRoutesIndex(index);
  }, [cacheRoutesIndex]);

  /**
   * Resolve route query (natural language → file path)
   */
  const resolveRoute = useCallback((
    query: string
  ): RouteResolverResult | null => {
    if (!state.routesIndex) {
      return null;
    }

    return resolveRouteQuery(query, state.routesIndex, {
      language,
      maxResults: 5,
    });
  }, [state.routesIndex, language]);

  /**
   * Find API by URL path
   */
  const findApi = useCallback((urlPath: string): IndexedRoute | null => {
    if (!state.routesIndex) return null;
    return findApiByPath(urlPath, state.routesIndex);
  }, [state.routesIndex]);

  /**
   * Find page by URL path
   */
  const findPage = useCallback((urlPath: string): IndexedRoute | null => {
    if (!state.routesIndex) return null;
    return findPageByPath(urlPath, state.routesIndex);
  }, [state.routesIndex]);

  /**
   * Plan ops permissions
   */
  const planPermissions = useCallback((): OpsPermissionsPlan | null => {
    if (!state.routesIndex) return null;
    return planOpsPermissions(state.routesIndex);
  }, [state.routesIndex]);

  /**
   * Get route-aware system message for agent
   */
  const getSystemMessage = useCallback((): string | null => {
    if (!state.routesIndex) return null;
    return buildRouteAwareSystemMessage({
      routesIndex: state.routesIndex,
      language,
    });
  }, [state.routesIndex, language]);

  /**
   * Check if a query is about routes
   */
  const checkRouteQuery = useCallback((query: string): boolean => {
    return isRouteQuery(query);
  }, []);

  /**
   * Get suggested routes for autocomplete
   */
  const getSuggestions = useCallback((
    partialQuery: string,
    max: number = 5
  ): IndexedRoute[] => {
    if (!state.routesIndex) return [];
    return getSuggestedRoutes(partialQuery, state.routesIndex, max);
  }, [state.routesIndex]);

  /**
   * Computed: Routes stats summary
   */
  const stats = useMemo(() => {
    if (!state.routesIndex) return null;
    return state.routesIndex.stats;
  }, [state.routesIndex]);

  /**
   * Computed: Has routes index
   */
  const hasRoutesIndex = useMemo(() => {
    return !!state.routesIndex;
  }, [state.routesIndex]);

  /**
   * Computed: Is index fresh (< 1 hour old)
   */
  const isFresh = useMemo(() => {
    if (!state.lastUpdated) return false;
    const oneHour = 60 * 60 * 1000;
    return Date.now() - state.lastUpdated < oneHour;
  }, [state.lastUpdated]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && projectRoot) {
      loadRoutesIndex();
    }
  }, [autoLoad, projectRoot, loadRoutesIndex]);

  /**
   * Phase 124.3.1: Open file in editor
   */
  const openFileInEditor = useCallback((filePath: string) => {
    if (typeof window !== 'undefined' && (window as any).f0Desktop?.openFileInEditor) {
      console.log('[useRoutesIndex] Opening file:', filePath);
      (window as any).f0Desktop.openFileInEditor(filePath, projectRoot);
    } else {
      console.warn('[useRoutesIndex] f0Desktop.openFileInEditor not available');
    }
  }, [projectRoot]);

  /**
   * Phase 124.3.1: Resolve route and open primary result in editor
   */
  const resolveAndOpenFile = useCallback((
    query: string
  ): RouteResolverResult | null => {
    const result = resolveRoute(query);

    if (result?.success && result.primaryFilePath) {
      console.log('[useRoutesIndex] Opening resolved file:', result.primaryFilePath);
      openFileInEditor(result.primaryFilePath);
    }

    return result;
  }, [resolveRoute, openFileInEditor]);

  return {
    // State
    routesIndex: state.routesIndex,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,

    // Actions
    loadRoutesIndex,
    updateRoutesIndex,

    // Route Tools
    resolveRoute,
    findApi,
    findPage,
    planPermissions,

    // Phase 124.3.1: File opening
    openFileInEditor,
    resolveAndOpenFile,

    // Agent Integration
    getSystemMessage,
    checkRouteQuery,
    getSuggestions,

    // Computed
    stats,
    hasRoutesIndex,
    isFresh,
  };
}

export default useRoutesIndex;
