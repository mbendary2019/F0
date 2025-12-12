# Phase 84.9: Live Cloud IDE Client (Web IDE)

**Status**: Ready to Implement
**Priority**: High
**Estimated Time**: 3-4 days
**Dependencies**: Phase 84.1-84.7 (IDE Bridge Protocol) ✅

---

## Executive Summary

Phase 84.9 transforms F0 into a full-fledged web-based IDE by creating a browser client that uses the same IDE Bridge Protocol as VS Code, Cursor, and Xcode extensions.

**Key Innovation**: No new backend APIs needed - 100% reuses existing infrastructure from Phase 84.1-84.7.

---

## Architecture Overview

### Client Types
```
Desktop IDEs          Web IDE (Phase 84.9)
├── VS Code           ├── Browser-based
├── Cursor            ├── Monaco Editor
└── Xcode             ├── React Components
                      └── Same APIs!
```

### Data Flow
```
User opens file in browser
    ↓
Monaco Editor loads content from Firestore/Storage
    ↓
User edits code
    ↓
Auto-save to Firestore (every 2 seconds)
    ↓
Context Collector gathers workspace info
    ↓
User asks AI question
    ↓
POST /api/ide/chat (same endpoint as VS Code!)
    ↓
AI receives file + workspace context
    ↓
AI returns response with optional patch
    ↓
Patch Applier updates Monaco Editor
```

---

## UI Structure

### Target Page
```
src/app/[locale]/f0/ide/page.tsx
```

### Layout (Three-Column Design)

```
┌────────────────┬──────────────────────────────┬─────────────────────┐
│ File Explorer  │      Monaco Editor           │   AI Chat Panel     │
│ (20%)          │      (55%)                   │   (25%)             │
├────────────────┼──────────────────────────────┼─────────────────────┤
│ 📁 project/    │ 1  import React from 'react' │ 💬 Ask AI:          │
│   📁 src/      │ 2                            │                     │
│     📄 App.tsx │ 3  function App() {          │ "Explain this file" │
│     📄 main.ts │ 4    return (                │                     │
│   📁 public/   │ 5      <div>Hello</div>      │ [Send]              │
│   📄 README.md │ 6    )                       │                     │
│                │ 7  }                         │ ─────────────────── │
│ [+ New File]   │                              │ AI: This is a React │
│ [+ New Folder] │ [Save] [Format] [Run]        │ component that...   │
└────────────────┴──────────────────────────────┴─────────────────────┘
│                         Terminal (Optional)                          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/app/[locale]/f0/ide/
├── page.tsx                      # Main IDE page
├── layout.tsx                    # IDE-specific layout
├── components/
│   ├── FileExplorer.tsx          # Left sidebar - file tree
│   ├── MonacoEditor.tsx          # Center - code editor
│   ├── AIChatPanel.tsx           # Right sidebar - AI chat
│   ├── ContextIndicator.tsx      # Top bar - workspace context
│   ├── SessionManager.tsx        # Session status/controls
│   ├── PatchViewer.tsx           # Diff viewer for AI patches
│   ├── FileTree.tsx              # Recursive file tree component
│   ├── TabBar.tsx                # Open files tabs
│   └── Terminal.tsx              # Terminal placeholder
├── hooks/
│   ├── useFileSystem.ts          # File operations (CRUD)
│   ├── useContextCollector.ts    # Workspace context collection
│   ├── useIDEChat.ts             # AI chat with context
│   ├── useMonaco.ts              # Monaco editor setup
│   ├── useAutoSave.ts            # Auto-save logic
│   └── usePatchApplier.ts        # Apply AI patches
├── services/
│   ├── ideClient.ts              # API client for IDE endpoints
│   ├── fileSystemService.ts      # Firestore/Storage file ops
│   ├── contextService.ts         # Context collection logic
│   └── patchService.ts           # Patch parsing/application
├── types/
│   ├── fileSystem.ts             # File tree types
│   ├── editor.ts                 # Editor state types
│   └── context.ts                # Context types
└── styles/
    ├── ide.module.css            # IDE-specific styles
    └── monaco-theme.json         # Custom Monaco theme
```

---

## Core Features Breakdown

### Feature 1: File Explorer (Left Sidebar)

**Component**: `FileExplorer.tsx`

**Functionality**:
- Load file tree from Firestore/Firebase Storage
- Expand/collapse folders
- Select file → Load in editor
- Create new file/folder
- Delete file/folder
- Rename file/folder
- Show file status (modified, new, deleted)

**Data Structure**:
```typescript
interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  modified?: boolean;
  language?: string;
}
```

