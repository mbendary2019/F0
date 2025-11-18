# Usage Analytics, Quotas & Admin Dashboard

**Sprint 8** - Complete usage tracking, quota enforcement, and admin analytics system.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Firestore Schema](#firestore-schema)
4. [Server Utilities](#server-utilities)
5. [Cloud Functions](#cloud-functions)
6. [API Routes](#api-routes)
7. [UI Pages](#ui-pages)
8. [Setup Guide](#setup-guide)
9. [Usage Examples](#usage-examples)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)
12. [Optional: Stripe Metered Billing](#optional-stripe-metered-billing)

---

## Overview

This system provides comprehensive usage tracking and quota enforcement for your SaaS application:

- **Usage Tracking**: Record and aggregate user activity (LLM calls, API requests, jobs, tasks)
- **Quota Enforcement**: Limit usage based on subscription tier (Free/Pro/Enterprise)
- **User Dashboard**: Self-service usage monitoring and historical analytics
- **Admin Analytics**: Platform-wide usage statistics and insights
- **Optional Metered Billing**: Report usage to Stripe for pay-as-you-go pricing

### Key Features

✅ Real-time usage recording
✅ Daily quota enforcement per plan tier
✅ Automatic quota reset at midnight UTC
✅ Historical usage tracking (90 days)
✅ Admin analytics with plan breakdown
✅ Optional Stripe metered billing integration
✅ Server-side only writes (security)
✅ Audit logging integration

---

## Architecture

### Data Flow

```
User Action
    ↓
API Route (with usageGuard)
    ↓
1. Check Authentication
2. Check Quota (user_quotas)
3. Record Usage (usage_events)
4. Execute Business Logic
    ↓
Cloud Function (every 15 min)
    ↓
Aggregate Events → usage_daily
Update Quotas → user_quotas
Update Admin Stats → admin_usage_stats
Optional: Report to Stripe
    ↓
Delete Processed Events
```

### Collections Structure

```
Firestore
├── usage_events/{eventId}          # Raw events (temporary)
├── usage_daily/{uid}/{yyyymmdd}    # Daily aggregated per user
├── user_quotas/{uid}                # Current quota state per user
└── admin_usage_stats/days/{yyyymmdd} # Platform-wide daily stats
```

---

## Firestore Schema

### 1. `usage_events/{autoId}` (Temporary)

Raw usage events, processed and deleted every 15 minutes.

```typescript
{
  uid: string;              // User ID
  wsId?: string;            // Workspace ID (optional)
  kind: 'llm' | 'api_call' | 'job' | 'task';
  amount: number;           // Usage units (default: 1)
  ts: Timestamp;            // Event timestamp
}
```

**Security**: Server-side only (no client read/write).

---

### 2. `usage_daily/{uid}/{yyyymmdd}` (Historical)

Aggregated daily usage per user.

```typescript
{
  total: number;                    // Total units used this day
  byKind: {                         // Breakdown by usage type
    llm: number;
    api_call: number;
    job: number;
    task: number;
  };
  planTier: 'free' | 'pro' | 'enterprise';
  updatedAt: Timestamp;
}
```

**Security**: Read-only for owner, server-side writes only.

---

### 3. `user_quotas/{uid}` (Current State)

Current quota tracking per user.

```typescript
{
  planTier: 'free' | 'pro' | 'enterprise';
  limit: number;                    // Daily quota limit
  period: 'day';                    // Reset period
  used: number;                     // Units used today
  dateKey: string;                  // YYYYMMDD for current day
  resetAt: Timestamp;               // Next reset time (midnight UTC)
  perKind?: {                       // Optional breakdown by kind
    llm: number;
    api_call: number;
  };
  updatedAt: Timestamp;
}
```

**Security**: Read-only for owner, server-side writes only.

---

### 4. `admin_usage_stats/days/{yyyymmdd}` (Platform Stats)

Platform-wide aggregated statistics.

```typescript
{
  total: number;                    // Total platform usage
  byKind: {                         // Breakdown by usage type
    llm: number;
    api_call: number;
    job: number;
    task: number;
  };
  byPlan: {                         // Breakdown by plan tier
    free: number;
    pro: number;
    enterprise: number;
  };
  updatedAt: Timestamp;
}
```

**Security**: Server-side only (no client access).

---

## Server Utilities

Located in [`src/server/usage.ts`](../src/server/usage.ts).

### Core Functions

#### `usageGuard(req, opts)`

All-in-one middleware for API routes with usage tracking.

```typescript
const result = await usageGuard(req, {
  kind: 'llm',          // Usage type
  amount: 10,           // Optional: units to consume (default: 1)
  wsId: 'ws_123',       // Optional: workspace ID
});

if (!result.ok) {
  return NextResponse.json(
    { error: result.error },
    { status: result.status }
  );
}

// result.ok === true
// result.uid - authenticated user ID
// result.tier - user's plan tier
```

**What it does:**
1. ✅ Authenticates user
2. ✅ Checks if user has remaining quota
3. ✅ Records usage event
4. ✅ Returns user info or error

**Error Responses:**
- `401 Unauthorized` - User not authenticated
- `429 Quota Exceeded` - Daily limit reached

---

#### `recordUsage(uid, kind, amount?, wsId?)`

Manually record a usage event.

```typescript
await recordUsage('user_123', 'api_call', 5, 'ws_456');
```

---

#### `checkQuota(uid, tier, amount?)`

Check if user has remaining quota (returns `true`/`false`).

```typescript
const allowed = await checkQuota('user_123', 'free', 10);
if (!allowed) {
  // Quota exceeded
}
```

---

#### `getUserUsageToday(uid)`

Get user's current usage stats.

```typescript
const stats = await getUserUsageToday('user_123');
// {
//   used: 450,
//   limit: 1000,
//   tier: 'free',
//   resetAt: Date
// }
```

---

#### `getUserUsageHistory(uid, days?)`

Get user's historical usage (default: 30 days).

```typescript
const history = await getUserUsageHistory('user_123', 30);
// [
//   { date: '20250101', total: 120, byKind: { llm: 100, api_call: 20 } },
//   { date: '20250102', total: 95, byKind: { llm: 80, api_call: 15 } },
//   ...
// ]
```

---

## Cloud Functions

Located in [`functions/src/usage.ts`](../functions/src/usage.ts).

### 1. `aggregateDailyUsage`

**Schedule**: Every 15 minutes
**Purpose**: Process usage events and update aggregated collections

**What it does:**
1. Fetches unprocessed events from last hour
2. Groups by user
3. Updates `usage_daily/{uid}/{dateKey}`
4. Updates `user_quotas/{uid}`
5. Updates `admin_usage_stats/days/{dateKey}`
6. Deletes processed events
7. (Optional) Reports to Stripe metered billing

**Monitoring**: Check Cloud Functions logs for processing stats

```bash
firebase functions:log --only aggregateDailyUsage
```

---

### 2. `resetDailyQuotas`

**Schedule**: Daily at 00:05 UTC
**Purpose**: Reset all user quotas for the new day

**What it does:**
1. Fetches all `user_quotas` documents
2. Resets `used` to 0
3. Updates `dateKey` to current day
4. Sets `resetAt` to tomorrow midnight UTC

---

## API Routes

### 1. POST `/api/usage/record`

Record a usage event manually (for testing or edge cases).

**Authentication**: Required (Bearer token)
**Rate Limit**: 20 requests/minute

**Request:**
```json
{
  "kind": "llm",
  "amount": 5,
  "wsId": "ws_123"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "recorded": {
    "kind": "llm",
    "amount": 5,
    "wsId": "ws_123"
  }
}
```

**Example:**
```typescript
const response = await fetch('/api/usage/record', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
  },
  body: JSON.stringify({
    kind: 'llm',
    amount: 10,
  }),
});
```

---

### 2. GET `/api/usage/stats?days=30`

Get current user's usage statistics.

**Authentication**: Required
**Rate Limit**: 60 requests/minute

**Query Params:**
- `days` - Number of days of history (default: 30, max: 90)

**Response:**
```json
{
  "today": {
    "used": 450,
    "limit": 1000,
    "tier": "free",
    "resetAt": "2025-01-07T00:00:00.000Z"
  },
  "history": [
    {
      "date": "20250101",
      "total": 120,
      "byKind": { "llm": 100, "api_call": 20 }
    }
  ]
}
```

---

### 3. GET `/api/admin/usage/overview?days=30`

Get platform-wide usage analytics (admin only).

**Authentication**: Required + Admin claim
**Rate Limit**: 60 requests/minute

**Query Params:**
- `days` - Number of days (default: 30, max: 90)

**Response:**
```json
{
  "dailyStats": [
    {
      "date": "20250101",
      "total": 12500,
      "byKind": { "llm": 10000, "api_call": 2500 },
      "byPlan": { "free": 5000, "pro": 6000, "enterprise": 1500 }
    }
  ],
  "totals": {
    "total": 375000,
    "byKind": { "llm": 300000, "api_call": 75000 },
    "byPlan": { "free": 150000, "pro": 180000, "enterprise": 45000 }
  },
  "userCounts": {
    "free": 120,
    "pro": 45,
    "enterprise": 8,
    "total": 173
  },
  "period": {
    "days": 30,
    "from": "20250101",
    "to": "20250130"
  }
}
```

---

## UI Pages

### 1. `/account/usage` - User Dashboard

**Access**: Authenticated users
**Features**:
- Current daily usage with progress bar
- Quota limit by plan tier
- Reset countdown
- Historical usage chart (7/14/30/60/90 days)
- Usage breakdown by type
- Upgrade prompts when nearing quota

**Components**:
- Real-time usage stats
- Simple bar chart visualization
- Plan tier badge
- Responsive design

---

### 2. `/admin/analytics` - Admin Dashboard

**Access**: Admin users only (requires `admin` custom claim)
**Features**:
- Platform-wide usage metrics
- Total users by plan tier
- Average usage per user
- Daily average usage
- Usage breakdown by plan
- Usage breakdown by type
- 30-day usage timeline (stacked by plan)
- Interactive tooltips on charts

**Protection**: Automatically redirects non-admin users

---

## Setup Guide

### 1. Environment Variables

Add to [`.env.local`](../.env.local.template):

```bash
# Daily quotas per plan tier
QUOTA_FREE_DAILY=1000
QUOTA_PRO_DAILY=10000
QUOTA_ENTERPRISE_DAILY=100000

# Optional: Stripe Metered Billing
STRIPE_METERED_BILLING_ENABLED=false
STRIPE_METERED_PRICE_ID=price_XXXXXXXXXXXXX
```

---

### 2. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

The rules ensure:
- ✅ Users can read their own `usage_daily` and `user_quotas`
- ✅ All writes are server-side only
- ✅ Admin stats are server-side only

---

### 3. Deploy Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions:aggregateDailyUsage,functions:resetDailyQuotas
```

**First-time setup**: Cloud Functions will start aggregating events every 15 minutes automatically.

---

### 4. Grant Admin Access (Optional)

To grant admin access for the analytics dashboard:

```typescript
// In Firebase Admin SDK or Cloud Functions
await admin.auth().setCustomUserClaims(uid, {
  admin: true,
  sub_tier: 'enterprise',  // optional
});
```

Or use the existing claims sync from Sprint 6.

---

### 5. Test Usage Recording

```bash
# Start dev server
npm run dev

# Navigate to a protected page
# Open browser console and test:

const idToken = await firebase.auth().currentUser.getIdToken();

await fetch('/api/usage/record', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
  },
  body: JSON.stringify({
    kind: 'llm',
    amount: 10,
  }),
});
```

---

## Usage Examples

### Example 1: Protect API Route with Usage Guard

```typescript
// src/app/api/ai/chat/route.ts

import { NextResponse } from 'next/server';
import { usageGuard } from '@/server/usage';

export async function POST(req: Request) {
  // Protect with usage guard (consumes 1 unit)
  const result = await usageGuard(req, {
    kind: 'llm',
    amount: 1,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  // User authenticated + quota checked + usage recorded
  const { uid, tier } = result;

  // Execute your business logic
  const response = await callOpenAI({ uid });

  return NextResponse.json({ response });
}
```

---

### Example 2: Track Workspace Usage

```typescript
// src/app/api/workspaces/[wsId]/tasks/route.ts

import { usageGuard } from '@/server/usage';

export async function POST(req: Request, { params }: { params: { wsId: string } }) {
  const { wsId } = params;

  // Track usage at workspace level
  const result = await usageGuard(req, {
    kind: 'task',
    amount: 1,
    wsId,  // Associate with workspace
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  // Create task...
}
```

---

### Example 3: Manual Quota Check

```typescript
import { checkQuota, recordUsage } from '@/server/usage';

// Check before expensive operation
const allowed = await checkQuota(uid, 'free', 100);

if (!allowed) {
  throw new Error('Quota exceeded');
}

// Execute operation
await performExpensiveTask();

// Record usage after success
await recordUsage(uid, 'job', 100);
```

---

## Testing

### Manual Testing Checklist

#### User Dashboard (`/account/usage`)

- [ ] Page loads without errors
- [ ] Shows correct current usage
- [ ] Displays correct quota limit for plan tier
- [ ] Progress bar matches usage percentage
- [ ] Reset time is correct
- [ ] Historical chart renders
- [ ] Period selector works (7/14/30/60/90 days)
- [ ] Upgrade prompt shows when near quota (free tier)

#### Admin Dashboard (`/admin/analytics`)

- [ ] Redirects non-admin users
- [ ] Shows platform-wide metrics
- [ ] User counts by plan are correct
- [ ] Usage breakdown by plan renders
- [ ] Usage breakdown by type renders
- [ ] Timeline chart shows stacked data
- [ ] Tooltips work on chart hover
- [ ] Period selector works

#### API Routes

```bash
# Test usage recording
curl -X POST http://localhost:3000/api/usage/record \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"kind":"llm","amount":5}'

# Test user stats
curl http://localhost:3000/api/usage/stats?days=30 \
  -H "Authorization: Bearer YOUR_ID_TOKEN"

# Test admin overview (requires admin claim)
curl http://localhost:3000/api/admin/usage/overview?days=30 \
  -H "Authorization: Bearer ADMIN_ID_TOKEN"
```

#### Cloud Functions

```bash
# Check function logs
firebase functions:log --only aggregateDailyUsage

# Manually trigger (for testing)
# Note: Scheduled functions run automatically
```

---

### Integration Testing

Create test file `__tests__/usage.test.ts`:

```typescript
import { checkQuota, recordUsage } from '@/server/usage';

describe('Usage System', () => {
  it('should enforce quota limits', async () => {
    const allowed = await checkQuota('test_user', 'free', 1001);
    expect(allowed).toBe(false);
  });

  it('should allow usage within quota', async () => {
    const allowed = await checkQuota('test_user', 'free', 500);
    expect(allowed).toBe(true);
  });

  it('should record usage events', async () => {
    await expect(
      recordUsage('test_user', 'llm', 10)
    ).resolves.not.toThrow();
  });
});
```

---

## Troubleshooting

### Issue: Quota not resetting at midnight

**Cause**: `resetDailyQuotas` Cloud Function not running

**Fix**:
1. Check function deployment: `firebase functions:list`
2. Check function logs: `firebase functions:log --only resetDailyQuotas`
3. Verify schedule: Should run at 00:05 UTC daily
4. Manually reset quota in Firestore if needed

---

### Issue: Usage events not aggregating

**Cause**: `aggregateDailyUsage` Cloud Function errors

**Fix**:
1. Check function logs: `firebase functions:log --only aggregateDailyUsage`
2. Verify `usage_events` collection has documents
3. Check for permission errors in logs
4. Ensure Cloud Functions has Firestore write permissions

---

### Issue: User shows quota exceeded immediately

**Cause**: Quota document has stale date

**Fix**:
```typescript
// Manually reset quota in Firestore
await db.doc(`user_quotas/${uid}`).delete();
// Will auto-recreate on next quota check
```

---

### Issue: Admin dashboard shows 403

**Cause**: User doesn't have `admin` custom claim

**Fix**:
```typescript
// Grant admin claim
await admin.auth().setCustomUserClaims(uid, {
  admin: true,
});

// User must sign out and sign back in for claims to refresh
```

---

### Issue: Charts not rendering

**Cause**: No usage data or incorrect date format

**Fix**:
1. Record some test usage events
2. Wait 15 minutes for aggregation
3. Check `usage_daily` collection in Firestore
4. Verify date keys are in YYYYMMDD format

---

## Optional: Stripe Metered Billing

Enable pay-as-you-go billing by reporting usage to Stripe.

### 1. Create Metered Price in Stripe

1. Go to Stripe Dashboard → Products
2. Create a new product or edit existing
3. Add a **Usage-based price**:
   - Pricing model: **Per unit**
   - Usage is **metered**
   - Unit price: e.g., $0.01 per unit
   - Billing period: Monthly

4. Copy the Price ID (starts with `price_`)

### 2. Enable in Environment

```bash
STRIPE_METERED_BILLING_ENABLED=true
STRIPE_METERED_PRICE_ID=price_1XXXXXXXXXX
```

### 3. Attach to Customer Subscription

When creating subscriptions, include the metered price:

```typescript
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [
    { price: 'price_pro_monthly' },      // Base plan
    { price: 'price_metered_usage' },    // Metered usage
  ],
  metadata: { uid },
});
```

### 4. How It Works

1. User performs actions → usage recorded
2. Every 15 minutes, `aggregateDailyUsage` runs
3. Function calls `reportToStripeMetered()`
4. Reports usage to Stripe: `stripe.subscriptionItems.createUsageRecord()`
5. Stripe bills at end of billing period

### 5. View Usage in Stripe

Stripe Dashboard → Subscriptions → Select customer → View usage records

---

## Summary

You now have a complete usage analytics and quota system:

✅ **Server Utilities** - `usageGuard`, `checkQuota`, `recordUsage`
✅ **Cloud Functions** - Automatic aggregation and quota reset
✅ **API Routes** - User stats and admin analytics
✅ **UI Pages** - User dashboard and admin analytics
✅ **Security** - Server-side only writes, role-based access
✅ **Optional** - Stripe metered billing integration

### Next Steps

1. **Integrate `usageGuard`** into your API routes
2. **Set quota limits** per plan in `.env.local`
3. **Monitor usage** via admin dashboard
4. **Optimize** quota limits based on actual usage patterns
5. **Set up alerts** for quota violations (optional)

---

## Related Documentation

- [Sprint 6 - Security Hardening](./SPRINT-6-SECURITY.md) - Custom claims and rate limiting
- [Sprint 7 - Team Workspaces](./SPRINT-7-COMPLETE.md) - Workspace integration
- [Stripe Billing](./STRIPE-BILLING.md) - Subscription management
- [Master README](./README.md) - Full documentation index

---

**Need Help?** Check the [Troubleshooting](#troubleshooting) section or review Cloud Functions logs.
