// desktop/src/hooks/useDesktopSettings.ts
import { useEffect, useState } from 'react';
import type { F0DesktopSettings, AgentMode } from '../f0/apiClient';

const LS_BACKEND_URL = 'F0_DESKTOP_BACKEND_URL';
const LS_API_KEY = 'F0_DESKTOP_API_KEY';
const LS_PROJECT_ID = 'F0_DESKTOP_PROJECT_ID';
// Phase 109.5.4: Cloud Agent settings
const LS_AGENT_MODE = 'F0_DESKTOP_AGENT_MODE';
const LS_CLOUD_API_BASE = 'F0_DESKTOP_CLOUD_API_BASE';
// Phase 109.5.5: Cloud Auth Token
const LS_CLOUD_AUTH_TOKEN = 'F0_DESKTOP_CLOUD_AUTH_TOKEN';
// Phase 110: Locale
const LS_LOCALE = 'F0_DESKTOP_LOCALE';

const DEFAULT_BACKEND_URL = 'http://localhost:3030/api/openai_compat/v1';
const DEFAULT_CLOUD_API_BASE = 'http://localhost:3030';
const DEFAULT_LOCALE = 'ar'; // Arabic as default (Phase 171.4: Changed from 'en')

export function loadSettingsFromStorage(): F0DesktopSettings {
  if (typeof window === 'undefined') {
    return {
      backendUrl: DEFAULT_BACKEND_URL,
      apiKey: '',
      projectId: 'default-project', // Phase 186: Default project for quick start
      agentMode: 'cloud', // Phase 186: Cloud mode as default for F0 Agent
      cloudApiBase: DEFAULT_CLOUD_API_BASE,
      cloudAuthToken: '',
      locale: DEFAULT_LOCALE as 'ar' | 'en',
    };
  }

  return {
    backendUrl: localStorage.getItem(LS_BACKEND_URL) || DEFAULT_BACKEND_URL,
    apiKey: localStorage.getItem(LS_API_KEY) || '',
    projectId: localStorage.getItem(LS_PROJECT_ID) || 'default-project', // Phase 186: Default project
    agentMode: (localStorage.getItem(LS_AGENT_MODE) as AgentMode) || 'cloud', // Phase 186: Cloud mode default
    cloudApiBase: localStorage.getItem(LS_CLOUD_API_BASE) || DEFAULT_CLOUD_API_BASE,
    cloudAuthToken: localStorage.getItem(LS_CLOUD_AUTH_TOKEN) || '',
    locale: (localStorage.getItem(LS_LOCALE) as 'ar' | 'en') || DEFAULT_LOCALE as 'ar' | 'en',
  };
}

export function saveSettingsToStorage(settings: F0DesktopSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_BACKEND_URL, settings.backendUrl);
  localStorage.setItem(LS_API_KEY, settings.apiKey);
  if (settings.projectId) {
    localStorage.setItem(LS_PROJECT_ID, settings.projectId);
  } else {
    localStorage.removeItem(LS_PROJECT_ID);
  }
  // Phase 109.5.4: Save Cloud Agent settings
  localStorage.setItem(LS_AGENT_MODE, settings.agentMode || 'local');
  localStorage.setItem(LS_CLOUD_API_BASE, settings.cloudApiBase || DEFAULT_CLOUD_API_BASE);
  // Phase 109.5.5: Save Cloud Auth Token
  if (settings.cloudAuthToken) {
    localStorage.setItem(LS_CLOUD_AUTH_TOKEN, settings.cloudAuthToken);
  } else {
    localStorage.removeItem(LS_CLOUD_AUTH_TOKEN);
  }
  // Phase 110: Save Locale
  localStorage.setItem(LS_LOCALE, settings.locale || DEFAULT_LOCALE);
}

export function useDesktopSettings(version: number) {
  const [settings, setSettings] = useState<F0DesktopSettings>(() =>
    loadSettingsFromStorage()
  );

  // re-load when version changes
  useEffect(() => {
    setSettings(loadSettingsFromStorage());
  }, [version]);

  return settings;
}
