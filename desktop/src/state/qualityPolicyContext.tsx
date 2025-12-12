// desktop/src/state/qualityPolicyContext.tsx
// Phase 135.0: Quality Profiles & Policies - Context Provider

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from 'react';
import type {
  QualityPolicyState,
  QualityProfileId,
  QualityPolicyThresholds,
} from './qualityPolicyTypes';
import { PROFILE_DEFAULTS } from './qualityPolicyTypes';

const STORAGE_KEY = 'f0.qualityPolicy.v1';

/**
 * Context value type
 */
interface QualityPolicyContextValue {
  /** Current policy state */
  state: QualityPolicyState;
  /** Switch to a different profile */
  setProfile: (profile: QualityProfileId) => void;
  /** Update individual thresholds (switches to custom profile) */
  updateThresholds: (patch: Partial<QualityPolicyThresholds>) => void;
  /** Reset to default balanced profile */
  resetToDefaults: () => void;
  /** Get thresholds for a specific profile (without switching) */
  getProfileThresholds: (profile: QualityProfileId) => QualityPolicyThresholds;
}

const QualityPolicyContext = createContext<QualityPolicyContextValue | null>(null);

/**
 * Load saved policy from localStorage
 */
function loadSavedPolicy(): QualityPolicyState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QualityPolicyState;
      // Validate structure
      if (parsed.profile && parsed.thresholds) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Save policy to localStorage
 */
function savePolicy(state: QualityPolicyState): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Quality Policy Provider
 * Manages quality profile selection and threshold configuration
 */
export const QualityPolicyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Initialize state from localStorage or default
  const [state, setState] = useState<QualityPolicyState>(() => {
    const saved = loadSavedPolicy();
    if (saved) return saved;

    return {
      profile: 'balanced',
      thresholds: PROFILE_DEFAULTS.balanced,
    };
  });

  // Persist to localStorage when state changes
  useEffect(() => {
    savePolicy(state);
  }, [state]);

  // Switch to a different profile
  const setProfile = useCallback((profile: QualityProfileId) => {
    setState((prev) => ({
      profile,
      // If switching to custom, keep current thresholds; otherwise use profile defaults
      thresholds: profile === 'custom' ? prev.thresholds : PROFILE_DEFAULTS[profile],
    }));
  }, []);

  // Update individual thresholds (auto-switches to custom)
  const updateThresholds = useCallback((patch: Partial<QualityPolicyThresholds>) => {
    setState((prev) => ({
      profile: 'custom',
      thresholds: { ...prev.thresholds, ...patch },
    }));
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setState({
      profile: 'balanced',
      thresholds: PROFILE_DEFAULTS.balanced,
    });
  }, []);

  // Get thresholds for a specific profile
  const getProfileThresholds = useCallback((profile: QualityProfileId) => {
    return PROFILE_DEFAULTS[profile];
  }, []);

  const value = useMemo<QualityPolicyContextValue>(
    () => ({
      state,
      setProfile,
      updateThresholds,
      resetToDefaults,
      getProfileThresholds,
    }),
    [state, setProfile, updateThresholds, resetToDefaults, getProfileThresholds]
  );

  return (
    <QualityPolicyContext.Provider value={value}>
      {children}
    </QualityPolicyContext.Provider>
  );
};

/**
 * Hook to access quality policy context
 * @throws if used outside QualityPolicyProvider
 */
export function useQualityPolicy(): QualityPolicyContextValue {
  const ctx = useContext(QualityPolicyContext);
  if (!ctx) {
    throw new Error('useQualityPolicy must be used within a QualityPolicyProvider');
  }
  return ctx;
}

/**
 * Hook to access just the policy state (read-only convenience)
 */
export function useQualityPolicyValue(): QualityPolicyState {
  return useQualityPolicy().state;
}

/**
 * Hook to access just the thresholds (read-only convenience)
 */
export function useQualityThresholds(): QualityPolicyThresholds {
  return useQualityPolicy().state.thresholds;
}

export default QualityPolicyProvider;
