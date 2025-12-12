/**
 * Phase 82: Unified Environment Management - Client Resolver
 * Client-side environment resolution (runs in browser)
 */

import type { EnvMode, ResolvedEnv } from '@/types/env';

const ENV_MODE_STORAGE_KEY = 'f0_env_mode';

/**
 * Get environment mode from localStorage or environment variable
 * This runs on the client side (browser)
 */
export function getClientEnvMode(): EnvMode {
  // Check if we're in browser environment
  if (typeof window === 'undefined') {
    return 'auto';
  }

  // Try to get mode from localStorage first (user preference)
  try {
    const stored = localStorage.getItem(ENV_MODE_STORAGE_KEY);
    if (stored === 'emulator' || stored === 'cloud' || stored === 'auto') {
      return stored;
    }
  } catch (e) {
    // localStorage might not be available
    console.warn('[Client Env] Failed to read from localStorage:', e);
  }

  // Fallback to environment variable
  const envMode = process.env.NEXT_PUBLIC_F0_ENV_MODE as EnvMode | undefined;
  if (envMode === 'emulator' || envMode === 'cloud' || envMode === 'auto') {
    return envMode;
  }

  // Default to auto mode
  return 'auto';
}

/**
 * Set environment mode in localStorage
 */
export function setClientEnvMode(mode: EnvMode): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(ENV_MODE_STORAGE_KEY, mode);
    console.log(`[Client Env] Mode set to: ${mode}`);
  } catch (e) {
    console.warn('[Client Env] Failed to save to localStorage:', e);
  }
}

/**
 * Resolve effective environment based on mode
 * Client-side version - checks window.location.hostname
 */
export function resolveClientEnv(mode?: EnvMode): ResolvedEnv {
  const envMode = mode || getClientEnvMode();

  // Default ports for Firebase emulators
  const FIRESTORE_EMULATOR_PORT = 8080;
  const AUTH_EMULATOR_PORT = 9099;
  const FUNCTIONS_EMULATOR_PORT = 5001;

  // Detect if we're running on localhost
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.'));

  let effective: 'emulator' | 'cloud';

  if (envMode === 'emulator') {
    effective = 'emulator';
  } else if (envMode === 'cloud') {
    effective = 'cloud';
  } else {
    // Auto mode: use emulator if on localhost
    effective = isLocalhost ? 'emulator' : 'cloud';
  }

  const useEmulator = effective === 'emulator';

  return {
    mode: envMode,
    effective,
    isLocalhost,
    firestore: {
      useEmulator,
      host: useEmulator ? 'localhost' : undefined,
      port: useEmulator ? FIRESTORE_EMULATOR_PORT : undefined,
    },
    auth: {
      useEmulator,
      url: useEmulator ? `http://localhost:${AUTH_EMULATOR_PORT}` : undefined,
    },
    functions: {
      useEmulator,
      host: useEmulator ? 'localhost' : undefined,
      port: useEmulator ? FUNCTIONS_EMULATOR_PORT : undefined,
    },
  };
}

/**
 * Log environment resolution for debugging
 */
export function logClientEnv(prefix = '[Client Env]'): void {
  const resolved = resolveClientEnv();

  console.log(`${prefix} Mode: ${resolved.mode} → Effective: ${resolved.effective}`);
  console.log(`${prefix} IsLocalhost: ${resolved.isLocalhost}`);
  console.log(`${prefix} Firestore: ${resolved.firestore.useEmulator ? `Emulator (${resolved.firestore.host}:${resolved.firestore.port})` : 'Cloud'}`);
  console.log(`${prefix} Auth: ${resolved.auth.useEmulator ? `Emulator (${resolved.auth.url})` : 'Cloud'}`);
  console.log(`${prefix} Functions: ${resolved.functions.useEmulator ? `Emulator (${resolved.functions.host}:${resolved.functions.port})` : 'Cloud'}`);
}

/**
 * Clear environment mode from localStorage
 */
export function clearClientEnvMode(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(ENV_MODE_STORAGE_KEY);
    console.log('[Client Env] Mode cleared from localStorage');
  } catch (e) {
    console.warn('[Client Env] Failed to clear localStorage:', e);
  }
}
