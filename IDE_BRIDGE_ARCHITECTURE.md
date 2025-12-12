# IDE Bridge Architecture - Complete Implementation

**Status:** ✅ Implementation Complete (Phase 86)
**Date:** 25 نوفمبر 2025

---

## 🎯 Overview

IDE Bridge يربط الـ IDE المحلي (VS Code/Cursor) بالـ Dashboard عشان:
1. الـ Agent يقدر يقترح patches
2. المستخدم يشوف الـ patches في Dashboard
3. يطبّقها في الـ IDE بـ one click

---

## 📊 Data Flow

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│     IDE     │────────▶│  Cloud Functions │────────▶│  Firestore  │
│  Extension  │  events │                  │  write  │             │
└─────────────┘         └──────────────────┘         └─────────────┘
       ▲                                                     │
       │                                                     │
       │                    ┌──────────────┐                │
       └────────────────────│  Dashboard   │◀───────────────┘
         commands (poll)    │   (Next.js)  │  onSnapshot
                           └──────────────┘
```

---

## 🔧 Components

### 1. Types (✅ Created)

**File:** `src/types/ideEvents.ts`

**Event Types:**
- `FILE_SNAPSHOT` - Full file content (first open)
- `FILE_CHANGED` - File content after edit
- `SELECTION_CHANGED` - Cursor/selection position
- `TEST_RESULT` - Test results
- `TERMINAL_OUTPUT` - Terminal output
- `HEARTBEAT` - Keep-alive signal

**Command Types:**
- `APPLY_PATCH` - Apply patch to IDE
- `OPEN_FILE` - Open file in IDE

**Structures:**
- `IdeEventEnvelope` - Event wrapper
- `IdeCommandEnvelope` - Command wrapper
- `IdePatch` - Patch data structure

---

### 2. Cloud Functions (✅ IMPLEMENTED)

#### A. `ideIngestEvent` - Receive events from IDE

**File:** `functions/src/ide/ideIngestEvent.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const ideIngestEvent = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const event = req.body; // IdeEventEnvelope

  // Validate
  if (!event.sessionId || !event.projectId) {
    res.status(400).json({ error: 'Missing sessionId or projectId' });
    return;
  }

  const db = admin.firestore();

  // Store event:
  // projects/{projectId}/ideSessions/{sessionId}/events/{eventId}
  await db
    .collection('projects')
    .doc(event.projectId)
    .collection('ideSessions')
    .doc(event.sessionId)
    .collection('events')
    .doc(event.eventId)
    .set({
      ...event,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  res.status(200).json({ ok: true });
});
```

**URL:** `https://<region>-<project>.cloudfunctions.net/ideIngestEvent`

---

#### B. `ideSendCommand` - Send commands to IDE

```typescript
export const ideSendCommand = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const command = req.body; // IdeCommandEnvelope

  const db = admin.firestore();

  // Store command:
  // projects/{projectId}/ideSessions/{sessionId}/commands/{commandId}
  await db
    .collection('projects')
    .doc(command.projectId)
    .collection('ideSessions')
    .doc(command.sessionId)
    .collection('commands')
    .doc(command.commandId)
    .set({
      ...command,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  res.status(200).json({ ok: true });
});
```

---

#### C. `ideGetCommands` - Poll commands (for IDE)

```typescript
export const ideGetCommands = functions.https.onRequest(async (req, res) => {
  const { sessionId, projectId, after } = req.query;

  if (!sessionId || !projectId) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }

  const db = admin.firestore();
  const ref = db
    .collection('projects')
    .doc(projectId as string)
    .collection('ideSessions')
    .doc(sessionId as string)
    .collection('commands');

  let q = ref.where('status', '==', 'pending').orderBy('createdAt', 'asc');

  if (after) {
    q = q.where('createdAt', '>', new Date(after as string));
  }

  const snap = await q.get();
  const commands = snap.docs.map(d => ({ ...d.data(), commandId: d.id }));

  res.status(200).json({ commands });
});
```

---

### 3. Next.js API Routes (✅ IMPLEMENTED)

#### `/api/live/send-command`

**File:** `src/app/api/live/send-command/route.ts`

```typescript
// src/app/api/live/send-command/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';

export async function POST(req: NextRequest) {
  // Verify authentication
  const auth = assertAuth(req);
  if (!auth.ok || !auth.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const command = await req.json();

  // Validate required fields
  if (!command.commandId || !command.sessionId || !command.projectId) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // Get Cloud Function URL
  const functionUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL ||
                     'http://127.0.0.1:5001/from-zero-84253/us-central1';

  // Call ideSendCommand Cloud Function
  const response = await fetch(`${functionUrl}/ideSendCommand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    const errorData = await response.json();
    return NextResponse.json(
      { error: errorData.error },
      { status: response.status }
    );
  }

  const result = await response.json();
  return NextResponse.json(result);
}
```

---

### 4. Firestore Structure

```
projects/
  {projectId}/
    ideSessions/
      {sessionId}/
        - status: 'active' | 'ended'
        - projectId: string
        - createdAt: Timestamp
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
            - sessionId: string
            - createdBy: 'agent' | 'user'
            - ts: string
            - files: array
            - status: 'pending' | 'applied' | 'discarded'
