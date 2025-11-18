// F0 Phase 35 - Cross-Device Sync Types

export type DeviceType = 'web' | 'desktop' | 'mobile';
export type DevicePlatform = 'mac' | 'win' | 'linux' | 'ios' | 'android' | 'web';
export type SessionStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type HandoffType = 'open-project' | 'open-session' | 'open-file';

export interface DeviceCapabilities {
  push: boolean;
  deeplink: boolean;
  clipboard: boolean;
  offline: boolean;
}

export interface DeviceStatus {
  online: boolean;
  lastSeen: number;
  heartbeat: number;
}

export interface Device {
  id: string;
  type: DeviceType;
  platform: DevicePlatform;
  fcmToken: string | null;
  capabilities: DeviceCapabilities;
  status: DeviceStatus;
  appVersion: string;
  createdAt: number;
  updatedAt: number;
}

export interface QueueItem {
  id: string;
  kind: string;
  payload: any;
  createdAt: number;
  retries?: number;
  error?: string;
}

export interface DeviceQueue {
  deviceId: string;
  pending: QueueItem[];
  processedCursor: string;
  updatedAt: number;
}

export interface ProjectState {
  projectId: string;
  dirty: boolean;
  cursor: string;
  lastActor: {
    uid: string;
    deviceId: string;
  };
  updatedAt: number;
}

export interface SessionData {
  id: string;
  projectId: string;
  status: SessionStatus;
  progress: number;
  startedAt: number;
  finishedAt: number | null;
  deviceId: string | null;
  userId: string;
  error?: string;
  result?: any;
}

export interface HandoffPayload {
  type: HandoffType;
  projectId?: string;
  jobId?: string;
  fileId?: string;
  metadata?: Record<string, any>;
}

export interface Handshake {
  id: string;
  fromDevice: string;
  toDevice: string;
  payload: HandoffPayload;
  createdAt: number;
  expiresAt: number;
  consumed?: boolean;
  consumedAt?: number;
}

export interface UserPresence {
  uid: string;
  online: boolean;
  lastSeen: number;
  devices: number;
  activeDevice?: string;
}

export interface ConflictInfo {
  has: boolean;
  reason?: string;
  resolvedAt?: number;
  resolution?: 'local' | 'remote' | 'merge';
}


