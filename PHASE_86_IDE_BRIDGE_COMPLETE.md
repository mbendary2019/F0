# Phase 86: IDE Bridge - Complete Implementation

**Status:** ✅ Complete
**Date:** 25 نوفمبر 2025

---

## 🎯 Overview

Phase 86 implements the complete IDE Bridge architecture that connects local IDEs (VS Code/Cursor) to the F0 Dashboard, enabling real-time collaboration between developers and the AI Agent.

**Core Functionality:**
- IDE extensions send file changes, events, and heartbeats to Cloud Functions
- AI Agent generates patches that appear in the Dashboard
- Users review and apply patches to their IDE with one click
- Bidirectional communication via Firestore and polling

---

## ✅ What Was Implemented

### 1. Cloud Functions (Backend)

#### A. `ideIngestEvent` - Receive Events from IDE
**File:** [functions/src/ide/ideIngestEvent.ts](functions/src/ide/ideIngestEvent.ts)

Receives events from IDE extensions and stores them in Firestore.

**Event Types:**
- `FILE_SNAPSHOT` - Full file content when opened
- `FILE_CHANGED` - File content after edit
- `SELECTION_CHANGED` - Cursor position changes
- `HEARTBEAT` - Keep-alive signal
- `TEST_RESULT` - Test execution results
- `TERMINAL_OUTPUT` - Terminal output

**Storage Path:**
```
projects/{projectId}/ideSessions/{sessionId}/events/{eventId}
```

**Example Request:**
```json
POST /ideIngestEvent
{
  "eventId": "evt_123",
  "sessionId": "session_abc",
  "projectId": "project_xyz",
  "source": "ide",
  "kind": "FILE_CHANGED",
  "ts": "2025-11-25T12:00:00Z",
  "payload": {
    "path": "src/app/page.tsx",
    "languageId": "tsx",
    "content": "export default function Page() { ... }"
  }
}
```

---

#### B. `ideSendCommand` - Send Commands to IDE
**File:** [functions/src/ide/ideSendCommand.ts](functions/src/ide/ideSendCommand.ts)

Sends commands from Dashboard to IDE extensions (stored in Firestore, IDE polls for them).

**Command Types:**
- `APPLY_PATCH` - Apply file changes to IDE
- `OPEN_FILE` - Open file at specific line

**Storage Path:**
```
projects/{projectId}/ideSessions/{sessionId}/commands/{commandId}
```

**Example Request:**
```json
POST /ideSendCommand
{
  "commandId": "cmd_456",
  "sessionId": "session_abc",
  "projectId": "project_xyz",
  "kind": "APPLY_PATCH",
  "ts": "2025-11-25T12:01:00Z",
  "payload": {
    "patchId": "patch_789",
    "files": [
      {
        "path": "src/lib/utils.ts",
        "newContent": "export function formatDate() { ... }"
      }
    ]
  }
}
```

---

#### C. `ideGetCommands` - Poll Endpoint for IDE
**File:** [functions/src/ide/ideGetCommands.ts](functions/src/ide/ideGetCommands.ts)

IDE extensions poll this endpoint every 3 seconds to get pending commands.

**Query Parameters:**
- `sessionId` (required)
- `projectId` (required)
- `after` (optional) - Timestamp to get commands after

**Example Request:**
```
GET /ideGetCommands?sessionId=session_abc&projectId=project_xyz
```

**Response:**
```json
{
  "ok": true,
  "commands": [
    {
      "commandId": "cmd_456",
      "kind": "APPLY_PATCH",
      "payload": { ... },
      "status": "pending"
    }
  ],
  "count": 1
}
```

---

### 2. Firestore Rules

**File:** [firestore.rules](firestore.rules) (lines 49-92)

Added security rules for IDE Bridge collections:

```javascript
match /projects/{projectId} {
  match /ideSessions/{sessionId} {
    allow read, write: if isSignedIn();

    // Events (IDE → Cloud)
    match /events/{eventId} {
      allow read: if isSignedIn();
      allow create: if true;  // IDE can send events
      allow update, delete: if false;
    }

    // Commands (Cloud → IDE)
    match /commands/{commandId} {
      allow read: if true;  // IDE polls for commands
      allow create: if isSignedIn();
      allow update: if true;  // IDE marks as applied
      allow delete: if false;
    }

    // Patches
    match /patches/{patchId} {
      allow read, write: if isSignedIn();
    }
  }
}
```

---

### 3. Next.js API Route

**File:** [src/app/api/live/send-command/route.ts](src/app/api/live/send-command/route.ts)