```

---

### 5. Firestore Rules (✅ IMPLEMENTED)

**File:** `firestore.rules` (lines 49-92)

```javascript
// projects collection
match /projects/{projectId} {
  // قراءة: صاحب المشروع فقط
  allow read: if isSignedIn() && resource.data.ownerUid == request.auth.uid;

  // كتابة: صاحب المشروع فقط
  allow write: if isSignedIn() && request.resource.data.ownerUid == request.auth.uid;

  // -------- ideSessions (IDE Bridge) --------
  match /ideSessions/{sessionId} {
    // قراءة: أي مستخدم مسجل
    allow read: if isSignedIn();

    // كتابة: أي مستخدم مسجل
    allow write: if isSignedIn();

    // events subcollection (IDE → Cloud)
    match /events/{eventId} {
      // قراءة: أي مستخدم مسجل
      allow read: if isSignedIn();

      // إنشاء: مسموح (IDE يبعت events)
      allow create: if true;

      // تعديل وحذف: ممنوع
      allow update, delete: if false;
    }

    // commands subcollection (Cloud → IDE)
    match /commands/{commandId} {
      // قراءة: مسموح (IDE يعمل poll)
      allow read: if true;

      // إنشاء: أي مستخدم مسجل
      allow create: if isSignedIn();

      // تعديل: مسموح (IDE يحدّث status)
      allow update: if true;

      // حذف: ممنوع
      allow delete: if false;
    }

    // patches subcollection
    match /patches/{patchId} {
      // قراءة: أي مستخدم مسجل
      allow read: if isSignedIn();

      // كتابة: أي مستخدم مسجل
      allow write: if isSignedIn();
    }
  }
}
```

---

## 🔌 IDE Extension Flow

### On Startup:
1. Get `sessionId` from user (or from config)
2. Start heartbeat timer (every 30s)
3. Watch file changes
4. Start polling for commands (every 3s)

### On File Open:
```typescript
sendEvent({
  eventId: uuid(),
  sessionId,
  projectId,
  source: 'ide',
  kind: 'FILE_SNAPSHOT',
  ts: new Date().toISOString(),
  payload: {
    path: document.uri.fsPath,
    languageId: document.languageId,
    content: document.getText(),
  },
});
```

### On File Save:
```typescript
sendEvent({
  eventId: uuid(),
  sessionId,
  projectId,
  source: 'ide',
  kind: 'FILE_CHANGED',
  ts: new Date().toISOString(),
  payload: {
    path: document.uri.fsPath,
    languageId: document.languageId,
    content: document.getText(),
  },
});
```

### On Command Received (APPLY_PATCH):
```typescript
async function applyPatch(command: IdeCommandEnvelope) {
  const payload = command.payload as ApplyPatchPayload;

  for (const file of payload.files) {
    // Open or create file
    const uri = vscode.Uri.file(path.join(workspaceRoot, file.path));
    const doc = await vscode.workspace.openTextDocument(uri);

    // Replace content
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(doc.getText().length)
    );
    edit.replace(uri, fullRange, file.newContent);
    await vscode.workspace.applyEdit(edit);

    // Save
    await doc.save();

    // Send FILE_CHANGED event
    sendEvent({ kind: 'FILE_CHANGED', ... });
  }

  // Mark command as applied
  await markCommandApplied(command.commandId);
}
```

---

## 🎨 Dashboard Integration (✅ IMPLEMENTED)

### A. Hook: `useIdePatches`

**File:** `src/hooks/useIdePatches.ts`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebaseClient';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { IdePatch } from '@/types/ideEvents';

export function useIdePatches(projectId: string | null, sessionId: string | null) {
  const [patches, setPatches] = useState<IdePatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !sessionId) {
      setPatches([]);
      setLoading(false);
      return;
    }

    const patchesRef = collection(
      db,
      'projects',
      projectId,
      'ideSessions',
      sessionId,
      'patches'
    );

    const q = query(patchesRef, where('status', '==', 'pending'));

    const unsub = onSnapshot(q, (snap) => {
      const list: IdePatch[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        list.push({
          patchId: doc.id,
          sessionId: data.sessionId,
          projectId: data.projectId,
          createdBy: data.createdBy,
          ts: data.ts,
          files: data.files || [],
          status: data.status,
          appliedAt: data.appliedAt,
        });
      });
      setPatches(list);
      setLoading(false);
    });

    return () => unsub();
  }, [projectId, sessionId]);

  return { patches, loading };
}
```

