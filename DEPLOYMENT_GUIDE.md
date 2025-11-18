# 🚀 Sprint 26 & 27 - Production Deployment Guide

## ✅ Current Status

### Completed:
- ✅ All Sprint 26 functions developed and tested locally
- ✅ All Sprint 27 Phase 5 functions developed and compiled
- ✅ Billing UI created at `/developers/billing`
- ✅ Gate enforcement integrated in API routes
- ✅ 13 Firebase Functions ready for deployment
- ✅ Firebase project: `cashout-swap` configured

### Blocked by:
- ⚠️ **Blaze Plan Upgrade Required**

---

## 📋 Pre-Deployment Checklist

### 1. Blaze Plan Upgrade (REQUIRED)

**Current Error:**
```
Your project cashout-swap must be on the Blaze (pay-as-you-go) plan to complete this command.
Required API cloudbuild.googleapis.com can't be enabled until the upgrade is complete.
```

**Action Required:**
1. Visit: https://console.firebase.google.com/project/cashout-swap/usage/details
2. Click "Upgrade to Blaze Plan"
3. Set up billing account
4. **CRITICAL**: Configure budget alerts immediately

### 2. Budget & Cost Controls (ESSENTIAL)

Set monthly budget: **$25**

**Budget Alerts:**
- 50% ($12.50) - Email warning
- 90% ($22.50) - Email + Slack alert
- 100% ($25.00) - Critical alert

**Expected Monthly Costs:**
- Cloud Functions: ~$5-10 (with minInstances=0)
- Cloud Build: ~$2-5 (deployments)
- Firestore: ~$3-8 (usage logs storage)
- Total: $10-23/month (well within $25 budget)

### 3. Firebase Secrets Configuration

Verify all secrets are set:

```bash
# Check current configuration
firebase functions:config:get

# Expected output should include:
# stripe.secret_key: "sk_live_..." or "sk_test_..."
# stripe.webhook_secret: "whsec_..."
# portal.return_url: "https://cashoutswap.app/developers"
# api.hash_secret: "your-secure-random-string"
```

If missing, set them:

```bash
firebase functions:config:set \
  stripe.secret_key="sk_live_YOUR_KEY" \
  stripe.webhook_secret="whsec_YOUR_SECRET" \
  portal.return_url="https://cashoutswap.app/developers" \
  api.hash_secret="$(openssl rand -hex 32)"
```

### 4. Enable Required APIs

After Blaze upgrade, these will auto-enable:
- ✅ Cloud Functions API
- ✅ Cloud Build API
- ✅ Artifact Registry API

---

## 🚀 Deployment Commands

### Deploy All Functions (Sprint 26 + 27)

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

**Expected Duration:** 5-8 minutes

### Deployment Success Indicators:

```
✔  functions[us-central1-createApiKey]: Successful create operation.
✔  functions[us-central1-listApiKeys]: Successful create operation.
✔  functions[us-central1-revokeApiKey]: Successful create operation.
✔  functions[us-central1-createBillingPortalLink]: Successful create operation.
✔  functions[us-central1-stripeWebhook]: Successful create operation.
✔  functions[us-central1-sendTestWebhook]: Successful create operation.
✔  functions[us-central1-rollupDailyToMonthly]: Successful create operation.
✔  functions[us-central1-pushUsageToStripe]: Successful create operation.
✔  functions[us-central1-closeBillingPeriod]: Successful create operation.
✔  functions[us-central1-quotaWarning]: Successful create operation.
✔  functions[us-central1-getSubscription]: Successful create operation.
✔  functions[us-central1-getUsageMonth]: Successful create operation.
✔  functions[us-central1-gateCheck]: Successful create operation.

✔  Deploy complete!
```

---

## 🔧 Post-Deployment Configuration

### 1. Configure Stripe Webhook

**Webhook URL:**
```
https://us-central1-cashout-swap.cloudfunctions.net/stripeWebhook
```

