// src/hooks/useWebDeployGate.ts
// =============================================================================
// Phase 150.4.4 – Main hook for Web Deploy Gate
// Phase 150.6.1 – Performance: Accept runtime as prop to avoid duplicate listeners
// =============================================================================
'use client';

import { useMemo } from 'react';
import {
  deriveGateDecision,
  type GateInputs,
  type GateDecision,
  type GateQualityInput,
  type GateSecurityInput,
  type GateTestsInput,
} from '@/shared/quality/deployGateEngine';
import { useProjectRuntime, type ProjectRuntimeState } from '@/hooks/useProjectRuntime';
import { useQualityPolicy } from '@/hooks/useQualityPolicy';

interface UseWebDeployGateResult {
  decision: GateDecision;
  inputs: GateInputs;
  loading: boolean;
}

// =============================================================================
// 150.6.1 – Performance-optimized version that accepts runtime as prop
// =============================================================================

/**
 * Convert runtime data to gate inputs
 * Shared logic between both hook versions
 */
function runtimeToGateInputs(
  runtime: ProjectRuntimeState,
  policy: GateInputs['policy']
): GateInputs {
  // Convert quality
  const qualityInput: GateQualityInput | null = runtime.latestQuality
    ? {
        score: runtime.latestQuality.score,
        status: runtime.latestQuality.status,
        totalIssues: runtime.latestQuality.totalIssues,
      }
    : null;

  // Convert security
  const securityInput: GateSecurityInput | null = runtime.securityStats
    ? {
        totalAlerts: runtime.securityStats.totalAlerts,
        hasBlocking: runtime.securityStats.hasBlocking,
      }
    : { totalAlerts: 0, hasBlocking: false };

  // Convert tests
  const testsInput: GateTestsInput | null = runtime.testsStats
    ? {
        status: runtime.testsStats.status,
        coverage: runtime.testsStats.coverage ?? undefined,
        lastRunAt: runtime.testsStats.lastRunAt,
      }
    : { status: 'not_run', coverage: undefined, lastRunAt: null };

  return {
    quality: qualityInput,
    security: securityInput,
    tests: testsInput,
    policy,
  };
}

/**
 * Performance-optimized hook: accepts runtime as prop
 * Use this when parent component already has runtime data
 */
export function useWebDeployGateWithRuntime(
  runtime: ProjectRuntimeState,
  projectId?: string | null
): UseWebDeployGateResult {
  const { policy } = useQualityPolicy('balanced');

  // Build gate inputs from runtime
  const inputs = useMemo(
    () => runtimeToGateInputs(runtime, policy),
    [runtime.latestQuality, runtime.securityStats, runtime.testsStats, policy]
  );

  // Derive decision
  const decision = useMemo(() => {
    const result = deriveGateDecision(inputs);

    // Log for debugging
    if (typeof window !== 'undefined' && projectId) {
      console.log('[150.6][GATE_WEB] Derived gate decision (optimized)', {
        projectId,
        inputs: {
          quality: inputs.quality
            ? { score: inputs.quality.score, status: inputs.quality.status }
            : null,
          security: inputs.security,
          tests: inputs.tests,
          policy: {
            minHealthForOK: inputs.policy.minHealthForOK,
            blockOnSecurityAlerts: inputs.policy.blockOnSecurityAlerts,
          },
        },
        decision: result,
      });
    }

    return result;
  }, [inputs, projectId]);

  return { decision, inputs, loading: runtime.loading };
}

// =============================================================================
// Original hook (for backwards compatibility)
// Uses its own runtime - only use when no parent has runtime
// =============================================================================

/**
 * Main hook for Web Deploy Gate
 * Note: If parent already has useProjectRuntime, use useWebDeployGateWithRuntime instead
 */
export function useWebDeployGate(projectId: string | null): UseWebDeployGateResult {
  const runtime = useProjectRuntime(projectId);
  return useWebDeployGateWithRuntime(runtime, projectId);
}

export default useWebDeployGate;
