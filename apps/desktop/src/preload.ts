/**
 * F0 Desktop - Electron Preload Script
 * Exposes safe APIs to renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for window.f0
export interface F0API {
  execute: (cmd: string, args?: string[], cwd?: string) => Promise<any>;
  telemetry: () => Promise<any>;
  execSafe: (cmd: string) => Promise<any>;
  getAppInfo: () => Promise<any>;
}

// Expose F0 API to renderer
contextBridge.exposeInMainWorld('f0', {
  /**
   * Execute command via F0 orchestrator
   */
  execute: (cmd: string, args?: string[], cwd?: string) =>
    ipcRenderer.invoke('f0:execute', { cmd, args, cwd }),

  /**
   * Get telemetry stats
   */
  telemetry: () =>
    ipcRenderer.invoke('f0:telemetry'),

  /**
   * Execute safe local command (whitelist only)
   */
  execSafe: (cmd: string) =>
    ipcRenderer.invoke('local:execSafe', cmd),

  /**
   * Get app info
   */
  getAppInfo: () =>
    ipcRenderer.invoke('app:getInfo')
} as F0API);

// Type augmentation for TypeScript
declare global {
  interface Window {
    f0: F0API;
  }
}

console.log('✅ F0 Desktop - Preload Script Loaded');


