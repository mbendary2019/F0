/**
 * Phase 82: Unified Environment Management - Context Provider
 * React Context for managing environment mode state globally
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { EnvMode, ResolvedEnv } from '@/types/env';
import { getClientEnvMode, setClientEnvMode, resolveClientEnv } from '@/lib/env/resolveEnv';

interface EnvModeContextValue {
  /** Current environment mode setting */
  mode: EnvMode;

  /** Resolved environment configuration */
  resolved: ResolvedEnv;

  /** Set environment mode and persist to localStorage */
  setMode: (mode: EnvMode) => void;

  /** Refresh resolved environment (useful after mode change) */
  refresh: () => void;
}

const EnvModeContext = createContext<EnvModeContextValue | undefined>(undefined);

interface EnvModeProviderProps {
  children: React.ReactNode;
}

export function EnvModeProvider({ children }: EnvModeProviderProps) {
  const [mode, setModeState] = useState<EnvMode>('auto');
  const [resolved, setResolved] = useState<ResolvedEnv>(() => resolveClientEnv('auto'));

  // Initialize mode from localStorage on mount
  useEffect(() => {
    const initialMode = getClientEnvMode();
    setModeState(initialMode);
    setResolved(resolveClientEnv(initialMode));
  }, []);

  // Set mode and persist to localStorage
  const setMode = useCallback((newMode: EnvMode) => {
    setModeState(newMode);
    setClientEnvMode(newMode);
    setResolved(resolveClientEnv(newMode));

    console.log(`[EnvModeContext] Mode changed to: ${newMode}`);

    // Reload page to apply new environment settings
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  // Refresh resolved environment
  const refresh = useCallback(() => {
    const currentMode = getClientEnvMode();
    setModeState(currentMode);
    setResolved(resolveClientEnv(currentMode));
  }, []);

  const value: EnvModeContextValue = {
    mode,
    resolved,
    setMode,
    refresh,
  };

  return <EnvModeContext.Provider value={value}>{children}</EnvModeContext.Provider>;
}

/**
 * Hook to access environment mode context
 */
export function useEnvMode(): EnvModeContextValue {
  const context = useContext(EnvModeContext);

  if (context === undefined) {
    throw new Error('useEnvMode must be used within EnvModeProvider');
  }

  return context;
}
