# Phase 109: F0 Desktop IDE (MVP) - Implementation Plan

**Date**: 2025-11-27
**Status**: 🟢 Backend Ready, 🔵 Desktop App To Be Built
**Previous Phase**: Phase 108 - Streaming Support (SSE)
**Dependencies**: Phases 106, 107.x, 108

---

## 🎯 الهدف العام (Overall Goal)

بناء أول نسخة من **F0 Desktop IDE Companion** - تطبيق Desktop محلي (Electron/Tauri + React) يشتغل كـ:

- ✅ واجهة محلية للكود (file tree + code editor)
- ✅ متصل بـ F0 Code Agent عبر OpenAI-compatible API
- ✅ يستغل كل infrastructure Phases 106–108 + 107.x
- ✅ يدعم Chat + Refactor + Streaming

**MVP Scope** - مش لازم يكون VS Code كامل، نركّز على:
- فتح مشروع محلي (folder picker)
- عرض ملفات + محرر كود بسيط (Monaco Editor مثلاً)
- Agent Panel على اليمين للتفاعل مع F0 Code Agent
- إرسال `fz_context` (currentFile + selection + openFiles)
- استقبال patches وتطبيقها على الملفات المحلية

---

## ✅ 1️⃣ Phase 109.0 — Backend Ready (COMPLETE)

### Backend Requirements

All backend infrastructure is **already complete** from previous phases:

#### Endpoints Available
- ✅ `/api/openai_compat/v1/chat/completions` (Phase 106)
  - Supports `stream: true/false` (Phase 108)
  - Accepts `fz_context` (Phase 107)
  - Accepts `projectId`, `workspaceId`, `ideType`

- ✅ `/api/openai_compat/v1/models` (Phase 106)
  - Lists `f0-code-agent` model info

#### Type System Updates (COMPLETE ✅)

**Files Modified**:

