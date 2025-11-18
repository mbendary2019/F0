const { contextBridge, ipcRenderer } = require('electron');

// Base API
contextBridge.exposeInMainWorld('fromZero', { version: '0.1.0' });

// F0 Command Queue API
contextBridge.exposeInMainWorld('f0', {
  // إضافة مهمة جديدة
  addJob: (job) => ipcRenderer.invoke('f0:queue:add', job),

  // التحكم في الطابور
  pauseQueue: () => ipcRenderer.invoke('f0:queue:pause'),
  resumeQueue: () => ipcRenderer.invoke('f0:queue:resume'),
  cancelJob: () => ipcRenderer.invoke('f0:queue:cancel'),
  clearQueue: () => ipcRenderer.invoke('f0:queue:clear'),

  // الحصول على البيانات
  getStats: () => ipcRenderer.invoke('f0:queue:stats'),
  getHistory: (limit) => ipcRenderer.invoke('f0:queue:history', limit),
  getQueued: () => ipcRenderer.invoke('f0:queue:queued'),
  getCurrentJob: () => ipcRenderer.invoke('f0:queue:current'),

  // الاستماع للأحداث
  onLog: (callback) => {
    ipcRenderer.on('f0:logs:line', (_event, line) => callback(line));
  },

  onQueueUpdate: (callback) => {
    ipcRenderer.on('f0:queue:update', (_event, data) => callback(data));
  },

  onQueueStatus: (callback) => {
    ipcRenderer.on('f0:queue:status', (_event, status) => callback(status));
  },

  // إزالة المستمعين
  removeLogListener: () => {
    ipcRenderer.removeAllListeners('f0:logs:line');
  },

  removeQueueUpdateListener: () => {
    ipcRenderer.removeAllListeners('f0:queue:update');
  },

  removeQueueStatusListener: () => {
    ipcRenderer.removeAllListeners('f0:queue:status');
  }
});