API route that proxies command requests from Dashboard to the `ideSendCommand` Cloud Function.

**Usage:**
```typescript
await fetch('/api/live/send-command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(command)
});
```

---

### 4. Frontend Integration

#### A. Hook: `useIdePatches`
**File:** [src/hooks/useIdePatches.ts](src/hooks/useIdePatches.ts)

Real-time hook to fetch pending patches for an active IDE session.

**Usage:**
```typescript
const { patches, loading } = useIdePatches(projectId, sessionId);
```

**Returns:**
```typescript
{
  patches: IdePatch[],  // Array of pending patches
  loading: boolean
}
```

---

#### B. Component: `PatchViewer`
**File:** [src/components/f0/PatchViewer.tsx](src/components/f0/PatchViewer.tsx)

Interactive UI component to display and apply patches.

**Features:**
- Display all files in each patch
- Checkbox selection for individual files
- "Select All" / "Deselect All" buttons
- "Apply Selected to IDE" button
- Visual indicators for file operations (add/modify/delete)
- Loading state while applying

---

#### C. Page: Live Coding
**File:** [src/app/[locale]/live/page.tsx](src/app/[locale]/live/page.tsx)

Updated to integrate patch viewer and command sending.

**New Sections:**
1. **Pending Patches from AI Agent** - Shows all patches with PatchViewer
2. **Apply Patch Handler** - Sends APPLY_PATCH commands to IDE

**Flow:**
1. User selects files from a patch
2. Clicks "Apply Selected to IDE"
3. Command is sent to `/api/live/send-command`
4. Cloud Function stores command in Firestore
5. IDE extension polls and receives command
6. IDE applies changes to local files

---

### 5. Type Definitions

**File:** [src/types/ideEvents.ts](src/types/ideEvents.ts) (Already existed)

Complete TypeScript types for:
- `IdeEventEnvelope` - Event wrapper
- `IdeCommandEnvelope` - Command wrapper
- `IdePatch` - Patch structure with files and status
- All payload types for events and commands

---

## 📊 Firestore Data Structure

```
projects/
  {projectId}/
    ideSessions/
      {sessionId}/
        - status: 'active' | 'ended'
        - projectId: string
        - lastEventAt: Timestamp

        events/
          {eventId}/
            - eventId: string
            - kind: IdeEventKind
            - ts: string
            - payload: object
            - receivedAt: Timestamp

        commands/
          {commandId}/
            - commandId: string
            - kind: IdeCommandKind
            - ts: string
            - payload: object
            - status: 'pending' | 'applied' | 'failed'
            - createdAt: Timestamp

        patches/
          {patchId}/
            - patchId: string
            - createdBy: 'agent' | 'user'
            - files: array
            - status: 'pending' | 'applied' | 'discarded'
            - ts: string
```

---

## 🔧 Architecture Diagram

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────┐
│   IDE Extension │────────▶│  Cloud Functions     │────────▶│  Firestore  │
│  (VS Code/     │  POST   │  - ideIngestEvent    │  write  │             │
│   Cursor)      │  events │  - ideSendCommand    │         │  projects/  │
└─────────────────┘         └──────────────────────┘         │  {id}/      │
       ▲                                                      │  ideSessions│
       │                                                      └─────────────┘
       │  GET commands (poll every 3s)                              │
       │                                                             │
       │                     ┌──────────────────┐                   │
       └─────────────────────│   Dashboard      │◀──────────────────┘
                             │   (Next.js)      │  onSnapshot
                             │                  │  (real-time)
                             │  - PatchViewer   │
                             │  - Live Page     │
                             └──────────────────┘
```

---

## 🚀 How It Works (End-to-End)

### 1. IDE → Dashboard (File Changes)

1. Developer opens file in VS Code/Cursor
2. Extension sends `FILE_SNAPSHOT` event to `ideIngestEvent`
3. Cloud Function stores event in Firestore
4. Dashboard can read events via Firestore queries

### 2. AI Agent → Dashboard (Patches)

1. AI Agent generates code changes
2. Stores patch in `projects/{id}/ideSessions/{id}/patches/{id}`
3. Dashboard listens with `useIdePatches` hook
4. PatchViewer component displays patch in UI

### 3. Dashboard → IDE (Apply Patch)

1. User selects files and clicks "Apply Selected to IDE"
2. `handleApplyPatch` function calls `/api/live/send-command`
3. API route calls `ideSendCommand` Cloud Function
4. Command stored in Firestore with status='pending'
5. IDE extension polls `ideGetCommands` every 3 seconds
6. IDE receives command and applies changes to local files
7. IDE updates command status to 'applied'

---

## 📝 Testing Guide

### 1. Test Cloud Functions (via Emulator)

```bash
# Start emulators
firebase emulators:start

