// src/hooks/useProjectQuality.ts
// =============================================================================
// Phase 150.2 – Hook to fetch project quality data from Firestore
// Phase 150.5 – Now uses unified useProjectRuntime hook
// Phase 150.6.1 – Performance: Accept runtime as prop to avoid duplicate listeners
// =============================================================================
'use client';

import { useMemo } from 'react';
import { type QualitySnapshot, scoreToStatus } from '@/types/quality';
import { useProjectRuntime, type ProjectRuntimeState } from './useProjectRuntime';

interface UseProjectQualityResult {
  quality: QualitySnapshot | null;
  loading: boolean;
  error: string | null;
}

// =============================================================================
// 150.6.1 – Shared conversion logic
// =============================================================================

/**
 * Convert runtime data to QualitySnapshot
 */
function runtimeToQualitySnapshot(
  runtime: ProjectRuntimeState,
  projectId: string | null
): QualitySnapshot | null {
  if (!runtime.latestQuality) {
    // Return placeholder when no data
    if (!projectId) return null;
    return {
      score: 72,
      status: 'caution',
      totalIssues: 5,
      lastScanAt: null,
    };
  }

  const { latestQuality } = runtime;
  return {
    score: latestQuality.score,
    status: latestQuality.status ?? scoreToStatus(latestQuality.score),
    totalIssues: latestQuality.totalIssues ?? 0,
    lastScanAt: latestQuality.recordedAt,
    filesScanned: latestQuality.filesScanned,
    // Include security and tests from runtime if available
    securityAlerts: runtime.securityStats?.totalAlerts,
    testsStatus: runtime.testsStats?.status,
  };
}

// =============================================================================
// 150.6.1 – Performance-optimized version that accepts runtime as prop
// =============================================================================

/**
 * Performance-optimized hook: accepts runtime as prop
 * Use this when parent component already has runtime data
 */
export function useProjectQualityWithRuntime(
  runtime: ProjectRuntimeState,
  projectId?: string | null
): UseProjectQualityResult {
  const quality = useMemo(
    () => runtimeToQualitySnapshot(runtime, projectId ?? null),
    [runtime.latestQuality, runtime.securityStats, runtime.testsStats, projectId]
  );

  return {
    quality,
    loading: runtime.loading,
    error: null,
  };
}

// =============================================================================
// Original hook (for backwards compatibility)
// =============================================================================

/**
 * Hook to fetch real-time quality data for a project
 * Note: If parent already has useProjectRuntime, use useProjectQualityWithRuntime instead
 */
export function useProjectQuality(projectId: string | null): UseProjectQualityResult {
  const runtime = useProjectRuntime(projectId);
  return useProjectQualityWithRuntime(runtime, projectId);
}

export default useProjectQuality;
