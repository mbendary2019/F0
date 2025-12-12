# Phase 109.1 - Complete Desktop IDE Code

**Status**: Ready to implement
**All code below** should be created in the `desktop/` folder

---

## ⚠️ Important: Backup First

The existing `desktop/` folder will be replaced. If needed, backup:
```bash
cd /Users/abdo/Desktop/from-zero-working
mv desktop desktop-old-backup
mkdir desktop
```

---

## 📦 Step 1: package.json

Create: `desktop/package.json`

```json
{
  "name": "f0-desktop-ide",
  "version": "0.1.0",
  "description": "F0 Desktop IDE - AI-powered code editor",
  "private": true,
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "build": "tsc && vite build && tsc -p electron.tsconfig.json",
    "electron": "electron .",
    "postinstall": "electron-builder install-app-deps"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "concurrently": "^9.0.0",
    "electron": "^30.0.0",
    "electron-builder": "^25.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "wait-on": "^8.0.0"
  }
}
```

---

## 🔧 Step 2: TypeScript Configs

### 2a. Main tsconfig.json (for renderer)

Create: `desktop/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### 2b. Electron tsconfig

Create: `desktop/electron.tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist-electron",
    "rootDir": "./electron",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["electron/**/*"]
}
```

---

## ⚡ Step 3: Vite Config

Create: `desktop/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'src'),
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
```

---

## 🖥️ Step 4: Electron Files

### 4a. Main Process

Create: `desktop/electron/main.ts`

```typescript
import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'F0 Desktop IDE',
    backgroundColor: '#050816',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  createWindow();
});

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
```

### 4b. Preload Script

Create: `desktop/electron/preload.ts`

```typescript
import { contextBridge } from 'electron';

// Phase 109.1: Placeholder for future IPC APIs
// Phase 109.4 will add: openFolder, readFile, writeFile, etc.

contextBridge.exposeInMainWorld('f0Desktop', {
  version: '0.1.0',
  platform: process.platform,
});

declare global {
  interface Window {
    f0Desktop: {
      version: string;
      platform: string;
    };
  }
}
```

---

## ⚛️ Step 5: React Renderer

### 5a. HTML Entry

Create: `desktop/src/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>F0 Desktop IDE</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

### 5b. React Entry

Create: `desktop/src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 5c. Main App Component

Create: `desktop/src/App.tsx`

```typescript
import React from 'react';
import { FileTreePane } from './components/FileTreePane';
import { CodeEditorPane } from './components/CodeEditorPane';
import { AgentPanelPane } from './components/AgentPanelPane';

export const App: React.FC = () => {
  return (
    <div className="f0-root">
      <header className="f0-header">
        <div className="f0-logo">F0 Desktop IDE</div>
        <div className="f0-header-actions">
          <button className="f0-btn">Open Folder</button>
          <button className="f0-btn f0-btn-secondary">Settings</button>
        </div>
      </header>

      <div className="f0-main-layout">
        <aside className="f0-pane f0-pane-left">
          <FileTreePane />
        </aside>

        <main className="f0-pane f0-pane-center">
          <CodeEditorPane />
        </main>

        <aside className="f0-pane f0-pane-right">
          <AgentPanelPane />
        </aside>
      </div>
    </div>
  );
};
```

---

## 🧩 Step 6: UI Components

### 6a. File Tree Pane

Create: `desktop/src/components/FileTreePane.tsx`

```typescript
import React from 'react';

export const FileTreePane: React.FC = () => {
  return (
    <div className="f0-pane-content">
      <h2 className="f0-pane-title">Files</h2>
      <div className="f0-pane-body">
        <p className="f0-muted">No folder opened yet.</p>
        <p className="f0-muted">Use "Open Folder" to load a project.</p>
      </div>
    </div>
  );
};
```

### 6b. Code Editor Pane

Create: `desktop/src/components/CodeEditorPane.tsx`

```typescript
import React from 'react';

export const CodeEditorPane: React.FC = () => {
  return (
    <div className="f0-pane-content">
      <h2 className="f0-pane-title">Editor</h2>
      <div className="f0-editor-placeholder">
        <p className="f0-muted">
          No file selected. Choose a file from the left to start editing.
        </p>
      </div>
    </div>
  );
};
```

### 6c. Agent Panel Pane

Create: `desktop/src/components/AgentPanelPane.tsx`

```typescript
import React from 'react';

export const AgentPanelPane: React.FC = () => {
  return (
    <div className="f0-pane-content f0-agent-pane">
      <h2 className="f0-pane-title">F0 Code Agent</h2>

      <div className="f0-agent-messages">
        <div className="f0-agent-message f0-agent-message-system">
          <div className="f0-agent-label">System</div>
          <div className="f0-agent-text">
            Welcome to F0 Desktop IDE. Connect settings in Phase 109.2 to start chatting.
          </div>
        </div>
      </div>

      <div className="f0-agent-input">
        <textarea
          className="f0-textarea"
          placeholder="Ask F0 to generate or refactor code..."
          rows={3}
          disabled
        />
        <div className="f0-agent-input-actions">
          <button className="f0-btn f0-btn-primary" disabled>
            Send (Coming in 109.2)
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 🎨 Step 7: Styles

Create: `desktop/src/styles.css`

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
  background: #050816;
  color: #e5e7eb;
  overflow: hidden;
}

.f0-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.f0-header {
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid #1f2937;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: radial-gradient(circle at top left, rgba(124, 58, 237, 0.15), #020617);
  flex-shrink: 0;
}

.f0-logo {
  font-weight: 600;
  letter-spacing: 0.04em;
  font-size: 14px;
  color: #e5e7eb;
}

.f0-header-actions {
  display: flex;
  gap: 8px;
}

.f0-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #4b5563;
  background: #111827;
  color: #e5e7eb;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.f0-btn:hover:not(:disabled) {
  background: #1f2937;
  border-color: #6b7280;
}

