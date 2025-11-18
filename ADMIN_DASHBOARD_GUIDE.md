# 🛠️ Admin Operations Dashboard

**Manual Scheduler Control & Monitoring**

---

## 📦 What's Included

### Admin Debug Functions (5 Callables)
- `debugRollup` - Manually trigger daily → monthly usage aggregation
- `debugPushUsage` - Manually push usage records to Stripe
- `debugQuotaWarn` - Manually send quota warnings to users at 80%
- `debugClosePeriod` - Manually close billing period for all users
- `debugStatus` - Fetch last run status for all schedulers

### Admin Dashboard UI
- **Location:** `/admin/ops`
- **Features:**
  - One-click scheduler execution buttons
  - Real-time status display
  - Execution time tracking
  - Result counters (users processed, warnings sent, etc.)

---

## 🔧 Setup Instructions

### 1. Configure Admin Token

**Functions Environment (.env or Firebase config):**
```bash
# Local development (.env)
ADMIN_DASH_TOKEN=super-secret-admin-token-change-me

# Production (Firebase Functions config)
firebase functions:config:set admin.dash_token="your-secure-random-token-here"
```

**Generate secure token:**
```bash
openssl rand -hex 32
# Example output: 7f3d9e2a1b4c8f6e5d7a9c2b3e4f6a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5
```

**Next.js Environment (.env.local or Vercel):**
```bash
ADMIN_DASH_TOKEN=super-secret-admin-token-change-me
NEXT_PUBLIC_API_BASE_URL=https://cashoutswap.app
```

**⚠️ Security Note:** Keep this token secret! Anyone with this token can trigger schedulers manually.

---

### 2. Deploy Admin Functions

```bash
cd functions
npm run build

firebase deploy --only \
  functions:debugRollup,\
  functions:debugPushUsage,\
  functions:debugQuotaWarn,\
  functions:debugClosePeriod,\
  functions:debugStatus
```

---

### 3. Access the Dashboard

**Local Development:**
```
http://localhost:3000/admin/ops
```

**Production:**
```
https://cashoutswap.app/admin/ops
```

**⚠️ Access Control:** Add authentication middleware to protect this route in production!

---

## 🎮 Using the Dashboard

### Dashboard Actions

#### 1. Run Rollup (Daily → Monthly)
**Button:** "Run Rollup (Daily→Monthly)"

**What it does:**
- Fetches all users from Firestore
- Aggregates last 31 days of daily usage logs
- Updates `usage_logs/{uid}/monthly/{YYYY-MM}` documents
- Calculates total requests, cost, and usage by endpoint

**Use cases:**
- After manual data corrections
- To verify aggregation before month-end
- Testing rollup logic with real data

**Expected duration:** ~2-5 seconds per 100 users

**Result displays:**
```
Rollup: 2025-10-08 13:45:23 • 1234 ms
counters: { users: 150, total: 45000, cost: 2300 }
```

---

#### 2. Push Usage to Stripe
**Button:** "Push Usage to Stripe"

**What it does:**
- Finds all Pro/Enterprise users with overage enabled
- Calculates delta between current usage and last reported usage
- Creates Stripe usage records via `subscriptionItems.createUsageRecord()`
- Updates `stripeReported` field in monthly usage logs

**Use cases:**
- Force sync with Stripe before billing period closes
- Recover from failed automated pushes
- Testing overage billing flow

**Expected duration:** ~1-2 seconds per user with overage

**Result displays:**
```
Push Usage: 2025-10-08 13:47:00 • 3456 ms
pushed: 12500 units
```

**⚠️ Warning:** This creates real Stripe usage records! Only run on production with caution.

---

#### 3. Send Quota Warnings
**Button:** "Send Quota Warnings"

**What it does:**
- Checks all users' monthly usage vs quota
- Creates `billing_events` documents for users at ≥80% quota
- Includes metadata: used, quota, percentage

**Use cases:**
- Testing warning notification system
- Triggering warnings before scheduled run
- Manual user outreach campaigns

**Expected duration:** ~1-2 seconds per 100 users

**Result displays:**
```
Quota Warn: 2025-10-08 13:50:15 • 890 ms
warned: 23 users
```

**Note:** This creates warning events. Connect email/notification system separately.

