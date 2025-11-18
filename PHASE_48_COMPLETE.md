# Phase 48 - Analytics & Audit Trail ✅

Complete implementation of usage analytics dashboards and auditable change history.

---

## 📊 Overview

Phase 48 adds comprehensive analytics tracking and audit trail functionality to monitor usage, track security-sensitive actions, and provide insights into system behavior.

### Goals Achieved

✅ Centralized event tracking (API requests, tokens, auth, billing, org actions)
✅ Daily metrics aggregation for charts (DAU, tokens, requests, seats)
✅ Searchable audit trail with filters & CSV export
✅ Lightweight client SDK for instrumentation
✅ Real-time dashboards with Recharts

---

## 🗄️ Data Model

### Collections

#### `ops_events` (Raw Events)
```typescript
{
  ts: Timestamp,              // Event timestamp
  uid?: string,               // Actor user ID
  orgId?: string,             // Organization ID
  type: 'api' | 'tokens' | 'auth' | 'billing' | 'org',
  key: string,                // Event key (e.g., 'chat.request')
  n?: number,                 // Numeric value (e.g., token count)
  meta?: Record<string, any>  // Additional metadata
}
```

**TTL:** Optional - Set Firestore TTL on `ts` field for 30-60 days retention

#### `ops_metrics_daily` (Aggregated Metrics)
```typescript
{
  date: 'YYYY-MM-DD',    // Date string
  dau: number,           // Daily Active Users
  tokens: number,        // Total tokens consumed
  requests: number,      // Total API requests
  seatsUsed: number,     // Total seats in use
  orgsActive: number,    // Active organizations
  aggregatedAt: Date     // Aggregation timestamp
}
```

#### `ops_audit` (Audit Trail)
```typescript
{
  ts: Timestamp,             // Action timestamp
  actorUid: string,          // User who performed action
  actorEmail?: string,       // Actor email
  orgId?: string,            // Organization ID
  action: string,            // Action type (e.g., 'role.update')
  object?: string,           // Target object (e.g., user ID)
  diff?: any,                // Change diff
  ip?: string,               // Client IP address
  userAgent?: string         // Client user agent
}
```

---

## ⚡ Cloud Functions

### 1. `recordEvent` (Callable)
**Purpose:** Record analytics events from client or server

**Usage:**
```typescript
import { recordEvent } from '@/lib/analytics';

await recordEvent({
  type: 'api',
  key: 'chat.request',
  n: 1,
  orgId: 'org-123'
});
```

**Validation:**
- Requires valid type: `api`, `tokens`, `auth`, `billing`, or `org`
- `key` is required
- Optional: `n` (numeric value), `orgId`, `meta`

### 2. `logAudit` (Callable)
**Purpose:** Log security-sensitive actions

**Usage:**
```typescript
import { logAudit } from '@/lib/analytics';

await logAudit({
  action: 'role.update',
  orgId: 'org-123',
  object: 'user-456',
  diff: { from: 'member', to: 'admin' }
});
```

**Auto-captured:**
- Actor UID and email from auth context
- Client IP address
- User agent string

### 3. `aggregateDailyMetrics` (Scheduled)
**Schedule:** Every day at 02:10 (Asia/Kuwait timezone)

**Purpose:** Aggregate daily metrics from events

**Process:**
1. Query all events for the day
2. Calculate unique users (DAU)
3. Sum tokens and requests
4. Count active orgs
5. Get current seats usage from `ops_orgs`
6. Write to `ops_metrics_daily`

**Manual Trigger:**
```bash
gcloud functions call aggregateDailyMetrics \
  --region us-central1 \
  --project from-zero-84253
```

### 4. `getAnalytics` (Callable)
**Purpose:** Retrieve dashboard data (KPIs + time series)

**Usage:**
```typescript
import { getAnalytics } from '@/lib/analytics';

const { kpis, series, period } = await getAnalytics({
  days: 30  // Last 30 days
});
```

**Returns:**
```typescript
{
  kpis: {
    dau: number,          // Peak DAU
    tokens: number,       // Total tokens
    requests: number,     // Total requests
    seatsUsed: number,    // Current seats
    orgsActive: number    // Peak active orgs
  },
  series: DailyMetrics[], // Time series data
  period: {
    start: string,        // Start date
    end: string,          // End date
    days: number          // Number of days
  }
}
```

### 5. `exportAuditCsv` (Callable)
**Purpose:** Export audit trail to CSV

**Usage:**
```typescript
import { exportAuditCsv } from '@/lib/analytics';

const { csv, count } = await exportAuditCsv({
  orgId: 'org-123',  // Optional filter
  limit: 2000        // Max 5000
});

// Download CSV
const blob = new Blob([csv], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'audit.csv';
a.click();
```

---

## 🎨 UI Pages

### `/ops/analytics` - Analytics Dashboard

**Features:**
- 4 KPI cards: DAU, Requests, Tokens, Seats
- Time series charts (Recharts):
  - API Requests over time
  - Token Consumption over time
  - Combined Metrics (Requests + DAU)