**Firestore Schema**:
```
projects/{projectId}/files/{fileId}
{
  path: string,
  type: 'file' | 'folder',
  content: string,  // For files only
  lastModified: timestamp,
  createdAt: timestamp,
  modifiedBy: uid
}
```

---

### Feature 2: Monaco Editor (Center Panel)

**Component**: `MonacoEditor.tsx`

**Integration**:
```tsx
import Editor from '@monaco-editor/react';

export function MonacoEditor({ file, onSave, onChange }) {
  return (
    <Editor
      height="100vh"
      language={file.language}
      value={file.content}
      onChange={onChange}
      theme="vs-dark"
      options={{
        minimap: { enabled: true },
        fontSize: 14,
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        autoSave: 'afterDelay',
        autoSaveDelay: 2000
      }}
    />
  );
}
```

**Features**:
- Syntax highlighting for 50+ languages
- IntelliSense (basic)
- Undo/Redo
- Find/Replace
- Multi-cursor editing
- Auto-save every 2 seconds
- Selection tracking (for AI context)

---

### Feature 3: AI Chat Panel (Right Sidebar)

**Component**: `AIChatPanel.tsx`

**Functionality**:
- Send message to AI
- Include file context automatically
- Include workspace context
- Display AI response
- Show patch suggestions
- Apply patches with one click

**Example**:
```tsx
export function AIChatPanel({ projectId, sessionId }) {
  const { sendChat } = useIDEChat({ projectId, sessionId });
  const { getContext } = useContextCollector();

  const handleSend = async (message: string) => {
    const context = await getContext();
    const response = await sendChat({
      message,
      fileContext: {
        filePath: currentFile.path,
        content: editorContent,
        selection: editorSelection,
        languageId: currentFile.language
      },
      workspaceContext: context
    });

    // Display response
    setMessages([...messages, { role: 'assistant', content: response.replyText }]);

    // Show patch if available
    if (response.patchSuggestion) {
      setPatch(response.patchSuggestion);
    }
  };

  return <ChatInterface onSend={handleSend} messages={messages} />;
}
```

---

### Feature 4: Workspace Context Collector (Browser)

**Hook**: `useContextCollector.ts`

**Implementation**:
```typescript
export function useContextCollector({ projectId }: { projectId: string }) {
  const { openFiles, currentFile } = useEditorState();
  const { fileTree } = useFileSystem({ projectId });

  const getContext = async (): Promise<IdeWorkspaceContext> => {
    // Get opened files
    const openedFiles = openFiles.map(f => ({
      path: f.path,
      languageId: f.language
    }));

    // Get current file
    const current = currentFile ? {
      path: currentFile.path,
      languageId: currentFile.language
    } : undefined;

    // Get changed files (compare with last saved version)
    const changedFiles = await detectChangedFiles(projectId);

    // Parse package.json (if exists)
    const packageJson = await parsePackageJson(fileTree);

    return {
      projectId,
      sessionId: currentSessionId,
      openedFiles,
      currentFile: current,
      changedFiles,
      packageJson,
      timestamp: Date.now()
    };
  };

  return { getContext };
}
```

**Changed Files Detection**:
```typescript
async function detectChangedFiles(projectId: string) {
  const localFiles = getLocalEditorState(); // From IndexedDB
  const remoteFiles = await fetchFirestoreFiles(projectId);

  const changed: Array<{ path: string; status: 'modified' | 'added' | 'deleted' }> = [];

  for (const [path, localContent] of Object.entries(localFiles)) {
    const remote = remoteFiles[path];

    if (!remote) {
      changed.push({ path, status: 'added' });
    } else if (remote.content !== localContent) {
      changed.push({ path, status: 'modified' });
    }
  }

  for (const path of Object.keys(remoteFiles)) {
    if (!localFiles[path]) {
      changed.push({ path, status: 'deleted' });
    }
  }

  return changed;
}
```

---

### Feature 5: Patch Applier

**Service**: `patchService.ts`

**Functionality**:
- Parse unified diff from AI response
- Show diff preview in Monaco
- Apply patch to editor content
- Undo/Redo patch application

