// src/hooks/useProjectSecurity.ts
// =============================================================================
// Phase 150.4.4 – Hook to fetch project security stats from Firestore
// Phase 150.5 – Now uses unified useProjectRuntime hook
// =============================================================================
'use client';

import { useMemo } from 'react';
import type { GateSecurityInput } from '@/shared/quality/deployGateEngine';
import { useProjectRuntime } from './useProjectRuntime';

interface UseProjectSecurityResult {
  stats: GateSecurityInput | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch real-time security data for a project
 * Uses unified runtime hook for consistent data across all components
 */
export function useProjectSecurity(projectId: string | null): UseProjectSecurityResult {
  const runtime = useProjectRuntime(projectId);

  // Convert runtime security to GateSecurityInput format
  const stats = useMemo((): GateSecurityInput | null => {
    if (!runtime.securityStats) {
      // Return default when no data
      return {
        totalAlerts: 0,
        hasBlocking: false,
      };
    }

    return {
      totalAlerts: runtime.securityStats.totalAlerts,
      hasBlocking: runtime.securityStats.hasBlocking,
    };
  }, [runtime.securityStats]);

  return {
    stats,
    loading: runtime.loading,
    error: null,
  };
}

export default useProjectSecurity;