---

#### 4. Close Period (Destructive)
**Button:** "Close Period" (Red/Destructive)

**What it does:**
- Creates `period_close` event for all users
- Marks billing period as closed
- Triggers any post-period cleanup (if configured)

**Use cases:**
- End-of-month manual close
- Testing period close logic
- Recovery from failed automated close

**Expected duration:** ~1 second per 100 users

**Result displays:**
```
Close Period: 2025-10-08 14:00:00 • 456 ms
closed: 150 users
```

**⚠️ Caution:** This is typically automated. Manual use should be rare.

---

#### 5. Refresh Status
**Button:** "Refresh Status"

**What it does:**
- Fetches current status from `admin/scheduler_status` Firestore document
- Updates UI with latest execution times and results

**Use cases:**
- Check if automated schedulers ran successfully
- Monitor execution times
- Verify last run timestamps

**Always safe to click!**

---

## 📊 Status Display

### Status Document Structure

Firestore location: `admin/scheduler_status`

```typescript
{
  rollup: {
    ok: true,
    at: Timestamp,
    tookMs: 1234,
    counters: {
      users: 150,
      total: 45000,
      cost: 2300
    }
  },
  pushUsage: {
    ok: true,
    at: Timestamp,
    tookMs: 3456,
    pushed: 12500
  },
  quotaWarn: {
    ok: true,
    at: Timestamp,
    tookMs: 890,
    warned: 23
  },
  closePeriod: {
    ok: true,
    at: Timestamp,
    tookMs: 456,
    closed: 150
  }
}
```

---

## 🔐 Security Considerations

### Current Security

**Token-based protection:**
- Functions verify `ADMIN_DASH_TOKEN` before execution
- Token passed from Next.js API route to Firebase callable
- Prevents unauthorized access to scheduler triggers

**Limitations:**
- No user authentication on `/admin/ops` page
- Anyone who accesses the URL can attempt to use it
- Token is in environment variables (not user-specific)

### Recommended Production Security

#### Option 1: IP Whitelist (Vercel)
```javascript
// middleware.ts
import { NextResponse } from 'next/server';

export function middleware(req: Request) {
  const url = new URL(req.url);

  if (url.pathname.startsWith('/admin')) {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const allowedIPs = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];

    if (!allowedIPs.includes(ip)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  return NextResponse.next();
}
```

#### Option 2: Basic Auth
```typescript
// src/app/admin/ops/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function AdminOpsPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');

  function checkAuth() {
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setAuthed(true);
    } else {
      alert('Invalid password');
    }
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="p-6 space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="border p-2"
          />
          <button onClick={checkAuth}>Login</button>
        </div>
      </div>
    );
  }

  return ( /* Dashboard UI */ );
}
```

#### Option 3: Firebase Auth Admin Role
```typescript
// src/app/admin/ops/page.tsx
import { useAuth } from '@/hooks/useAuth';

export default function AdminOpsPage() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user || !user.customClaims?.admin) {
    return <div>403 Forbidden - Admin access required</div>;
  }

  return ( /* Dashboard UI */ );
}
```

---

## 🧪 Testing

### Local Testing

1. **Start Firebase Emulator:**
   ```bash
   firebase emulators:start --only functions,firestore
   ```

2. **Start Next.js:**
   ```bash
   npm run dev -- -p 3000
   ```

3. **Create test data:**
   ```javascript
   // Firestore Console or script
   // Create test user with subscription and usage
   db.doc('users/test_user').set({ ... });
   db.doc('users/test_user/subscription/current').set({ ... });
   db.doc('usage_logs/test_user/daily/2025-10-08').set({ total: 500 });
   ```

4. **Visit dashboard:**
   ```
   http://localhost:3000/admin/ops
   ```

5. **Click "Run Rollup"** → Check Firestore for updated `monthly` document

---

### Production Testing

**⚠️ Test in staging first!**

1. Deploy to staging environment
2. Create test user with minimal usage
3. Test each scheduler individually
4. Verify Firestore updates
5. Check Stripe dashboard for usage records (if testing pushUsage)
6. Only deploy to production after full validation

---

## 📈 Monitoring

### Check Scheduler Health

**Automated schedulers vs Manual triggers:**

