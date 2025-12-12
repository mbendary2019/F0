# Phase 84.6 & 84.7 — VS Code Extension: Auto Project Detection + Auth

**Date**: 2025-11-20
**Status**: 📋 **IMPLEMENTATION PLAN**

---

## Overview

This document outlines the implementation plan for:
- **Phase 84.6**: Auto Project Detection (VS Code reads `.f0/project.json`)
- **Phase 84.7**: Authentication + Secure API communication

---

## Phase 84.6 — Auto Project Detection

### Objective
Enable VS Code extension to automatically detect and link to F0 projects using a local configuration file (`.f0/project.json`).

### Implementation Steps

#### 1️⃣ New File: `vscode-extension/src/projectConfig.ts`

**Purpose**: Read/write `.f0/project.json` in the workspace root.

**Key Functions**:
```typescript
export interface F0ProjectConfig {
  projectId: string;
  apiBase: string;
  createdAt: string;      // ISO string
  lastLinkedAt?: string;  // ISO string
}

async function getWorkspaceRoot(): Promise<vscode.Uri | null>
async function readProjectConfig(): Promise<F0ProjectConfig | null>
async function writeProjectConfig(config: F0ProjectConfig): Promise<void>
async function ensureProjectConfig(options: {
  apiBase: string;
  projectId?: string;
}): Promise<F0ProjectConfig | null>
```

**Behavior**:
- If `.f0/project.json` exists → Read and return config
- If not exists → Show QuickPick:
  - "Create F0 Project" (future: call API to create)
  - "Link Existing Project" (prompt for project ID)
  - "Cancel"

**File Structure**:
```json
{
  "projectId": "abc123xyz",
  "apiBase": "http://localhost:3030",
  "createdAt": "2025-11-20T10:00:00.000Z",
  "lastLinkedAt": "2025-11-20T10:00:00.000Z"
}
```

---

#### 2️⃣ Modified: `vscode-extension/src/projectBinding.ts`

**Purpose**: Central binding management using `globalState` + `.f0/project.json`.

**Key Functions**:
```typescript
export interface ProjectBinding {
  projectId: string;
  apiBase: string;
}

async function loadBinding(context: vscode.ExtensionContext): Promise<ProjectBinding | null>
async function saveBinding(context: vscode.ExtensionContext, binding: ProjectBinding): Promise<void>
async function ensureBinding(context: vscode.ExtensionContext, client: F0Client): Promise<ProjectBinding | null>
```

**Logic Flow** (`ensureBinding`):
1. Check `globalState` for existing binding
2. If not found → Check `.f0/project.json`
3. If found → Validate project ID via API (`/api/ide/project/validate`)
4. If valid → Save to `globalState` and return
5. If invalid → Show error and return null

---

#### 3️⃣ Modified: `vscode-extension/src/f0Client.ts`

**Added**:
```typescript
export class F0Client {
  constructor(public apiBase: string) {}

  async validateProject(projectId: string): Promise<boolean> {
    const res = await fetch(`${this.apiBase}/api/ide/project/validate`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return json.ok === true;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = await authManager.getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }
}
```

---

#### 4️⃣ Modified: `vscode-extension/src/extension.ts`

**Activation Flow**:
```typescript
export async function activate(context: vscode.ExtensionContext) {
  const apiBase = 'http://localhost:3030'; // or from config
  const client = new F0Client(apiBase);

  // Auto project detection on activation
  const binding = await ensureBinding(context, client);
  if (!binding) {
    console.log('F0: No project binding yet');
    // Extension works in basic mode without "Fix Selected Code"
  } else {
    console.log('F0: bound to project', binding.projectId);
  }

  // Register commands:
  // - F0: Open Assistant
  // - F0: Fix Selected Code
  // - F0: Link Project (manual override)
}
```

---

## Phase 84.7 — Authentication + Secure API

### Objective
Secure all API calls from VS Code extension using Firebase ID tokens.

### Implementation Steps

#### 1️⃣ New File: `vscode-extension/src/authManager.ts`

**Purpose**: Manage Firebase ID token storage and retrieval.

**Key Functions**:
```typescript
class AuthManager {
  private _token: string | null = null;
  constructor(private context: vscode.ExtensionContext) {}

  async loadFromStorage(): Promise<void>
  async setIdToken(token: string | null): Promise<void>
  async getIdToken(): Promise<string | null>
}

export function initAuthManager(context: vscode.ExtensionContext): void
export const authManager: {
  getIdToken: () => Promise<string | null>;
  setIdToken: (token: string | null) => Promise<void>;
}
```

