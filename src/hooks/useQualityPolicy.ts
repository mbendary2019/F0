// src/hooks/useQualityPolicy.ts
// =============================================================================
// Phase 150.4.4 – Hook to get quality policy settings
// =============================================================================
'use client';

import { useState, useCallback } from 'react';
import {
  type GatePolicyInput,
  type PolicyPreset,
  getPolicyPreset,
  POLICY_PRESETS,
} from '@/shared/quality/deployGateEngine';

interface UseQualityPolicyResult {
  policy: GatePolicyInput;
  preset: PolicyPreset;
  setPreset: (preset: PolicyPreset) => void;
  availablePresets: PolicyPreset[];
}

/**
 * Hook to manage quality policy settings
 * For now uses local state, could be extended to persist to Firestore
 */
export function useQualityPolicy(
  initialPreset: PolicyPreset = 'balanced',
): UseQualityPolicyResult {
  const [preset, setPresetState] = useState<PolicyPreset>(initialPreset);

  const setPreset = useCallback((newPreset: PolicyPreset) => {
    console.log('[150.4][useQualityPolicy] Policy changed', {
      from: preset,
      to: newPreset,
    });
    setPresetState(newPreset);
  }, [preset]);

  const policy = getPolicyPreset(preset);

  return {
    policy,
    preset,
    setPreset,
    availablePresets: Object.keys(POLICY_PRESETS) as PolicyPreset[],
  };
}

export default useQualityPolicy;
