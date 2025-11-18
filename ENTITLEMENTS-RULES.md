# 🔐 Firestore Entitlements & Security Rules

Complete guide to Firestore data structure and security rules for subscription entitlements.

---

## 📋 Table of Contents

1. [Data Schema](#data-schema)
2. [Security Rules](#security-rules)
3. [Best Practices](#best-practices)
4. [Access Patterns](#access-patterns)
5. [Migration Guide](#migration-guide)
6. [Examples](#examples)

---

## Data Schema

### User Document Structure

```
users/{uid}
  ├── email: string
  ├── displayName: string (optional)
  ├── photoURL: string (optional)
  ├── stripeCustomerId: string
  ├── createdAt: Timestamp
  ├── updatedAt: Timestamp
  └── entitlements: {
      ├── provider: "stripe"
      ├── active: boolean
      ├── tier: "free" | "basic" | "pro"
      ├── periodEnd: Timestamp
      ├── customerId: string
      ├── subscriptionId: string
      ├── status: "active" | "trialing" | "past_due" | "canceled" | "incomplete"
      ├── cancelAtPeriodEnd: boolean
      └── updatedAt: Timestamp
  }
```

### Entitlements Object

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `provider` | string | Payment provider (e.g., "stripe") | ✅ |
| `active` | boolean | Whether subscription is active | ✅ |
| `tier` | string | Subscription tier (free, basic, pro) | ✅ |
| `periodEnd` | Timestamp | End of current billing period | ✅ |
| `customerId` | string | Stripe customer ID | ✅ |
| `subscriptionId` | string | Stripe subscription ID | ✅ |
| `status` | string | Stripe subscription status | ✅ |
| `cancelAtPeriodEnd` | boolean | If subscription will cancel at period end | ✅ |
| `updatedAt` | Timestamp | Last update timestamp | ✅ |

---

## Security Rules

### Development Rules (firestore.rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to check if user owns the document
    function isOwner(uid) {
      return isAuthenticated() && request.auth.uid == uid;
    }

    // Helper function to check if request is from server
    function isServer() {
      return request.auth.token.admin == true;
    }

    // Users collection
    match /users/{uid} {
      // Allow read if authenticated and is owner
      allow read: if isOwner(uid);

      // Allow write to own document (excluding entitlements)
      allow update: if isOwner(uid) &&
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['entitlements']);

      // Allow create for new users
      allow create: if isOwner(uid);
    }
  }
}
```

### Production Rules (Strict)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isAuthenticated() && request.auth.uid == uid;
    }

    function isServerRequest() {
      // Only Firebase Functions can set this claim
      return request.auth.token.get('server', false) == true;
    }

    // Users collection
    match /users/{uid} {
      // Read: User can read own data
      allow read: if isOwner(uid);

      // Create: User can create own document on signup
      allow create: if isOwner(uid) &&
        request.resource.data.keys().hasOnly(['email', 'displayName', 'photoURL', 'createdAt']);

      // Update: User can update own profile (NOT entitlements)
      allow update: if isOwner(uid) &&
        !request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['entitlements', 'stripeCustomerId', 'createdAt']);

      // Delete: Only server can delete
      allow delete: if false;

      // Entitlements subcollection (alternative structure)
      match /entitlements/{doc} {
        allow read: if isOwner(uid);
        allow write: if false; // Only Cloud Functions can write
      }
    }

    // Admin only collections
    match /subscriptions/{subscriptionId} {
      allow read: if isServerRequest();
      allow write: if isServerRequest();
    }

    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Alternative: Separate Entitlements Subcollection

**Structure:**
```
users/{uid}
  └── (profile data)

users/{uid}/entitlements/current
  └── (subscription data)
```

**Rules:**
```javascript
match /users/{uid}/entitlements/{doc} {
  // Read: Only owner can read
  allow read: if isOwner(uid);

  // Write: Only Cloud Functions (never client)
  allow write: if false;
}
```

---

## Best Practices

### 1. **Never Trust Client Data**

❌ **Bad:**
```typescript
// Client-side code trying to update entitlements
await updateDoc(doc(db, `users/${uid}`), {
  entitlements: { active: true, tier: 'pro' }
});
```

✅ **Good:**
```typescript
// Only read entitlements on client
const entitlements = useEntitlements();
// Updates happen via webhooks only
```

### 2. **Server-Only Writes**

- ✅ Use Firebase Functions for all entitlements updates
- ✅ Validate webhook signatures
- ✅ Use Firestore Admin SDK in Functions
- ❌ Never update entitlements from client code

### 3. **Secure Custom Claims (Optional)**

Set custom claims for faster auth checks:

```typescript
// In Firebase Function after successful subscription
await admin.auth().setCustomUserClaims(uid, {
  stripeRole: 'pro',
  subscriptionActive: true
});
```

**Access in rules:**
```javascript
function hasProAccess() {
  return request.auth.token.get('stripeRole', '') == 'pro' &&
         request.auth.token.get('subscriptionActive', false) == true;
}
```

### 4. **Audit Trail**

Keep subscription history:

```
users/{uid}/subscriptionHistory/{timestamp}
  ├── action: "created" | "updated" | "canceled"
  ├── previousStatus: string
  ├── newStatus: string
  ├── timestamp: Timestamp
  └── metadata: object
```

### 5. **Grace Period Handling**

```typescript
function hasAccess(entitlements: Entitlements): boolean {
  if (!entitlements) return false;

  // Allow grace period (e.g., 3 days after period end)
  const gracePeriodMs = 3 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (entitlements.active) return true;

  if (entitlements.periodEnd &&
      now < entitlements.periodEnd + gracePeriodMs) {
    return true;
  }

  return false;
}
```

---

## Access Patterns

### Client-Side Read

```typescript
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

async function getEntitlements() {
  const user = auth.currentUser;
  if (!user) return null;

  const docRef = doc(db, `users/${user.uid}`);
  const docSnap = await getDoc(docRef);

  return docSnap.data()?.entitlements ?? null;
}
```

### Server-Side Write (Firebase Function)

```typescript
import * as admin from 'firebase-admin';

async function updateEntitlements(
  uid: string,
  entitlements: Entitlements
) {
  await admin.firestore()
    .doc(`users/${uid}`)
    .set({
      entitlements: {
        ...entitlements,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });
}
```

### Real-time Subscription

```typescript
import { doc, onSnapshot } from 'firebase/firestore';

function subscribeToEntitlements(uid: string, callback: (data: any) => void) {
  const docRef = doc(db, `users/${uid}`);

  return onSnapshot(docRef, (snapshot) => {
    const data = snapshot.data();
    callback(data?.entitlements ?? null);
  });
}
```

---

## Migration Guide

### From Flat Structure to Subcollection

**Before:**
```
users/{uid}
  └── entitlements: {...}
```

**After:**
```
users/{uid}/entitlements/current
  └── {...}
```

**Migration Script:**
```typescript
import * as admin from 'firebase-admin';

async function migrateEntitlements() {
  const db = admin.firestore();
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  const batch = db.batch();

  snapshot.forEach((doc) => {
    const data = doc.data();

    if (data.entitlements) {
      // Create subcollection
      const entRef = doc.ref.collection('entitlements').doc('current');
      batch.set(entRef, data.entitlements);

      // Remove from main doc
      batch.update(doc.ref, {
        entitlements: admin.firestore.FieldValue.delete()
      });
    }
  });

  await batch.commit();
  console.log('Migration complete!');
}
```

---

## Examples

### Example 1: Check Active Subscription

```typescript
function hasActiveSubscription(entitlements: Entitlements | null): boolean {
  return entitlements?.active === true;
}
```

### Example 2: Check Specific Tier

```typescript
function hasProAccess(entitlements: Entitlements | null): boolean {
  return entitlements?.active === true &&
         entitlements?.tier === 'pro';
}
```

### Example 3: Check Trial Status

```typescript
function isTrialing(entitlements: Entitlements | null): boolean {
  return entitlements?.status === 'trialing';
}
```

### Example 4: Days Until Renewal

```typescript
function daysUntilRenewal(entitlements: Entitlements | null): number {
  if (!entitlements?.periodEnd) return 0;

  const now = Date.now();
  const diff = entitlements.periodEnd - now;

  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
```

### Example 5: UI Gate Component

```tsx
import { useEntitlements } from '@/hooks/useEntitlements';

function ProFeature() {
  const entitlements = useEntitlements();

  if (!entitlements?.active) {
    return (
      <div className="locked-feature">
        <p>This feature requires a Pro subscription</p>
        <a href="/pricing">Upgrade Now</a>
      </div>
    );
  }

  return <div>Pro Feature Content</div>;
}
```

### Example 6: Server-Side Validation

```typescript
import * as admin from 'firebase-admin';

export async function validateProAccess(uid: string): Promise<boolean> {
  const doc = await admin.firestore()
    .doc(`users/${uid}`)
    .get();

  const entitlements = doc.data()?.entitlements;

  return entitlements?.active === true &&
         entitlements?.tier === 'pro';
}
```

---

## Testing

### Test Data Setup

```typescript
// Create test user with entitlements
const testEntitlements = {
  provider: 'stripe',
  active: true,
  tier: 'pro',
  periodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  customerId: 'cus_test_123',
  subscriptionId: 'sub_test_123',
  status: 'active',
  cancelAtPeriodEnd: false,
  updatedAt: new Date()
};
```

### Security Rules Testing

```javascript
// firestore.test.rules.js
const firebase = require('@firebase/testing');

describe('Entitlements Security', () => {
  it('should allow user to read own entitlements', async () => {
    const db = firebase.firestore(authedApp({ uid: 'user1' }));
    await firebase.assertSucceeds(
      db.collection('users').doc('user1').get()
    );
  });

  it('should deny user updating entitlements', async () => {
    const db = firebase.firestore(authedApp({ uid: 'user1' }));
    await firebase.assertFails(
      db.collection('users').doc('user1').update({
        entitlements: { active: true }
      })
    );
  });
});
```

---

## Monitoring & Alerts

### Cloud Monitoring Queries

```sql
-- Failed entitlements updates
resource.type="cloud_function"
resource.labels.function_name="stripeWebhook"
severity="ERROR"
jsonPayload.message=~"entitlements"

-- Subscription state changes
resource.type="cloud_function"
resource.labels.function_name="stripeWebhook"
jsonPayload.subscriptionStatus!=""
```

### Alert Conditions

1. **Webhook Failures**: Alert if >5% of webhooks fail
2. **Entitlements Lag**: Alert if update takes >10s
3. **Invalid States**: Alert on inconsistent data

---

## Additional Resources

- [Firestore Security Rules Guide](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Best Practices for Firestore](https://firebase.google.com/docs/firestore/best-practices)
- [Stripe Webhook Security](https://stripe.com/docs/webhooks/signatures)

---

**Last Updated:** October 2025
**Version:** 1.0.0
