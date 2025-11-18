# Phase 47 - Teams, Seats & RBAC ✅

## Overview

Phase 47 implements a complete **Teams, Seats, and Role-Based Access Control (RBAC)** system for organizations. Users can create organizations, invite members with specific roles, manage seat limits, and enforce permissions.

All functions use **Firebase Functions v2** with **Node.js 20** runtime.

---

## ✅ What Was Deployed

### Cloud Functions (8 new)

#### 1. createOrg (Callable)
- **Purpose:** Create a new organization
- **Input:** `{ name: string, seats?: number }`
- **Features:**
  - Validates organization name
  - Default seats: 5 (range: 1-1000)
  - Creator automatically added as owner
  - Atomic transaction for org + owner member
- **Location:** [functions/src/orgs/management.ts](functions/src/orgs/management.ts)

#### 2. updateOrg (Callable)
- **Purpose:** Update organization details
- **Input:** `{ orgId: string, name: string }`
- **Permissions:** Owner or Admin
- **Features:**
  - Update organization name
  - RBAC permission checks
- **Location:** [functions/src/orgs/management.ts](functions/src/orgs/management.ts)

#### 3. deleteOrg (Callable)
- **Purpose:** Delete organization and all related data
- **Input:** `{ orgId: string }`
- **Permissions:** Owner only
- **Features:**
  - Deletes org, members, and pending invites
  - Atomic transaction
- **Location:** [functions/src/orgs/management.ts](functions/src/orgs/management.ts)

#### 4. inviteMember (Callable)
- **Purpose:** Invite a new member to organization
- **Input:** `{ orgId: string, email: string, role: 'admin' | 'member' | 'viewer' }`
- **Permissions:** Owner or Admin
- **Features:**
  - Checks seat availability
  - Validates role
  - Prevents duplicate invites
  - Invite expires in 7 days
- **Location:** [functions/src/orgs/members.ts](functions/src/orgs/members.ts)

#### 5. acceptInvite (Callable)
- **Purpose:** Accept organization invite
- **Input:** `{ inviteId: string }`
- **Features:**
  - Validates invite email matches user
  - Checks expiration
  - Increments seat usage
  - Atomic transaction
- **Location:** [functions/src/orgs/members.ts](functions/src/orgs/members.ts)

#### 6. removeMember (Callable)
- **Purpose:** Remove member from organization
- **Input:** `{ orgId: string, memberUid: string }`
- **Permissions:** Owner or Admin (with restrictions)
- **Features:**
  - Cannot remove owner
  - Admins can only remove members/viewers
  - Decrements seat usage
  - Atomic transaction
- **Location:** [functions/src/orgs/members.ts](functions/src/orgs/members.ts)

#### 7. updateRole (Callable)
- **Purpose:** Update member's role
- **Input:** `{ orgId: string, memberUid: string, newRole: 'admin' | 'member' | 'viewer' }`
- **Permissions:** Owner or Admin (with restrictions)
- **Features:**
  - Cannot change owner role
  - Role hierarchy enforcement
- **Location:** [functions/src/orgs/members.ts](functions/src/orgs/members.ts)

#### 8. updateSeats (Callable)
- **Purpose:** Update organization seat limit
- **Input:** `{ orgId: string, newSeats: number }`
- **Permissions:** Owner only
- **Features:**
  - Cannot reduce below current usage
  - Range: 1-1000 seats
  - Audit logging
- **Location:** [functions/src/orgs/seats.ts](functions/src/orgs/seats.ts)

### RBAC Helper Utilities

**Location:** [functions/src/utils/rbac.ts](functions/src/utils/rbac.ts)

- `getRolePermissions(role)` - Get permissions for a role
- `getUserRole(orgId, uid)` - Get user's role in org
- `hasPermission(orgId, uid, permission)` - Check permission
- `isMember(orgId, uid)` - Check membership
- `getUserOrganizations(uid)` - Get all user's orgs
- `getOrgMembers(orgId)` - Get org members
- `canManageRole(requesterRole, targetRole)` - Validate hierarchy

### Firestore Rules Updates

Added security rules for:

```rules
// Phase 47: Organizations
match /ops_orgs/{orgId} {
  allow read: if isSignedIn() && isMemberOfOrg(orgId, request.auth.uid);
  allow write: if false; // Cloud Functions only
}

// Phase 47: Organization Members
match /ops_org_members/{memberId} {
  allow read: if isSignedIn() && isMemberOfOrg(resource.data.orgId, request.auth.uid);
  allow write: if false; // Cloud Functions only
}

// Phase 47: Organization Invites
match /ops_org_invites/{inviteId} {
  allow read: if isSignedIn() && (
    isMemberOfOrg(resource.data.orgId, request.auth.uid) ||
    resource.data.email == request.auth.token.email
  );
  allow write: if false; // Cloud Functions only
}
```

---

## 📊 Data Structures

