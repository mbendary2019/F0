/**
 * F0 Desktop - Electron Main Process
 * Autonomous Ops Desktop Client
 */

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { F0SDK } from '@f0/sdk';
import { autoUpdater } from 'electron-updater';

const exec = promisify(execCb);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize F0 SDK
const f0sdk = new F0SDK({
  apiUrl: process.env.F0_API_URL || 'http://localhost:8080/api',
  projectId: process.env.FIREBASE_PROJECT_ID,
  apiKey: process.env.F0_API_KEY
});

let mainWindow: BrowserWindow | null = null;

// Configure auto-updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  console.log('[Auto-Update] Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('[Auto-Update] Update available:', info.version);
  mainWindow?.webContents.send('update:available', info);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[Auto-Update] No updates available');
});

autoUpdater.on('error', (err) => {
  console.error('[Auto-Update] Error:', err);
  mainWindow?.webContents.send('update:error', err.message);
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`[Auto-Update] Download progress: ${progress.percent.toFixed(2)}%`);
  mainWindow?.webContents.send('update:progress', progress);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[Auto-Update] Update downloaded:', info.version);
  mainWindow?.webContents.send('update:ready', info);
});

/**
 * Create main window
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'F0 Autonomous Ops',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    },
    backgroundColor: '#000000',
    show: false, // Show when ready
    titleBarStyle: 'default'
  });

  // Development: Load from Next.js dev server
  const devUrl = process.env.F0_WEB_URL ?? 'http://localhost:3000';
  const targetUrl = `${devUrl}/desktop`;

  try {
    await mainWindow.loadURL(targetUrl);
    console.log(`✅ Loaded: ${targetUrl}`);
  } catch (error) {
    console.error('❌ Failed to load URL:', error);
    // Fallback to error page
    mainWindow.loadURL(`data:text/html,<h1>Failed to connect to ${targetUrl}</h1>`);
  }

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * App lifecycle
 */
app.whenReady().then(async () => {
  await createWindow();

  // Check for updates (only in production)
  if (process.env.NODE_ENV === 'production' || process.env.CHECK_UPDATES === 'true') {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.error('[Auto-Update] Check failed:', err);
      });
    }, 3000); // Wait 3 seconds after app starts
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * IPC Handlers
 */

// F0: Execute command via orchestrator (Real SDK integration)
ipcMain.handle('f0:execute', async (_event, payload: { cmd: string; args?: string[]; cwd?: string }) => {
  console.log('[IPC] f0:execute', payload);

  try {
    const result = await f0sdk.execute(payload.cmd, payload.args || [], { cwd: payload.cwd });
    console.log('[IPC] f0:execute result:', result);
    return result;
  } catch (error) {
    console.error('[IPC] f0:execute error:', error);
    return {
      success: false,
      command: payload.cmd,
      args: payload.args || [],
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    };
  }
});

// F0: Get telemetry stats (Real SDK integration)
ipcMain.handle('f0:telemetry', async () => {
  console.log('[IPC] f0:telemetry');

  try {
    const stats = await f0sdk.getTelemetry();
    console.log('[IPC] f0:telemetry result:', stats);
    
    // Merge with Electron-specific stats
    return {
      ...stats,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node
    };
  } catch (error) {
    console.error('[IPC] f0:telemetry error:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Safe local execution (whitelist only)
const SAFE_COMMANDS = [
  'git --version',
  'node -v',
  'pnpm -v',
  'npm -v',
  'firebase --version'
];

ipcMain.handle('local:execSafe', async (_event, cmd: string) => {
  console.log('[IPC] local:execSafe', cmd);

  if (!SAFE_COMMANDS.includes(cmd)) {
    throw new Error(`Command not in whitelist: ${cmd}`);
  }

  try {
    const { stdout, stderr } = await exec(cmd);
    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Get app info
ipcMain.handle('app:getInfo', async () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron
  };
});

// Auto-update: Install and restart
ipcMain.handle('update:install', async () => {
  console.log('[Auto-Update] Installing update and restarting...');
  autoUpdater.quitAndInstall(false, true);
});

// Auto-update: Check manually
ipcMain.handle('update:check', async () => {
  console.log('[Auto-Update] Manual check requested');
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      success: true,
      updateInfo: result?.updateInfo
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

console.log('🚀 F0 Desktop - Electron Main Process Ready');