**Steps:**
1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter URL above
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Save and copy signing secret
6. Update Firebase config:
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_NEW_SECRET"
   firebase deploy --only functions:stripeWebhook
   ```

### 2. Update Next.js Environment Variables

Update `.env.local` for production:

```bash
FIREBASE_PROJECT_ID=cashout-swap
FUNCTIONS_REGION=us-central1
USE_FUNCTIONS_EMULATOR=false
FUNCTIONS_EMULATOR_ORIGIN=
PORTAL_RETURN_URL=https://cashoutswap.app/developers
NEXT_PUBLIC_API_BASE_URL=https://cashoutswap.app
```

### 3. Configure Firestore Indexes

Create composite indexes for queries:

```bash
# Create firestore.indexes.json
```

**Required Indexes:**
```json
{
  "indexes": [
    {
      "collectionGroup": "api_keys",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "active", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "usage_logs",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "lastUpdated", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Deploy indexes:
```bash
firebase deploy --only firestore:indexes
```

---

## 🧪 Smoke Tests (Production)

### A) Gate Enforcement Test

Test quota blocking for free user:

```bash
# Create test user document in Firestore:
# users/test_free_user/subscription
# {
#   plan: 'free',
#   status: 'active',
#   limits: { monthlyQuota: 100, ratePerMin: 60 }
# }

# Create usage exceeding quota:
# usage_logs/test_free_user/monthly/2025-10
# { total: 150 }

# Test API call (should return 429)
curl -X POST https://cashoutswap.app/api/v1/events \
  -H 'Content-Type: application/json' \
  -d '{"uid":"test_free_user","type":"test.event"}'

# Expected Response:
# Status: 429
# Body: {"code":"quota_exceeded","message":"Request blocked by plan gate"}
```

### B) Billing UI Test

1. Visit: https://cashoutswap.app/developers/billing
2. Verify displays:
   - ✅ Current plan name
   - ✅ Status (active/inactive)
   - ✅ Period end date
   - ✅ Monthly quota limits
   - ✅ Usage progress bar
   - ✅ "Open Billing Portal" button works

### C) Overage Test (Pro Plan)

```bash
# Create Pro user with overage enabled:
# users/test_pro_user/subscription
# {
#   plan: 'pro',
#   status: 'active',
#   limits: {
#     monthlyQuota: 1000,
#     overage: { enabled: true, pricePer1k: 5 }
#   },
#   stripe: {
#     overagePriceItemId: 'si_...'
#   }
# }

# Create usage exceeding quota:
# usage_logs/test_pro_user/monthly/2025-10
# { total: 1200 }

# Test API call (should ALLOW with overage)
curl -X POST https://cashoutswap.app/api/v1/events \
  -H 'Content-Type: application/json' \
  -d '{"uid":"test_pro_user","type":"test.event"}'

# Expected: 201 Created (allowed despite quota exceeded)
```

After 1 hour, verify Stripe usage record created:
```bash
# Check Stripe Dashboard > Subscriptions > [user] > Usage
# Should show: +200 units recorded
```

### D) Webhook Test

```bash
curl -X POST https://cashoutswap.app/api/webhooks/test \
  -H 'Content-Type: application/json' \
  -d '{"event":"test.event","payload":{"message":"Hello from production"}}'

# Check Firestore: webhook_queue collection
# Should have new document with status: 'pending'
```

### E) API Keys Test

```bash
# Create API key via Developer Portal UI
# Or via API:
curl -X POST https://cashoutswap.app/api/devportal/keys \
  -H 'Content-Type: application/json' \
  -d '{"name":"Production Test Key","scopes":["read","write"]}'

# Should return:
# {
#   "id": "abc123",
#   "apiKey": "f0_...",
#   "name": "Production Test Key",
#   "scopes": ["read","write"]
# }

# List keys:
curl https://cashoutswap.app/api/devportal/keys

# Revoke key:
curl -X DELETE https://cashoutswap.app/api/devportal/keys/abc123
```

---

## 📊 Monitoring & Alerts Setup

### 1. Cloud Functions Monitoring

**Key Metrics to Track:**
- Invocation count per function
- Error rate (target: <1%)
- Execution time p95 (target: <400ms)
- Memory usage
- Cold start frequency

**Access:** https://console.cloud.google.com/functions/list?project=cashout-swap

### 2. Set Up Alerts

**Critical Alerts:**

1. **High Error Rate (5xx)**
   - Condition: Error rate > 2% for 5 minutes
   - Action: Email + Slack notification

2. **Quota Exceeded Spike**
   - Condition: 429 responses > 100 in 5 minutes
   - Action: Email notification

3. **Scheduler Failures**
   - Condition: rollupDailyToMonthly, pushUsageToStripe, quotaWarning, or closeBillingPeriod fails
   - Action: Critical alert

4. **Stripe Webhook Failures**
   - Condition: stripeWebhook error rate > 5%
   - Action: Email + Slack notification

### 3. Firestore Monitoring

**Watch Collections:**
- `users/{uid}/subscription` - subscription changes
- `usage_logs/{uid}/monthly/{month}` - usage tracking
- `billing_events` - billing operations log
- `webhook_queue` - webhook delivery status

### 4. Cost Monitoring

**Daily Review (first week):**
- Cloud Functions invocations
- Cloud Build minutes used
- Firestore read/write operations
- Egress bandwidth

**Weekly Review:**
- Total spend vs. budget
- Cost per user
- Function optimization opportunities

---

## 🔐 Security Checklist

- [ ] All Firebase Functions use `onCall` with auth checks (not HTTP endpoints except stripeWebhook)
- [ ] Stripe webhook signature verification enabled
- [ ] API keys hashed with HMAC-SHA256
- [ ] CORS configured for production domains only
- [ ] Environment variables/secrets not committed to git
- [ ] `minInstances: 0` set to avoid idle costs
- [ ] Firestore security rules deployed (separate command)
- [ ] Rate limiting active via gate enforcement

---

## 🐛 Troubleshooting

### Issue: Functions not deploying

**Check:**
```bash
firebase functions:log --limit 50
```

**Common causes:**
- TypeScript compilation errors (check `npm run build` output)
- Missing dependencies in package.json
- Invalid Firebase config format

### Issue: Gate enforcement not working

**Debug:**
```bash
# Check subscription document exists:
# Firestore > users/{uid}/subscription

# Check monthly usage document:
# Firestore > usage_logs/{uid}/monthly/{YYYY-MM}

# Check function logs:
firebase functions:log --only gateCheck
```

### Issue: Stripe webhooks failing

**Verify:**
1. Webhook signing secret matches Firebase config
2. Webhook URL is correct
3. Selected events include subscription lifecycle events
4. Check Stripe webhook logs for error details

### Issue: Schedulers not running

**Check:**
1. Verify scheduler functions deployed successfully
2. Check Cloud Scheduler console: https://console.cloud.google.com/cloudscheduler?project=cashout-swap
3. Review function execution logs
4. Manually trigger for testing:
   ```bash
   # Create test HTTP endpoint (temporary) to trigger scheduler
   ```

---

## 📈 First Week KPIs

Track these metrics daily for the first week:

| Metric | Target | Day 1 | Day 2 | Day 3 | Day 7 |
|--------|--------|-------|-------|-------|-------|
| Success Rate | ≥99% | | | | |
| P95 Latency | <400ms | | | | |
| Error Rate | <1% | | | | |
| 429 (Quota) Count | <50/day | | | | |
| Free→Pro Conversions | - | | | | |
| Daily Cost | <$1 | | | | |
| Stripe Records Match Firestore | 100% | | | | |

---

## 🎯 Next Steps After Deployment

1. **Monitor for 24 hours** - Watch error rates and performance
2. **Test user journey** - Sign up → Create API Key → Make requests → Hit quota → Upgrade
3. **Verify billing** - Ensure Stripe usage records created correctly
4. **Optimize** - Review cold starts, consider increasing minInstances for hot paths
5. **Scale plan** - Document process for adding new tiers (e.g., Teams, Enterprise+)

---

## 📞 Support & Resources

- **Firebase Console:** https://console.firebase.google.com/project/cashout-swap
- **Stripe Dashboard:** https://dashboard.stripe.com
- **Cloud Functions Logs:** `firebase functions:log`
- **Documentation:** This guide + inline code comments

---

## ✅ Deployment Readiness

**Current Status: READY TO DEPLOY (pending Blaze upgrade)**

All code is production-ready. Once Blaze Plan is activated:

1. Run deployment command (5 mins)
2. Configure Stripe webhook (2 mins)
3. Run smoke tests (10 mins)
4. Monitor for 24 hours

**Estimated Total Time:** ~20 minutes active work + 24h monitoring