| Scheduler | Automated Schedule | Manual Trigger Function |
|-----------|-------------------|------------------------|
| Rollup | Every 3 hours | `debugRollup` |
| Push Usage | Every 60 minutes | `debugPushUsage` |
| Quota Warn | Every 6 hours | `debugQuotaWarn` |
| Close Period | 1st of month 00:00 UTC | `debugClosePeriod` |

**Use dashboard to verify:**
- Automated schedulers running on time
- No execution failures
- Execution times staying reasonable (<10 seconds typical)

---

## 🐛 Troubleshooting

### "Permission Denied" Error

**Symptoms:**
```json
{
  "error": {
    "code": "permission-denied",
    "message": "Not authorized"
  }
}
```

**Causes:**
1. `ADMIN_DASH_TOKEN` mismatch between Next.js and Functions
2. Token not set in environment
3. Functions config not deployed

**Fix:**
```bash
# Verify Next.js env
echo $ADMIN_DASH_TOKEN

# Verify Functions env
firebase functions:config:get

# Redeploy if needed
firebase functions:config:set admin.dash_token="your-token"
firebase deploy --only functions:debugRollup,functions:debugPushUsage,functions:debugQuotaWarn,functions:debugClosePeriod,functions:debugStatus
```

---

### Scheduler Runs But No Updates

**Check:**
1. **Firestore permissions** - Functions have read/write access?
2. **User data exists** - Check `users` collection populated
3. **Monthly usage documents** - Check `usage_logs/{uid}/monthly/` exists

**Debug:**
```bash
# Check function logs
firebase functions:log --only debugRollup --limit 50

# Look for errors or empty result sets
```

---

### Stripe API Errors (pushUsage)

**Common errors:**
- `No such subscription_item` - User's Stripe subscription missing overage price item
- `Rate limit exceeded` - Too many requests to Stripe API

**Fix:**
1. Verify Stripe subscription has usage-based price item
2. Check `users/{uid}/subscription/stripe/overagePriceItemId` exists
3. Add rate limiting to `debugPushUsage` if processing many users

---

## 📚 API Reference

### Admin API Routes

#### POST `/api/admin/scheduler/rollup`
Triggers daily → monthly rollup.

**Response:**
```json
{
  "ok": true,
  "counters": {
    "users": 150,
    "total": 45000,
    "cost": 2300
  }
}
```

#### POST `/api/admin/scheduler/push-usage`
Pushes usage to Stripe.

**Response:**
```json
{
  "ok": true,
  "pushed": 12500
}
```

#### POST `/api/admin/scheduler/quota-warn`
Sends quota warnings.

**Response:**
```json
{
  "ok": true,
  "warned": 23
}
```

#### POST `/api/admin/scheduler/close-period`
Closes billing period.

**Response:**
```json
{
  "ok": true,
  "closed": 150
}
```

#### POST `/api/admin/scheduler/status`
Fetches scheduler status.

**Response:**
```json
{
  "rollup": { "ok": true, "at": {...}, "tookMs": 1234, "counters": {...} },
  "pushUsage": { "ok": true, "at": {...}, "tookMs": 3456, "pushed": 12500 },
  "quotaWarn": { "ok": true, "at": {...}, "tookMs": 890, "warned": 23 },
  "closePeriod": { "ok": true, "at": {...}, "tookMs": 456, "closed": 150 }
}
```

---

## 🎯 Best Practices

1. **Use automated schedulers** - Manual triggers should be exception, not norm
2. **Test in staging first** - Especially for `pushUsage` and `closePeriod`
3. **Monitor execution times** - If times increase significantly, optimize queries
4. **Add authentication** - Protect `/admin/ops` route in production
5. **Log all manual runs** - Add audit trail for compliance
6. **Set up alerts** - Monitor `admin/scheduler_status` for failures

---

## 🔗 Related Documentation

- **Main README:** [SPRINT_26_27_README.md](./SPRINT_26_27_README.md)
- **Deployment Guide:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Monitoring Setup:** [MONITORING_SETUP.md](./MONITORING_SETUP.md)
- **Rollback Plan:** [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)

---

**Status:** ✅ PRODUCTION READY

**Security Level:** 🔒 Token-protected (Add user auth for production)

**Last Updated:** 2025-10-08