- Period selector (default: 30 days)
- Link to Audit Trail

**Access:** Admin users only

### `/ops/audit` - Audit Trail

**Features:**
- Real-time table of last 200 audit entries
- Search by action, email, or org ID
- CSV export button
- Sortable columns:
  - Timestamp
  - Actor (email + UID)
  - Action (with badge)
  - Org ID
  - Object
- Auto-updates via Firestore subscription

**Access:** Admin users only

---

## 🔐 Security

### Firestore Rules

```javascript
// Phase 48: Analytics & Audit Trail
match /ops_events/{id} {
  allow read: if isAdmin();
  allow write: if false; // Cloud Functions only
}

match /ops_metrics_daily/{id} {
  allow read: if isAdmin();
  allow write: if false; // Cloud Functions only
}

match /ops_audit/{id} {
  allow read: if isAdmin();
  allow write: if false; // Cloud Functions only
}
```

**Key Points:**
- ✅ All writes from Cloud Functions only
- ✅ Read access restricted to admins
- ✅ No direct client writes allowed
- ✅ Audit trail immutable from client

---

## 📝 Client SDK Reference

### Core Functions

```typescript
// Record API request
await recordEvent({
  type: 'api',
  key: 'chat.request',
  n: 1,
  orgId: 'org-123'
});

// Record token consumption
await recordEvent({
  type: 'tokens',
  key: 'tokens.consume',
  n: 500,
  orgId: 'org-123'
});

// Log audit entry
await logAudit({
  action: 'member.invite',
  orgId: 'org-123',
  object: 'user@example.com'
});
```

### Helper Functions

```typescript
import {
  recordApiRequest,
  recordTokens,
  recordAuth,
  recordBilling,
  recordOrgEvent
} from '@/lib/analytics';

// Simplified helpers
await recordApiRequest('org-123');
await recordTokens(500, 'org-123');
await recordAuth('login');
await recordBilling('subscription.created', 'org-123');
await recordOrgEvent('member.added', 'org-123');
```

---

## 🔧 Instrumentation Guide

### Where to Add Tracking

#### 1. **API Routes**
```typescript
// In your API route
import { recordApiRequest } from '@/lib/analytics';

export async function POST(req: Request) {
  const { orgId } = await req.json();

  // Track the request
  await recordApiRequest(orgId);

  // Your logic here
  return Response.json({ success: true });
}
```

#### 2. **Token Consumption**
```typescript
// After AI model call
import { recordTokens } from '@/lib/analytics';

const response = await openai.chat.completions.create({...});
const tokensUsed = response.usage?.total_tokens || 0;

await recordTokens(tokensUsed, orgId);
```

#### 3. **Audit Trail for Org Actions**
```typescript
// In org management functions
import { logAudit } from '@/lib/analytics';

// When inviting member
await inviteMember({ orgId, email, role });
await logAudit({
  action: 'member.invite',
  orgId,
  object: email,
  diff: { role }
});

// When changing role
await updateRole({ orgId, uid, role: newRole });
await logAudit({
  action: 'role.update',
  orgId,
  object: uid,
  diff: { from: oldRole, to: newRole }
});

// When removing member
await removeMember({ orgId, uid });
await logAudit({
  action: 'member.remove',
  orgId,
  object: uid
});
```

#### 4. **Authentication Events**
```typescript
// After login
import { recordAuth } from '@/lib/analytics';

await signInWithEmailAndPassword(auth, email, password);
await recordAuth('login', { method: 'email' });

// After signup
await createUserWithEmailAndPassword(auth, email, password);
await recordAuth('signup', { method: 'email' });
```

#### 5. **Billing Events**
```typescript
// After subscription created
import { recordBilling, logAudit } from '@/lib/analytics';

await recordBilling('subscription.created', orgId, {
  plan: 'pro',
  seats: 10
});

await logAudit({
  action: 'billing.subscription_created',
  orgId,
  diff: { plan: 'pro', seats: 10 }
});
```

---

## 📈 KPI Definitions

### DAU (Daily Active Users)
Number of unique users who performed any tracked action on a given day.

**Calculation:** `Set<uid>` from all events with type matching tracked actions

### Total Requests
Sum of all API requests across all days in the period.

**Calculation:** `Σ(events.n)` where `type === 'api'`

### Total Tokens
Sum of all tokens consumed across all days in the period.

**Calculation:** `Σ(events.n)` where `type === 'tokens'`

### Seats Used
Current number of seats in use across all organizations.

**Calculation:** `Σ(org.usedSeats)` from `ops_orgs` collection

### Orgs Active
Peak number of unique organizations with activity on any day.

**Calculation:** `Max(Set<orgId>)` from events per day

---

## 🚀 Deployment

### Quick Deploy
```bash
chmod +x scripts/deploy-phase48.sh
./scripts/deploy-phase48.sh
```

### Manual Deploy
```bash
# 1. Build functions
cd functions && npm install && npm run build && cd ..

# 2. Build Next.js
npm run build

# 3. Deploy functions
firebase deploy --only functions:recordEvent,functions:logAudit,functions:aggregateDailyMetrics,functions:getAnalytics,functions:exportAuditCsv

# 4. Deploy rules
firebase deploy --only firestore:rules

# 5. Deploy hosting
firebase deploy --only hosting
```

