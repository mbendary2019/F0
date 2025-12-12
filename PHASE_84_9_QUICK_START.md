# Phase 84.9: Quick Start Guide - Web IDE Implementation

**Time to MVP**: 2-3 hours for basic version
**Full Implementation**: 3-4 days

---

## Quick Win: Minimal Web IDE (2-3 hours)

### Step 1: Install Monaco Editor (5 minutes)

```bash
cd /Users/abdo/Desktop/from-zero-working
pnpm add @monaco-editor/react monaco-editor
```

### Step 2: Create IDE Page (10 minutes)

Create file: `src/app/[locale]/f0/ide/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';

export default function WebIDEPage() {
  const [content, setContent] = useState('// Start coding...\n');

  return (
    <div className="h-screen flex">
      {/* Simple File List */}
      <div className="w-64 bg-gray-900 p-4">
        <h3 className="text-white mb-4">Files</h3>
        <div className="text-gray-400">
          📄 index.ts
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100vh"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={content}
          onChange={(value) => setContent(value || '')}
        />
      </div>
    </div>
  );
}
```

**Test**: Navigate to `http://localhost:3030/en/f0/ide`

✅ You should see a working code editor!

---

### Step 3: Add AI Chat Panel (30 minutes)

Update `page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';

export default function WebIDEPage() {
  const [content, setContent] = useState('// Start coding...\n');
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
  const [input, setInput] = useState('');

  const sendToAI = async () => {
    // TODO: Connect to /api/ide/chat
    setMessages([...messages, { role: 'user', content: input }]);
    setInput('');
  };

  return (
    <div className="h-screen flex">
      {/* File Explorer */}
      <div className="w-64 bg-gray-900 p-4">
        <h3 className="text-white mb-4">Files</h3>
        <div className="text-gray-400">📄 index.ts</div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100vh"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={content}
          onChange={(value) => setContent(value || '')}
        />
      </div>

      {/* AI Chat */}
      <div className="w-80 bg-gray-800 p-4 flex flex-col">
        <h3 className="text-white mb-4">AI Assistant</h3>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`mb-2 ${msg.role === 'user' ? 'text-blue-400' : 'text-green-400'}`}>
              <strong>{msg.role}:</strong> {msg.content}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendToAI()}
            className="flex-1 bg-gray-700 text-white p-2 rounded"
            placeholder="Ask AI..."
          />
          <button
            onClick={sendToAI}
            className="bg-blue-600 text-white px-4 rounded"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 4: Connect to Real IDE API (45 minutes)

Create: `src/lib/ideClient.ts`

```typescript
interface IdeChatRequest {
  message: string;
  sessionId: string;
  projectId: string;
  fileContext?: {
    filePath: string;
    content: string;
    languageId: string;
  };
  locale: string;
}

export class WebIDEClient {
  private sessionId: string | null = null;

  async startSession(projectId: string): Promise<string> {
    const res = await fetch('/api/ide/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        clientKind: 'web-ide'
      })
    });

    const data = await res.json();
    this.sessionId = data.sessionId;
    return data.sessionId;
  }

  async sendChat(request: IdeChatRequest) {
    const res = await fetch('/api/ide/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    return res.json();
  }
}

export const webIDEClient = new WebIDEClient();
```

Update `page.tsx`:

```tsx
import { webIDEClient } from '@/lib/ideClient';

