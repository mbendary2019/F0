# Phase 152 – Web Code Editor Behaviour (LOCKED v1)

> **Status**: LOCKED (Phase 152.7)
> **Date**: December 2024
> **Next Phase**: >= 153 for major changes

---

## Overview

Phase 152 implements a Monaco-based code editor in the web dashboard, enabling users to view, edit, and format code directly from `/[locale]/live`.

---

## Editor Features

| Feature | Status | Phase |
|---------|--------|-------|
| Monaco Editor base | ✅ | 152.0 |
| Syntax highlighting | ✅ | 152.0 |
| Language auto-detection | ✅ | 152.0 |
| F0 custom dark theme | ✅ | 152.0 |
| Local edit state tracking | ✅ | 152.1 |
| isDirty indicator | ✅ | 152.1 |
| Save to Firestore | ✅ | 152.2 |
| Desktop sync (fileWrites queue) | ✅ | 152.3 |
| Prettier auto-format | ✅ | 152.4 |
| Issues overlay (markers) | ✅ | 152.5 |
| Diff mode (original vs modified) | ✅ | 152.6 |

---

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Web Editor    │────▶│    Firestore     │────▶│ Desktop Watcher │
│  (/live page)   │     │                  │     │                 │
└─────────────────┘     │  projects/       │     └─────────────────┘
                        │    {projectId}/  │              │
                        │      files/      │              │
                        │      fileWrites/ │              ▼
                        └──────────────────┘     ┌─────────────────┐
                                                 │  Local Files    │
                                                 │  (fs.write)     │
                                                 └─────────────────┘
```

### Web → Firestore
1. User edits code in Monaco editor
2. `useEditorState` tracks `content`, `originalContent`, `isDirty`
3. On Save (⌘S or button):
   - `useFileSave` updates `projects/{projectId}/files/{docId}` with new content
   - `useFileSave` adds entry to `projects/{projectId}/fileWrites/{autoId}`

### Firestore → Desktop
1. `fileWritesWatcher` listens to `fileWrites` where `status == 'pending'`
2. For each pending write:
   - Reads `path` and `content`
   - Writes to local filesystem via `fs.writeFileSync`
   - Updates document `status` to `'applied'` or `'failed'`

---

## Hotkeys

| Key Combo | Action | Phase |
|-----------|--------|-------|
| `⌘S` / `Ctrl+S` | Save file to Firestore | 152.2 |
| `Shift+Alt+F` | Format code (planned) | 152.4 |

---

## Components

### src/components/ide/MonacoCodeEditor.tsx
- Monaco wrapper with F0 theme
- Handles language mapping
- Applies issue markers from props

### src/components/ide/CodeViewer.tsx
- File header with path, language badge, line count
- Wraps MonacoCodeEditor
- Handles loading/notFound states

### src/components/ide/CodeDiffViewer.tsx
- Monaco DiffEditor wrapper
- Side-by-side comparison
- Shows original vs modified content

---

## Hooks

### useEditorState(filePath, backendContent)
Returns:
- `content`: Current editor content
- `originalContent`: Last saved/loaded content
- `isDirty`: Whether content differs from original
- `setContent(v)`: Update current content
- `reset()`: Revert to original
- `markSaved()`: Mark current as saved

### useFileSave(projectId)
Returns:
- `isSaving`: Boolean loading state
- `error`: Error message if save failed
- `lastSavedAt`: Timestamp of last successful save
- `saveFile(path, content)`: Save function

### useFileIssues(projectId, relativePath)
Returns:
- Array of `FileIssue` objects for Monaco markers
- Currently placeholder, ready for real issue sources

---

## Constraints (v1)

1. **No multi-file refactors** from web
   - Single file editing only
   - Multi-file operations require Desktop IDE

2. **No inline ACE edits**
   - ACE suggestions displayed but not auto-applied
   - Planned for Phase >= 153

3. **Read-only in Demo mode**
   - No active session = readOnly Monaco
   - Save disabled without activeSession

4. **fileWrites queue is one-way**
   - Web → Desktop only
   - Desktop → Web uses separate `files` collection sync

---

## Console Logs

| Log Prefix | Description |
|------------|-------------|
| `[152.0][WEB][MONACO]` | Editor mount/init |
| `[152.1][WEB][EDITOR_STATE]` | State changes (file switch, backend sync) |
| `[152.2][WEB][SAVE]` | File save to Firestore |
| `[152.3][WEB][WRITE_QUEUE]` | Enqueue to fileWrites |
| `[152.3][DESKTOP][FILE_WRITE]` | Desktop applying changes |
| `[152.4][WEB][FORMAT]` | Prettier formatting |
| `[152.5][WEB][ISSUES]` | Issue markers applied |
| `[152.6][WEB][DIFF]` | Diff mode toggled |

---

## Testing Checklist

### /en/live
- [ ] Open file from FileExplorer → displays in Monaco
- [ ] Edit content → isDirty shows "Unsaved changes"
- [ ] ⌘S → saves to Firestore, shows toast
- [ ] Desktop receives write via `fileWrites` collection
- [ ] Format button → Prettier formats code
- [ ] View Diff → shows side-by-side comparison
- [ ] Discard → reverts to original content

### /ar/live
- [ ] Layout renders correctly (RTL)
- [ ] Arabic labels displayed
- [ ] All functionality works same as /en

---

## Files (LOCKED)

```
src/components/ide/
├── MonacoCodeEditor.tsx    # Phase 152.0
├── CodeViewer.tsx          # Phase 152.0
└── CodeDiffViewer.tsx      # Phase 152.6

src/hooks/
├── useEditorState.ts       # Phase 152.1
├── useFileSave.ts          # Phase 152.2-152.3
└── useFileIssues.ts        # Phase 152.5

src/lib/editor/
└── formatCode.ts           # Phase 152.4

desktop/src/lib/runtime/
└── fileWritesWatcher.ts    # Phase 152.3
```

---

## Future Phases

- **Phase 153**: Inline ACE auto-fix integration
- **Phase 154**: Multi-tab editor support
- **Phase 155**: Terminal/output panel in web IDE
- **Phase 156**: Real-time collaborative editing

---

> **LOCK NOTICE**: This document describes v1 behavior. Major changes require Phase >= 153 approval.
