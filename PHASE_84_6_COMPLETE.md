# Phase 84.6 — Auto Project Detection & Auth Complete

**Date**: 2025-11-20
**Phase**: 84.6 & Partial 84.7
**Status**: ✅ Complete

---

## Summary

Phase 84.6 (Auto Project Detection) and core Phase 84.7 (Authentication) infrastructure have been successfully implemented. The VS Code extension now has project validation capabilities, and the backend has secure authentication helpers for IDE endpoints.

### Key Discovery

During implementation, we discovered that **Phase 84.6 auto-detection infrastructure was already substantially complete** in the existing codebase:

- ✅ `projectDetection.ts` — Auto-detection logic exists
- ✅ `f0ProjectConfig.ts` — Type definitions exist
- ✅ `projectBinding.ts` — Priority system (`.f0/project.json` > workspace settings)
- ✅ `authManager.ts` — OAuth authentication (Phase 84.4/84.5)

**What was missing**:
- ❌ Backend project validation endpoint
- ❌ `validateProject()` method in F0Client
- ❌ Backend authentication helpers (`requireUser`, `requireProjectOwner`)

---

## What Was Implemented

### 1. VS Code Extension Updates

**File**: `ide/vscode-f0-bridge/src/api/f0Client.ts`

**Added**: `validateProject()` method (lines 129-167)

```typescript
async validateProject(projectId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const binding = getProjectBinding();
    if (!binding) {
      return { ok: false, error: 'NO_BINDING' };
    }

    const token = await this.authManager.ensureSignedIn();

    const res = await fetch(`${binding.apiBase}/api/ide/project/validate`, {
      method: 'POST',
      headers: this.buildHeaders(token.accessToken),
      body: JSON.stringify({ projectId }),
    });

    if (!res.ok) {
      if (res.status === 401) return { ok: false, error: 'UNAUTHORIZED' };
      if (res.status === 403) return { ok: false, error: 'NOT_OWNER' };
      if (res.status === 404) return { ok: false, error: 'PROJECT_NOT_FOUND' };
      return { ok: false, error: 'UNKNOWN_ERROR' };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('validateProject error:', err);
    return { ok: false, error: 'NETWORK_ERROR' };
  }
}
```

---

### 2. Backend Authentication Helpers

#### `src/lib/api/requireUser.ts` (NEW)

**Purpose**: Extract and verify Firebase ID token from Authorization header

```typescript
import { NextRequest } from 'next/server';
import { adminAuth } from '@/server/firebaseAdmin';

export interface AuthedUser {
  uid: string;
  email?: string;
}

export async function requireUser(req: NextRequest): Promise<AuthedUser> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (!token) {
    throw new Error('NO_TOKEN');
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch (err) {
    console.error('verifyIdToken failed:', err);
    throw new Error('INVALID_TOKEN');
  }
}
```

**Throws**:
- `NO_TOKEN` — Missing Authorization header
- `INVALID_TOKEN` — Token verification failed

---

#### `src/lib/api/requireProjectOwner.ts` (NEW)

**Purpose**: Verify that the authenticated user owns the specified project

```typescript
import { adminDb } from '@/server/firebaseAdmin';
import { AuthedUser } from './requireUser';

export interface ProjectOwnership {
  projectId: string;
  ownerId: string;
}

export async function requireProjectOwner(
  user: AuthedUser,
  projectId: string
): Promise<ProjectOwnership> {
  if (!projectId) {
    throw new Error('PROJECT_ID_REQUIRED');
  }

  try {
    const projectDoc = await adminDb.collection('projects').doc(projectId).get();

    if (!projectDoc.exists) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    const projectData = projectDoc.data();
    const ownerId = projectData?.ownerId || projectData?.userId;

    if (!ownerId) {
      console.error('Project missing ownerId/userId:', projectId);
      throw new Error('PROJECT_INVALID');
    }

    if (ownerId !== user.uid) {
      console.warn('Ownership mismatch:', {
        projectId,
        expected: user.uid,
        actual: ownerId,
      });
      throw new Error('NOT_OWNER');
    }

    return {
      projectId,
      ownerId,
    };
  } catch (err: any) {
    if (
      err.message === 'PROJECT_NOT_FOUND' ||
      err.message === 'PROJECT_INVALID' ||
      err.message === 'NOT_OWNER'
    ) {
      throw err;
    }

    console.error('requireProjectOwner Firestore error:', err);
    throw new Error('DATABASE_ERROR');
  }
}
```

