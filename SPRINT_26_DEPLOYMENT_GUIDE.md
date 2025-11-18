# Sprint 26 Complete Deployment Guide

## Overview

This guide provides step-by-step deployment instructions for all 4 phases of Sprint 26:
- **Phase 1**: API Keys
- **Phase 2**: OAuth 2.0
- **Phase 3**: Webhooks, SDKs, OpenAPI
- **Phase 4**: Developer Portal & Billing

---

## Prerequisites

### Required Tools
- Node.js 18+ and npm
- Firebase CLI: `npm install -g firebase-tools`
- Vercel CLI: `npm install -g vercel`
- Git

### Required Accounts
- Firebase project (already set up)
- Stripe account with API keys
- Vercel account (for Next.js deployment)

### Environment Setup

**Firebase Functions** (`functions/.env`):
```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_FREE=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...

# OAuth JWT
OAUTH_JWT_ISSUER=f0.ai
OAUTH_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
OAUTH_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
OAUTH_ACCESS_TTL_SEC=3600
OAUTH_REFRESH_TTL_SEC=2592000

# API Key Security
API_KEY_HASH_SECRET=your-random-secret-key-min-32-chars

# Billing Portal
PORTAL_RETURN_URL=https://f0.ai/developers?tab=billing
```

**Next.js** (`.env.local`):
```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Public URLs
NEXT_PUBLIC_DOCS_URL=/docs
NEXT_PUBLIC_OPENAPI_URL=/openapi.yaml
NEXT_PUBLIC_API_BASE_URL=https://api.f0.ai/v1

# Feature Flags
NEXT_PUBLIC_DEVELOPER_PORTAL_ENABLED=true
```

---

## Step 1: Generate RSA Keys (OAuth Phase 2)

```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem

# Convert to single-line for .env (macOS)
cat private.pem | awk '{printf "%s\\n", $0}' | pbcopy

# For Linux:
cat private.pem | awk '{printf "%s\\n", $0}'
```

Paste the output into `OAUTH_JWT_PRIVATE_KEY` in `functions/.env`.

Repeat for public key → `OAUTH_JWT_PUBLIC_KEY`.

---

## Step 2: Deploy Firebase Backend

### 2.1 Install Dependencies

```bash
cd functions
npm install

# Required packages:
npm install stripe@latest
npm install jsonwebtoken
npm install node-fetch@3
```

### 2.2 Update Firestore Rules

Add to `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isAuthenticated() && request.auth.uid == uid;
    }

    function isAdmin() {
      return isAuthenticated() && request.auth.token.admin == true;
    }

    // API Keys
    match /api_keys/{keyId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;
      allow update, delete: if isOwner(resource.data.uid) || isAdmin();
    }

    // OAuth Clients
    match /oauth_clients/{clientId} {
      allow read: if isOwner(resource.data.ownerUid) || isAdmin();
      allow create: if isAuthenticated() && request.resource.data.ownerUid == request.auth.uid;
      allow update: if isOwner(resource.data.ownerUid) || isAdmin();
      allow delete: if isAdmin();
    }

    // OAuth Codes (server-only)
    match /oauth_codes/{codeId} {
      allow read, write: if false;
    }

    // OAuth Tokens (server-only)
    match /oauth_tokens/{tokenId} {
      allow read, write: if false;
    }

    // Webhook Subscriptions
    match /webhook_subscriptions/{subId} {
      allow read, write: if isOwner(resource.data.ownerUid);
    }

    // Webhook Events (server-only)
    match /webhook_events/{eventId} {
      allow read, write: if false;
    }

    // Webhook Deliveries (read by owner)
    match /webhook_deliveries/{uid}/{deliveryId} {
      allow read: if isOwner(uid) || isAdmin();
      allow write: if isAdmin();
    }

    // Usage Logs
    match /usage_logs/{uid}/daily/{date} {
      allow read: if isOwner(uid) || isAdmin();
      allow write: if isOwner(uid) || isAdmin();
    }

    // User Subscription
    match /users/{uid}/subscription {
      allow read: if isOwner(uid) || isAdmin();
      allow write: if isAdmin();
    }

    // Rate Limits (server-only)
    match /rate_limits/{key} {
      allow read, write: if false;
    }

    // Idempotency Keys (server-only)
    match /idempotency_keys/{key} {
      allow read, write: if false;
    }
  }
}
```

### 2.3 Update Firestore Indexes

Create `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "api_keys",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "api_keys",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "prefix", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "oauth_clients",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerUid", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "webhook_subscriptions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerUid", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "webhook_subscriptions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "events", "arrayConfig": "CONTAINS" }
      ]
    },
    {
      "collectionGroup": "webhook_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "nextRetryAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "webhook_deliveries",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### 2.4 Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:createApiKey,functions:revokeApiKey,functions:listApiKeys

firebase deploy --only functions:createBillingPortalLink,functions:stripeWebhook

firebase deploy --only functions:webhookDeliveryWorker
```

### 2.5 Deploy Firestore Configuration

