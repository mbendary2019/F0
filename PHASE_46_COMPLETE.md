# ✅ Phase 46 - Usage Metering & Invoices - COMPLETE

**Date:** 2025-10-12
**Time:** 23:44 UTC

---

## Summary

Phase 46 adds end-to-end usage metering (tokens/requests), UI-ready data structures, and invoice history. All functions successfully deployed to Firebase Cloud Functions v2.

---

## Deployed Functions

### 1. recordUsage ✅
- **Type:** Callable Function (HTTPS)
- **Status:** ACTIVE
- **URL:** https://recordusage-vpxyxgcfbq-uc.a.run.app
- **Timeout:** 60 seconds
- **Memory:** 256Mi
- **Runtime:** nodejs20

**Purpose:** Atomic accumulation of usage from server/API (tokens/requests) with plan-aware limits. Updates both daily and monthly usage collections.

**Usage Example:**
```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

const recordUsage = httpsCallable(functions, 'recordUsage');
await recordUsage({
  tokens: 1234,
  requests: 1,
  costUsd: 0.0012
});
```

**Features:**
- Transactional updates to prevent race conditions
- Daily quota enforcement (fails fast if exceeded)
- Monthly rollup aggregation
- Plan-aware tracking (records which plan user was on)

---

### 2. lowQuotaAlert ✅
- **Type:** Scheduled Function (Cloud Scheduler)
- **Status:** ACTIVE
- **URL:** https://lowquotaalert-vpxyxgcfbq-uc.a.run.app
- **Schedule:** */30 7-23 * * * (Every 30 minutes, 7 AM - 11 PM, Asia/Kuwait)
- **Timeout:** 300 seconds (5 minutes)
- **Memory:** 256Mi
- **Runtime:** nodejs20

**Purpose:** Monitors user quotas and logs alerts when usage exceeds 90% threshold. Can be extended to send email/FCM/Slack notifications.

**Configuration:**
```bash
# Set custom threshold via environment variable
LOW_QUOTA_THRESHOLD=0.85  # 85% threshold
```

**Features:**
- Checks all users with daily usage
- Compares against ops_user_plans dailyQuota
- Logs structured alerts for monitoring
- Ready for notification integration (Phase 49)

---

### 3. listInvoices ✅
- **Type:** Callable Function (HTTPS)
- **Status:** ACTIVE
- **URL:** https://listinvoices-vpxyxgcfbq-uc.a.run.app
- **Timeout:** 60 seconds
- **Memory:** 256Mi
- **Runtime:** nodejs20

**Purpose:** Returns user invoice history from ops_invoices collection (synced via Stripe webhook).

**Usage Example:**
```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

const listInvoices = httpsCallable(functions, 'listInvoices');
const result = await listInvoices();
console.log(result.data.invoices); // Array of invoice objects
```

**Returns:**
```typescript
{
  invoices: [
    {
      id: 'inv_xxx',
      number: 'INV-0001',
      created: 1697234567,
      total: 990,
      currency: 'usd',
      status: 'paid',
      hostedInvoiceUrl: 'https://...',
      invoicePdf: 'https://...'
    }
  ]
}
```

---

## Firestore Collections

### ops_usage_daily
- **Document ID:** `{uid}_{YYYY-MM-DD}`
- **Purpose:** Daily usage tracking per user
- **Security:** User can read own, Cloud Functions write only
- **Structure:**
```json
{
  "uid": "user123",
  "date": "2025-10-12",
  "tokens": 3210,
  "requests": 12,
  "costUsd": 0.0023,
  "planAtUse": "starter",
  "updatedAt": Timestamp
}
```

**Recommended Index:**
- Collection: `ops_usage_daily`
- Fields: `uid` (ASC), `date` (DESC)

---

### ops_usage_monthly
- **Document ID:** `{uid}_{YYYY-MM}`
- **Purpose:** Monthly rollup aggregation
- **Security:** User can read own, Cloud Functions write only
- **Structure:**
```json
{
  "uid": "user123",
  "month": "2025-10",
  "tokens": 45670,
  "requests": 234,
  "costUsd": 0.0456,
  "updatedAt": Timestamp
}
```

**Recommended Index:**
- Collection: `ops_usage_monthly`
- Fields: `uid` (ASC), `month` (DESC)

---