**Implementation**:
```typescript
import * as monaco from 'monaco-editor';

export class PatchApplier {
  constructor(private editor: monaco.editor.IStandaloneCodeEditor) {}

  async applyPatch(patch: string) {
    // Parse unified diff
    const changes = this.parseUnifiedDiff(patch);

    // Create Monaco edit operations
    const edits: monaco.editor.IIdentifiedSingleEditOperation[] = changes.map(change => ({
      range: new monaco.Range(
        change.startLine,
        1,
        change.endLine,
        Number.MAX_VALUE
      ),
      text: change.newText
    }));

    // Apply edits
    this.editor.executeEdits('ai-patch', edits);
  }

  showDiffPreview(patch: string) {
    // Open diff editor
    const originalContent = this.editor.getValue();
    const modifiedContent = this.applyPatchToString(originalContent, patch);

    // Show diff in modal
    return { originalContent, modifiedContent };
  }

  private parseUnifiedDiff(diff: string) {
    // Parse diff format
    // Return: [{ startLine, endLine, oldText, newText }]
  }
}
```

---

### Feature 6: Auto-Save

**Hook**: `useAutoSave.ts`

**Implementation**:
```typescript
export function useAutoSave({ file, content, interval = 2000 }) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (content !== file.savedContent) {
        setIsSaving(true);
        await saveFile(file.path, content);
        setLastSaved(new Date());
        setIsSaving(false);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [content, file.path, interval]);

  return { isSaving, lastSaved };
}
```

---

## API Integration

### IDE Client Service

**File**: `services/ideClient.ts`

```typescript
import type { IdeChatRequest, IdeChatResponse, IdeWorkspaceContext } from '@/types/ideBridge';

class IDEClient {
  private baseUrl: string;
  private authToken: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    this.authToken = ''; // Will be set on auth
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  async startSession(projectId: string): Promise<{ sessionId: string }> {
    const res = await fetch(`${this.baseUrl}/api/ide/session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectId,
        clientKind: 'web-ide'  // New client kind!
      })
    });

    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
  }

  async sendChat(request: IdeChatRequest): Promise<IdeChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/ide/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!res.ok) throw new Error('Failed to send chat');
    return res.json();
  }

  async uploadContext(context: IdeWorkspaceContext): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/ide/context`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(context)
    });

    if (!res.ok) throw new Error('Failed to upload context');
  }
}

export const ideClient = new IDEClient();
```

---

## File System Service

**File**: `services/fileSystemService.ts`

```typescript
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';

export class FileSystemService {
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  async listFiles(): Promise<FileNode[]> {
    // Option 1: Store in Firestore
    const snapshot = await adminDb
      .collection('projects')
      .doc(this.projectId)
      .collection('files')
      .get();

    const files: FileNode[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FileNode[];

    return this.buildFileTree(files);
  }

  async readFile(path: string): Promise<string> {
    const doc = await adminDb
      .collection('projects')
      .doc(this.projectId)
      .collection('files')
      .where('path', '==', path)
      .get();

    if (doc.empty) throw new Error('File not found');
    return doc.docs[0].data().content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fileRef = adminDb
      .collection('projects')
      .doc(this.projectId)
      .collection('files')
      .doc();

    await fileRef.set({
      path,
      type: 'file',
      content,
      lastModified: FieldValue.serverTimestamp(),
      modifiedBy: currentUser.uid
    });
  }

  async deleteFile(path: string): Promise<void> {
    const doc = await this.getFileByPath(path);
    await doc.ref.delete();
  }

  private buildFileTree(files: FileNode[]): FileNode[] {
    // Convert flat list to tree structure
    // Group by directory, build hierarchy
  }
}
```

---

## Implementation Roadmap

### Phase 84.9.1: Basic Editor (Day 1)
- ✅ Create `/f0/ide` page
- ✅ Integrate Monaco Editor
- ✅ File tree placeholder
- ✅ Load single file from Firestore
- ✅ Basic save functionality

### Phase 84.9.2: File System (Day 2)
- ✅ Full file tree component
- ✅ Create/delete/rename files
- ✅ Open multiple files (tabs)
- ✅ Auto-save implementation
- ✅ Local state persistence (IndexedDB)

### Phase 84.9.3: AI Integration (Day 3)
- ✅ AI Chat Panel component
- ✅ Context collector hook
- ✅ IDE session management
- ✅ Send chat with file context
- ✅ Display AI responses

### Phase 84.9.4: Patch System (Day 4)
- ✅ Patch parser
- ✅ Diff viewer
- ✅ Apply patch to editor
- ✅ Undo/Redo patches
- ✅ Patch history

### Phase 84.9.5: Polish & Testing (Day 5)
- ✅ Keyboard shortcuts
- ✅ Theme customization
- ✅ Terminal placeholder
- ✅ Error handling
- ✅ Loading states
- ✅ End-to-end testing

---

## Testing Checklist