```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

---

## Step 3: Configure Stripe

### 3.1 Create Products & Prices

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Create products:
   - **Free**: $0/month (price ID → `STRIPE_PRICE_ID_FREE`)
   - **Pro**: $99/month (price ID → `STRIPE_PRICE_ID_PRO`)
   - **Enterprise**: $499/month (price ID → `STRIPE_PRICE_ID_ENTERPRISE`)
3. Copy price IDs to `functions/.env`

### 3.2 Configure Webhook Endpoint

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Endpoint URL: `https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/stripeWebhook`
   - Replace with your actual Cloud Function URL
   - Get URL: `firebase functions:list`
4. Events to send:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` in `functions/.env`
6. Redeploy function: `firebase deploy --only functions:stripeWebhook`

---

## Step 4: Deploy Next.js Frontend

### 4.1 Install Dependencies

```bash
# Install UI dependencies
npm install @radix-ui/react-tabs
npm install @radix-ui/react-switch
npm install @radix-ui/react-select
npm install lucide-react
npm install recharts
npm install sonner

# If using shadcn/ui, initialize:
npx shadcn-ui@latest init
npx shadcn-ui@latest add tabs card button input textarea table badge switch select
```

### 4.2 Create Developer Portal Page

Copy the provided production-ready code to:
- `src/app/(developer)/developers/page.tsx`

### 4.3 Create API Routes for Developer Portal

**File**: `src/app/api/devportal/keys/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getFunctions, httpsCallable } from 'firebase-admin';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);

    // Call Firebase function
    const listApiKeys = httpsCallable(getFunctions(), 'listApiKeys');
    const result = await listApiKeys({}, { token });

    return NextResponse.json(result.data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const body = await req.json();

    const createApiKey = httpsCallable(getFunctions(), 'createApiKey');
    const result = await createApiKey(body, { token });

    return NextResponse.json(result.data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**File**: `src/app/api/devportal/keys/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getFunctions, httpsCallable } from 'firebase-admin';