### ops_invoices
- **Purpose:** Invoice history (synced from Stripe webhooks)
- **Security:** User can read own, Cloud Functions write only
- **Structure:**
```json
{
  "uid": "user123",
  "number": "INV-0001",
  "created": 1697234567,
  "total": 990,
  "subtotal": 990,
  "tax": 0,
  "currency": "usd",
  "status": "paid",
  "hostedInvoiceUrl": "https://invoice.stripe.com/...",
  "invoicePdf": "https://invoice.stripe.com/.../pdf",
  "lines": []
}
```

**Recommended Index:**
- Collection: `ops_invoices`
- Fields: `uid` (ASC), `created` (DESC)

---

## Firestore Security Rules

Added rules for Phase 46 collections:

```rules
// Phase 46: Usage tracking - daily
match /ops_usage_daily/{id} {
  allow read: if isSignedIn() && resource.data.uid == request.auth.uid;
  allow write: if false; // Cloud Functions only
}

// Phase 46: Usage tracking - monthly
match /ops_usage_monthly/{id} {
  allow read: if isSignedIn() && resource.data.uid == request.auth.uid;
  allow write: if false; // Cloud Functions only
}

// Phase 46: Invoices
match /ops_invoices/{id} {
  allow read: if isSignedIn() && resource.data.uid == request.auth.uid;
  allow write: if false; // Cloud Functions only (via Stripe webhook)
}
```

---

## Helper Utilities

### functions/src/utils/plan.ts
```typescript
export async function getUserPlan(uid: string) {
  const s = await db.collection('ops_user_plans').doc(uid).get();
  return s.exists
    ? s.data()!
    : { plan: 'trial', dailyQuota: 500, entitlements: [] };
}
```

Used by `recordUsage` to check quotas and track plan at time of use.

---

## Scripts

### Deployment Script
```bash
./scripts/deploy-phase46.sh
```

Deploys all Phase 46 functions and Firestore rules.

### Demo Seeding Script
```bash
# Set your demo user UID (optional, defaults to 'demo-user-uid')
export DEMO_UID="your-user-uid-here"

# Run seeding
node scripts/seed-phase46-demo.js
```