1. [src/types/ideBridge.ts](src/types/ideBridge.ts#L107)
```typescript
// Phase 109: Desktop IDE support
ideType?: 'continue' | 'vscode' | 'web' | 'desktop';
```

2. [src/types/openaiCompat.ts](src/types/openaiCompat.ts#L35-L36)
```typescript
// Phase 109: Desktop IDE support
ideType?: 'continue' | 'vscode' | 'web' | 'desktop';
```

#### Backend Verification Test

Test performed successfully:
```bash
curl -X POST http://localhost:3030/api/openai_compat/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <API_KEY>" \
  -d '{
    "model": "f0-code-agent",
    "ideType": "desktop",
    "projectId": "f0-desktop-test",
    "messages": [...],
    "fz_context": {
      "currentFile": {
        "path": "src/utils/greetings.ts",
        "content": "// code here",
        "languageId": "typescript",
        "isOpen": true
      }
    }
  }'
```

**Result**: ✅ Backend accepts `ideType='desktop'` and processes request correctly.

---

## 🏗️ 2️⃣ Desktop IDE App — Architecture

### Recommended Tech Stack

**Option 1: Electron (Most Common)**
- Electron + React + TypeScript
- Monaco Editor for code editing
- Node.js APIs for file system access

**Option 2: Tauri (Lightweight)**
- Tauri + React + TypeScript
- Rust backend for file operations
- Smaller bundle size

**Option 3: Web-Based (Development Only)**
- React SPA with File System API (Chrome-only)
- Good for prototyping, not production

### Folder Structure

```
desktop/
├── package.json
├── tsconfig.json
├── electron.vite.config.ts      # If using Electron
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts            # Entry point
│   │   ├── fileSystem.ts       # File operations
│   │   └── ipc.ts              # IPC handlers
│   ├── preload/
│   │   └── index.ts            # Preload script (bridge)
│   └── renderer/               # React app
│       ├── main.tsx            # React entry
│       ├── App.tsx
│       ├── components/
│       │   ├── FileTree.tsx
│       │   ├── CodeEditor.tsx
│       │   ├── AgentPanel.tsx
│       │   ├── ChatMessage.tsx
│       │   ├── SettingsModal.tsx
│       │   └── StatusBar.tsx
│       ├── hooks/
│       │   ├── useFileSystem.ts
│       │   ├── useF0Agent.ts
│       │   └── useStreaming.ts
│       ├── types/
│       │   └── desktop.ts
│       └── utils/
│           ├── f0Client.ts     # API client
│           └── patchApplier.ts # Apply patches to files
```

---

## 🎨 3️⃣ Phase 109.1 — Desktop Shell (Electron + React)

### Goal
Create base desktop app with static UI (no API calls yet).

### Tasks

#### 3.1.1 Electron Setup
```bash
cd desktop
npm init -y
npm install --save-dev electron electron-builder vite
npm install react react-dom @monaco-editor/react
npm install --save-dev @types/react @types/react-dom
```

#### 3.1.2 UI Layout Components

**App.tsx** - Main Layout:
```tsx
import { FileTree } from './components/FileTree';
import { CodeEditor } from './components/CodeEditor';
import { AgentPanel } from './components/AgentPanel';
import { StatusBar } from './components/StatusBar';

export function App() {
  return (
    <div className="app">
      <div className="sidebar-left">
        <FileTree />
      </div>
      <div className="main-content">
        <CodeEditor />
        <StatusBar />
      </div>
      <div className="sidebar-right">
        <AgentPanel />
      </div>
    </div>
  );
}
```

**FileTree.tsx** - File Explorer:
- Display folder structure (tree view)
- Click to open file
- Context menu: Rename, Delete, New File

**CodeEditor.tsx** - Monaco Code Editor:
- Display file content
- Syntax highlighting
- Text selection support
- Language detection from file extension

**AgentPanel.tsx** - F0 Agent Interface:
- Chat messages list
- Text input + Send button
- "Refactor Selection" button
- "Generate Code" button
- Stream toggle switch

**SettingsModal.tsx** - Configuration:
- Backend URL input
- API Key input
- Project ID input
- Save to local storage

#### 3.1.3 File System Integration (Main Process)

**main/fileSystem.ts**:
```typescript
import fs from 'fs/promises';
import path from 'path';

export async function readDirectory(dirPath: string) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.map(e => ({
    name: e.name,
    path: path.join(dirPath, e.name),
    isDirectory: e.isDirectory()
  }));
}

export async function readFile(filePath: string) {
  return await fs.readFile(filePath, 'utf-8');
}

export async function writeFile(filePath: string, content: string) {
  await fs.writeFile(filePath, content, 'utf-8');
}
```

**main/ipc.ts** - IPC Handlers:
```typescript
import { ipcMain } from 'electron';
import { readDirectory, readFile, writeFile } from './fileSystem';

ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
  return await readDirectory(dirPath);
});

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  return await readFile(filePath);
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  await writeFile(filePath, content);
});

ipcMain.handle('dialog:openFolder', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});
```

**Deliverable**: Working desktop app that can:
- Open a local folder
- Display file tree
- Open and edit files
- Show static Agent Panel UI

---

## 🔌 4️⃣ Phase 109.2 — Connect to F0 API

### Goal
Wire Chat functionality to F0 backend (non-streaming first).

### Tasks

#### 4.2.1 Settings Screen

**SettingsModal.tsx**:
```tsx
interface Settings {
  backendUrl: string;      // e.g., http://localhost:3030/api/openai_compat/v1
  apiKey: string;          // F0_EXT_API_KEY
  projectId: string;       // User's F0 project ID
  workspaceId?: string;    // Optional workspace identifier
}

function SettingsModal() {
  const [settings, setSettings] = useState<Settings>({
    backendUrl: 'http://localhost:3030/api/openai_compat/v1',
    apiKey: '',
    projectId: '',
  });

  const handleSave = () => {
    localStorage.setItem('f0-settings', JSON.stringify(settings));
  };

  // UI form for editing settings...
}
```

#### 4.2.2 F0 API Client

**utils/f0Client.ts**:
```typescript
export interface F0ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
  ideType: 'desktop';
  projectId: string;
  workspaceId?: string;
  fz_context?: {
    currentFile?: {
      path: string;
      content: string;
      languageId: string;
      isOpen: boolean;
      selection?: { start: number; end: number };
    };
    openFiles?: Array<{
      path: string;
      content: string;
      languageId: string;
      isOpen: boolean;
    }>;
  };
}

export async function sendChatMessage(
  request: F0ChatRequest,
  settings: Settings
): Promise<{ content: string; patches?: any[] }> {
  const response = await fetch(`${settings.backendUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    patches: data.patches, // If F0 returns patches
  };
}
```

#### 4.2.3 Wire Chat UI

**AgentPanel.tsx** (non-streaming):
```tsx
function AgentPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    const settings = JSON.parse(localStorage.getItem('f0-settings') || '{}');
    const currentFile = getCurrentFile(); // From editor state

    const request: F0ChatRequest = {
      model: 'f0-code-agent',
      stream: false,
      ideType: 'desktop',
      projectId: settings.projectId,
      messages: [
        { role: 'user', content: input }
      ],
      fz_context: {
        currentFile: currentFile ? {
          path: currentFile.path,
          content: currentFile.content,
          languageId: currentFile.languageId,
          isOpen: true,
        } : undefined,
      },
    };

    const response = await sendChatMessage(request, settings);

    setMessages([
      ...messages,
      { role: 'user', content: input },
      { role: 'assistant', content: response.content }
    ]);
  };

  // Render chat UI...
}
```

**Deliverable**: User can:
- Configure backend settings
- Send chat messages to F0 Agent
- Receive complete responses (non-streaming)
- See responses in Agent Panel

---

## 📡 5️⃣ Phase 109.3 — Streaming Integration

### Goal
Enable SSE streaming for real-time typing effect.

### Tasks

#### 5.3.1 Streaming Client Hook

**hooks/useStreaming.ts**:
```typescript
export function useF0Streaming() {
  const streamChatMessage = async (
    request: F0ChatRequest,
    settings: Settings,
    onChunk: (delta: string) => void,
    onComplete: () => void
  ) => {
    const response = await fetch(`${settings.backendUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({ ...request, stream: true }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onComplete();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0]?.delta?.content;
            if (delta) {
              onChunk(delta);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  };

  return { streamChatMessage };
}
```

#### 5.3.2 Update AgentPanel for Streaming

**AgentPanel.tsx** (with streaming):
```tsx
function AgentPanel() {
  const [streamEnabled, setStreamEnabled] = useState(true);
  const { streamChatMessage } = useF0Streaming();

  const handleSendStreaming = async () => {
    let assistantMessage = '';

    setMessages(prev => [...prev,
      { role: 'user', content: input },
      { role: 'assistant', content: '', streaming: true }
    ]);

    await streamChatMessage(
      request,
      settings,
      // On chunk
      (delta) => {
        assistantMessage += delta;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = assistantMessage;
          return updated;
        });
      },
      // On complete
      () => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].streaming = false;
          return updated;
        });
      }
    );
  };

  // Toggle between streaming and non-streaming...
}
```

**Deliverable**: User sees:
- Real-time typing effect as agent responds
- Toggle to switch between streaming and non-streaming modes

---

## 🔧 6️⃣ Phase 109.4 — Context & Refactor Integration

### Goal
Send `fz_context` with file selection and apply returned patches.

### Tasks

#### 6.4.1 Build fz_context from Editor State

**utils/contextBuilder.ts**:
```typescript
export function buildFzContext(
  currentFile: FileState,
  openFiles: FileState[],
  selection?: { start: number; end: number }
) {
  return {
    currentFile: {
      path: currentFile.path,
      content: currentFile.content,
      languageId: getLanguageId(currentFile.path),
      isOpen: true,
      selection: selection || null,
    },
    openFiles: openFiles
      .filter(f => f.path !== currentFile.path)
      .map(f => ({
        path: f.path,
        content: f.content,
        languageId: getLanguageId(f.path),
        isOpen: true,
      })),
  };
}
```

#### 6.4.2 "Refactor Selection" Button

**AgentPanel.tsx**:
```tsx
function AgentPanel() {
  const handleRefactor = async () => {
    const selection = editorRef.current?.getSelection();
    if (!selection) {
      alert('Please select code to refactor');
      return;
    }

    const request: F0ChatRequest = {
      model: 'f0-code-agent',
      stream: streamEnabled,
      ideType: 'desktop',
      projectId: settings.projectId,
      messages: [
        { role: 'user', content: input }
      ],
      fz_context: buildFzContext(
        currentFile,
        openFiles,
        { start: selection.startOffset, end: selection.endOffset }
      ),
    };

    // Send and handle response...
  };

  return (
    <div>
      <button onClick={handleRefactor}>Refactor Selection</button>
      {/* Chat UI */}
    </div>
  );
}
```

#### 6.4.3 Apply Patches to Local Files

**utils/patchApplier.ts**:
```typescript
export interface FilePatch {
  filePath: string;
  diff: string;  // New file content from F0
  stepId?: string;
}

export async function applyPatchesToFiles(
  patches: FilePatch[],
  workspaceRoot: string
) {
  for (const patch of patches) {
    const fullPath = path.join(workspaceRoot, patch.filePath);

    // Write new content (F0 returns full file content, not diffs)
    await window.electron.writeFile(fullPath, patch.diff);

    console.log(`Applied patch to ${patch.filePath}`);
  }
}
```

**AgentPanel.tsx** (handling patches):
```tsx
const handleSend = async () => {
  const response = await sendChatMessage(request, settings);

  // Display response
  setMessages(prev => [...prev,
    { role: 'assistant', content: response.content }
  ]);

  // Apply patches if any
  if (response.patches && response.patches.length > 0) {
    const shouldApply = confirm(
      `Apply ${response.patches.length} file changes?`
    );

    if (shouldApply) {
      await applyPatchesToFiles(response.patches, workspaceRoot);

      // Reload files in editor
      await reloadOpenFiles();
    }
  }
};
```

**Deliverable**: User can:
- Select code in editor
- Click "Refactor Selection"
- Agent receives selection context
- User confirms and applies returned patches
- Files are updated automatically

---

## 🧪 7️⃣ Testing Scenarios

### Test 1: Open Local Project
1. Launch F0 Desktop IDE
2. Click "Open Folder" → Select local project
3. Verify file tree displays correctly
4. Click file → Opens in editor

### Test 2: Chat with Agent (Non-Streaming)
1. Open Settings → Configure backend URL, API key, project ID
2. Open a file (e.g., `src/utils/math.ts`)
3. Type in Agent Panel: "Add a multiply function"
4. Click Send
5. Verify response appears in chat
6. Verify patch is offered
7. Accept patch → File is updated

### Test 3: Streaming Chat
1. Enable streaming toggle
2. Send message: "Create a React button component"
3. Verify typing effect as response streams in
4. Verify `data: [DONE]` triggers completion

### Test 4: Refactor Selection
1. Open `src/components/Button.tsx`
2. Select existing button code
3. Type: "Add TypeScript types and improve accessibility"
4. Click "Refactor Selection"
5. Verify `fz_context.currentFile.selection` is sent
6. Verify refactored code is returned
7. Apply patch → File updated with selection preserved

### Test 5: Multi-File Context
1. Open 3 files: `Button.tsx`, `Button.test.tsx`, `types.ts`
2. Send message: "Add error state to button"
3. Verify `fz_context.openFiles` includes all 3 files
4. Verify agent suggests changes to multiple files (Phase 107.2)
5. Apply patches → All files updated

---

## 📊 Phase 109 Sub-Phases Summary

### Phase 109.0 — Backend Ready ✅ (COMPLETE)
- Add `ideType: 'desktop'` to type system
- Verify `/chat/completions` accepts desktop requests
- Test with `fz_context`

### Phase 109.1 — Desktop Shell 🔵 (To Be Built)
- Electron + React app skeleton
- File tree component
- Monaco code editor
- Static Agent Panel UI
- File system integration (main process)

### Phase 109.2 — API Connection 🔵 (To Be Built)
- Settings screen (backend URL, API key, project ID)
- F0 API client (`f0Client.ts`)
- Wire Chat UI to backend
- Display non-streaming responses

### Phase 109.3 — Streaming Support 🔵 (To Be Built)
- SSE streaming client hook
- Real-time typing effect in chat
- Toggle streaming on/off

### Phase 109.4 — Context & Refactor 🔵 (To Be Built)
- Build `fz_context` from editor state
- "Refactor Selection" button
- Send selection + open files to backend
- Apply returned patches to local files
- Reload files in editor

---

## 🎉 Success Criteria

Phase 109 MVP is complete when:

- ✅ User can open a local folder in Desktop IDE
- ✅ File tree displays project structure
- ✅ Monaco editor opens and edits files
- ✅ Settings screen configures F0 backend
- ✅ Chat messages send to F0 Agent and receive responses
- ✅ Streaming mode shows real-time typing effect
- ✅ "Refactor Selection" sends `fz_context` with selection
- ✅ Returned patches can be applied to local files automatically
- ✅ Multi-file context (open files) is sent to agent

---

## 🚀 After Phase 109

Once Desktop IDE MVP is complete, F0 will have **3 IDE interfaces**:

1. **Web IDE** (Phases 80s–90s) - Browser-based
2. **Continue Integration** (Phase 106) - VS Code extension
3. **Desktop IDE Companion** (Phase 109) - Standalone app

All 3 connect to the same backend:
- `/api/openai_compat/v1/chat/completions`
- `/api/openai_compat/v1/models`

All 3 benefit from:
- Phase 107.x (Context-aware code generation, multi-file refactor)
- Phase 108 (SSE streaming)

**F0 becomes a true multi-platform code generation platform!** 🎉

---

## 📝 Implementation Notes

### Recommended Development Order
1. Start with Electron boilerplate (electron-vite or electron-forge)
2. Add Monaco Editor first (test file opening/editing)
3. Build file tree (use recursive rendering)
4. Add Agent Panel UI (static first)
5. Wire Settings → API client
6. Implement non-streaming chat
7. Add streaming support
8. Implement context building + refactor
9. Add patch application logic

### Key Libraries
- `electron` - Desktop app framework
- `@monaco-editor/react` - Code editor
- `react` + `react-dom` - UI framework
- `vite` - Build tool
- `@types/node` - Node.js types

### Electron Security Best Practices
- Enable `contextIsolation: true`
- Disable `nodeIntegration` in renderer
- Use preload script for IPC bridge
- Validate all file paths (prevent directory traversal)
- Sanitize user input before sending to API

---

## 🔗 Related Phases

- **Phase 106**: OpenAI-Compatible API Foundation
- **Phase 107**: Context-Aware Code Generation
- **Phase 107.1**: Selection Text Extraction
- **Phase 107.2**: Multi-File Refactor Support
- **Phase 108**: Streaming Support (SSE)
- **Phase 109**: Desktop IDE (MVP) ← **Current Phase**

---

**Next Steps**: Choose between Electron/Tauri and start building Phase 109.1 (Desktop Shell)! 🚀
