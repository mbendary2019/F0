/**
 * Phase 82: Unified Environment Management - Server Helper
 * Server-side environment resolution (runs in Node.js/API routes)
 */

import type { EnvMode, ResolvedEnv } from '@/types/env';

/**
 * Get environment mode from server environment variables
 * This runs on the server side (API routes, getServerSideProps, etc.)
 */
export function getServerEnvMode(): EnvMode {
  const mode = process.env.NEXT_PUBLIC_F0_ENV_MODE as EnvMode | undefined;

  if (mode === 'emulator' || mode === 'cloud' || mode === 'auto') {
    return mode;
  }

  // Default to auto mode
  return 'auto';
}

/**
 * Resolve effective environment based on mode
 * Server-side version - checks environment variables
 */
export function resolveServerEnv(mode?: EnvMode): ResolvedEnv {
  const envMode = mode || getServerEnvMode();

  // Default ports for Firebase emulators
  const FIRESTORE_EMULATOR_PORT = 8080;
  const AUTH_EMULATOR_PORT = 9099;
  const FUNCTIONS_EMULATOR_PORT = 5001;

  // Detect if we're running in localhost environment
  const isLocalhost =
    process.env.NODE_ENV === 'development' ||
    process.env.FIRESTORE_EMULATOR_HOST !== undefined;

  let effective: 'emulator' | 'cloud';

  if (envMode === 'emulator') {
    effective = 'emulator';
  } else if (envMode === 'cloud') {
    effective = 'cloud';
  } else {
    // Auto mode: use emulator if in development
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
export function logServerEnv(prefix = '[Server Env]'): void {
  const resolved = resolveServerEnv();

  console.log(`${prefix} Mode: ${resolved.mode} → Effective: ${resolved.effective}`);
  console.log(`${prefix} IsLocalhost: ${resolved.isLocalhost}`);
  console.log(`${prefix} Firestore: ${resolved.firestore.useEmulator ? `Emulator (${resolved.firestore.host}:${resolved.firestore.port})` : 'Cloud'}`);
  console.log(`${prefix} Auth: ${resolved.auth.useEmulator ? `Emulator (${resolved.auth.url})` : 'Cloud'}`);
  console.log(`${prefix} Functions: ${resolved.functions.useEmulator ? `Emulator (${resolved.functions.host}:${resolved.functions.port})` : 'Cloud'}`);
}
