// desktop/src/hooks/useApiDebugger.ts
// Phase 124.5.1: API Debugger Hook
// Provides state management for debugging API endpoints

import { useState, useCallback, useMemo } from 'react';
import type { RoutesIndex, IndexedRoute } from '../../indexer/types';
import type { DebugApiEndpointOutput } from '../lib/agent/tools/apiLogsDebugger';
import { resolveApiIntentFromQuery, type ApiQueryIntent } from '../lib/agent/tools';

/**
 * Hook options
 */
export interface UseApiDebuggerOptions {
  projectRoot: string;
  routesIndex: RoutesIndex | null;
  language?: 'ar' | 'en';
}

/**
 * API debugger state
 */
export interface ApiDebuggerState {
  urlPath: string;
  query: string;
  loading: boolean;
  result: DebugApiEndpointOutput | null;
  error: string | null;
  lastDebuggedAt: number | null;
}

/**
 * Quick endpoints for common API routes
 */
export interface QuickEndpoint {
  label: string;
  urlPath: string;
  icon: string;
}

/**
 * Hook for managing API debugger state and actions
 */
export function useApiDebugger(options: UseApiDebuggerOptions) {
  const { projectRoot, routesIndex, language = 'ar' } = options;

  const [state, setState] = useState<ApiDebuggerState>({
    urlPath: '',
    query: '',
    loading: false,
    result: null,
    error: null,
    lastDebuggedAt: null,
  });

  /**
   * Set the URL path to debug
   */
  const setUrlPath = useCallback((urlPath: string) => {
    setState(s => ({ ...s, urlPath, error: null }));
  }, []);

  /**
   * Set the natural language query
   */
  const setQuery = useCallback((query: string) => {
    setState(s => ({ ...s, query, error: null }));
  }, []);

  /**
   * Debug an API endpoint
   */
  const debugApi = useCallback(async (urlPathOverride?: string, queryOverride?: string) => {
    const targetUrl = urlPathOverride || state.urlPath;
    const targetQuery = queryOverride || state.query;

    if (!targetUrl && !targetQuery) {
      setState(s => ({
        ...s,
        error: language === 'ar' ? 'يرجى إدخال مسار الـ API أو سؤال' : 'Please enter an API path or query',
      }));
      return null;
    }

    if (!projectRoot) {
      setState(s => ({
        ...s,
        error: language === 'ar' ? 'لم يتم تحديد مسار المشروع' : 'Project root not specified',
      }));
      return null;
    }

    setState(s => ({ ...s, loading: true, error: null }));

    try {
      // Check if f0Desktop bridge is available
      if (typeof window !== 'undefined' && (window as any).f0Desktop?.debugApi) {
        const result = await (window as any).f0Desktop.debugApi({
          urlPath: targetUrl,
          query: targetQuery,
          projectRoot,
          minutesBack: 60,
        });

        console.log('[useApiDebugger] Debug result:', result);

        setState(s => ({
          ...s,
          loading: false,
          result,
          error: result.success ? null : result.reason,
          lastDebuggedAt: Date.now(),
          urlPath: result.urlPath || targetUrl || s.urlPath,
        }));

        return result;
      }

      // Fallback: Call API endpoint
      const response = await fetch('/api/desktop/debug-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urlPath: targetUrl,
          query: targetQuery,
          projectRoot,
          minutesBack: 60,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as DebugApiEndpointOutput;

      console.log('[useApiDebugger] Debug result from API:', result);

      setState(s => ({
        ...s,
        loading: false,
        result,
        error: result.success ? null : result.reason,
        lastDebuggedAt: Date.now(),
        urlPath: result.urlPath || targetUrl || s.urlPath,
      }));

      return result;
    } catch (err) {
      console.error('[useApiDebugger] Debug error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to debug API';

      setState(s => ({
        ...s,
        loading: false,
        error: errorMessage,
      }));

      return null;
    }
  }, [state.urlPath, state.query, projectRoot, language]);

  /**
   * Resolve intent from natural language query
   */
  const resolveIntent = useCallback((query: string): ApiQueryIntent => {
    return resolveApiIntentFromQuery(query, routesIndex ?? undefined);
  }, [routesIndex]);

  /**
   * Clear the debug result
   */
  const clearResult = useCallback(() => {
    setState(s => ({
      ...s,
      result: null,
      error: null,
      lastDebuggedAt: null,
    }));
  }, []);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setState({
      urlPath: '',
      query: '',
      loading: false,
      result: null,
      error: null,
      lastDebuggedAt: null,
    });
  }, []);

  /**
   * Get quick endpoints from routes index
   */
  const quickEndpoints = useMemo((): QuickEndpoint[] => {
    if (!routesIndex) return [];

    const apiRoutes = routesIndex.routes.filter(r => r.kind === 'api');

    // Prioritize common endpoints
    const priorityPatterns = [
      { pattern: /auth|login/i, icon: '🔐', priority: 1 },
      { pattern: /billing|payment|checkout/i, icon: '💳', priority: 2 },
      { pattern: /chat|message/i, icon: '💬', priority: 3 },
      { pattern: /user|profile/i, icon: '👤', priority: 4 },
      { pattern: /project/i, icon: '📁', priority: 5 },
    ];

    const scored = apiRoutes.map(route => {
      let priority = 99;
      let icon = '🔌';

      for (const p of priorityPatterns) {
        if (p.pattern.test(route.urlPath)) {
          priority = p.priority;
          icon = p.icon;
          break;
        }
      }

      return {
        route,
        priority,
        icon,
      };
    });

    return scored
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 6)
      .map(({ route, icon }) => ({
        label: route.urlPath.replace('/api/', ''),
        urlPath: route.urlPath,
        icon,
      }));
  }, [routesIndex]);

  /**
   * Get all API routes for autocomplete
   */
  const apiRoutes = useMemo((): IndexedRoute[] => {
    if (!routesIndex) return [];
    return routesIndex.routes.filter(r => r.kind === 'api');
  }, [routesIndex]);

  /**
   * Check if has debug result
   */
  const hasResult = useMemo(() => {
    return !!state.result?.success;
  }, [state.result]);

  /**
   * Get labels based on language
   */
  const labels = useMemo(() => {
    const isArabic = language === 'ar';
    return {
      title: isArabic ? '🔍 تصحيح API' : '🔍 API Debugger',
      placeholder: isArabic ? 'مسار الـ API أو سؤال...' : 'API path or question...',
      debug: isArabic ? 'تصحيح' : 'Debug',
      clear: isArabic ? 'مسح' : 'Clear',
      loading: isArabic ? 'جاري التحليل...' : 'Analyzing...',
      noResult: isArabic ? 'لا توجد نتائج' : 'No results',
      quickEndpoints: isArabic ? 'الـ APIs السريعة' : 'Quick APIs',
      codeAnalysis: isArabic ? '📋 تحليل الكود' : '📋 Code Analysis',
      logsSummary: isArabic ? '📊 ملخص الـ Logs' : '📊 Logs Summary',
      rootCause: isArabic ? '🎯 السبب المحتمل' : '🎯 Probable Cause',
      suggestions: isArabic ? '💡 اقتراحات الإصلاح' : '💡 Fix Suggestions',
      errors: isArabic ? 'أخطاء' : 'Errors',
      warnings: isArabic ? 'تحذيرات' : 'Warnings',
      methods: isArabic ? 'الـ Methods' : 'Methods',
      auth: isArabic ? 'المصادقة' : 'Auth',
      validation: isArabic ? 'التحقق' : 'Validation',
      none: isArabic ? 'لا يوجد' : 'None',
      commonErrors: isArabic ? '🔴 الأخطاء الشائعة' : '🔴 Common Errors',
    };
  }, [language]);

  return {
    // State
    urlPath: state.urlPath,
    query: state.query,
    loading: state.loading,
    result: state.result,
    error: state.error,
    lastDebuggedAt: state.lastDebuggedAt,

    // Actions
    setUrlPath,
    setQuery,
    debugApi,
    resolveIntent,
    clearResult,
    reset,

    // Data
    quickEndpoints,
    apiRoutes,

    // Computed
    hasResult,
    labels,
  };
}

export default useApiDebugger;