**Storage**:
- Uses `context.globalState.update('f0.idToken', token)`
- Persists across VS Code sessions

**Temporary Flow** (until OAuth is implemented):
1. User gets ID token from F0 web dashboard
2. User runs command "F0: Set Token"
3. Extension prompts for token
4. Token is saved via `authManager.setIdToken(token)`

**Future Flow** (Phase 84.5 - OAuth):
1. User runs command "F0: Login"
2. Extension opens browser for Firebase Auth
3. Extension receives token via redirect/deeplink
4. Token is automatically saved

---

#### 2️⃣ Modified: `vscode-extension/src/f0Client.ts`

**All API Methods Use Auth**:
```typescript
async createIdeSession(payload: CreateSessionPayload) {
  const res = await fetch(`${this.apiBase}/api/ide/session`, {
    method: 'POST',
    headers: await this.getHeaders(),
    body: JSON.stringify(payload),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('UNAUTHORIZED');
  }
  return res.json();
}

async sendIdeChat(payload: ChatPayload) {
  const res = await fetch(`${this.apiBase}/api/ide/chat`, {
    method: 'POST',
    headers: await this.getHeaders(),
    body: JSON.stringify(payload),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('UNAUTHORIZED');
  }
  return res.json();
}
```

**Error Handling**:
- 401/403 → Show "Please login to F0" notification
- Optionally: Clear stored token and prompt re-login

---

#### 3️⃣ Backend: New Helper `src/lib/api/requireUser.ts`

**Purpose**: Extract and verify Firebase ID token from request headers.

```typescript
import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp } from '../server/firebaseAdmin';

export interface AuthedUser {
  uid: string;
  email?: string;
}

export async function requireUser(req: NextRequest): Promise<AuthedUser> {
  const app = getFirebaseAdminApp();
  const auth = getAuth(app);

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (!token) {
    throw new Error('NO_TOKEN');
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (err) {
    console.error('verifyIdToken failed', err);
    throw new Error('INVALID_TOKEN');
  }
}
```

---

#### 4️⃣ Backend: New Helper `src/lib/api/requireProjectOwner.ts`

**Purpose**: Verify that the authenticated user owns the project.

```typescript
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '../server/firebaseAdmin';

export async function requireProjectOwner(projectId: string, uid: string) {
  const app = getFirebaseAdminApp();
  const db = getFirestore(app);

  const snap = await db.collection('projects').doc(projectId).get();
  if (!snap.exists) {
    throw new Error('PROJECT_NOT_FOUND');
  }
  const data = snap.data() as any;
  if (!data.ownerUid || data.ownerUid !== uid) {
    throw new Error('FORBIDDEN_PROJECT');
  }

  return data;
}
```

---

#### 5️⃣ Backend: Modified `src/app/api/ide/session/route.ts`

