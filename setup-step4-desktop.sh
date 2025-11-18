#!/usr/bin/env bash
set -euo pipefail
cd /Users/abdo/Downloads/from-zero
mkdir -p apps/desktop && cd apps/desktop
pnpm init -y >/dev/null
pnpm add electron concurrently vite react react-dom @types/react @types/react-dom @f0/ui @f0/sdk
mkdir -p electron renderer/src
cat > electron/main.ts <<'TS'
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
function createWindow(){
  const win = new BrowserWindow({
    width: 1280, height: 800,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.loadURL(process.env.VITE_DESKTOP_URL || 'http://localhost:5173');
}
app.whenReady().then(()=>{
  createWindow();
  app.on('activate', ()=> BrowserWindow.getAllWindows().length===0 && createWindow());
});
app.on('window-all-closed', ()=> process.platform==='darwin' ? null : app.quit());
ipcMain.handle('f0:open-vscode', ()=> true);
TS
cat > electron/preload.ts <<'TS'
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('f0', { openVSCode: ()=> ipcRenderer.invoke('f0:open-vscode') });
TS
cat > renderer/index.html <<'HTML'
<!doctype html>
<html>
  <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>F0 Agent</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
HTML
cat > renderer/src/main.tsx <<'TSX'
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
createRoot(document.getElementById('root')!).render(<App />);
TSX
cat > renderer/src/App.tsx <<'TSX'
import { Sidebar } from '@f0/ui';
export default function App(){
  return (
    <div className="flex bg-[#0a0c14] text-white min-h-screen">
      <Sidebar/>
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold">F0 Agent</h1>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Queue</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Logs</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Status</div>
        </div>
      </main>
    </div>
  );
}
TSX
cat > vite.config.ts <<'TS'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], root: './renderer' });
TS
node - <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.scripts = {
  "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
  "build": "echo TODO: build electron app"
};
fs.writeFileSync('package.json', JSON.stringify(pkg,null,2));
NODE
echo "✅ Step 4 ready. Run: pnpm --filter desktop dev"