---

## 🧪 Testing

### 1. Test Event Recording
```typescript
// In browser console or test file
import { recordEvent } from '@/lib/analytics';

await recordEvent({
  type: 'api',
  key: 'test.event',
  n: 1
});

// Verify in Firestore: ops_events collection
```

### 2. Test Audit Logging
```typescript
import { logAudit } from '@/lib/analytics';

await logAudit({
  action: 'test.action',
  object: 'test-object'
});

// Verify in Firestore: ops_audit collection
```

### 3. Test Daily Aggregation
```bash
# Manually trigger aggregation
gcloud functions call aggregateDailyMetrics \
  --region us-central1 \
  --project from-zero-84253

# Check ops_metrics_daily collection for today's doc
```

### 4. Test Dashboard
1. Navigate to `/ops/analytics`
2. Verify KPI cards show data
3. Verify charts render correctly
4. Check period info matches

### 5. Test Audit Trail
1. Navigate to `/ops/audit`
2. Verify entries appear in table
3. Test search functionality
4. Test CSV export

---

## 🔄 Optional: Firestore TTL Setup

To automatically delete old events after 30-60 days:

### Via Console
1. Go to Firestore console
2. Select `ops_events` collection
3. Click "TTL" tab
4. Enable TTL on `ts` field
5. Set expiration to 30 or 60 days

### Via gcloud
```bash
gcloud firestore fields ttls update ts \
  --collection-group=ops_events \
  --enable-ttl \
  --project=from-zero-84253
```

---

## 📊 Sample Data Seeding

For demo/testing purposes:

```javascript
// scripts/seed-phase48-demo.js
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const now = Timestamp.now().toDate();
const orgId = 'demo-org';

// Seed 50 days of demo data
for (let i = 0; i < 50; i++) {
  const date = new Date(now.getTime() - i * 86400000);

  // Random API requests
  await db.collection('ops_events').add({
    ts: date,
    uid: 'demo-user',
    orgId,
    type: 'api',
    key: 'chat.request',
    n: 1 + Math.floor(Math.random() * 10)
  });

  // Random token consumption
  await db.collection('ops_events').add({
    ts: date,
    uid: 'demo-user',
    orgId,
    type: 'tokens',
    key: 'tokens.consume',
    n: 100 + Math.floor(Math.random() * 500)
  });
}

console.log('✅ Seeded ops_events with demo data');
```

Run:
```bash
DEMO_ORG=your-org-id node scripts/seed-phase48-demo.js
```

---

## 🎯 Acceptance Criteria

✅ **Backend Functions**
- [x] `recordEvent` callable returns `{success:true}` and writes to `ops_events`
- [x] `logAudit` callable returns `{success:true}` and writes to `ops_audit`
- [x] `aggregateDailyMetrics` scheduled runs daily and writes to `ops_metrics_daily`
- [x] `getAnalytics` returns KPIs and series data correctly
- [x] `exportAuditCsv` generates valid CSV with correct headers

✅ **Frontend Pages**
- [x] `/ops/analytics` renders KPI cards with live data
- [x] `/ops/analytics` shows dual-line charts (Requests, Tokens)
- [x] `/ops/analytics` displays last 30 days by default
- [x] `/ops/audit` lists last 200 entries in real-time
- [x] `/ops/audit` exports CSV correctly with download

✅ **Security**
- [x] Firestore rules block direct writes to analytics/audit collections
- [x] Only admins can read analytics/audit data
- [x] All mutations go through Cloud Functions only

✅ **Instrumentation**
- [x] Client SDK provides easy-to-use helpers
- [x] Type-safe TypeScript interfaces
- [x] Automatic metadata capture (IP, user agent)

---

## 📚 Next Steps

### Phase 49 Ideas:
1. **Real-time Alerts** - Trigger alerts on anomalies (spike in requests, high token usage)
2. **Cost Analytics** - Track spending per org, per model
3. **User Segmentation** - Cohort analysis, retention metrics
4. **Predictive Analytics** - ML-based usage forecasting
5. **Custom Reports** - User-defined metric dashboards

### Immediate Enhancements:
1. Add more event types (errors, performance, features)
2. Implement date range picker in dashboard
3. Add export to PDF for analytics reports
4. Create scheduled email reports for admins
5. Add drill-down capabilities (click chart → see raw events)

---

## ✨ Summary

Phase 48 is **complete** with:

✅ **5 Cloud Functions** deployed and active
✅ **2 UI pages** with real-time updates
✅ **3 Firestore collections** with secure rules
✅ **Client SDK** with helper functions
✅ **Charts** using Recharts library
✅ **CSV export** for audit trail
✅ **Scheduled aggregation** running daily

**Live Pages:**
- https://from-zero-84253.web.app/ops/analytics
- https://from-zero-84253.web.app/ops/audit

All features are production-ready and fully documented! 🎉
