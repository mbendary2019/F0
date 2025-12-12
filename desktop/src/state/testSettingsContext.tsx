// desktop/src/state/testSettingsContext.tsx
// Phase 133.3: Test Settings Context for Auto-Run Configuration

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * Test auto-run settings
 */
export interface TestSettings {
  /** Run tests automatically after ACE applies fixes */
  autoRunAfterAce: boolean;
  /** Run tests automatically after generating new tests */
  autoRunAfterGenerate: boolean;
  /** Run tests automatically after code cleanup */
  autoRunAfterCleanup: boolean;
  /** Show toast notifications for test results */
  showTestToasts: boolean;
}

const DEFAULT_SETTINGS: TestSettings = {
  autoRunAfterAce: true,
  autoRunAfterGenerate: true,
  autoRunAfterCleanup: false,
  showTestToasts: true,
};

interface TestSettingsContextValue {
  settings: TestSettings;
  setSettings: (update: Partial<TestSettings>) => void;
  toggleSetting: (key: keyof TestSettings) => void;
}

const TestSettingsContext = createContext<TestSettingsContextValue | undefined>(undefined);

const STORAGE_KEY = 'f0-test-settings';

/**
 * Load settings from localStorage
 */
function loadSettings(): TestSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: TestSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Provider for test settings
 */
export const TestSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettingsState] = useState<TestSettings>(DEFAULT_SETTINGS);

  // Load settings on mount
  useEffect(() => {
    setSettingsState(loadSettings());
  }, []);

  // Update settings
  const setSettings = useCallback((update: Partial<TestSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...update };
      saveSettings(next);
      return next;
    });
  }, []);

  // Toggle a single setting
  const toggleSetting = useCallback((key: keyof TestSettings) => {
    setSettingsState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSettings(next);
      return next;
    });
  }, []);

  return (
    <TestSettingsContext.Provider value={{ settings, setSettings, toggleSetting }}>
      {children}
    </TestSettingsContext.Provider>
  );
};

/**
 * Hook to access test settings
 */
export function useTestSettings(): TestSettingsContextValue {
  const ctx = useContext(TestSettingsContext);
  if (!ctx) {
    throw new Error('useTestSettings must be used within TestSettingsProvider');
  }
  return ctx;
}

/**
 * Hook for just reading settings (no throw, returns defaults if no provider)
 */
export function useTestSettingsValue(): TestSettings {
  const ctx = useContext(TestSettingsContext);
  return ctx?.settings ?? DEFAULT_SETTINGS;
}

export default TestSettingsProvider;