---

### B. Component: `PatchViewer`

**File:** `src/components/f0/PatchViewer.tsx`

Interactive UI component with:
- ✅ Display all files in each patch
- ✅ Checkbox selection for individual files
- ✅ "Select All" / "Deselect All" buttons
- ✅ "Apply Selected to IDE" button
- ✅ Visual indicators for file operations (add/modify/delete)
- ✅ Loading state while applying

---

### C. Live Coding Page Integration

**File:** `src/app/[locale]/live/page.tsx`

```typescript
export default function LiveCodingPage() {
  const { sessions } = useLiveSessionsList();
  const activeSession = sessions.find((s) => s.status === 'active');

  // Fetch patches for active session
  const { patches } = useIdePatches(
    activeSession?.projectId || null,
    activeSession?.id || null
  );

  // Handle apply patch
  const handleApplyPatch = async (patchId: string, selectedFilePaths: string[]) => {
    const patch = patches.find((p) => p.patchId === patchId);
    if (!patch) return;

    const selectedFiles = patch.files
      .filter((f) => selectedFilePaths.includes(f.path))
      .map((f) => ({ path: f.path, newContent: f.newContent }));

    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await fetch('/api/live/send-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId,
        sessionId: activeSession.id,
        projectId: activeSession.projectId,
        kind: 'APPLY_PATCH',
        ts: new Date().toISOString(),
        payload: { patchId, files: selectedFiles },
      }),
    });

    alert('Patch command sent to IDE!');
  };

  return (
    <F0Shell>
      {/* ... Active Session Card ... */}

      {/* Patches from AI Agent */}
      {activeSession && (
        <div>
          <h2>Pending Patches from AI Agent</h2>
          <PatchViewer patches={patches} onApplyPatch={handleApplyPatch} />
        </div>
      )}
    </F0Shell>
  );
}
```

---

## 📝 Implementation Steps

### Phase 1: Basic Event Flow ✅ COMPLETE
1. ✅ Types defined (`ideEvents.ts`)
2. ✅ Cloud Functions (`ideIngestEvent`, `ideSendCommand`, `ideGetCommands`)
3. ✅ Firestore rules (lines 49-92 in `firestore.rules`)
4. ✅ Next.js API routes (`/api/live/send-command`)

### Phase 2: Dashboard Integration ✅ COMPLETE
1. ✅ `useIdePatches` hook for real-time patches
2. ✅ `PatchViewer` component with file selection
3. ✅ Live Coding page integration
4. ✅ "Apply Selected to IDE" functionality

### Phase 3: IDE Extension ⏳ TODO (Phase 87)
1. ⏳ VS Code extension scaffold
2. ⏳ Event sending (FILE_SNAPSHOT, FILE_CHANGED, HEARTBEAT)
3. ⏳ Command polling (every 3 seconds)
4. ⏳ Patch application logic (write files to workspace)
5. ⏳ Authentication flow
6. ⏳ Publish to marketplace

### Phase 4: Testing ⏳ TODO
1. ⏳ End-to-end flow with real IDE extension
2. ⏳ Error handling edge cases
3. ⏳ Performance optimization

---

## 🔗 Related Files

### Created/Modified (Phase 86):
- ✅ `functions/src/ide/ideIngestEvent.ts` - Event ingestion Cloud Function
- ✅ `functions/src/ide/ideSendCommand.ts` - Command sending Cloud Function
- ✅ `functions/src/ide/ideGetCommands.ts` - Command polling Cloud Function
- ✅ `functions/src/index.ts` - Export IDE Bridge functions (lines 573-575)
- ✅ `firestore.rules` - Security rules for ideSessions (lines 49-92)
- ✅ `src/app/api/live/send-command/route.ts` - API route for commands
- ✅ `src/hooks/useIdePatches.ts` - Real-time patches hook
- ✅ `src/components/f0/PatchViewer.tsx` - Interactive patch viewer
- ✅ `src/app/[locale]/live/page.tsx` - Live Coding page with patches

### Existing (Used):
- ✅ `src/types/ideEvents.ts` - Event/Command types
- ✅ `src/types/liveSession.ts` - Session types
- ✅ `src/hooks/useLiveSessionsList.ts` - Sessions list hook

---

## 📄 Documentation

- ✅ [IDE_BRIDGE_ARCHITECTURE.md](IDE_BRIDGE_ARCHITECTURE.md) - This file (architecture + implementation)
- ✅ [PHASE_86_IDE_BRIDGE_COMPLETE.md](PHASE_86_IDE_BRIDGE_COMPLETE.md) - Detailed completion report

---

**Status:** ✅ Phase 86 Complete - Backend + Dashboard Ready
**Next:** Phase 87 - VS Code/Cursor Extension Development
