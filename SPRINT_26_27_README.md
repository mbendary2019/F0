# 🚀 Sprint 26 & 27 - API Monetization Platform

**Complete Developer Portal with API Keys, Billing, and Usage-Based Pricing**

---

## 📦 What's Included

### Sprint 26 - Developer Portal & Core Billing ✅
- **API Keys Management** - Secure HMAC-hashed key generation, listing, revocation
- **Stripe Billing Portal** - Self-service subscription management
- **Webhook System** - Event delivery infrastructure
- **Developer Portal UI** - Bilingual (EN/AR) dashboard for developers
- **Next.js Integration** - 11 API routes connecting to Firebase Functions

### Sprint 27 Phase 5 - Monetization Engine ✅
- **Real-time Gate Enforcement** - Rate limiting & quota checking per plan
- **Usage Aggregation** - Daily → Monthly rollup schedulers
- **Overage Billing** - Automatic Stripe usage records for pay-as-you-go
- **Period Close** - Monthly billing cycle automation
- **Quota Warnings** - 80% threshold alerts
- **Billing UI** - Live usage dashboard with progress bars

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                        │
│  /developers/billing  •  /developers/keys  •  /api/v1/*    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Firebase Cloud Functions (13)                  │
├─────────────────────────────────────────────────────────────┤
│  API Keys:   createApiKey, listApiKeys, revokeApiKey       │
│  Billing:    createBillingPortalLink, stripeWebhook        │
│  Gate:       gateCheck, getSubscription, getUsageMonth     │
│  Schedulers: rollupDailyToMonthly, pushUsageToStripe,      │
│              closeBillingPeriod, quotaWarning              │
│  Test:       sendTestWebhook                                │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│   Firestore  │          │    Stripe    │
│              │          │              │
│ • users/     │          │ • Customers  │
│ • api_keys   │          │ • Subs       │
│ • usage_logs │◄─────────┤ • Usage Rec  │
│ • billing_*  │          │ • Invoices   │
└──────────────┘          └──────────────┘
```

---

## 📂 Project Structure

```
from-zero-starter/
├── functions/src/
│   ├── index-new.ts              # Clean exports (avoids legacy errors)
│   ├── config.ts                 # Unified environment config
│   ├── apiKeys.ts                # API key CRUD operations
│   ├── billing.ts                # Stripe portal + webhook
│   ├── limits.ts                 # Gate enforcement logic
│   ├── gateCheck.ts              # Callable wrapper for gate
│   ├── aggregateMonthly.ts       # Daily→Monthly scheduler
│   ├── overage.ts                # Stripe usage records
│   ├── periodClose.ts            # Monthly billing close
│   ├── quotaWarn.ts              # 80% quota alerts
│   ├── subscriptionRead.ts       # Get user subscription
│   ├── usageMonthRead.ts         # Get monthly usage
│   └── webhooksTest.ts           # Test webhook sender
│
├── src/app/
│   ├── developers/billing/page.tsx        # Billing UI
│   ├── api/
│   │   ├── devportal/
│   │   │   ├── keys/route.ts              # API Keys CRUD
│   │   │   ├── subscription/route.ts      # Subscription data
│   │   │   └── usage-month/route.ts       # Monthly usage
│   │   ├── billing/portal/route.ts        # Stripe portal
│   │   ├── webhooks/test/route.ts         # Test webhook
│   │   └── v1/events/route.ts             # Public API with gate
│   └── lib/functionsClient.ts             # Firebase callable helper
│
├── scripts/
│   └── smoke-prod.sh                      # Production smoke tests
│
├── firestore.indexes.json                 # Database indexes
├── QUICK_START.md                         # 3-step deployment
├── DEPLOYMENT_GUIDE.md                    # Full deployment docs
├── ROLLBACK_PLAN.md                       # Emergency procedures
├── MONITORING_SETUP.md                    # Alerts & dashboards
└── SPRINT_26_27_README.md                 # This file
```

---

## 🚀 Quick Start

### Prerequisites
- ✅ Firebase project: `cashout-swap`
- ✅ Stripe account with API keys
- ⚠️ **Blaze Plan** (required for Cloud Functions deployment)

### 3-Step Deployment

#### 1. Upgrade to Blaze Plan
Visit: https://console.firebase.google.com/project/cashout-swap/usage/details

Set budget alert: **$25/month**

#### 2. Deploy Functions
```bash
cd functions
firebase deploy --only \
  functions:createApiKey,functions:listApiKeys,functions:revokeApiKey,\
  functions:createBillingPortalLink,functions:stripeWebhook,\
  functions:sendTestWebhook,\
  functions:rollupDailyToMonthly,functions:pushUsageToStripe,\
  functions:closeBillingPeriod,functions:quotaWarning,\
  functions:getSubscription,functions:getUsageMonth,functions:gateCheck
```

#### 3. Configure Stripe Webhook
URL: `https://us-central1-cashout-swap.cloudfunctions.net/stripeWebhook`

Events: `customer.subscription.*`

**Full guide:** [QUICK_START.md](./QUICK_START.md)

---

## 🧪 Testing

### Local Development
```bash
# Terminal 1: Firebase Emulator
firebase emulators:start --only functions,firestore

# Terminal 2: Next.js Dev Server
npm run dev -- -p 3000

# Visit: http://localhost:3000/developers/billing
```

### Production Smoke Tests
```bash
./scripts/smoke-prod.sh

# Tests:
# ✓ API Keys create/list
# ✓ Billing Portal URL generation
# ✓ Webhook delivery
# ✓ Public API with gate enforcement
# ✓ Billing UI accessibility
```

---

## 📊 Plans & Pricing

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Monthly Quota | 10,000 | 250,000 | 2,000,000 |
| Rate Limit | 60/min | 600/min | 3,000/min |
| Webhooks | ❌ | ✅ (5) | ✅ (20) |
| API Keys | 2 | 10 | 50 |
| Overage | Hard Cap | $5/1k | $3/1k |

**Configuration:** [functions/src/billing.ts](functions/src/billing.ts#L11)

---

## 🔐 Security

- ✅ API keys hashed with HMAC-SHA256
- ✅ Firebase Auth required for callable functions
- ✅ Stripe webhook signature verification
- ✅ Environment secrets via Firebase config
- ✅ CORS configured for production domains
- ✅ Rate limiting per plan
- ✅ Soft delete for API keys (audit trail)

---

## 📈 Monitoring

### Key Metrics
- Success rate: **≥99%**
- p95 latency: **<400ms**
- Error rate: **<1%**
- Daily cost: **<$1**

### Dashboards
- Firebase Console: https://console.firebase.google.com/project/cashout-swap/functions/list
- Cloud Monitoring: https://console.cloud.google.com/monitoring?project=cashout-swap
- Stripe: https://dashboard.stripe.com

**Full setup:** [MONITORING_SETUP.md](./MONITORING_SETUP.md)

---

## 🗄️ Data Model

### Firestore Collections

#### `users/{uid}/subscription`
```typescript
{
  plan: 'free' | 'pro' | 'enterprise',
  status: 'active' | 'canceled' | 'past_due',
  periodEnd: Timestamp,
  limits: {
    monthlyQuota: number,
    ratePerMin: number,
    overage: {
      enabled: boolean,
      pricePer1k: number
    }
  },
  stripe: {
    customerId: string,
    subscriptionId: string,
    overagePriceItemId: string
  }
}
```

#### `api_keys/{keyId}`
```typescript
{
  uid: string,
  name: string,
  hash: string,  // HMAC-SHA256
  scopes: string[],
  active: boolean,
  createdAt: Timestamp,
  lastUsed: Timestamp | null,
  revokedAt: Timestamp | null
}
```

#### `usage_logs/{uid}/monthly/{YYYY-MM}`
```typescript
{
  total: number,
  byEndpoint: {
    'POST_/api/v1/events': number,
    'GET_/api/v1/events': number,
    // ...
  },
  cost: number,  // cents
  stripeReported: {
    totalUnits: number,
    at: Timestamp
  },
  lastUpdated: Timestamp
}
```

#### `billing_events/{eventId}`
```typescript
{
  uid: string,
  type: 'overage_record' | 'overage_error' | 'period_close' | 'quota_warn',
  meta: object,
  createdAt: Timestamp
}
```

---

## 🔄 Schedulers

| Function | Schedule | Purpose |
|----------|----------|---------|
| `rollupDailyToMonthly` | Every 3 hours | Aggregate daily usage into monthly totals |
| `pushUsageToStripe` | Every 60 minutes | Send overage usage to Stripe |
| `quotaWarning` | Every 6 hours | Alert users at 80% quota |
| `closeBillingPeriod` | 1st of month 00:00 UTC | Monthly billing cycle close |

**Implementation:** [functions/src/](./functions/src/)

---

## 🛠️ Configuration

### Environment Variables

**Firebase Functions** (`.env` or `firebase functions:config:set`):
```bash
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORTAL_RETURN_URL=https://cashoutswap.app/developers
API_KEY_HASH_SECRET=your-secure-random-string
```

**Next.js** (`.env.local` or `.env.production`):
```bash
FIREBASE_PROJECT_ID=cashout-swap
FUNCTIONS_REGION=us-central1
USE_FUNCTIONS_EMULATOR=false
PORTAL_RETURN_URL=https://cashoutswap.app/developers
NEXT_PUBLIC_API_BASE_URL=https://cashoutswap.app
```

---

## 🧯 Emergency Procedures

### Rollback
```bash
# Disable public API immediately
# Option 1: Environment variable
API_PUBLIC_ENABLED=false

# Option 2: Freeze all users
# Set all users' ratePerMin = 0 in Firestore

# Option 3: Revert functions
git checkout PREVIOUS_COMMIT -- functions/
firebase deploy --only functions
```

**Full plan:** [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)

---

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - 15-minute deployment guide
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Comprehensive deployment handbook
- **[ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)** - Emergency rollback procedures
- **[MONITORING_SETUP.md](./MONITORING_SETUP.md)** - Alerts, dashboards, KPIs
- **[firestore.indexes.json](./firestore.indexes.json)** - Database indexes

---

## 🎯 Success Criteria

After 7 days in production:

- ✅ 99.9% uptime
- ✅ <1% error rate
- ✅ p95 latency <400ms
- ✅ Total cost <$25/month
- ✅ Zero billing discrepancies
- ✅ Zero data loss incidents
- ✅ All schedulers 100% reliable

---

## 🔗 Key Links

- **Firebase Console:** https://console.firebase.google.com/project/cashout-swap
- **Cloud Functions:** https://console.cloud.google.com/functions/list?project=cashout-swap
- **Firestore:** https://console.firebase.google.com/project/cashout-swap/firestore
- **Cloud Monitoring:** https://console.cloud.google.com/monitoring?project=cashout-swap
- **Billing:** https://console.cloud.google.com/billing?project=cashout-swap
- **Stripe Dashboard:** https://dashboard.stripe.com

---

## 📞 Support

**Deployment Issues:**
- Check logs: `firebase functions:log --limit 50`
- Verify build: `cd functions && npm run build`
- Review deployment guide: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

**Runtime Errors:**
- Monitor dashboards: See [MONITORING_SETUP.md](./MONITORING_SETUP.md)
- Check Firestore data integrity
- Review Stripe webhook logs

**Emergency:**
- Execute rollback: [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)
- Contact Firebase Support: https://firebase.google.com/support

---

## 🏆 Features Delivered

### ✅ Completed
- [x] 13 Firebase Cloud Functions (Sprint 26 + 27)
- [x] API Keys management with HMAC security
- [x] Stripe billing portal integration
- [x] Real-time gate enforcement with quota checking
- [x] Daily → Monthly usage aggregation
- [x] Automatic overage billing via Stripe
- [x] Monthly billing period close
- [x] 80% quota warning system
- [x] Billing UI with live usage display
- [x] Developer Portal routes
- [x] Smoke test suite
- [x] Comprehensive documentation
- [x] Firestore indexes optimized
- [x] Rollback procedures documented
- [x] Monitoring setup guide

### 🔄 Next Phase (Future)
- [ ] Email notifications for quota warnings
- [ ] Admin dashboard for operations
- [ ] Usage analytics charts
- [ ] API versioning (v2)
- [ ] GraphQL support
- [ ] Webhook retry DLQ
- [ ] Multi-region deployment

---

**Status:** ✅ PRODUCTION READY

**Deployment Required:** Blaze Plan Upgrade → Deploy Functions → Configure Stripe Webhook

**Estimated Time:** 20 minutes + 24h monitoring

---

Built with ❤️ using Firebase, Next.js, Stripe, and TypeScript
