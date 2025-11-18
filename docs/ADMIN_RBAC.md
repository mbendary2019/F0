# Admin RBAC (Role-Based Access Control)

This document describes the Admin RBAC system implementation.

## Overview

The Admin RBAC system provides role-based access control for administrative operations. It includes authentication guards, audit logging, and API endpoints for managing user roles.

## Architecture

### Authentication Guard

**File**: `src/lib/admin/assertAdminReq.ts`

A unified guard that:
1. Verifies user authentication via `authGuard()`
2. Checks if user has admin role via `isAdmin(uid)`
3. Returns 401 if not authenticated
4. Returns 403 if authenticated but not admin

```typescript
import { assertAdminReq } from '@/lib/admin/assertAdminReq';

export async function GET() {
  const { uid } = await assertAdminReq();
  // Admin-only operations...
}
```

### Audit Logging

**File**: `src/lib/admin/audit.ts`

Logs admin actions for compliance and security tracking.

```typescript
await auditAdmin('grant', actorUid, targetUid);
```

**Future Enhancement**: Connect to Firestore collection `admin_audit` with schema:
```typescript
{
  action: string,      // 'grant', 'revoke', etc.
  actorUid: string,    // Who performed the action
  targetUid?: string,  // Who was affected
  timestamp: number    // Date.now()
}
```

## API Endpoints

### Grant Role

**POST** `/api/admin/users/{uid}/grant`

Grants a role to a user.

**Request Body**:
```json
{
  "role": "admin"
}
```

**Response**:
```json
{
  "ok": true
}
```

**Status Codes**:
- 200: Success
- 401: Not authenticated
- 403: Not admin
- 400: Invalid request body

### Revoke Role

**POST** `/api/admin/users/{uid}/revoke`

Revokes a role from a user.

**Request Body**:
```json
{
  "role": "admin"
}
```

**Response**:
```json
{
  "ok": true
}
```

**Status Codes**:
- 200: Success
- 401: Not authenticated
- 403: Not admin
- 400: Invalid request body

### List Admins

**GET** `/api/admin/admins`

Lists all users with admin role.

**Response**:
```json
{
  "admins": [
    {
      "uid": "user123",
      "email": "admin@example.com",
      "roles": ["admin", "moderator"]
    }
  ]
}
```

**Status Codes**:
- 200: Success
- 401: Not authenticated
- 403: Not admin

## Admin UI

**Route**: `/admin`

A simple admin control panel that displays:
- List of all admin users
- User IDs, emails, and roles

**Future Enhancements**:
- Grant/Revoke role forms
- Optimistic UI updates
- Toast notifications
- User search and filtering

## User Profile Functions

**File**: `src/lib/userProfile.ts`

Core functions for managing user roles and profile data:

### Role Management

```typescript
// Get user's roles
const roles = await getUserRoles(uid);

// Add a role
await addRole(uid, 'admin');

// Remove a role
await removeRole(uid, 'moderator');

// Check if user is admin
const isUserAdmin = await isAdmin(uid);

// List all admins
const admins = await listAdmins();
```

### Profile Data

```typescript
// Get user's plan
const plan = await getPlan(uid); // 'free', 'pro', etc.

// Get user's usage stats
const usage = await getUsage(uid); // { calls: 0, tokens: 0 }
```

## Firestore Schema

### Users Collection

```
/users/{uid}
{
  email: string,
  roles: string[],      // ['admin', 'moderator', etc.]
  plan: string,         // 'free', 'pro', etc.
  createdAt: timestamp
}
```

### Usage Collection

```
/usage/{uid}
{
  calls: number,
  tokens: number,
  lastUpdated: timestamp
}
```

### Admin Audit Collection (Future)

```
/admin_audit/{auditId}
{
  action: string,
  actorUid: string,
  targetUid: string,
  timestamp: number
}
```

## Security Considerations

1. **Authentication First**: All admin endpoints verify authentication before checking admin role
2. **Role Verification**: Admin status is verified from Firestore, not from client claims
3. **Audit Trail**: All admin actions should be logged (currently console.log, will be Firestore)
4. **Least Privilege**: Only admins can access admin endpoints
5. **Session Validation**: Uses secure session cookies with Firebase Admin SDK

## Testing

See `tests/admin-rbac.test.ts` for unit tests.

To run tests:
```bash
npm test
```

## Future Enhancements

1. **Audit Dashboard**: View and filter admin audit logs
2. **Role Hierarchy**: Define role permissions and hierarchies
3. **Bulk Operations**: Grant/revoke roles for multiple users
4. **Activity Monitoring**: Real-time admin activity feed
5. **Role Templates**: Pre-defined role combinations
6. **RBAC Rules Engine**: Dynamic permission checks based on custom rules