### ops_orgs/{orgId}
```json
{
  "id": "org-123",
  "name": "Acme Corporation",
  "seats": 10,
  "usedSeats": 3,
  "createdBy": "user-uid-owner",
  "createdAt": "2025-10-13T05:00:00Z",
  "updatedAt": "2025-10-13T05:00:00Z"
}
```

### ops_org_members/{orgId}_{uid}
```json
{
  "orgId": "org-123",
  "uid": "user-uid",
  "role": "admin",
  "joinedAt": "2025-10-13T05:00:00Z"
}
```

### ops_org_invites/{inviteId}
```json
{
  "id": "invite-456",
  "orgId": "org-123",
  "orgName": "Acme Corporation",
  "email": "newuser@example.com",
  "role": "member",
  "invitedBy": "user-uid-owner",
  "status": "pending",
  "createdAt": "2025-10-13T05:00:00Z",
  "expiresAt": "2025-10-20T05:00:00Z"
}
```

---

## 🎭 Role Matrix

| Role | Read | Write | Invite | Remove | Change Roles | Update Seats | Delete Org |
|------|------|-------|--------|--------|--------------|--------------|------------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅* | ✅* | ❌ | ❌ |
| **Member** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Viewer** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

*Admins can only remove/change roles for members and viewers, not other admins or owners.

---

## 🧪 Testing

### Test 1: Create Organization

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const createOrg = httpsCallable(functions, 'createOrg');

const result = await createOrg({ name: 'My Startup', seats: 10 });
console.log(result.data);
// { success: true, orgId: 'org-123', name: 'My Startup', seats: 10 }
```

### Test 2: Invite Member

```javascript
const inviteMember = httpsCallable(functions, 'inviteMember');

const result = await inviteMember({
  orgId: 'org-123',
  email: 'teammate@example.com',
  role: 'member'
});

console.log(result.data);
// { success: true, inviteId: 'invite-456', expiresAt: 1729123456789 }
```

### Test 3: Accept Invite

```javascript
const acceptInvite = httpsCallable(functions, 'acceptInvite');

const result = await acceptInvite({ inviteId: 'invite-456' });
console.log(result.data);
// { success: true, orgId: 'org-123', role: 'member' }
```

### Test 4: Update Member Role

```javascript
const updateRole = httpsCallable(functions, 'updateRole');

const result = await updateRole({
  orgId: 'org-123',
  memberUid: 'user-uid',
  newRole: 'admin'
});

console.log(result.data);
// { success: true, orgId: 'org-123', memberUid: 'user-uid', newRole: 'admin' }
```

### Test 5: Remove Member

```javascript
const removeMember = httpsCallable(functions, 'removeMember');

const result = await removeMember({
  orgId: 'org-123',
  memberUid: 'user-uid'
});

console.log(result.data);
// { success: true, orgId: 'org-123', memberUid: 'user-uid' }
```

### Test 6: Update Seats

```javascript
const updateSeats = httpsCallable(functions, 'updateSeats');

const result = await updateSeats({
  orgId: 'org-123',
  newSeats: 20
});

console.log(result.data);
// { success: true, orgId: 'org-123', seats: 20, usedSeats: 3 }
```

---

## 🚀 Deployment

### Quick Deploy

```bash
./scripts/deploy-phase47.sh
```

### Manual Deploy

```bash
# 1. Build functions
cd functions && npm run build && cd ..

# 2. Deploy
firebase deploy --only \
  functions:createOrg,\
functions:updateOrg,\
functions:deleteOrg,\
functions:inviteMember,\
functions:acceptInvite,\
functions:removeMember,\
functions:updateRole,\
functions:updateSeats,\
firestore:rules
```

---

## 🌱 Seeding Demo Data

```bash
# Seed demo organization with members and invites
node scripts/seed-phase47-demo.js

# With custom UIDs
OWNER_UID=your-uid node scripts/seed-phase47-demo.js
```

---

## 📝 Integration with UI

### Frontend Example (React)

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '@/hooks/useAuth';

export function CreateOrgButton() {
  const { user } = useAuth();
  const functions = getFunctions();

  const handleCreate = async () => {
    const createOrg = httpsCallable(functions, 'createOrg');

    try {
      const result = await createOrg({
        name: 'My Organization',
        seats: 10
      });

      console.log('Org created:', result.data.orgId);
      toast.success('Organization created!');
    } catch (error) {
      console.error(error.message);
      toast.error('Failed to create organization');
    }
  };

  return <button onClick={handleCreate}>Create Organization</button>;
}

export function InviteMemberForm({ orgId }: { orgId: string }) {
  const functions = getFunctions();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');

  const handleInvite = async () => {
    const inviteMember = httpsCallable(functions, 'inviteMember');

    try {
      await inviteMember({ orgId, email, role });
      toast.success('Invitation sent!');
      setEmail('');
    } catch (error) {
      if (error.code === 'resource-exhausted') {
        toast.error('No available seats. Please upgrade.');
      } else {
        toast.error(error.message);
      }
    }
  };

  return (
    <div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="teammate@example.com"
      />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="admin">Admin</option>
        <option value="member">Member</option>
        <option value="viewer">Viewer</option>
      </select>
      <button onClick={handleInvite}>Send Invite</button>
    </div>
  );
}

export function MembersList({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const db = getFirestore();

  useEffect(() => {
    const q = query(
      collection(db, 'ops_org_members'),
      where('orgId', '==', orgId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => doc.data()));
    });

    return () => unsubscribe();
  }, [orgId]);

  return (
    <ul>
      {members.map((member) => (
        <li key={member.uid}>
          {member.uid} - {member.role}
        </li>
      ))}
    </ul>
  );
}
```

