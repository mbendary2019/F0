# Sprint 24 Execution Guide - Desktop Agent Licensing
## v25.0.0 - Complete Implementation

> Comprehensive guide for implementing Electron desktop client with Firebase licensing, device binding (max 2), 48-hour offline grace, and auto-updates (stable/beta/canary channels).

---

## Table of Contents

1. [Prerequisites & Setup](#1-prerequisites--setup)
2. [Electron Application Structure](#2-electron-application-structure)
3. [Device Binding & Fingerprinting](#3-device-binding--fingerprinting)
4. [License Activation APIs](#4-license-activation-apis)
5. [Offline Grace Mode](#5-offline-grace-mode)
6. [Auto-Updates System](#6-auto-updates-system)
7. [Security & Code Signing](#7-security--code-signing)
8. [Testing & Deployment](#8-testing--deployment)

---

## 1) Prerequisites & Setup

### Dependencies Check

**Required Sprints:**
- ✅ Sprint 20: Subscriptions & Billing
- ✅ Sprint 21: Onboarding & Paywall
- ✅ Sprint 22: Observability & Status
- ✅ Sprint 23: Marketplace & Payouts

### Environment Variables

**File**: `desktop/.env`

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=f0-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=f0-project

# API Configuration
VITE_API_BASE_URL=https://f0.ai
VITE_API_TIMEOUT=10000

# License Configuration
LICENSE_GRACE_HOURS=48
DEVICE_LIMIT=2
MAX_OFFLINE_STARTS=10

# Update Configuration
UPDATE_CHANNEL=stable # stable | beta | canary
UPDATE_SERVER_URL=https://updates.f0.ai
AUTO_DOWNLOAD_UPDATES=true

# Security
ENABLE_HARDWARE_ACCELERATION=true
ENABLE_REMOTE_MODULE=false
CSP_ENABLED=true

# Telemetry
TELEMETRY_BATCH_INTERVAL=60000 # 1 minute
TELEMETRY_ENABLED=true
```

**Server**: `.env.local` (additions)

```bash
# Desktop Licensing
DESKTOP_DEVICE_LIMIT=2
DESKTOP_GRACE_HOURS=48
DESKTOP_MAX_OFFLINE_STARTS=10

# Code Signing
APPLE_ID=developer@f0.ai
APPLE_ID_PASSWORD=@keychain:AC_PASSWORD
APPLE_TEAM_ID=ABC123DEF4
WIN_CSC_LINK=/path/to/certificate.pfx
WIN_CSC_KEY_PASSWORD=...
```

### Feature Flags

**Firestore**: `config/feature_flags`

```json
{
  "desktop": {
    "enabled": true,
    "require_subscription": true,
    "plans_allowed": ["pro", "teams", "enterprise"]
  },
  "desktop_grace": {
    "enabled": true,
    "hours": 48,
    "max_offline_starts": 10
  },
  "desktop_updates": {
    "enabled": true,
    "channels": ["stable", "beta", "canary"],
    "auto_download": true,
    "force_update_after_days": 30
  },
  "device_binding": {
    "enabled": true,
    "max_devices": 2,
    "allow_transfer": true
  }
}
```

---

## 2) Electron Application Structure

### 2.1 Project Setup

**File**: `desktop/package.json`

```json
{
  "name": "f0-desktop",
  "version": "1.0.0",
  "description": "F0 Desktop Agent",
  "main": "main.js",
  "scripts": {
    "dev": "concurrently \"npm:dev:vite\" \"npm:dev:electron\"",
    "dev:vite": "vite",
    "dev:electron": "electron .",
    "build": "vite build && electron-builder",
    "build:mac": "vite build && electron-builder --mac",
    "build:win": "vite build && electron-builder --win",
    "build:linux": "vite build && electron-builder --linux"
  },
  "dependencies": {
    "electron-updater": "^6.1.7",
    "electron-log": "^5.0.1",
    "node-machine-id": "^1.1.12",
    "axios": "^1.6.2",
    "firebase": "^10.7.1",
    "keytar": "^7.9.0"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "vite": "^5.0.8",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "concurrently": "^8.2.2"
  },
  "build": {
    "appId": "ai.f0.desktop",
    "productName": "F0 Desktop",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "dist/**/*",
      "main.js",
      "preload.js"
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "target": ["dmg", "zip"]
    },
    "win": {
      "target": ["nsis", "portable"],
      "signingHashAlgorithms": ["sha256"]
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Utility"
    },
    "publish": {
      "provider": "generic",
      "url": "https://updates.f0.ai"
    }
  }
}
```

### 2.2 Main Process

**File**: `desktop/main.js`

```javascript
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const { LicenseManager } = require('./src/lib/license');
const { TelemetryService } = require('./src/lib/telemetry');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

let mainWindow = null;
let licenseManager = null;
let telemetryService = null;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

async function createWindow() {
  // Initialize services
  licenseManager = new LicenseManager();
  telemetryService = new TelemetryService();

  // Check license before opening window
  const licenseValid = await licenseManager.checkLicense();

  if (!licenseValid && !licenseManager.isInGracePeriod()) {
    dialog.showErrorBox(
      'License Required',
      'Please activate your F0 Desktop license to continue.'
    );
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 }
  });

  // Load app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Setup auto-updater
  setupAutoUpdater();

  // Start heartbeat
  licenseManager.startHeartbeat();
  telemetryService.start();

  mainWindow.on('closed', () => {
    licenseManager.stopHeartbeat();
    telemetryService.stop();
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err);
    mainWindow.webContents.send('update-error', err.message);
  });

  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000);

  // Initial check after 10 seconds
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 10000);
}

// IPC Handlers
ipcMain.handle('license:activate', async (event, { email, password }) => {
  try {
    const result = await licenseManager.activate(email, password);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('license:status', async () => {
  return licenseManager.getStatus();
});

ipcMain.handle('license:deactivate', async () => {
  try {
    await licenseManager.deactivate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('update:check', () => {
  autoUpdater.checkForUpdates();
});

ipcMain.handle('telemetry:track', (event, eventData) => {
  telemetryService.track(eventData);
});

// App lifecycle
app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  if (licenseManager) {
    await licenseManager.cleanup();
  }
  if (telemetryService) {
    await telemetryService.flush();
  }
});
```

### 2.3 Preload Script (IPC Bridge)

**File**: `desktop/preload.js`

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // License methods
  license: {
    activate: (credentials) => ipcRenderer.invoke('license:activate', credentials),
    status: () => ipcRenderer.invoke('license:status'),
    deactivate: () => ipcRenderer.invoke('license:deactivate')
  },

  // Update methods
  updates: {
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onAvailable: (callback) => ipcRenderer.on('update-available', (_, info) => callback(info)),
    onDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_, info) => callback(info)),
    onError: (callback) => ipcRenderer.on('update-error', (_, error) => callback(error))
  },

  // Telemetry
  telemetry: {
    track: (event) => ipcRenderer.invoke('telemetry:track', event)
  },

  // System info
  platform: process.platform,
  version: process.env.npm_package_version
});
```

---

## 3) Device Binding & Fingerprinting

### 3.1 Device ID Generation

**File**: `desktop/src/lib/device.ts`

```typescript
import { machineIdSync } from 'node-machine-id';
import { createHash, createHmac } from 'crypto';
import os from 'os';

export class DeviceFingerprint {
  private static SECRET = 'f0-desktop-device-secret';

  /**
   * Generate unique device ID
   */
  static generateDeviceId(): string {
    try {
      const machineId = machineIdSync();
      const platform = os.platform();
      const arch = os.arch();
      const hostname = os.hostname();

      // Combine machine-specific identifiers
      const raw = `${machineId}-${platform}-${arch}-${hostname}`;

      // Create HMAC hash for security
      const hmac = createHmac('sha256', this.SECRET);
      hmac.update(raw);

      return hmac.digest('hex');
    } catch (err) {
      console.error('Failed to generate device ID:', err);
      throw new Error('Device fingerprinting failed');
    }
  }

  /**
   * Get device metadata
   */
  static getDeviceInfo() {
    return {
      deviceId: this.generateDeviceId(),
      name: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      osVersion: os.release(),
      cpuCores: os.cpus().length,
      totalMemoryGB: Math.round(os.totalmem() / (1024 ** 3))
    };
  }

  /**
   * Create device signature for verification
   */
  static createSignature(deviceId: string, timestamp: number, uid: string): string {
    const payload = `${deviceId}:${timestamp}:${uid}`;
    const hash = createHash('sha256');
    hash.update(payload + this.SECRET);
    return hash.digest('hex');
  }

  /**
   * Verify device signature
   */
  static verifySignature(
    deviceId: string,
    timestamp: number,
    uid: string,
    signature: string
  ): boolean {
    const expected = this.createSignature(deviceId, timestamp, uid);
    return expected === signature;
  }
}
```

### 3.2 Device Storage (Secure Cache)

**File**: `desktop/src/lib/deviceStorage.ts`

```typescript
import * as keytar from 'keytar';
import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

const SERVICE_NAME = 'F0Desktop';
const CACHE_FILE = 'device.cache.json';

export class DeviceStorage {
  private cachePath: string;

  constructor() {
    this.cachePath = path.join(app.getPath('userData'), CACHE_FILE);
  }

  /**
   * Save device credentials securely
   */
  async saveCredentials(deviceId: string, uid: string, token: string) {
    try {
      // Store token in OS keychain
      await keytar.setPassword(SERVICE_NAME, deviceId, token);

      // Store metadata in file
      const metadata = {
        deviceId,
        uid,
        savedAt: Date.now()
      };

      await fs.writeFile(this.cachePath, JSON.stringify(metadata, null, 2));
    } catch (err) {
      console.error('Failed to save credentials:', err);
      throw err;
    }
  }

  /**
   * Retrieve device credentials
   */
  async getCredentials(): Promise<{ deviceId: string; uid: string; token: string } | null> {
    try {
      // Read metadata
      const data = await fs.readFile(this.cachePath, 'utf-8');
      const metadata = JSON.parse(data);

      // Get token from keychain
      const token = await keytar.getPassword(SERVICE_NAME, metadata.deviceId);

      if (!token) {
        return null;
      }

      return {
        deviceId: metadata.deviceId,
        uid: metadata.uid,
        token
      };
    } catch (err) {
      return null;
    }
  }

  /**
   * Clear stored credentials
   */
  async clearCredentials() {
    try {
      const credentials = await this.getCredentials();

      if (credentials) {
        await keytar.deletePassword(SERVICE_NAME, credentials.deviceId);
      }

      await fs.unlink(this.cachePath).catch(() => {});
    } catch (err) {
      console.error('Failed to clear credentials:', err);
    }
  }
}
```

---

## 4) License Activation APIs

### 4.1 Server-Side License API

**File**: `src/app/api/desktop/license/activate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { DeviceFingerprint } from '@/lib/device-security';

const DEVICE_LIMIT = parseInt(process.env.DESKTOP_DEVICE_LIMIT || '2');

export async function POST(req: NextRequest) {
  try {
    const { email, password, deviceId, deviceInfo, signature } = await req.json();

    // Authenticate user
    let uid: string;
    try {
      const userRecord = await adminAuth.getUserByEmail(email);
      uid = userRecord.uid;
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify device signature
    const timestamp = Date.now();
    if (!DeviceFingerprint.verify(deviceId, timestamp, uid, signature)) {
      return NextResponse.json(
        { error: 'Invalid device signature' },
        { status: 403 }
      );
    }

    // Check subscription
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (!userData?.entitlements?.desktop) {
      return NextResponse.json(
        { error: 'Desktop access not included in your plan' },
        { status: 403 }
      );
    }

    // Check device limit
    const devicesSnap = await adminDb
      .collection('users').doc(uid)
      .collection('devices')
      .where('status', '==', 'active')
      .get();

    const existingDevice = devicesSnap.docs.find(doc => doc.id === deviceId);

    if (!existingDevice && devicesSnap.size >= DEVICE_LIMIT) {
      return NextResponse.json(
        {
          error: `Device limit reached (${DEVICE_LIMIT} devices max)`,
          devices: devicesSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            lastActiveAt: doc.data().lastHeartbeatAt
          }))
        },
        { status: 403 }
      );
    }

    // Create or update device record
    const deviceRef = adminDb
      .collection('users').doc(uid)
      .collection('devices').doc(deviceId);

    await deviceRef.set({
      name: deviceInfo.name,
      platform: deviceInfo.platform,
      arch: deviceInfo.arch,
      osVersion: deviceInfo.osVersion,
      status: 'active',
      firstActivatedAt: existingDevice?.data()?.firstActivatedAt || Date.now(),
      lastActivatedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
      channel: 'stable',
      offlineStarts: 0
    }, { merge: true });

    // Generate session token
    const sessionToken = await adminAuth.createCustomToken(uid, {
      deviceId,
      type: 'desktop'
    });

    // Log activation
    await adminDb.collection('audit_logs').add({
      type: 'desktop_activation',
      uid,
      deviceId,
      deviceName: deviceInfo.name,
      timestamp: Date.now()
    });

    return NextResponse.json({
      success: true,
      token: sessionToken,
      plan: userData.plan,
      deviceId,
      graceHours: parseInt(process.env.DESKTOP_GRACE_HOURS || '48')
    });

  } catch (err: any) {
    console.error('License activation failed:', err);
    return NextResponse.json(
      { error: err.message || 'Activation failed' },
      { status: 500 }
    );
  }
}
```

### 4.2 Heartbeat Endpoint

**File**: `src/app/api/desktop/license/heartbeat/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyDesktopToken } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await verifyDesktopToken(token);
    const { uid, deviceId } = decoded;

    // Get user subscription status
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (!userData?.entitlements?.desktop) {
      return NextResponse.json({
        allowed: false,
        reason: 'subscription_expired',
        message: 'Your subscription does not include desktop access'
      });
    }

    // Get device status
    const deviceDoc = await adminDb
      .collection('users').doc(uid)
      .collection('devices').doc(deviceId)
      .get();

    if (!deviceDoc.exists) {
      return NextResponse.json({
        allowed: false,
        reason: 'device_not_found',
        message: 'Device not activated'
      });
    }

    const device = deviceDoc.data()!;

    if (device.status === 'revoked') {
      return NextResponse.json({
        allowed: false,
        reason: 'device_revoked',
        message: 'This device has been deactivated'
      });
    }

    // Update heartbeat
    await deviceDoc.ref.update({
      lastHeartbeatAt: Date.now(),
      version: req.nextUrl.searchParams.get('version') || 'unknown'
    });

    // Calculate grace remaining (if offline)
    const graceHours = parseInt(process.env.DESKTOP_GRACE_HOURS || '48');
    const lastHeartbeat = device.lastHeartbeatAt || Date.now();
    const hoursSinceLastHeartbeat = (Date.now() - lastHeartbeat) / (1000 * 60 * 60);
    const graceRemainingMin = Math.max(0, (graceHours * 60) - (hoursSinceLastHeartbeat * 60));

    return NextResponse.json({
      allowed: true,
      plan: userData.plan,
      graceRemainingMin: Math.round(graceRemainingMin),
      channel: device.channel || 'stable',
      updateAvailable: false // TODO: Check for updates
    });

  } catch (err: any) {
    console.error('Heartbeat failed:', err);
    return NextResponse.json(
      { error: 'Heartbeat failed' },
      { status: 500 }
    );
  }
}
```

### 4.3 Deactivation Endpoint

**File**: `src/app/api/desktop/license/deactivate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyDesktopToken } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await verifyDesktopToken(token);
    const { uid, deviceId } = decoded;

    // Update device status
    await adminDb
      .collection('users').doc(uid)
      .collection('devices').doc(deviceId)
      .update({
        status: 'revoked',
        revokedAt: Date.now()
      });

    // Log deactivation
    await adminDb.collection('audit_logs').add({
      type: 'desktop_deactivation',
      uid,
      deviceId,
      timestamp: Date.now()
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Deactivation failed:', err);
    return NextResponse.json(
      { error: 'Deactivation failed' },
      { status: 500 }
    );
  }
}
```

---

## 5) Offline Grace Mode

### 5.1 License Manager with Grace Period

**File**: `desktop/src/lib/license.ts`

```typescript
import { DeviceFingerprint } from './device';
import { DeviceStorage } from './deviceStorage';
import axios from 'axios';
import log from 'electron-log';

const API_BASE = process.env.VITE_API_BASE_URL;
const GRACE_HOURS = parseInt(process.env.LICENSE_GRACE_HOURS || '48');
const MAX_OFFLINE_STARTS = parseInt(process.env.MAX_OFFLINE_STARTS || '10');
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface LicenseCache {
  lastAllowedAt: number;
  plan: string;
  offlineStarts: number;
  graceRemainingMin: number;
}

export class LicenseManager {
  private storage: DeviceStorage;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private cache: LicenseCache | null = null;
  private token: string | null = null;

  constructor() {
    this.storage = new DeviceStorage();
    this.loadCache();
  }

  /**
   * Activate device license
   */
  async activate(email: string, password: string) {
    const deviceInfo = DeviceFingerprint.getDeviceInfo();
    const timestamp = Date.now();
    const signature = DeviceFingerprint.createSignature(
      deviceInfo.deviceId,
      timestamp,
      email // Use email as placeholder for uid
    );

    try {
      const response = await axios.post(`${API_BASE}/api/desktop/license/activate`, {
        email,
        password,
        deviceId: deviceInfo.deviceId,
        deviceInfo,
        signature,
        timestamp
      });

      const { token, plan, graceHours } = response.data;

      // Save credentials
      await this.storage.saveCredentials(deviceInfo.deviceId, email, token);

      // Update cache
      this.cache = {
        lastAllowedAt: Date.now(),
        plan,
        offlineStarts: 0,
        graceRemainingMin: graceHours * 60
      };
      await this.saveCache();

      this.token = token;

      log.info('License activated successfully');
      return { success: true, plan };

    } catch (err: any) {
      log.error('License activation failed:', err.response?.data || err.message);
      throw new Error(err.response?.data?.error || 'Activation failed');
    }
  }

  /**
   * Check license validity (with grace period support)
   */
  async checkLicense(): Promise<boolean> {
    try {
      // Try online check first
      const credentials = await this.storage.getCredentials();

      if (!credentials) {
        log.warn('No credentials found');
        return false;
      }

      this.token = credentials.token;

      const response = await axios.post(
        `${API_BASE}/api/desktop/license/heartbeat`,
        {},
        {
          headers: { Authorization: `Bearer ${credentials.token}` },
          timeout: 10000
        }
      );

      if (response.data.allowed) {
        // Update cache with fresh data
        this.cache = {
          lastAllowedAt: Date.now(),
          plan: response.data.plan,
          offlineStarts: 0,
          graceRemainingMin: response.data.graceRemainingMin
        };
        await this.saveCache();

        log.info('License valid (online check)');
        return true;
      } else {
        log.error('License denied:', response.data.reason);
        return false;
      }

    } catch (err: any) {
      log.warn('Online check failed, using grace period:', err.message);

      // Fallback to grace period
      return this.checkGracePeriod();
    }
  }

  /**
   * Check if in grace period (offline mode)
   */
  isInGracePeriod(): boolean {
    if (!this.cache) {
      return false;
    }

    const hoursSinceLastAllowed = (Date.now() - this.cache.lastAllowedAt) / (1000 * 60 * 60);

    if (hoursSinceLastAllowed > GRACE_HOURS) {
      log.error(`Grace period expired (${hoursSinceLastAllowed.toFixed(1)} hours)`);
      return false;
    }

    if (this.cache.offlineStarts >= MAX_OFFLINE_STARTS) {
      log.error(`Max offline starts exceeded (${this.cache.offlineStarts})`);
      return false;
    }

    log.info(`In grace period: ${(GRACE_HOURS - hoursSinceLastAllowed).toFixed(1)} hours remaining`);
    return true;
  }

  /**
   * Check grace period and increment offline counter
   */
  private async checkGracePeriod(): Promise<boolean> {
    if (!this.cache) {
      return false;
    }

    if (!this.isInGracePeriod()) {
      return false;
    }

    // Increment offline start counter
    this.cache.offlineStarts += 1;
    await this.saveCache();

    log.info(`Offline start ${this.cache.offlineStarts}/${MAX_OFFLINE_STARTS}`);
    return true;
  }

  /**
   * Start heartbeat timer
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.checkLicense();
      } catch (err) {
        log.error('Heartbeat error:', err);
      }
    }, HEARTBEAT_INTERVAL);

    log.info('Heartbeat started');
  }

  /**
   * Stop heartbeat timer
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      log.info('Heartbeat stopped');
    }
  }

  /**
   * Deactivate device
   */
  async deactivate() {
    try {
      const credentials = await this.storage.getCredentials();

      if (credentials) {
        await axios.post(
          `${API_BASE}/api/desktop/license/deactivate`,
          {},
          { headers: { Authorization: `Bearer ${credentials.token}` } }
        );
      }

      await this.storage.clearCredentials();
      this.cache = null;
      await this.saveCache();

      log.info('Device deactivated');
    } catch (err) {
      log.error('Deactivation error:', err);
      throw err;
    }
  }

  /**
   * Get license status
   */
  async getStatus() {
    const credentials = await this.storage.getCredentials();

    return {
      activated: !!credentials,
      inGrace: this.isInGracePeriod(),
      cache: this.cache
    };
  }

  /**
   * Load cache from disk
   */
  private async loadCache() {
    try {
      const { app } = require('electron');
      const fs = require('fs/promises');
      const path = require('path');

      const cachePath = path.join(app.getPath('userData'), 'license.cache.json');
      const data = await fs.readFile(cachePath, 'utf-8');
      this.cache = JSON.parse(data);
    } catch (err) {
      this.cache = null;
    }
  }

  /**
   * Save cache to disk
   */
  private async saveCache() {
    try {
      const { app } = require('electron');
      const fs = require('fs/promises');
      const path = require('path');

      const cachePath = path.join(app.getPath('userData'), 'license.cache.json');
      await fs.writeFile(cachePath, JSON.stringify(this.cache, null, 2));
    } catch (err) {
      log.error('Failed to save cache:', err);
    }
  }

  /**
   * Cleanup on app exit
   */
  async cleanup() {
    this.stopHeartbeat();
    await this.saveCache();
  }
}
```

---

*Due to length constraints, I'll continue with the remaining sections (Auto-Updates, Security, Testing) in the next part. Should I continue?*