.f0-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.f0-btn-secondary {
  opacity: 0.8;
}

.f0-btn-primary {
  background: #7c3aed;
  border-color: #7c3aed;
}

.f0-btn-primary:hover:not(:disabled) {
  background: #8b5cf6;
  border-color: #8b5cf6;
}

.f0-main-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 340px;
  min-height: 0;
  overflow: hidden;
}

.f0-pane {
  border-right: 1px solid #111827;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #020617;
  overflow: hidden;
}

.f0-pane-right {
  border-right: none;
  border-left: 1px solid #111827;
}

.f0-pane-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.f0-pane-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #9ca3af;
  margin: 0 0 10px;
  font-weight: 600;
}

.f0-pane-body {
  flex: 1;
  border-radius: 8px;
  border: 1px dashed #1f2937;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  min-height: 0;
  overflow: auto;
}

.f0-editor-placeholder {
  flex: 1;
  border-radius: 8px;
  border: 1px solid #111827;
  background: #0a0f1e;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  min-height: 0;
}

.f0-muted {
  color: #6b7280;
  font-size: 13px;
  text-align: center;
  line-height: 1.6;
}

.f0-agent-pane {
  gap: 10px;
}

.f0-agent-messages {
  flex: 1;
  border-radius: 8px;
  border: 1px solid #111827;
  background: #0a0f1e;
  padding: 10px;
  overflow-y: auto;
  min-height: 0;
}

.f0-agent-message {
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.f0-agent-message-system {
  background: #111827;
  border: 1px solid #1f2937;
}

.f0-agent-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #9ca3af;
  margin-bottom: 4px;
  font-weight: 600;
}

.f0-agent-text {
  color: #e5e7eb;
}

.f0-agent-input {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.f0-textarea {
  width: 100%;
  resize: vertical;
  min-height: 70px;
  border-radius: 8px;
  border: 1px solid #1f2937;
  background: #0a0f1e;
  color: #e5e7eb;
  font-size: 13px;
  padding: 8px 10px;
  font-family: inherit;
  line-height: 1.5;
}

.f0-textarea:focus {
  outline: none;
  border-color: #7c3aed;
  background: #0d1220;
}

.f0-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.f0-agent-input-actions {
  display: flex;
  justify-content: flex-end;
}
```

---

## 📝 Step 8: .gitignore

Create: `desktop/.gitignore`

```
node_modules
dist
dist-electron
*.log
.DS_Store
```

---

## 🚀 Installation & Running

### Install Dependencies

```bash
cd desktop
pnpm install
```

### Run Development Server

```bash
pnpm dev
```

**Expected Result**:
1. Vite dev server starts on http://localhost:5173
2. Electron window opens
3. Shows F0 Desktop IDE with 3 panes
4. DevTools open automatically

### Verify Phase 109.1 Success ✅

You should see:
- **Header**: "F0 Desktop IDE" with "Open Folder" and "Settings" buttons
- **Left Pane**: "FILES" - shows placeholder message
- **Center Pane**: "EDITOR" - shows placeholder message
- **Right Pane**: "F0 CODE AGENT" - shows welcome message and disabled Send button
- **Dark neon theme** with purple accents

---

## 📊 File Structure Summary

```
desktop/
├── package.json
├── tsconfig.json
├── electron.tsconfig.json
├── vite.config.ts
├── .gitignore
├── electron/
│   ├── main.ts
│   └── preload.ts
└── src/
    ├── index.html
    ├── main.tsx
    ├── App.tsx
    ├── styles.css
    └── components/
        ├── FileTreePane.tsx
        ├── CodeEditorPane.tsx
        └── AgentPanelPane.tsx
```

**Total Files**: 13 files

---

## ✅ Checklist

- [ ] Create all 13 files listed above
- [ ] Run `pnpm install` in `desktop/` folder
- [ ] Run `pnpm dev`
- [ ] Verify Electron window opens
- [ ] Verify 3-pane layout displays correctly
- [ ] Verify dark theme with neon purple accents
- [ ] Verify DevTools open
- [ ] Verify no console errors

If all checkboxes pass → **Phase 109.1 Complete!** ✅

---

## 🔜 Next: Phase 109.2

Once Phase 109.1 is verified working, Phase 109.2 will add:
- Settings modal (backend URL, API key, project ID)
- F0 API client for chat completions
- Enable "Send" button
- Non-streaming chat functionality

**Phase 109.1 focuses on the shell UI only.** API connection comes in Phase 109.2! 🚀
