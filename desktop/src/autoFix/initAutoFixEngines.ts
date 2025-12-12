// desktop/src/autoFix/initAutoFixEngines.ts
// Phase 143.1 – Auto-Fix Engines Initialization
// Call this once at app startup to register all engines

import { registerAutoFixEngine } from './autoFixOrchestrator';
import { registerDesktopIssueEngines } from './engines/desktopIssuesEngine';

let initialized = false;

/**
 * Initialize and register all Auto-Fix engines.
 * Should be called once at app startup (e.g., in App.tsx or main.tsx).
 * Safe to call multiple times - will only initialize once.
 */
export function initAutoFixEngines(): void {
  if (initialized) {
    console.log('[initAutoFixEngines] Already initialized, skipping');
    return;
  }

  console.log('[initAutoFixEngines] Initializing Auto-Fix engines...');

  // Register desktop issue engines (ts, eslint, generic)
  registerDesktopIssueEngines(registerAutoFixEngine);

  initialized = true;
  console.log('[initAutoFixEngines] Auto-Fix engines initialized');
}

/**
 * Check if engines have been initialized
 */
export function isAutoFixInitialized(): boolean {
  return initialized;
}
