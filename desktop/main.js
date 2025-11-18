// تحميل متغيرات البيئة مبكرًا
require('dotenv').config();

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const kill = require('tree-kill');

let orcProc;
let win = null;
let commandQueue = null;

function startOrchestrator() {
  const orcDir = path.join(__dirname, '..', 'orchestrator');
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['tsx','watch','src/index.ts'];
  orcProc = spawn(cmd, args, { cwd: orcDir, env: { ...process.env, PORT: '8080' } });
  orcProc.stdout.on('data', d => console.log('[orc]', d.toString().trim()));
  orcProc.stderr.on('data', d => console.error('[orc]', d.toString().trim()));
  orcProc.on('exit', code => console.log('[orc] exited', code));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.loadURL('http://localhost:8080/');
}

// تهيئة Command Queue
async function initCommandQueue() {
  try {
    const { CommandQueue } = require(path.join(__dirname, '..', 'orchestrator', 'src', 'commandQueue.ts'));
    commandQueue = new CommandQueue();

    // ربط الأحداث بالواجهة
    commandQueue.on('log', (job, line) => {
      win?.webContents.send('f0:logs:line', line);
    });

    commandQueue.on('enqueue', (job) => {
      win?.webContents.send('f0:queue:update', {
        type: 'enqueue',
        job,
        stats: commandQueue.getStats()
      });
    });

    commandQueue.on('start', (job) => {
      win?.webContents.send('f0:queue:update', {
        type: 'start',
        job,
        stats: commandQueue.getStats()
      });
    });

    commandQueue.on('done', (job) => {
      win?.webContents.send('f0:queue:update', {
        type: 'done',
        job,
        stats: commandQueue.getStats()
      });
    });

    commandQueue.on('error', (job, error) => {
      win?.webContents.send('f0:queue:update', {
        type: 'error',
        job,
        error: error.message,
        stats: commandQueue.getStats()
      });
    });

    commandQueue.on('paused', () => {
      win?.webContents.send('f0:queue:status', { active: false });
    });

    commandQueue.on('resumed', () => {
      win?.webContents.send('f0:queue:status', { active: true });
    });

    console.log('[main] Command Queue initialized');
  } catch (error) {
    console.error('[main] Failed to init queue:', error);
  }
}

// IPC Handlers للـ Queue
function setupQueueHandlers() {
  // إضافة مهمة جديدة
  ipcMain.handle('f0:queue:add', async (_event, job) => {
    try {
      if (!commandQueue) {
        throw new Error('Queue not initialized');
      }
      const newJob = commandQueue.enqueue(job);
      return { ok: true, job: newJob };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // إيقاف مؤقت
  ipcMain.handle('f0:queue:pause', async () => {
    try {
      commandQueue?.pause();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // استئناف
  ipcMain.handle('f0:queue:resume', async () => {
    try {
      commandQueue?.resume();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // إلغاء المهمة الحالية
  ipcMain.handle('f0:queue:cancel', async () => {
    try {
      commandQueue?.cancel();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // مسح الطابور
  ipcMain.handle('f0:queue:clear', async () => {
    try {
      commandQueue?.clear();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // الحصول على الإحصائيات
  ipcMain.handle('f0:queue:stats', async () => {
    try {
      const stats = commandQueue?.getStats() || {};
      return { ok: true, stats };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // الحصول على التاريخ
  ipcMain.handle('f0:queue:history', async (_event, limit) => {
    try {
      const history = commandQueue?.getHistory(limit) || [];
      return { ok: true, history };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // الحصول على المهام المنتظرة
  ipcMain.handle('f0:queue:queued', async () => {
    try {
      const queued = commandQueue?.getQueuedJobs() || [];
      return { ok: true, queued };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // المهمة الحالية
  ipcMain.handle('f0:queue:current', async () => {
    try {
      const current = commandQueue?.getCurrentJob();
      return { ok: true, current };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  console.log('[main] Queue IPC handlers registered');
}

app.whenReady().then(async () => {
  try {
    startOrchestrator();
    createWindow();
    setupQueueHandlers();
    await initCommandQueue();
  } catch (e) {
    dialog.showErrorBox('Startup Error', String(e.message || e));
  }
});

app.on('window-all-closed', () => {
  if (orcProc?.pid) kill(orcProc.pid);
  if (process.platform !== 'darwin') app.quit();
});