**Throws**:
- `PROJECT_ID_REQUIRED` — Missing projectId parameter
- `PROJECT_NOT_FOUND` — Project doesn't exist in Firestore
- `PROJECT_INVALID` — Project missing ownerId/userId field
- `NOT_OWNER` — User doesn't own the project
- `DATABASE_ERROR` — Firestore query error

---

### 3. Backend API Route

#### `src/app/api/ide/project/validate/route.ts` (NEW)

**Endpoint**: `POST /api/ide/project/validate`

**Request**:
```json
{
  "projectId": "abc123"
}
```

**Response** (Success):
```json
{
  "ok": true
}
```

**Response** (Error):
```json
{
  "ok": false,
  "error": "NOT_OWNER"
}
```

**HTTP Status Codes**:
- `200` — Success (user owns project)
- `400` — Missing projectId
- `401` — Missing or invalid token
- `403` — User doesn't own project
- `404` — Project not found
- `500` — Server error

---

## How It Works

### Auto Project Detection Flow

1. User opens workspace in VS Code
2. Extension activates and calls `getProjectBinding()`
3. Priority check:
   - First: Look for `.f0/project.json` (via `detectF0Project()`)
   - Fallback: Check workspace settings
4. If `.f0/project.json` exists, project is auto-detected
5. Extension uses `f0Client.validateProject()` to verify ownership
6. Backend verifies user owns project via Firestore

### Authentication Flow

1. **VS Code Extension** → Calls `authManager.ensureSignedIn()`
2. **AuthManager** → Returns Firebase ID token
3. **F0Client** → Adds `Authorization: Bearer {token}` header
4. **Backend** → Calls `requireUser(req)` to verify token
5. **Backend** → Calls `requireProjectOwner(user, projectId)` to verify ownership
6. **Response** → Success (`200`) or error (`401`/`403`/`404`/`500`)

---

## Files Modified/Created

### Modified Files
- `ide/vscode-f0-bridge/src/api/f0Client.ts` — Added `validateProject()` method

### New Files
- `src/lib/api/requireUser.ts` — Firebase ID token verification
- `src/lib/api/requireProjectOwner.ts` — Project ownership verification
- `src/app/api/ide/project/validate/route.ts` — Validation endpoint

---

## Testing

### Test Commands

```bash
# 1. Create test .f0/project.json
mkdir -p /path/to/workspace/.f0
echo '{
  "projectId": "your-project-id",
  "projectName": "Test Project",
  "backendUrl": "http://localhost:3030",
  "environment": "dev"
}' > /path/to/workspace/.f0/project.json

# 2. Test validation endpoint (with valid token)
curl -X POST http://localhost:3030/api/ide/project/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -d '{"projectId": "your-project-id"}'

# Expected: {"ok":true}

# 3. Test validation endpoint (missing token)
curl -X POST http://localhost:3030/api/ide/project/validate \
  -H "Content-Type: application/json" \
  -d '{"projectId": "your-project-id"}'

# Expected: {"ok":false,"error":"NO_TOKEN"}
```

---

## Next Steps (Phase 84.7 Continuation)

To finish Phase 84.7, secure existing IDE endpoints:

1. Update `src/app/api/ide/session/route.ts` to use `requireUser` and `requireProjectOwner`
2. Update `src/app/api/ide/chat/route.ts` to use `requireUser` and `requireProjectOwner`
3. Update Firestore security rules for IDE collections
4. End-to-end testing with authentication

---

## Security Comparison

### Before
```typescript
// ❌ INSECURE: No authentication
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId } = body;
  // Anyone can access any project!
  const session = await createSession(projectId);
  return NextResponse.json(session);
}
```

### After
```typescript
// ✅ SECURE: Authentication + ownership verification
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  const body = await req.json();
  const { projectId } = body;
  await requireProjectOwner(user, projectId);
  const session = await createSession(projectId);
  return NextResponse.json(session);
}
```

---

**Phase 84.6**: ✅ Complete
**Phase 84.7**: 🟡 Partially Complete (auth helpers done, endpoints need updates)
**Next**: Secure existing IDE endpoints with new auth helpers
