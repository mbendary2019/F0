// F0 Phase 35 - Presence Client

import type { DeviceCapabilities } from './types';

export interface HeartbeatPayload {
  deviceId: string;
  appVersion: string;
  capabilities: DeviceCapabilities;
}

/**
 * Send heartbeat to update device presence
 */
export async function sendHeartbeat(
  callable: (name: string, data: any) => Promise<any>,
  payload: HeartbeatPayload
): Promise<{ ok: boolean }> {
  try {
    const result = await callable('heartbeat', payload);
    return result.data || { ok: true };
  } catch (error) {
    console.error('Heartbeat failed:', error);
    return { ok: false };
  }
}

/**
 * Register FCM token for push notifications
 */
export async function registerFCMToken(
  callable: (name: string, data: any) => Promise<any>,
  deviceId: string,
  fcmToken: string
): Promise<{ ok: boolean }> {
  try {
    const result = await callable('registerToken', { deviceId, fcmToken });
    return result.data || { ok: true };
  } catch (error) {
    console.error('FCM token registration failed:', error);
    return { ok: false };
  }
}

/**
 * Create a heartbeat manager
 */
export class HeartbeatManager {
  private interval: NodeJS.Timeout | null = null;
  private callable: (name: string, data: any) => Promise<any>;
  private payload: HeartbeatPayload;
  private intervalMs: number;

  constructor(
    callable: (name: string, data: any) => Promise<any>,
    payload: HeartbeatPayload,
    intervalMs: number = 30000 // 30 seconds default
  ) {
    this.callable = callable;
    this.payload = payload;
    this.intervalMs = intervalMs;
  }

  start() {
    if (this.interval) {
      console.warn('Heartbeat already running');
      return;
    }

    // Send immediately
    sendHeartbeat(this.callable, this.payload);

    // Then set interval
    this.interval = setInterval(() => {
      sendHeartbeat(this.callable, this.payload);
    }, this.intervalMs);

    console.log(`Heartbeat started (interval: ${this.intervalMs}ms)`);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('Heartbeat stopped');
    }
  }

  updatePayload(payload: Partial<HeartbeatPayload>) {
    this.payload = { ...this.payload, ...payload };
  }
}

/**
 * Get device capabilities based on platform
 */
export function getDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    // Node.js / Electron main process
    return {
      push: true,
      deeplink: true,
      clipboard: true,
      offline: true,
    };
  }

  // Browser / Electron renderer
  const isElectron = !!(window as any).electron || !!(window as any).f0;
  const isPWA = window.matchMedia('(display-mode: standalone)').matches;

  return {
    push: 'Notification' in window && Notification.permission === 'granted',
    deeplink: isElectron || isPWA,
    clipboard: !!navigator.clipboard,
    offline: 'serviceWorker' in navigator,
  };
}

/**
 * Generate a unique device ID
 */
export function generateDeviceId(): string {
  // Try to get existing ID from storage
  if (typeof localStorage !== 'undefined') {
    const existing = localStorage.getItem('f0_device_id');
    if (existing) return existing;

    // Generate new ID
    const deviceId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('f0_device_id', deviceId);
    return deviceId;
  }

  // Fallback for environments without localStorage
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}


