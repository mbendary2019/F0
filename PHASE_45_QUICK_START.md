# Phase 45 - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Get Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get your API keys:
   - **Test mode:** `sk_test_...` and `pk_test_...`
   - **Live mode:** `sk_live_...` and `pk_live_...`

### 2. Create Stripe Products

In Stripe Dashboard → Products:

1. **Starter Plan**
   - Name: "Starter"
   - Price: $9/month
   - Copy Price ID: `price_...`

2. **Pro Plan**
   - Name: "Pro"
   - Price: $29/month
   - Copy Price ID: `price_...`

### 3. Set Environment Variables

```bash
# In from-zero-starter directory
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."  # Get this after step 5
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
export STRIPE_PRICE_STARTER="price_..."   # From step 2
export STRIPE_PRICE_PRO="price_..."       # From step 2
export NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Deploy

```bash
./scripts/deploy-phase45.sh
```

Wait for deployment to complete (~3 minutes).

### 5. Configure Stripe Webhook

1. Get your Cloud Function URL from deployment output
2. Go to Stripe Dashboard → Developers → Webhooks → Add endpoint
3. URL: `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/stripeWebhookV2`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy webhook signing secret (`whsec_...`)
6. Update config:
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_..."
   firebase deploy --only functions:stripeWebhookV2
   ```

### 6. Seed Data

```bash
node scripts/seed-phase45.js
```

Then update Stripe Price IDs in [Firebase Console](https://console.firebase.google.com/project/from-zero-84253/firestore):
- Collection: `ops_billing_plans`
- Docs: `starter`, `pro`
- Field: `stripePriceId` → Use your actual price IDs

### 7. Test

1. Start Next.js dev server: `npm run dev`
2. Go to `http://localhost:3000/pricing`
3. Click "Upgrade" on Starter plan
4. Use test card: `4242 4242 4242 4242`
5. Complete checkout
6. Should redirect to `/account/plan?session_id=...`
7. Verify entitlements granted in Firestore: `ops_user_plans/{uid}`

---

## 📋 Quick Reference

### API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/billing/create-checkout` | POST | Required | Create Stripe checkout session |
| `/api/billing/create-portal` | POST | Required | Create customer portal session |
| `/api/billing/me` | GET | Required | Get current user's billing info |
| `/api/billing/consume` | POST | Required | Consume tokens from quota |
| `/api/billing/usage` | GET | Required | Check quota usage |

### Cloud Functions

| Function | Type | Schedule | Description |
|----------|------|----------|-------------|
| `createCheckoutSession` | Callable | - | Create checkout |
| `createPortalSession` | Callable | - | Create portal |
| `stripeWebhookV2` | HTTP | - | Handle Stripe webhooks |
| `reconcileSubscriptions` | Scheduled | Daily 2 AM UTC | Sync Stripe ↔ Firebase |
| `installPaidItem` | Callable | - | Install paid marketplace item |
| `checkMarketplaceAccess` | Callable | - | Check paid access |

### Components

```tsx
// Pricing table
import PricingTable from '@/components/PricingTable';
<PricingTable plans={plans} currentPlan="trial" onSelectPlan={handleSelect} />

// Paywall
import Paywall from '@/components/Paywall';
<Paywall quotaExceeded={false} dailyQuota={500} usedToday={100}>
  <YourContent />
</Paywall>

// Entitlement gate
import EntitlementGate from '@/components/EntitlementGate';
<EntitlementGate required="marketplace_paid" userEntitlements={ents}>
  <PremiumFeature />
</EntitlementGate>
```

### Plans

| Plan | Price | Daily Quota | Paid Marketplace | Entitlements |
|------|-------|-------------|------------------|--------------|
| Trial | $0 | 500 | ❌ | None |
| Starter | $9/mo | 5,000 | ❌ | `priority_support` |
| Pro | $29/mo | 50,000 | ✅ | `priority_support`, `marketplace_paid`, `advanced_analytics`, `custom_branding` |

---

## 🔧 Common Tasks

### Add New Plan

1. Create in Stripe Dashboard
2. Add to `scripts/seed-phase45.js`
3. Run: `node scripts/seed-phase45.js`

### Add New Entitlement

1. Add key to plan in `ops_billing_plans/{planId}`
2. Update `PricingTable` component to display it
3. Use `EntitlementGate` to protect features

### Test Webhooks Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks
stripe listen --forward-to http://localhost:5001/from-zero-84253/us-central1/stripeWebhookV2

# Trigger test event
stripe trigger checkout.session.completed
```

### Check Subscription Status

```typescript
import { getPlanById } from '@/../../functions/src/billing/plans';
import { getUserEntitlements } from '@/../../functions/src/billing/entitlements';

const plan = await getPlanById('pro');
const ents = await getUserEntitlements('user-uid-here');
```

### Manually Grant Plan

```bash
# Firebase Functions shell
firebase functions:shell

# Grant pro plan
const admin = require('firebase-admin');
const { grantPlan } = require('./billing/entitlements');
const { getPlanById } = require('./billing/plans');

const plan = await getPlanById('pro');
await grantPlan('USER_UID_HERE', plan);
```

---

## 🐛 Troubleshooting

### "Customer not found" error
- Check `ops_user_plans/{uid}` has `stripe.customerId`
- Try creating checkout session again (it will create customer)

### Entitlements not granted after payment
- Check webhook is configured correctly
- Check Cloud Functions logs: `firebase functions:log`
- Verify `firebaseUID` metadata on subscription
- Run reconciliation: Wait for 2 AM UTC or trigger manually

### Quota not resetting
- Check `resetDailyQuotas` function is deployed
- Verify timezone (Asia/Kuwait) in function
- Check `ops_user_plans/{uid}.resetAt` field

### Webhook signature mismatch
- Ensure using `req.rawBody` (not parsed JSON)
- Verify webhook secret matches Stripe Dashboard
- Check Cloud Functions config: `firebase functions:config:get`

---

## 📞 Support

- **Stripe Docs:** https://stripe.com/docs
- **Firebase Docs:** https://firebase.google.com/docs
- **GitHub Issues:** https://github.com/your-repo/issues

---

**Ready to monetize! 💰**