**Before** (Insecure):
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  const projectId = body.projectId;
  // Create session without auth check
}
```

**After** (Secure):
```typescript
import { requireUser } from '@/src/lib/api/requireUser';
import { requireProjectOwner } from '@/src/lib/api/requireProjectOwner';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();

    const projectId: string = body.projectId;
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    await requireProjectOwner(projectId, user.uid);

    // Create IDE session
    // const sessionId = randomId();
    // await db.doc(`projects/${projectId}/ideSessions/${sessionId}`).set({...});

    return NextResponse.json({ ok: true, sessionId }, { status: 200 });
  } catch (e: any) {
    if (e.message === 'NO_TOKEN' || e.message === 'INVALID_TOKEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e.message === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (e.message === 'FORBIDDEN_PROJECT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

#### 6️⃣ Backend: Modified `src/app/api/ide/chat/route.ts`

**Same Pattern**:
```typescript
import { requireUser } from '@/src/lib/api/requireUser';
import { requireProjectOwner } from '@/src/lib/api/requireProjectOwner';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();

    const { projectId, sessionId, message, fileContext } = body;
    if (!projectId || !sessionId) {
      return NextResponse.json({ error: 'Missing projectId or sessionId' }, { status: 400 });
    }

    await requireProjectOwner(projectId, user.uid);

    // Pipeline:
    // - Read ideSession
    // - Call askAgent
    // - Generate patches
    // - Save to Firestore

    return NextResponse.json({ ok: true, response, patches }, { status: 200 });
  } catch (e: any) {
    // Same error handling as session route
  }
}
```

---

#### 7️⃣ Backend: New Route `src/app/api/ide/project/validate/route.ts`

**Purpose**: Validate project ID for auto-detection.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/src/lib/api/requireUser';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/server/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const app = getFirebaseAdminApp();
    const db = getFirestore(app);

    const snap = await db.collection('projects').doc(projectId).get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const data = snap.data() as any;
    if (data.ownerUid !== user.uid) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    if (e.message === 'NO_TOKEN' || e.message === 'INVALID_TOKEN') {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

#### 8️⃣ Firestore Rules

**Secure IDE Collections**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Projects
    match /projects/{projectId} {
      allow read: if resource.data.ownerUid == request.auth.uid;
      allow write: if request.resource.data.ownerUid == request.auth.uid;
    }

    // IDE Sessions
    match /projects/{projectId}/ideSessions/{sessionId} {
      allow read, write: if
        get(/databases/$(database)/documents/projects/$(projectId)).data.ownerUid == request.auth.uid;
    }

    // Threads (IDE chat history)
    match /projects/{projectId}/threads/{threadId} {
      allow read, write: if
        get(/databases/$(database)/documents/projects/$(projectId)).data.ownerUid == request.auth.uid;
    }

    // IDE Files (if stored in Firestore)
    match /projects/{projectId}/ideFiles/{fileId} {
      allow read, write: if
        get(/databases/$(database)/documents/projects/$(projectId)).data.ownerUid == request.auth.uid;
    }
  }
}
```

---

## Implementation Checklist

### Phase 84.6 — Auto Project Detection

- [ ] **VS Code Extension**:
  - [ ] Create `src/projectConfig.ts`
    - [ ] Implement `getWorkspaceRoot()`
    - [ ] Implement `readProjectConfig()`
    - [ ] Implement `writeProjectConfig()`
    - [ ] Implement `ensureProjectConfig()` with QuickPick
  - [ ] Modify `src/projectBinding.ts`
    - [ ] Add `loadBinding()`
    - [ ] Add `saveBinding()`
    - [ ] Add `ensureBinding()` with validation
  - [ ] Modify `src/f0Client.ts`
    - [ ] Add `validateProject()` method
  - [ ] Modify `src/extension.ts`
    - [ ] Call `ensureBinding()` on activation
    - [ ] Handle missing binding gracefully

- [ ] **Backend**:
  - [ ] Create `/api/ide/project/validate` route
    - [ ] Verify project exists
    - [ ] Verify user is owner
    - [ ] Return `{ ok: boolean }`

- [ ] **Testing**:
  - [ ] Test with existing `.f0/project.json`
  - [ ] Test with missing config (QuickPick appears)
  - [ ] Test "Link Existing Project" flow
  - [ ] Test invalid project ID rejection
  - [ ] Test project ownership validation

---

### Phase 84.7 — Authentication + Security

- [ ] **VS Code Extension**:
  - [ ] Create `src/authManager.ts`
    - [ ] Implement `loadFromStorage()`
    - [ ] Implement `setIdToken()`
    - [ ] Implement `getIdToken()`
    - [ ] Export singleton `authManager`
  - [ ] Modify `src/extension.ts`
    - [ ] Call `initAuthManager(context)` on activation
    - [ ] Register "F0: Set Token" command (temporary)
  - [ ] Modify `src/f0Client.ts`
    - [ ] Add `getHeaders()` method
    - [ ] Use `getHeaders()` in all API calls
    - [ ] Handle 401/403 errors gracefully

- [ ] **Backend**:
  - [ ] Create `src/lib/api/requireUser.ts`
    - [ ] Read `Authorization` header
    - [ ] Verify Firebase ID token
    - [ ] Return `{ uid, email }`
    - [ ] Throw `NO_TOKEN` or `INVALID_TOKEN` errors
  - [ ] Create `src/lib/api/requireProjectOwner.ts`
    - [ ] Read project document
    - [ ] Verify `ownerUid === uid`
    - [ ] Throw `PROJECT_NOT_FOUND` or `FORBIDDEN_PROJECT` errors
  - [ ] Modify `/api/ide/session/route.ts`
    - [ ] Add `requireUser()` call
    - [ ] Add `requireProjectOwner()` call
    - [ ] Return proper HTTP status codes
  - [ ] Modify `/api/ide/chat/route.ts`
    - [ ] Add `requireUser()` call
    - [ ] Add `requireProjectOwner()` call
    - [ ] Return proper HTTP status codes
  - [ ] Update `firestore.rules`
    - [ ] Secure `projects` collection
    - [ ] Secure `ideSessions` subcollection
    - [ ] Secure `threads` subcollection
    - [ ] Secure `ideFiles` subcollection (if applicable)

- [ ] **Testing**:
  - [ ] Test API call without token → 401
  - [ ] Test API call with invalid token → 401
  - [ ] Test API call with valid token but wrong project → 403
  - [ ] Test API call with valid token and own project → 200
  - [ ] Test "F0: Set Token" command flow
  - [ ] Test "F0: Fix Selected Code" with auth
  - [ ] Test Firestore rules with Firebase Emulator

---

## Error Scenarios & Handling

### Scenario 1: No Token in VS Code
**Flow**:
1. User runs "F0: Fix Selected Code"
2. Extension calls `client.createIdeSession()`
3. `authManager.getIdToken()` returns `null`
4. Request is sent without `Authorization` header
5. Backend returns 401
6. Extension shows notification: "Please login to F0. Run 'F0: Set Token' command."

### Scenario 2: Invalid/Expired Token
**Flow**:
1. User has old token stored
2. Extension calls API with token
3. Backend `verifyIdToken()` fails
4. Backend returns 401
5. Extension clears token: `authManager.setIdToken(null)`
6. Extension shows notification: "Session expired. Please login again."

### Scenario 3: User Not Project Owner
**Flow**:
1. User has valid token
2. User tries to access another user's project
3. Backend `requireProjectOwner()` throws `FORBIDDEN_PROJECT`
4. Backend returns 403
5. Extension shows error: "You don't have access to this project."

### Scenario 4: Project Not Found
**Flow**:
1. `.f0/project.json` contains non-existent project ID
2. Extension calls `client.validateProject(projectId)`
3. Backend returns `{ ok: false }`
4. Extension shows error: "Invalid project ID in .f0/project.json"
5. Extension prompts user to link a different project

---

## Security Improvements Summary

### Before (Insecure)
- ❌ No authentication required
- ❌ Any VS Code instance can access any project
- ❌ No ownership validation
- ❌ Direct Firestore access from client

### After (Secure)
- ✅ Firebase ID token required for all API calls
- ✅ Token verified using Firebase Admin SDK
- ✅ Project ownership validated before operations
- ✅ Proper HTTP status codes (401/403/404)
- ✅ Firestore rules enforce server-side checks
- ✅ Token stored securely in VS Code `globalState`

---

## Future Enhancements (Post Phase 84.7)

### Phase 84.5 — OAuth Flow
- Replace "F0: Set Token" with proper OAuth
- Open browser for Firebase Auth
- Receive token via deeplink/redirect
- Auto-refresh expired tokens

### Phase 84.8 — Multi-User Projects
- Support shared projects (not just owner)
- Add `collaborators` array in Firestore
- Update `requireProjectOwner` → `requireProjectAccess`

### Phase 84.9 — Offline Mode
- Cache project data locally
- Queue operations when offline
- Sync when connection restored

---

## Testing Commands

### VS Code Extension Testing
```bash
# In vscode-extension directory
npm run compile
code --extensionDevelopmentPath=.
```

### Backend Testing
```bash
# Start emulators
firebase emulators:start --only auth,firestore,functions

# Test API with curl
curl -X POST http://localhost:3030/api/ide/session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -d '{"projectId":"test-123","clientKind":"vscode"}'
```

### Get Test ID Token
```javascript
// In browser console on F0 dashboard
const user = firebase.auth().currentUser;
const token = await user.getIdToken();
console.log(token);
```

---

## Success Criteria

Phase 84.6 & 84.7 are complete when:

1. ✅ VS Code extension auto-detects `.f0/project.json`
2. ✅ VS Code extension prompts for project linking if config missing
3. ✅ VS Code extension validates project ID via API
4. ✅ All API calls include `Authorization: Bearer <token>` header
5. ✅ Backend rejects requests without valid token (401)
6. ✅ Backend rejects requests for unowned projects (403)
7. ✅ Firestore rules prevent unauthorized access
8. ✅ "F0: Fix Selected Code" command works end-to-end with auth
9. ✅ Error messages are clear and actionable
10. ✅ No sensitive data (tokens, project IDs) logged to console

---

**Next Steps**: Begin implementation starting with VS Code extension auth manager, then backend helpers, then integrate into existing API routes.

