# Team Workspaces & Access Control

**Sprint 7**: Complete implementation of team collaboration with workspaces, role-based access control, secure invitations, and member management.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Firestore Schema](#firestore-schema)
4. [Security Rules](#security-rules)
5. [API Routes](#api-routes)
6. [React Hooks](#react-hooks)
7. [Environment Variables](#environment-variables)
8. [Usage Examples](#usage-examples)
9. [Role Permissions](#role-permissions)
10. [Invite System](#invite-system)
11. [Testing](#testing)
12. [Best Practices](#best-practices)

---

## Overview

The workspace system enables team collaboration with:

✅ **Multi-tenant workspaces** - Users can belong to multiple workspaces
✅ **Role-based access** - Owner, Admin, Member, Viewer roles
✅ **Secure invites** - Token-based invitations with expiry
✅ **Member management** - Add, remove, and change member roles
✅ **Firestore rules** - Client-side security enforcement
✅ **Audit logging** - Track all workspace operations
✅ **Rate limiting** - Prevent abuse

---

## Architecture

### Data Flow

```
Create Workspace
     ↓
User becomes Owner
     ↓
Create Invite → Generate Token → Send URL
     ↓
Recipient clicks URL
     ↓
API verifies token → Add as Member
     ↓
Member can access workspace resources
```

### Security Layers

```
1. Middleware → Check authentication
2. API Route → Verify token + claims
3. Firestore Rules → Enforce role-based access
4. Rate Limiting → Prevent abuse
5. Audit Logs → Track operations
```

---

## Firestore Schema

### Collections Structure

```
workspaces/
  {wsId}/
    name: string
    ownerUid: string
    planTier: 'free' | 'pro' | 'enterprise'
    createdAt: Timestamp
    updatedAt: Timestamp

    members/
      {uid}/
        role: 'owner' | 'admin' | 'member' | 'viewer'
        status: 'active' | 'invited' | 'revoked'
        invitedBy?: string
        joinedAt?: Timestamp
        updatedAt?: Timestamp

invites/
  {inviteId}/
    wsId: string
    email?: string | null
    role: 'admin' | 'member' | 'viewer'
    tokenHash: string              # SHA-256 hash
    expiresAt: Timestamp
    createdAt: Timestamp
    createdBy: string
    usedBy?: string | null
    usedAt?: Timestamp | null
```

### Field Explanations

#### Workspace Document

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Workspace display name (max 80 chars) |
| `ownerUid` | string | User ID of workspace owner |
| `planTier` | string | Subscription tier (free, pro, enterprise) |
| `createdAt` | Timestamp | When workspace was created |
| `updatedAt` | Timestamp | Last update timestamp |

#### Member Document

| Field | Type | Description |
|-------|------|-------------|
| `role` | string | Member role (owner, admin, member, viewer) |
| `status` | string | Membership status (active, invited, revoked) |
| `invitedBy` | string? | UID of user who invited this member |
| `joinedAt` | Timestamp? | When member joined workspace |
| `updatedAt` | Timestamp? | Last role/status update |

#### Invite Document

| Field | Type | Description |
|-------|------|-------------|
| `wsId` | string | Workspace ID this invite is for |
| `email` | string? | Optional email restriction |
| `role` | string | Role to assign when accepted |
| `tokenHash` | string | SHA-256 hash of invite token |
| `expiresAt` | Timestamp | When invite expires |
| `createdAt` | Timestamp | When invite was created |
| `createdBy` | string | UID of user who created invite |
| `usedBy` | string? | UID of user who accepted (if used) |
| `usedAt` | Timestamp? | When invite was accepted |

---

## Security Rules

File: `firestore.rules`

### Helper Functions

```javascript
// Check if user is a member of workspace
function isMember(wsId) {
  return isAuthenticated() &&
    exists(/databases/$(database)/documents/workspaces/$(wsId)/members/$(request.auth.uid));
}

// Get member's role in workspace
function memberRole(wsId) {
  return get(/databases/$(database)/documents/workspaces/$(wsId)/members/$(request.auth.uid)).data.role;
}

// Check if user has one of the specified roles
function hasRole(wsId, roles) {
  return isMember(wsId) && (memberRole(wsId) in roles);
}
```

### Workspace Rules

```javascript
match /workspaces/{wsId} {
  // Read: Only members can read workspace
  allow read: if isMember(wsId);

  // Create: Any authenticated user can create workspace
  allow create: if isAuthenticated();

  // Update: Only owners and admins can update
  allow update: if hasRole(wsId, ['owner', 'admin']);

  // Delete: Only owner can delete workspace
  allow delete: if hasRole(wsId, ['owner']);

  // Members subcollection
  match /members/{uid} {
    // Read: All workspace members can see member list
    allow read: if isMember(wsId);

    // Write: Never allow from client (API routes only)
    // This prevents users from elevating their own roles
    allow write: if false;
  }
}
```

### Invite Rules

```javascript
match /invites/{inviteId} {
  // No client access (API routes only)
  // Invites are created and consumed via API
  allow read, write: if false;
}
```

---

## API Routes

### 1. Create Workspace

**Endpoint:** `POST /api/workspaces/create`

**Request:**
```json
{
  "name": "My Team"
}
```

**Response:**
```json
{
  "id": "ws_abc123",
  "name": "My Team"
}
```

**Implementation:** [src/app/api/workspaces/create/route.ts](../src/app/api/workspaces/create/route.ts)

### 2. Create Invite

**Endpoint:** `POST /api/workspaces/[wsId]/invite`

**Request:**
```json
{
  "email": "user@example.com",  // Optional
  "role": "member"              // admin | member | viewer
}
```

**Response:**
```json
{
  "inviteId": "inv_xyz789",
  "url": "https://app.com/workspaces/invite?token=abc&id=inv_xyz789",
  "role": "member",
  "expiresAt": "2025-01-15T12:00:00Z"
}
```

**Implementation:** [src/app/api/workspaces/[wsId]/invite/route.ts](../src/app/api/workspaces/[wsId]/invite/route.ts)

### 3. Accept Invite

**Endpoint:** `POST /api/workspaces/invite/accept`

**Request:**
```json
{
  "token": "abc123...",
  "id": "inv_xyz789"
}
```

**Response:**
```json
{
  "ok": true,
  "wsId": "ws_abc123",
  "role": "member"
}
```

**Implementation:** [src/app/api/workspaces/invite/accept/route.ts](../src/app/api/workspaces/invite/accept/route.ts)

### 4. Change Member Role

**Endpoint:** `POST /api/workspaces/[wsId]/members/[memberUid]/role`

**Request:**
```json
{
  "newRole": "admin"  // admin | member | viewer
}
```

**Response:**
```json
{
  "ok": true,
  "role": "admin"
}
```

**Implementation:** [src/app/api/workspaces/[wsId]/members/[memberUid]/role/route.ts](../src/app/api/workspaces/[wsId]/members/[memberUid]/role/route.ts)

### 5. Remove Member

**Endpoint:** `DELETE /api/workspaces/[wsId]/members/[memberUid]`

**Response:**
```json
{
  "ok": true,
  "message": "Member removed successfully"
}
```

**Implementation:** [src/app/api/workspaces/[wsId]/members/[memberUid]/route.ts](../src/app/api/workspaces/[wsId]/members/[memberUid]/route.ts)

---

## React Hooks

File: `src/hooks/useWorkspace.ts`

### useWorkspace

Subscribe to a single workspace:

```typescript
const workspace = useWorkspace(wsId);

if (!workspace) return <div>Loading...</div>;

return <div>{workspace.name}</div>;
```

### useMembers

Subscribe to workspace members:

```typescript
const members = useMembers(wsId);

return (
  <ul>
    {members.map(member => (
      <li key={member.id}>
        {member.id} - {member.role}
      </li>
    ))}
  </ul>
);
```

### useUserWorkspaces

Get all workspaces for current user:

```typescript
const workspaces = useUserWorkspaces();

return (
  <select>
    {workspaces.map(ws => (
      <option key={ws.id} value={ws.id}>
        {ws.name}
      </option>
    ))}
  </select>
);
```

### useMyRole

Get current user's role in a workspace:

```typescript
const myRole = useMyRole(wsId);

if (myRole === 'owner' || myRole === 'admin') {
  return <AdminPanel />;
}

return <MemberView />;
```

---

## Environment Variables

```bash
# Application URL (for invite links)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Invite token secret (for hashing)
INVITE_TOKEN_SECRET=your-random-32-char-secret

# Invite expiry (in minutes)
INVITE_TTL_MINUTES=10080  # 1 week

# Security (from Sprint 6)
AUDIT_LOGS_ENABLED=1
AUDIT_IP_HASH_SECRET=your-secret
RATE_LIMIT_POINTS=60
RATE_LIMIT_DURATION_SECONDS=60
```

---

## Usage Examples

### Create a Workspace

```typescript
async function createWorkspace(name: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const idToken = await user.getIdToken();

  const response = await fetch("/api/workspaces/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ name }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to create workspace");
  }

  return data; // { id, name }
}
```

### Invite a Member

```typescript
async function inviteMember(wsId: string, email: string, role: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const idToken = await user.getIdToken();

  const response = await fetch(`/api/workspaces/${wsId}/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ email, role }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to create invite");
  }

  return data; // { inviteId, url, role, expiresAt }
}
```

### Accept an Invite

```typescript
async function acceptInvite(token: string, id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const idToken = await user.getIdToken();

  const response = await fetch("/api/workspaces/invite/accept", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ token, id }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to accept invite");
  }

  return data; // { ok, wsId, role }
}
```

---

## Role Permissions

### Permission Matrix

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| Read workspace | ✅ | ✅ | ✅ | ✅ |
| Update workspace | ✅ | ✅ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ | ❌ |
| View members | ✅ | ✅ | ✅ | ✅ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Change member roles | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| Leave workspace | ❌ | ✅ | ✅ | ✅ |

### Role Descriptions

**Owner**
- Full control over workspace
- Can delete workspace
- Cannot be removed or have role changed
- Cannot leave workspace (must transfer ownership first)
- One owner per workspace

**Admin**
- Can manage members and invites
- Can update workspace settings
- Cannot delete workspace or change owner role
- Can leave workspace

**Member**
- Can access workspace resources
- Cannot manage members or settings
- Can leave workspace

**Viewer**
- Read-only access to workspace
- Cannot modify anything
- Can leave workspace

---

## Invite System

### How Invites Work

1. **Create Invite**
   - Admin/Owner generates invite
   - Secure random token created (24 bytes)
   - Token hashed with SHA-256
   - Only hash stored in Firestore
   - Raw token included in URL

2. **Send Invite**
   - URL format: `https://app.com/workspaces/invite?token=ABC&id=inv_123`
   - Optional: Restrict to specific email
   - Expires after TTL (default: 1 week)

3. **Accept Invite**
   - User clicks URL
   - Token verified against hash
   - Email checked (if restricted)
   - User added as member
   - Invite marked as used

### Security Features

✅ **Token Hashing** - Raw tokens never stored
✅ **Expiry** - Invites auto-expire
✅ **One-time Use** - Invites can only be used once
✅ **Email Restriction** - Optional email validation
✅ **Audit Logging** - All invite operations logged

### Invite States

| State | Description |
|-------|-------------|
| **Pending** | Created, not yet used, not expired |
| **Used** | Successfully accepted by a user |
| **Expired** | Past expiry timestamp |

---

## Testing

### 1. Create Workspace

```bash
# Get ID token from browser console
const token = await auth.currentUser.getIdToken();

# Create workspace
curl -X POST http://localhost:3000/api/workspaces/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Workspace"}'
```

### 2. Create Invite

```bash
curl -X POST http://localhost:3000/api/workspaces/ws_123/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","role":"member"}'
```

### 3. Accept Invite

```bash
curl -X POST http://localhost:3000/api/workspaces/invite/accept \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"ABC123...","id":"inv_xyz"}'
```

### 4. Test Firestore Rules

```javascript
// Try to directly write to members (should fail)
const db = getFirestore();
await setDoc(doc(db, 'workspaces/ws_123/members/user123'), {
  role: 'owner' // ❌ Should be denied by rules
});
```

---

## Best Practices

### Workspace Management

1. ✅ **One owner per workspace** - Simplifies permission model
2. ✅ **Limit admin count** - Too many admins = security risk
3. ✅ **Regular audits** - Review member list periodically
4. ✅ **Remove inactive members** - Clean up regularly

### Invite Security

1. ✅ **Short TTL** - Shorter invites = less risk
2. ✅ **Email restriction** - When possible, restrict to specific email
3. ✅ **Monitor usage** - Track invite acceptance rates
4. ✅ **Revoke unused** - Delete old pending invites

### Performance

1. ✅ **Index members** - Create composite indexes for queries
2. ✅ **Batch operations** - Use batched writes when possible
3. ✅ **Cache workspace data** - Use React hooks for real-time sync
4. ✅ **Pagination** - For large member lists

### Compliance

1. ✅ **Audit trail** - Log all member changes
2. ✅ **Data retention** - Define member data retention policy
3. ✅ **Access reviews** - Periodic access reviews
4. ✅ **Offboarding** - Remove members when they leave organization

---

## Summary

Sprint 7 provides enterprise-grade team collaboration:

- ✅ Multi-tenant workspaces
- ✅ Role-based access control (Owner/Admin/Member/Viewer)
- ✅ Secure token-based invitations
- ✅ Firestore security rules
- ✅ Complete API suite
- ✅ React hooks for easy integration
- ✅ Audit logging
- ✅ Rate limiting

All workspace operations are:
1. Protected by authentication
2. Enforced by Firestore rules
3. Rate limited
4. Audit logged
5. Role-based authorized

Next steps:
- Create UI pages for workspace management
- Implement workspace switcher component
- Add workspace-specific resources
- Set up billing per workspace