### Basic Editor Tests
- [ ] Open file in editor
- [ ] Edit content
- [ ] Save file manually
- [ ] Auto-save works
- [ ] Syntax highlighting for JS/TS/Python/etc.

### File System Tests
- [ ] Load file tree
- [ ] Expand/collapse folders
- [ ] Create new file
- [ ] Create new folder
- [ ] Delete file
- [ ] Rename file
- [ ] Open multiple files (tabs)

### AI Integration Tests
- [ ] Start IDE session
- [ ] Send chat message
- [ ] File context included
- [ ] Workspace context included
- [ ] AI response displayed
- [ ] Patch suggestion shown

### Patch System Tests
- [ ] Parse unified diff
- [ ] Show diff preview
- [ ] Apply patch
- [ ] Undo patch
- [ ] Multiple patches

### Performance Tests
- [ ] Open 10 files quickly
- [ ] Auto-save doesn't lag
- [ ] File tree loads fast (100+ files)
- [ ] Chat response time < 3s
- [ ] No memory leaks

---

## Dependencies

### NPM Packages
```json
{
  "dependencies": {
    "@monaco-editor/react": "^4.6.0",
    "monaco-editor": "^0.44.0",
    "diff": "^5.1.0",
    "idb": "^8.0.0",
    "react-split": "^2.0.14",
    "react-tabs": "^6.0.2"
  }
}
```

### Installation
```bash
pnpm add @monaco-editor/react monaco-editor diff idb react-split react-tabs
```

---

## Backend Changes

**Required**: NONE! ✅

All existing APIs work perfectly:
- ✅ `/api/ide/session` - Already supports `clientKind` parameter
- ✅ `/api/ide/chat` - Already accepts file + workspace context
- ✅ `/api/ide/context` - Already stores/retrieves context

**Only addition**: Update `clientKind` enum to include `'web-ide'`

**File**: `src/types/ideBridge.ts`
```typescript
export type IdeClientKind = 'vscode' | 'cursor-like' | 'xcode' | 'web-ide';
```

---

## Security Considerations

### Authentication
- ✅ Already handled by Next.js middleware
- ✅ Firebase Auth tokens passed to API

### File Access
- ✅ Firestore rules restrict to project owner
- ✅ Server-side validation in file operations

### XSS Prevention
- ✅ Monaco editor sanitizes content
- ✅ React escapes user input

### Rate Limiting
- ⚠️ Add rate limiting to file save operations
- ⚠️ Limit file size (max 1MB per file)

---

## UI/UX Enhancements

### Keyboard Shortcuts
```
Cmd/Ctrl + S    → Save file
Cmd/Ctrl + K    → Open command palette
Cmd/Ctrl + P    → Quick file search
Cmd/Ctrl + /    → Toggle AI chat
Cmd/Ctrl + B    → Toggle file explorer
Cmd/Ctrl + `    → Toggle terminal
```

### Themes
- VS Code Dark (default)
- VS Code Light
- Monokai
- Dracula
- Custom F0 theme

### Responsive Design
- Collapsible panels on mobile
- Swipe gestures for tabs
- Touch-friendly buttons

---

## Future Enhancements (Phase 85+)

### Terminal Integration
- Web-based terminal
- Execute npm commands
- Run build scripts

### Git Integration
- Commit changes
- Push to GitHub
- Branch management
- Merge conflict resolution

### Collaboration
- Real-time multi-user editing
- Live cursors
- Chat with team members

### Advanced AI Features
- Inline code suggestions (like Copilot)
- Multi-file refactoring
- Architecture recommendations
- Code review automation

---

## Success Criteria

Phase 84.9 is complete when:

1. ✅ User can open any file in Monaco Editor
2. ✅ File tree loads and displays correctly
3. ✅ Auto-save works reliably
4. ✅ AI chat sends file + workspace context
5. ✅ AI patches can be previewed and applied
6. ✅ Multiple files can be opened simultaneously
7. ✅ No backend changes required
8. ✅ Performance is acceptable (< 100ms file load)

---

## Summary

Phase 84.9 brings the IDE Bridge Protocol full circle by creating a native web client. Users can now:

- 🌐 Code entirely in the browser
- 🤖 Chat with AI about their code
- 📁 Manage files without leaving F0
- 🔧 Apply AI patches with one click
- ⚡ Same experience as desktop IDEs

**Key Achievement**: Protocol reusability proven across 4 client types:
1. VS Code Extension ✅
2. Cursor CLI ✅
3. Xcode Extension ✅
4. Web IDE ✅ (Phase 84.9)

**Next**: Phase 85 - Workspace Intelligence Engine 🚀
