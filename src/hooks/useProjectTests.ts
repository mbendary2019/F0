// src/hooks/useProjectTests.ts
// =============================================================================
// Phase 150.4.4 – Hook to fetch project tests stats from Firestore
// Phase 150.5 – Now uses unified useProjectRuntime hook
// =============================================================================
'use client';

import { useMemo } from 'react';
import type { GateTestsInput } from '@/shared/quality/deployGateEngine';
import { useProjectRuntime } from './useProjectRuntime';

interface UseProjectTestsResult {
  stats: GateTestsInput | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch real-time tests data for a project
 * Uses unified runtime hook for consistent data across all components
 */
export function useProjectTests(projectId: string | null): UseProjectTestsResult {
  const runtime = useProjectRuntime(projectId);

  // Convert runtime tests to GateTestsInput format
  const stats = useMemo((): GateTestsInput | null => {
    if (!runtime.testsStats) {
      // Return default when no data
      return {
        status: 'not_run',
        coverage: undefined,
        lastRunAt: null,
      };
    }

    return {
      status: runtime.testsStats.status,
      coverage: runtime.testsStats.coverage ?? undefined,
      lastRunAt: runtime.testsStats.lastRunAt,
    };
  }, [runtime.testsStats]);

  return {
    stats,
    loading: runtime.loading,
    error: null,
  };
}

export default useProjectTests;
