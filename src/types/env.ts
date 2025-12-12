/**
 * Phase 73: Project Environment Variables
 */
export type EnvVarScope = "server" | "client" | "both";

export type ProjectEnvVar = {
  id: string;      // doc id
  key: string;
  value: string;
  scope: EnvVarScope;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Phase 82: Unified Environment Management
 * Types for Firebase environment mode configuration
 */

export type EnvMode = 'auto' | 'emulator' | 'cloud';

export interface ResolvedEnv {
  mode: EnvMode;
  effective: 'emulator' | 'cloud';
  isLocalhost: boolean;
  firestore: {
    useEmulator: boolean;
    host?: string;
    port?: number;
  };
  auth: {
    useEmulator: boolean;
    url?: string;
  };
  functions: {
    useEmulator: boolean;
    host?: string;
    port?: number;
  };
}