export default function WebIDEPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const projectId = 'your-project-id'; // Get from URL params

  useEffect(() => {
    webIDEClient.startSession(projectId).then(setSessionId);
  }, [projectId]);

  const sendToAI = async () => {
    if (!sessionId) return;

    const response = await webIDEClient.sendChat({
      message: input,
      sessionId,
      projectId,
      fileContext: {
        filePath: 'index.ts',
        content: content,
        languageId: 'typescript'
      },
      locale: 'en'
    });

    setMessages([
      ...messages,
      { role: 'user', content: input },
      { role: 'assistant', content: response.replyText }
    ]);
    setInput('');
  };

  // ... rest of component
}
```

**Test**: Ask AI "What does this code do?" - should work!

---

## Full Implementation Roadmap

### Day 1: Core Editor (4-6 hours)

**Morning** (2-3 hours):
- [x] Install Monaco
- [x] Create basic page
- [x] Add file explorer placeholder
- [ ] Load file from Firestore
- [ ] Save file to Firestore

**Afternoon** (2-3 hours):
- [ ] Add tab system for multiple files
- [ ] Implement auto-save
- [ ] Add syntax highlighting for 10+ languages

**Deliverable**: Working editor that loads/saves files

---

### Day 2: File System (4-6 hours)

**Morning** (2-3 hours):
- [ ] Create FileExplorer component
- [ ] Load file tree from Firestore
- [ ] Expand/collapse folders
- [ ] Select file → load in editor

**Afternoon** (2-3 hours):
- [ ] Create new file
- [ ] Create new folder
- [ ] Delete file/folder
- [ ] Rename operations

**Deliverable**: Full file management system

---

### Day 3: AI Integration (4-6 hours)

**Morning** (2-3 hours):
- [ ] Create AIChatPanel component
- [ ] Integrate IDE session API
- [ ] Send messages with file context
- [ ] Display AI responses

**Afternoon** (2-3 hours):
- [ ] Implement context collector
- [ ] Send workspace context
- [ ] Show changed files
- [ ] Parse package.json

**Deliverable**: AI chat working with full context

---

### Day 4: Patch System (4-6 hours)

**Morning** (2-3 hours):
- [ ] Parse unified diff format
- [ ] Create diff viewer component
- [ ] Show diff preview in modal

**Afternoon** (2-3 hours):
- [ ] Apply patch to Monaco editor
- [ ] Undo/redo patch
- [ ] Highlight changes

**Deliverable**: AI patches can be applied automatically

---

### Day 5: Polish (4-6 hours)

**Morning** (2 hours):
- [ ] Add keyboard shortcuts
- [ ] Theme selector
- [ ] Loading states
- [ ] Error handling

**Afternoon** (2 hours):
- [ ] Responsive design
- [ ] Performance optimization
- [ ] End-to-end testing

**Evening** (2 hours):
- [ ] Documentation
- [ ] Demo video
- [ ] Deploy to staging

**Deliverable**: Production-ready Web IDE

---

## File Checklist

### Create These Files

```
src/app/[locale]/f0/ide/
  ✅ page.tsx                      # Main IDE page
  ⏳ layout.tsx                    # IDE layout
  ⏳ components/
     ⏳ FileExplorer.tsx           # File tree
     ⏳ MonacoEditor.tsx           # Editor wrapper
     ⏳ AIChatPanel.tsx            # AI chat
     ⏳ TabBar.tsx                 # Open files
     ⏳ PatchViewer.tsx            # Diff preview

src/lib/
  ⏳ ideClient.ts                  # API client
  ⏳ fileSystem.ts                 # File operations
  ⏳ contextCollector.ts           # Context logic

src/hooks/
  ⏳ useFileSystem.ts              # File CRUD
  ⏳ useIDEChat.ts                 # AI chat
  ⏳ useAutoSave.ts                # Auto-save
  ⏳ useMonaco.ts                  # Monaco setup
```

---

## Testing Commands

### Test Monaco Installation
```bash
pnpm why @monaco-editor/react
# Should show: @monaco-editor/react@4.6.0
```

### Test Page Route
```bash
curl http://localhost:3030/en/f0/ide
# Should return HTML (not 404)
```

### Test IDE Session API
```bash
curl -X POST http://localhost:3030/api/ide/session \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","clientKind":"web-ide"}'

# Should return: {"sessionId":"..."}
```

### Test Chat API
```bash
curl -X POST http://localhost:3030/api/ide/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId":"test-session",
    "projectId":"test-project",
    "message":"What is React?",
    "locale":"en"
  }'

# Should return AI response
```

---

## Common Issues & Solutions

### Issue: Monaco not loading

**Solution**:
```tsx
// Add dynamic import
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false
});
```

### Issue: Styles not working

**Solution**: Add to `globals.css`:
```css
.monaco-editor-wrapper {
  width: 100%;
  height: 100vh;
}
```

### Issue: API 401 Unauthorized

**Solution**: Add auth token:
```typescript
const token = await getIdToken(user);
fetch('/api/ide/chat', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Success Metrics

### MVP Success (2-3 hours)
- ✅ Editor loads
- ✅ Can type code
- ✅ Syntax highlighting works
- ✅ AI chat panel exists

### Day 1 Success
- ✅ Load file from Firestore
- ✅ Save file to Firestore
- ✅ Multiple files in tabs

### Day 3 Success
- ✅ AI receives file context
- ✅ AI receives workspace context
- ✅ Responses displayed correctly

### Day 5 Success (Production Ready)
- ✅ All features working
- ✅ Performance acceptable
- ✅ No critical bugs
- ✅ Documentation complete

---

## Next Steps After Phase 84.9

### Phase 85: Workspace Intelligence
- Multi-file reasoning
- Project-wide refactoring
- Smart dependency management
- Architecture recommendations

### Phase 86: Collaboration
- Real-time multi-user editing
- Live cursors
- Team chat
- Code review workflow

### Phase 87: DevOps Integration
- CI/CD pipelines
- Deploy to production
- Environment management
- Monitoring & alerts

---

## Resources

### Monaco Editor Docs
https://microsoft.github.io/monaco-editor/

### React Monaco Docs
https://github.com/suren-atoyan/monaco-react

### Diff Parser Library
https://www.npmjs.com/package/diff

### IndexedDB (idb)
https://www.npmjs.com/package/idb

---

## Summary

Phase 84.9 delivers a **fully functional Web IDE** that:
- 🌐 Runs entirely in the browser
- 🤖 Integrates F0 AI natively
- 📁 Manages project files
- ✨ Applies AI patches automatically
- ⚡ Reuses all existing backend APIs

**No backend changes needed** - that's the power of the IDE Bridge Protocol!

**Start now**: Just run `pnpm add @monaco-editor/react` and create the page! 🚀