---

## 🐛 Troubleshooting

### Issue: "Permission denied" when inviting members

**Cause:** User is not owner or admin

**Solution:**
```bash
# Check user's role in Firestore
# ops_org_members/{orgId}_{uid} → role
```

### Issue: "No available seats"

**Cause:** Organization has reached seat limit

**Solution:**
```javascript
const updateSeats = httpsCallable(functions, 'updateSeats');
await updateSeats({ orgId: 'org-123', newSeats: 20 });
```

### Issue: "Invite has expired"

**Cause:** Invite older than 7 days

**Solution:** Create a new invite for the user

### Issue: Cannot remove admin

**Cause:** Admins cannot remove other admins

**Solution:** Only owners can remove admins

---

## 🔐 Security

### Permission Enforcement

1. **Organization Creation:**
   - Any authenticated user can create an org
   - Creator automatically becomes owner

2. **Member Invitation:**
   - Only owners and admins can invite
   - Seat availability checked before invite
   - Email validation required

3. **Role Updates:**
   - Owner can change any role (except their own)
   - Admins can only change member/viewer roles
   - Cannot change owner role

4. **Member Removal:**
   - Owner cannot be removed
   - Admins cannot remove other admins
   - Self-removal allowed for non-owners

5. **Seat Updates:**
   - Only owners can update seats
   - Cannot reduce below current usage

### Firestore Rules Protection

- ✅ Members can only read their organizations
- ✅ Members can read all members in their orgs
- ✅ Invitees can read their own invites
- ✅ Only Cloud Functions can write to org collections

---

## 📋 Next Steps

### After Phase 47

1. **Create UI Components**
   - Organization settings page
   - Member management table
   - Invite modal
   - Role selector dropdown

2. **Add Organization Context**
   ```typescript
   // useOrg.tsx
   const { currentOrg, setCurrentOrg, userOrgs } = useOrg();
   ```

3. **Integrate with Billing**
   - Link seat upgrades to Stripe subscriptions
   - Add pricing tiers based on seats

4. **Add Notifications**
   - Email invitations
   - Role change notifications
   - Seat limit warnings

5. **Add Organization-Scoped Data**
   - Projects per organization
   - Team dashboards
   - Shared resources

---

## 📞 Support

### View Deployed Functions

```bash
firebase functions:list | grep -E "createOrg|updateOrg|deleteOrg|inviteMember|acceptInvite|removeMember|updateRole|updateSeats"
```

### Delete Functions (Rollback)

```bash
firebase functions:delete createOrg --region=us-central1 -f
firebase functions:delete updateOrg --region=us-central1 -f
firebase functions:delete deleteOrg --region=us-central1 -f
firebase functions:delete inviteMember --region=us-central1 -f
firebase functions:delete acceptInvite --region=us-central1 -f
firebase functions:delete removeMember --region=us-central1 -f
firebase functions:delete updateRole --region=us-central1 -f
firebase functions:delete updateSeats --region=us-central1 -f
```

### Revert Firestore Rules

Remove the Phase 47 rules from `firestore.rules` and redeploy:

```bash
firebase deploy --only firestore:rules
```

---

## ✅ Deployment Checklist

- [x] createOrg function deployed
- [x] updateOrg function deployed
- [x] deleteOrg function deployed
- [x] inviteMember function deployed
- [x] acceptInvite function deployed
- [x] removeMember function deployed
- [x] updateRole function deployed
- [x] updateSeats function deployed
- [x] Firestore rules updated (ops_orgs, ops_org_members, ops_org_invites)
- [x] RBAC helper utilities created
- [x] Functions built without errors
- [ ] Demo data seeded
- [ ] Integration tested from frontend
- [ ] Documentation reviewed

---

**Phase 47 Status:** ✅ Deployed and Ready for Integration

**Deployment Date:** 2025-10-13
**Node Version:** 20
**Firebase Functions:** v2 (GCF 2nd Gen)
**Total Functions:** 8 (all callable)

---

## 🎯 Summary

Phase 47 provides a complete **Teams & RBAC** foundation:

✅ **8 Cloud Functions** for org management
✅ **4 Role Types** with granular permissions
✅ **Seat Management** with usage tracking
✅ **Invite System** with expiration
✅ **Security Rules** for all org collections
✅ **RBAC Utilities** for permission checks
✅ **Atomic Transactions** for data consistency
✅ **Audit Logging** for compliance

Ready to integrate with your UI and billing system!