Seeds:
- Daily usage record for today
- Monthly usage aggregate for current month
- 3 sample invoices (30, 60, 90 days ago)
- Demo user plan (if doesn't exist)

---

## Frontend Integration Guide

### 1. Usage Dashboard (`/account/usage`)

**Data Sources:**
- `ops_user_plans/{uid}` - Plan info and quotas
- `ops_usage_daily` - Last 30 days (for chart)
- `ops_usage_monthly` - Current month aggregate

**UI Components:**
- UsageHeader - Title and overview
- UsageCounters - Today's tokens, quota, percentage
- UsageChartDaily - Line chart (last 30 days)
- UsagePlanCard - Current plan and limits

**Sample Query:**
```typescript
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

const q = query(
  collection(db, 'ops_usage_daily'),
  where('uid', '==', currentUser.uid),
  orderBy('date', 'desc'),
  limit(30)
);

onSnapshot(q, (snapshot) => {
  const usage = snapshot.docs.map(d => d.data());
  // Render chart with usage data
});
```

---

### 2. Billing History (`/account/billing/history`)

**Data Source:**
- `ops_invoices` collection

**Sample Query:**
```typescript
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

const q = query(
  collection(db, 'ops_invoices'),
  where('uid', '==', currentUser.uid),
  orderBy('created', 'desc')
);

onSnapshot(q, (snapshot) => {
  const invoices = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
  // Render invoice list
});
```

**UI Display:**
```tsx
{invoices.map((invoice) => (
  <div key={invoice.id}>
    <span>#{invoice.number}</span>
    <span>{(invoice.total / 100).toFixed(2)} {invoice.currency.toUpperCase()}</span>
    <a href={invoice.hostedInvoiceUrl} target="_blank">View</a>
    {invoice.invoicePdf && (
      <a href={invoice.invoicePdf} target="_blank">PDF</a>
    )}
  </div>
))}
```

---

### 3. Usage Tracking Helper

**Client-side helper** (call from your API layer):

```typescript
// lib/usage.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export async function trackUsage(params: {
  tokens: number;
  requests?: number;
  costUsd?: number;
}) {
  const fn = httpsCallable(functions, 'recordUsage');
  return await fn(params);
}

// Usage in your API
await trackUsage({
  tokens: 1234,
  requests: 1,
  costUsd: 0.0012
});
```

---

## Integration with Stripe Webhooks

The Stripe webhook handler (Phase 45) should populate `ops_invoices` on these events:

**Relevant Events:**
- `invoice.created`
- `invoice.finalized`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.updated`

**Sample webhook handler addition:**
```typescript
case 'invoice.payment_succeeded': {
  const invoice = event.data.object as Stripe.Invoice;
  await db.collection('ops_invoices').doc(invoice.id).set({
    uid: invoice.metadata.uid,
    number: invoice.number,
    created: invoice.created,
    total: invoice.total,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    currency: invoice.currency,
    status: invoice.status,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoicePdf: invoice.invoice_pdf,
    lines: invoice.lines.data.map(line => ({
      description: line.description,
      amount: line.amount,
      quantity: line.quantity
    }))
  }, { merge: true });
  break;
}
```

---

## Testing Checklist

### Backend Functions
- [x] recordUsage deployed and callable
- [x] lowQuotaAlert deployed and scheduled
- [x] listInvoices deployed and callable
- [x] Firestore rules deployed
- [ ] Seed demo data (`node scripts/seed-phase46-demo.js`)
- [ ] Test recordUsage with valid data
- [ ] Test recordUsage quota enforcement (exceeds daily limit)
- [ ] Test lowQuotaAlert execution (next run at top of hour)
- [ ] Test listInvoices returns user invoices

### Frontend Integration
- [ ] Create `/account/usage` page with components
- [ ] Display today's usage metrics
- [ ] Render 30-day usage chart (recharts line chart)
- [ ] Create `/account/billing/history` page
- [ ] Display invoice list with links
- [ ] Test real-time updates when recordUsage is called

### End-to-End Flow
- [ ] Call recordUsage from your API layer
- [ ] Verify daily usage document updates in Firestore
- [ ] Verify monthly usage rollup updates
- [ ] Check quota enforcement (try exceeding limit)
- [ ] Verify lowQuotaAlert logs when threshold hit
- [ ] Test invoice display after Stripe webhook fires

---

## Cost Optimization

**recordUsage Transaction Cost:**
- 2 transactions per call (daily + monthly)
- ~$0.000002 per call (Firestore pricing)

**lowQuotaAlert Cost:**
- Runs every 30 minutes during 7 AM - 11 PM (32 times/day)
- Reads all active users' daily usage
- Optimize by adding index on `date` field

**Recommended:**
- Keep `lowQuotaAlert` schedule limited to business hours
- Consider batching multiple API calls before calling `recordUsage`
- Use client-side aggregation for small increments

---

## Next Steps

1. **Seed Demo Data**
   ```bash
   export DEMO_UID="your-uid-here"
   node scripts/seed-phase46-demo.js
   ```

2. **Create Frontend Pages**
   - Implement `/account/usage` with charts
   - Implement `/account/billing/history` with invoice list

3. **Integrate with API Layer**
   - Call `recordUsage` from your API endpoints
   - Track tokens/requests for each operation

4. **Update Stripe Webhook**
   - Add invoice event handling to populate `ops_invoices`

5. **Monitor Usage**
   - Check Cloud Functions logs for `lowQuotaAlert` execution
   - Set up alerts for quota threshold breaches

6. **Phase 47 (Optional)**
   - Add email/FCM notifications for quota alerts
   - Implement usage reports and analytics

---

## Function URLs (Production)

```
recordUsage:       https://recordusage-vpxyxgcfbq-uc.a.run.app
lowQuotaAlert:     https://lowquotaalert-vpxyxgcfbq-uc.a.run.app (scheduled)
listInvoices:      https://listinvoices-vpxyxgcfbq-uc.a.run.app
```

---

## Rollback Instructions

If you need to remove Phase 46 functions:

```bash
firebase functions:delete recordUsage --region=us-central1 -f
firebase functions:delete lowQuotaAlert --region=us-central1 -f
firebase functions:delete listInvoices --region=us-central1 -f

# Optionally revert Firestore rules (remove Phase 46 section)
```

---

**🎉 Phase 46 deployment successful! Usage metering and invoice tracking are now live.**

**Next:** Implement frontend UI at `/account/usage` and `/account/billing/history`
