// desktop/src/state/previewDevicesContext.tsx
// Phase 131.0: Preview Devices Context for Mobile Preview & Device Lab

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type {
  DevicePreset,
  DeviceOrientation,
  PreviewScale,
  PreviewState,
  PreviewActions,
  DeviceProfile,
} from '../lib/preview/previewTypes';
import {
  DEFAULT_PREVIEW_STATE,
  getDeviceProfile,
  DEVICE_PROFILES,
} from '../lib/preview/previewTypes';

/**
 * Context value type
 */
interface PreviewDevicesContextValue extends PreviewState, PreviewActions {
  /** Current device profile */
  currentProfile: DeviceProfile | undefined;
  /** All available profiles */
  allProfiles: DeviceProfile[];
}

/**
 * Storage key for persistence
 */
const STORAGE_KEY = 'f0-preview-device-settings';

/**
 * Load saved settings from localStorage
 */
function loadSavedSettings(): Partial<PreviewState> {
  try {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore errors
  }
  return {};
}

/**
 * Save settings to localStorage
 */
function saveSettings(state: Partial<PreviewState>): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      currentPreset: state.currentPreset,
      orientation: state.orientation,
      scale: state.scale,
      showFrame: state.showFrame,
      autoReload: state.autoReload,
    }));
  } catch {
    // Ignore errors
  }
}

/**
 * Create context
 */
const PreviewDevicesContext = createContext<PreviewDevicesContextValue | null>(null);

/**
 * Provider props
 */
interface PreviewDevicesProviderProps {
  children: ReactNode;
  /** Initial URL to preview */
  initialUrl?: string;
}

/**
 * Preview Devices Provider
 */
export const PreviewDevicesProvider: React.FC<PreviewDevicesProviderProps> = ({
  children,
  initialUrl = 'http://localhost:3000',
}) => {
  // Load saved settings on mount
  const savedSettings = loadSavedSettings();

  // State
  const [currentPreset, setCurrentPresetState] = useState<DevicePreset>(
    savedSettings.currentPreset || DEFAULT_PREVIEW_STATE.currentPreset
  );
  const [orientation, setOrientationState] = useState<DeviceOrientation>(
    savedSettings.orientation || DEFAULT_PREVIEW_STATE.orientation
  );
  const [scale, setScaleState] = useState<PreviewScale>(
    savedSettings.scale || DEFAULT_PREVIEW_STATE.scale
  );
  const [url, setUrlState] = useState<string>(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [showFrame, setShowFrameState] = useState(
    savedSettings.showFrame ?? DEFAULT_PREVIEW_STATE.showFrame
  );
  const [autoReload, setAutoReloadState] = useState(
    savedSettings.autoReload ?? DEFAULT_PREVIEW_STATE.autoReload
  );
  const [lastReloadAt, setLastReloadAt] = useState<string | undefined>();

  // Get current profile
  const currentProfile = getDeviceProfile(currentPreset);

  // Actions
  const setDevicePreset = useCallback((preset: DevicePreset) => {
    setCurrentPresetState(preset);
    console.log('[Preview] Device preset changed:', preset);
  }, []);

  const setOrientation = useCallback((newOrientation: DeviceOrientation) => {
    setOrientationState(newOrientation);
    console.log('[Preview] Orientation changed:', newOrientation);
  }, []);

  const toggleOrientation = useCallback(() => {
    setOrientationState(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  }, []);

  const setScale = useCallback((newScale: PreviewScale) => {
    setScaleState(newScale);
    console.log('[Preview] Scale changed:', newScale);
  }, []);

  const setUrl = useCallback((newUrl: string) => {
    setUrlState(newUrl);
    setIsLoading(true);
    console.log('[Preview] URL changed:', newUrl);
  }, []);

  const reload = useCallback(() => {
    setIsLoading(true);
    setLastReloadAt(new Date().toISOString());
    console.log('[Preview] Reload triggered');
  }, []);

  const setShowFrame = useCallback((show: boolean) => {
    setShowFrameState(show);
  }, []);

  const setAutoReload = useCallback((auto: boolean) => {
    setAutoReloadState(auto);
  }, []);

  const resetToDefault = useCallback(() => {
    setCurrentPresetState(DEFAULT_PREVIEW_STATE.currentPreset);
    setOrientationState(DEFAULT_PREVIEW_STATE.orientation);
    setScaleState(DEFAULT_PREVIEW_STATE.scale);
    setShowFrameState(DEFAULT_PREVIEW_STATE.showFrame);
    setAutoReloadState(DEFAULT_PREVIEW_STATE.autoReload);
    console.log('[Preview] Reset to defaults');
  }, []);

  // Save settings when they change
  useEffect(() => {
    saveSettings({
      currentPreset,
      orientation,
      scale,
      showFrame,
      autoReload,
    });
  }, [currentPreset, orientation, scale, showFrame, autoReload]);

  // Context value
  const value: PreviewDevicesContextValue = {
    // State
    currentPreset,
    orientation,
    scale,
    url,
    isLoading,
    showFrame,
    autoReload,
    lastReloadAt,
    // Derived
    currentProfile,
    allProfiles: DEVICE_PROFILES,
    // Actions
    setDevicePreset,
    setOrientation,
    toggleOrientation,
    setScale,
    setUrl,
    reload,
    setShowFrame,
    setAutoReload,
    resetToDefault,
  };

  return (
    <PreviewDevicesContext.Provider value={value}>
      {children}
    </PreviewDevicesContext.Provider>
  );
};

/**
 * Hook to use preview devices context
 */
export function usePreviewDevices(): PreviewDevicesContextValue {
  const context = useContext(PreviewDevicesContext);
  if (!context) {
    throw new Error('usePreviewDevices must be used within PreviewDevicesProvider');
  }
  return context;
}

/**
 * Hook to use preview devices context (optional - returns null if not in provider)
 */
export function usePreviewDevicesOptional(): PreviewDevicesContextValue | null {
  return useContext(PreviewDevicesContext);
}

export default PreviewDevicesContext;