import { adminAuth } from '@/lib/firebase-admin';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await adminAuth.verifyIdToken(token);

    const revokeApiKey = httpsCallable(getFunctions(), 'revokeApiKey');
    await revokeApiKey({ keyId: params.id }, { token });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**File**: `src/app/api/devportal/usage/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Get last 30 days of usage
    const snapshot = await adminDb
      .collection(`usage_logs/${uid}/daily`)
      .orderBy('date', 'desc')
      .limit(30)
      .get();

    const data = snapshot.docs.map(doc => ({
      date: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**File**: `src/app/api/devportal/webhooks/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Get recent webhook deliveries
    const snapshot = await adminDb
      .collectionGroup('webhook_deliveries')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**File**: `src/app/api/devportal/console/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await adminAuth.verifyIdToken(token);
    const { endpoint, method, body } = await req.json();

    // Proxy request to actual API
    const apiUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}`;
    const response = await fetch(apiUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**File**: `src/app/api/billing/portal/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getFunctions, httpsCallable } from 'firebase-admin';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await adminAuth.verifyIdToken(token);

    const createPortalLink = httpsCallable(getFunctions(), 'createBillingPortalLink');
    const result = await createPortalLink({}, { token });

    return NextResponse.json(result.data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### 4.4 Deploy to Vercel

```bash
# Build and test locally
npm run build
npm run dev

# Deploy to production
vercel --prod
```

---

## Step 5: Initialize User Subscriptions

Create a migration script to add default subscriptions for existing users.

**File**: `scripts/init-user-subscriptions.ts`

```typescript
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

async function initializeSubscriptions() {
  console.log('Initializing user subscriptions...');

  const usersSnapshot = await db.collection('users').get();
  let count = 0;

  for (const userDoc of usersSnapshot.docs) {
    const uid = userDoc.id;
    const subRef = db.doc(`users/${uid}/subscription`);
    const subDoc = await subRef.get();

    if (!subDoc.exists) {
      await subRef.set({
        plan: 'free',
        status: 'active',
        periodEnd: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        limits: {
          ratePerMin: 60,
          monthlyQuota: 10000,
          webhooksEnabled: false,
          maxApiKeys: 2,
          maxWebhooks: 0,
        },
        usage: {
          currentMonth: 0,
          lastReset: Date.now(),
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      count++;
      console.log(`✅ Initialized subscription for user: ${uid}`);
    }
  }

  console.log(`\n✅ Done! Initialized ${count} subscriptions.`);
  process.exit(0);
}

initializeSubscriptions().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
```

Run:
```bash
npx ts-node scripts/init-user-subscriptions.ts
```

---

## Step 6: Upload OpenAPI Spec

```bash
# Copy OpenAPI spec to public directory
cp SPRINT_26_PHASE_3_WEBHOOKS_SDKS_OPENAPI.md public/openapi.yaml

# Verify it's accessible
curl https://your-domain.com/openapi.yaml
```

---

## Step 7: Run Smoke Tests

### 7.1 Test API Keys

```bash
# Create test user
curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$FIREBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","returnSecureToken":true}'

# Get ID token from response
ID_TOKEN="<from_response>"

# Create API key via portal
# Visit https://your-domain.com/developers
# Create key and copy it

# Test API with key
curl "https://api.f0.ai/v1/agents" \
  -H "Authorization: Bearer f0_XXXX_YYYY"
```

### 7.2 Test OAuth Flow

```bash
# Test client credentials flow
curl -X POST "https://your-domain.com/api/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "scope": "agents:read"
  }'
```

### 7.3 Test Webhooks

```bash
# Create webhook subscription
curl -X POST "https://your-domain.com/api/webhooks/subscriptions" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.site/YOUR-UNIQUE-URL",
    "events": ["order.paid", "test.webhook"]
  }'

# Send test event
curl -X POST "https://your-domain.com/api/webhooks/test" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subscriptionId": "SUB_ID"}'
```

### 7.4 Test Billing Portal

```bash
# Open billing portal
curl -X POST "https://your-domain.com/api/billing/portal" \
  -H "Authorization: Bearer $ID_TOKEN"

# Should return: {"url": "https://billing.stripe.com/..."}
```

---

## Step 8: Post-Deployment Verification

### Checklist

- [ ] Developer Portal accessible at `/developers`
- [ ] API Keys tab: Create, list, revoke working
- [ ] Usage tab: Charts display with data
- [ ] Webhooks tab: Delivery logs visible
- [ ] Console tab: API requests work
- [ ] Billing tab: Portal link opens Stripe
- [ ] OpenAPI spec accessible at `/openapi.yaml`
- [ ] Docs page displays Swagger UI at `/docs`
- [ ] Rate limiting enforces per plan
- [ ] Stripe webhook receives events
- [ ] User subscriptions sync correctly
- [ ] Audit logs capture all operations

### Monitor These Metrics (Week 1)

1. **Developer Adoption**
   - Portal conversion rate: % users creating API keys
   - Active API keys: Daily unique keys
   - SDK downloads: npm + PyPI

2. **API Performance**
   - Success rate: >99%
   - Latency p95: <500ms
   - Error rate: <0.5%

3. **Billing**
   - Free → Pro conversions
   - Churn rate
   - MRR growth

4. **Support**
   - API-related tickets: <3/day
   - Time to resolution: <24h

---

## Troubleshooting

### Common Issues

**1. Function deployment fails**
```bash
# Check Node version (must be 18+)
node --version

# Clear build cache
rm -rf functions/lib
cd functions && npm run build
```

**2. Firestore rules errors**
```bash
# Validate rules syntax
firebase firestore:rules:validate

# Deploy rules separately
firebase deploy --only firestore:rules
```

**3. Stripe webhook not receiving events**
```bash
# Test webhook signature locally
stripe listen --forward-to localhost:5001/PROJECT/REGION/stripeWebhook

# Trigger test event
stripe trigger customer.subscription.updated
```

**4. API keys not authenticating**
```bash
# Verify hash secret is set
echo $API_KEY_HASH_SECRET

# Check function logs
firebase functions:log --only createApiKey

# Test key format
echo "f0_PREFIX_SECRET" | wc -c  # Should be ~50 chars
```

**5. Usage data not appearing**
```bash
# Check if trackUsage is called
firebase functions:log --only apiGateway

# Verify collection path
# Should be: usage_logs/{uid}/daily/{YYYY-MM-DD}
```

---

## Rollback Procedures

### Rollback Functions

```bash
# List function versions
gcloud functions list --project YOUR_PROJECT

# Rollback specific function
gcloud functions deploy FUNCTION_NAME \
  --source=gs://BUCKET/previous-version.zip
```

### Rollback Firestore Rules

```bash
# Download previous rules
firebase firestore:rules:get --output firestore.rules.backup

# Deploy backup
firebase deploy --only firestore:rules
```

### Disable Features

```bash
# Disable API globally
# Set in Firebase console: Config > api.enabled = false

# Or via CLI
firebase database:set /config/api/enabled false
```

---

## Success Criteria

**Sprint 26 is successfully deployed when:**

✅ All 4 phases deployed to production
✅ Developer Portal accessible and functional
✅ API keys working with all endpoints
✅ OAuth flows (Authorization Code, Client Credentials) working
✅ Webhooks delivering with signatures
✅ Stripe billing syncing subscriptions
✅ Rate limits enforcing per plan
✅ Usage tracking populating charts
✅ OpenAPI spec and docs accessible
✅ SDKs published to npm and PyPI
✅ All smoke tests passing
✅ Week 1 KPIs being tracked

**When all criteria are met, SPRINT 26 IS COMPLETE! 🎉**

---

## Next Steps

After successful deployment:

1. **Monitor dashboards** for Week 1 KPIs
2. **Gather user feedback** from early API users
3. **Optimize performance** based on metrics
4. **Plan Sprint 27**: Advanced features (metered billing, team management)
5. **Document learnings** in team retrospective