# Test ideIngestEvent
curl -X POST http://127.0.0.1:5001/from-zero-84253/us-central1/ideIngestEvent \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "test_evt_1",
    "sessionId": "test_session",
    "projectId": "test_project",
    "source": "ide",
    "kind": "FILE_SNAPSHOT",
    "ts": "2025-11-25T12:00:00Z",
    "payload": {
      "path": "test.ts",
      "content": "console.log(\"hello\");"
    }
  }'

# Test ideSendCommand
curl -X POST http://127.0.0.1:5001/from-zero-84253/us-central1/ideSendCommand \
  -H "Content-Type: application/json" \
  -d '{
    "commandId": "test_cmd_1",
    "sessionId": "test_session",
    "projectId": "test_project",
    "kind": "APPLY_PATCH",
    "ts": "2025-11-25T12:01:00Z",
    "payload": {
      "patchId": "test_patch_1",
      "files": [{"path": "test.ts", "newContent": "console.log(\"world\");"}]
    }
  }'

# Test ideGetCommands (polling)
curl "http://127.0.0.1:5001/from-zero-84253/us-central1/ideGetCommands?sessionId=test_session&projectId=test_project"
```

### 2. Test Dashboard Integration

1. Start development server:
```bash
PORT=3030 pnpm dev
```

2. Navigate to Live Coding page: `http://localhost:3030/en/live`

3. Create a test patch in Firestore:
```javascript
const patch = {
  patchId: 'patch_test_1',
  sessionId: 'session_abc',
  projectId: 'project_xyz',
  createdBy: 'agent',
  ts: new Date().toISOString(),
  files: [
    {
      path: 'src/test.ts',
      operation: 'modify',
      newContent: 'export const test = "hello";'
    }
  ],
  status: 'pending'
};

// Add to Firestore via emulator UI or script
```

4. Patch should appear in Dashboard automatically
5. Click "Apply Selected to IDE" to test command flow

---

## 🔗 Related Files

### Created/Modified:
- ✅ [functions/src/ide/ideIngestEvent.ts](functions/src/ide/ideIngestEvent.ts) - Event ingestion
- ✅ [functions/src/ide/ideSendCommand.ts](functions/src/ide/ideSendCommand.ts) - Command sending
- ✅ [functions/src/ide/ideGetCommands.ts](functions/src/ide/ideGetCommands.ts) - Command polling
- ✅ [functions/src/index.ts](functions/src/index.ts:573-575) - Export functions (lines 573-575)
- ✅ [firestore.rules](firestore.rules:49-92) - Security rules (lines 49-92)
- ✅ [src/app/api/live/send-command/route.ts](src/app/api/live/send-command/route.ts) - API route
- ✅ [src/hooks/useIdePatches.ts](src/hooks/useIdePatches.ts) - Patches hook
- ✅ [src/components/f0/PatchViewer.tsx](src/components/f0/PatchViewer.tsx) - UI component
- ✅ [src/app/[locale]/live/page.tsx](src/app/[locale]/live/page.tsx) - Live Coding page

### Existing (Used):
- ✅ [src/types/ideEvents.ts](src/types/ideEvents.ts) - Type definitions
- ✅ [src/types/liveSession.ts](src/types/liveSession.ts) - Session types
- ✅ [src/hooks/useLiveSessionsList.ts](src/hooks/useLiveSessionsList.ts) - Sessions hook

---

## 🎉 Summary

Phase 86 IDE Bridge is **100% complete** with:

✅ **3 Cloud Functions** for bidirectional communication
✅ **Firestore security rules** for events, commands, and patches
✅ **Next.js API route** for command proxy
✅ **React hook** for real-time patch fetching
✅ **UI component** for patch display and selection
✅ **Live Coding page** integration with full flow

The system is ready to receive events from IDE extensions, display patches in the Dashboard, and send commands back to IDEs.

---

## 🔜 Next Steps

**Phase 87: VS Code/Cursor Extension Development**
1. Create VS Code extension scaffold
2. Implement event sending (FILE_SNAPSHOT, FILE_CHANGED, HEARTBEAT)
3. Implement command polling (every 3 seconds)
4. Implement patch application logic (write files to workspace)
5. Add authentication flow
6. Package and publish to marketplace

---

**End of Phase 86 Documentation**
