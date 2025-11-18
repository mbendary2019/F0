# Phase 45 - Ready for Testing ✅

## ✅ What's Deployed

### Cloud Functions (3/7 Active)
1. ✅ **createCheckoutSession** - Creates Stripe checkout sessions
2. ✅ **createPortalSession** - Customer billing portal access
3. ✅ **stripeWebhookV2** - Webhook event handler with UPDATED secret

### Configuration
- ✅ Webhook Secret: `whsec_34WcIkTuLAYiaaZOqPCNdhNmNDNrZxVN` (configured)
- ✅ Stripe Secret Key: `sk_test_51SETrw...` (configured)
- ✅ App URL: `https://from-zero-84253.web.app` (configured)
- ✅ Firestore Rules: Phase 45 rules deployed

### Webhook URL
```
https://stripewebhookv2-vpxyxgcfbq-uc.a.run.app
```

---

## 📋 Testing Checklist

### 1️⃣ Setup Stripe Webhook Endpoint

**Go to:** [Stripe Dashboard - Webhooks](https://dashboard.stripe.com/test/webhooks)

**Steps:**
1. Click **+ Add endpoint**
2. Enter URL: `https://stripewebhookv2-vpxyxgcfbq-uc.a.run.app`
3. Select events:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
4. Save endpoint
5. ✅ Verify: Secret matches `whsec_34WcIkTuLAYiaaZOqPCNdhNmNDNrZxVN`

---

### 2️⃣ Seed Billing Plans Manually

**Required:** Add 3 documents to Firestore `ops_billing_plans` collection

**Follow:** [PHASE_45_MANUAL_SEED.md](./PHASE_45_MANUAL_SEED.md)

**Quick Reference:**

#### Document: `trial`
```json
{
  "id": "trial",
  "title": "Trial",
  "price": 0,
  "interval": "month",
  "stripePriceId": "",
  "limits": {
    "dailyQuota": 500,
    "marketplacePaid": false
  },
  "entitlements": [],
  "createdAt": [SERVER_TIMESTAMP]
}
```

#### Document: `starter`
```json
{
  "id": "starter",
  "title": "Starter",
  "price": 9,
  "interval": "month",
  "stripePriceId": "price_YOUR_STARTER_PRICE_ID",
  "limits": {
    "dailyQuota": 5000,
    "marketplacePaid": false
  },
  "entitlements": ["priority_support"],
  "createdAt": [SERVER_TIMESTAMP]
}
```

#### Document: `pro`
```json
{
  "id": "pro",
  "title": "Pro",
  "price": 29,
  "interval": "month",
  "stripePriceId": "price_YOUR_PRO_PRICE_ID",
  "limits": {
    "dailyQuota": 50000,
    "marketplacePaid": true
  },
  "entitlements": ["priority_support", "advanced_analytics", "custom_branding"],
  "createdAt": [SERVER_TIMESTAMP]
}
```

**⚠️ Important:** Replace `price_YOUR_STARTER_PRICE_ID` and `price_YOUR_PRO_PRICE_ID` with real Price IDs from your [Stripe Products](https://dashboard.stripe.com/test/products).

---

### 3️⃣ Test Checkout Flow

#### From Frontend (JavaScript):

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const createCheckout = httpsCallable(functions, 'createCheckoutSession');

async function startCheckout(priceId) {
  try {
    const result = await createCheckout({ priceId });

    // Redirect to Stripe Checkout
    window.location.href = result.data.url;
  } catch (error) {
    console.error('Checkout error:', error);
  }
}

// Example: Start checkout for Starter plan
startCheckout('price_YOUR_STARTER_PRICE_ID');
```

#### Expected Flow:
1. User clicks "Subscribe to Starter"
2. `createCheckoutSession` creates Stripe session
3. User redirects to Stripe Checkout
4. User completes payment
5. Stripe sends `checkout.session.completed` webhook
6. `stripeWebhookV2` processes event
7. User subscription saved to `ops_user_plans/{uid}`

---

### 4️⃣ Test Customer Portal

```javascript
const createPortal = httpsCallable(functions, 'createPortalSession');

async function openPortal() {
  try {
    const result = await createPortal({});
    window.location.href = result.data.url;
  } catch (error) {
    console.error('Portal error:', error);
  }
}
```

---

### 5️⃣ Verify Webhook Events

#### Check Function Logs:
```bash
firebase functions:log --only stripeWebhookV2
```

#### Expected Log Output:
```
[webhook] Received event: checkout.session.completed
[webhook] Checkout completed for user abc123, sub sub_xyz
[webhook] Subscription sub_xyz for user abc123: active
```

#### Check Firestore:
1. **ops_user_plans/{uid}** - Should contain:
   ```json
   {
     "plan": "starter",
     "status": "active",
     "stripe": {
       "customerId": "cus_...",
       "subscriptionId": "sub_...",
       "priceId": "price_...",
       "status": "active"
     },
     "entitlements": ["priority_support"],
     "limits": {
       "dailyQuota": 5000,
       "usedToday": 0,
       "marketplacePaid": false
     }
   }
   ```

2. **billing_events** - Should log subscription events:
   ```json
   {
     "uid": "user123",
     "type": "subscription_activated",
     "plan": "starter",
     "subscriptionId": "sub_...",
     "status": "active",
     "createdAt": "..."
   }
   ```

3. **billing_invoices/{invoiceId}** - Should log payment:
   ```json
   {
     "uid": "user123",
     "invoiceId": "in_...",
     "subscriptionId": "sub_...",
     "amount": 900,
     "currency": "usd",
     "status": "paid",
     "paidAt": "..."
   }
   ```

---

### 6️⃣ Test with Stripe CLI (Alternative)

Forward webhook events to your deployed function:

```bash
# Forward events
stripe listen --forward-to https://stripewebhookv2-vpxyxgcfbq-uc.a.run.app

# Trigger test event
stripe trigger checkout.session.completed
```

---

## 🔍 Troubleshooting

### Webhook Not Receiving Events?
✅ **Check Stripe Dashboard**: Events tab should show sent webhooks
✅ **Check endpoint URL**: Must exactly match deployed URL
✅ **Check webhook secret**: Must match in Firebase config
✅ **Check logs**: `firebase functions:log --only stripeWebhookV2`

### Checkout Fails?
✅ **Verify Price IDs**: Must be valid Stripe Price IDs from your dashboard
✅ **Check Stripe keys**: Must be test mode keys (start with `sk_test_`)
✅ **Verify authentication**: User must be signed in before checkout
✅ **Check function logs**: `firebase functions:log --only createCheckoutSession`

### Subscription Not Updating?
✅ **Verify webhook configured**: In Stripe Dashboard
✅ **Check firebaseUID metadata**: Should be in checkout session
✅ **Check Firestore rules**: User should have read access to their plan
✅ **Check function logs**: Look for webhook processing errors

---

## 📊 Current Status

### ✅ Completed
- [x] stripeWebhookV2 deployed with correct secret
- [x] createCheckoutSession deployed
- [x] createPortalSession deployed
- [x] Firestore security rules updated
- [x] Environment variables configured

### ⏸️ Pending
- [ ] Stripe webhook endpoint configured in Dashboard
- [ ] Billing plans seeded in Firestore
- [ ] Real Stripe Price IDs added to plans
- [ ] End-to-end checkout flow tested
- [ ] Webhook event processing verified

### 🔜 Next Phase (After Testing Confirms Stability)
- [ ] Deploy reconcileSubscriptions (nightly sync)
- [ ] Deploy paid marketplace functions
- [ ] Create frontend UI components
- [ ] Test quota enforcement
- [ ] Test entitlement gates

---

## 📚 Documentation

- **[PHASE_45_WEBHOOK_DEPLOYED.md](./PHASE_45_WEBHOOK_DEPLOYED.md)** - Detailed deployment info
- **[PHASE_45_FUNCTIONS_REFERENCE.md](./PHASE_45_FUNCTIONS_REFERENCE.md)** - Complete API reference
- **[PHASE_45_MANUAL_SEED.md](./PHASE_45_MANUAL_SEED.md)** - Data seeding instructions
- **[PHASE_45_ملخص_النشر.md](./PHASE_45_ملخص_النشر.md)** - Arabic summary

---

## 🚀 Quick Start Commands

```bash
# View webhook logs
firebase functions:log --only stripeWebhookV2

# View all Phase 45 function logs
firebase functions:log --only createCheckoutSession,createPortalSession,stripeWebhookV2

# Test with Stripe CLI
stripe listen --forward-to https://stripewebhookv2-vpxyxgcfbq-uc.a.run.app
stripe trigger checkout.session.completed

# Check deployed functions
firebase functions:list | grep -i stripe
```

---

**Status:** ✅ Ready for Testing
**Deployed:** 2025-10-12 19:32 UTC
**Next:** Configure Stripe webhook endpoint and test complete flow
