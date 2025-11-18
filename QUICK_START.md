# 🚀 Quick Start - Sprint 26 & 27 Production Deployment

## ✅ What's Ready

- **13 Firebase Functions** compiled and ready to deploy
- **Billing UI** at `/developers/billing`
- **Gate Enforcement** integrated in API routes
- **Firestore Indexes** configured
- **Next.js Integration** complete
- **Admin RBAC** with role management and audit logging
- **User Profile API** at `/api/me` (returns uid, email, roles, plan, usage)
- **Admin Dashboard** at `/admin` for managing admin users

---

## ⚡ Fast Track to Production (3 Steps)

### Step 1: Upgrade to Blaze Plan (5 minutes)

1. Visit: https://console.firebase.google.com/project/cashout-swap/usage/details
2. Click **"Upgrade to Blaze Plan"**
3. Set up billing account
4. **CRITICAL**: Set budget alert to **$25/month** with 50%, 90%, 100% notifications

**Why?** Cloud Functions deployment requires Cloud Build API, which needs Blaze Plan.

**Expected Cost:** $10-23/month (well within $25 budget)

---

### Step 2: Deploy Functions (5 minutes)

```bash
cd /Users/abdo/Downloads/from-zero-starter/functions

firebase deploy --only \
  functions:createApiKey,\
  functions:listApiKeys,\
  functions:revokeApiKey,\
  functions:createBillingPortalLink,\
  functions:stripeWebhook,\
  functions:sendTestWebhook,\
  functions:rollupDailyToMonthly,\
  functions:pushUsageToStripe,\
  functions:closeBillingPeriod,\
  functions:quotaWarning,\
  functions:getSubscription,\
  functions:getUsageMonth,\
  functions:gateCheck
```

**Watch for:** ✔ Deploy complete! (~5-8 minutes)

---

### Step 3: Configure Stripe Webhook (2 minutes)

1. Go to: https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://us-central1-cashout-swap.cloudfunctions.net/stripeWebhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy signing secret
5. Update Firebase config:
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_YOUR_NEW_SECRET"
   firebase deploy --only functions:stripeWebhook
   ```

---

## 🧪 Quick Smoke Test (2 minutes)

### Test Billing UI
Visit: https://cashoutswap.app/developers/billing

Should show:
- ✅ Plan information
- ✅ Usage progress bar
- ✅ "Open Billing Portal" button

### Test Gate Enforcement
```bash
curl -X POST https://cashoutswap.app/api/v1/events \
  -H 'Content-Type: application/json' \
  -d '{"uid":"demo","type":"test.event"}'
```

Expected: 200 or 201 response

---

## 📊 Monitor First 24 Hours

- **Firebase Console:** https://console.firebase.google.com/project/cashout-swap/functions/list
- **Check for errors:** `firebase functions:log --limit 50`
- **Watch costs:** https://console.firebase.google.com/project/cashout-swap/usage/details

**Target Metrics:**
- Error rate: <1%
- p95 latency: <400ms
- Daily cost: <$1

---

## 📖 Full Documentation

For detailed guides, troubleshooting, and KPIs:
- **Deployment Guide:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Functions Code:** [functions/src/](./functions/src/)
- **Billing UI:** [src/app/developers/billing/page.tsx](./src/app/developers/billing/page.tsx)
- **Admin RBAC:** [docs/ADMIN_RBAC.md](./docs/ADMIN_RBAC.md)

## 🔐 Admin Features

### User Profile Endpoint
**GET** `/api/me` - Returns authenticated user's profile:
```json
{
  "uid": "user123",
  "email": "user@example.com",
  "roles": ["admin"],
  "plan": "pro",
  "usage": { "calls": 42, "tokens": 1500 }
}
```

### Admin Dashboard
Visit `/admin` to manage admin users. Requires admin role.

### Admin API Endpoints
- **POST** `/api/admin/users/{uid}/grant` - Grant role to user
- **POST** `/api/admin/users/{uid}/revoke` - Revoke role from user
- **GET** `/api/admin/admins` - List all admin users

See [docs/ADMIN_RBAC.md](./docs/ADMIN_RBAC.md) for full documentation.

---

## 🆘 Need Help?

**Deployment Failed?**
```bash
# Check Firebase logs
firebase functions:log --limit 50

# Verify project
firebase projects:list
firebase use cashout-swap
```

**Functions Not Loading?**
```bash
# Rebuild
cd functions && npm run build

# Check for TypeScript errors (ignore legacy code errors)
# Only new files matter: index-new.ts and Sprint 26/27 files
```

**Budget Alerts Not Set?**
1. https://console.cloud.google.com/billing
2. Budgets & alerts → Create budget
3. Amount: $25, Alerts: 50%, 90%, 100%

---

## ✨ What's Next?

After successful deployment:

1. **Test user journey** - Sign up → API Key → Make requests → Hit quota
2. **Verify billing** - Check Stripe usage records match Firestore
3. **Monitor performance** - Track error rates and latency
4. **Optimize** - Review cold starts, consider minInstances for hot paths

---

**Current Status:** READY TO DEPLOY ✅

All code is production-ready. Total deployment time: ~15 minutes.
