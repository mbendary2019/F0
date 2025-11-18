# Phase 45 - Stripe Webhook Deployed ✅

## ✅ Deployment Status

**Successfully Deployed Functions:**
1. ✅ **createCheckoutSession** - Stripe checkout for subscriptions
2. ✅ **createPortalSession** - Customer billing portal
3. ✅ **stripeWebhookV2** - Webhook event handler (NEW!)

**Webhook URL:**
```
https://stripewebhookv2-vpxyxgcfbq-uc.a.run.app
```

---

## 📋 Next Steps

### 1. Configure Stripe Webhook Endpoint

You need to add this webhook URL to your Stripe Dashboard:

#### Option A: Stripe Dashboard (Recommended for Production)

1. Go to [Stripe Dashboard - Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click **+ Add endpoint**
3. Enter the endpoint URL:
   ```
   https://stripewebhookv2-vpxyxgcfbq-uc.a.run.app
   ```
4. Select the following events to listen to:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`

5. Click **Add endpoint**
6. **Copy the Signing Secret** (starts with `whsec_...`)
7. Update Firebase Functions config with the REAL webhook secret:
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_YOUR_REAL_SECRET_HERE"
   ```
8. Redeploy to pick up the new secret:
   ```bash
   firebase deploy --only functions:stripeWebhookV2
   ```

#### Option B: Stripe CLI (For Testing)

Forward webhook events to your deployed function:

```bash
stripe listen --forward-to https://stripewebhookv2-vpxyxgcfbq-uc.a.run.app
```

---

### 2. Manually Seed Billing Plans

Since the seed script failed due to ADC, please add billing plans manually:

📄 **Follow instructions in:** [PHASE_45_MANUAL_SEED.md](./PHASE_45_MANUAL_SEED.md)

**Quick Summary:**
1. Open [Firestore Console](https://console.firebase.google.com/project/from-zero-84253/firestore)
2. Create collection: `ops_billing_plans`
3. Add 3 documents: `trial`, `starter`, `pro`
4. Update `stripePriceId` fields with real Stripe Price IDs

---

### 3. Update Stripe Price IDs

Get your real Stripe Price IDs:

1. Go to [Stripe Dashboard - Products](https://dashboard.stripe.com/test/products)
2. Create products if needed:
   - **Starter Plan:** $9/month → Copy the Price ID (starts with `price_...`)
   - **Pro Plan:** $29/month → Copy the Price ID
3. Update in Firestore:
   - `ops_billing_plans/starter` → set `stripePriceId`
   - `ops_billing_plans/pro` → set `stripePriceId`

---

### 4. Test the Complete Flow

#### A. Test Checkout

From your frontend, call the checkout function:

```javascript
const functions = getFunctions();
const createCheckout = httpsCallable(functions, 'createCheckoutSession');

try {
  const result = await createCheckout({
    priceId: 'price_YOUR_STARTER_PRICE_ID'
  });

  // Redirect user to Stripe Checkout
  window.location.href = result.data.url;
} catch (error) {
  console.error('Checkout error:', error);
}
```

#### B. Test Customer Portal

```javascript
const createPortal = httpsCallable(functions, 'createPortalSession');

try {
  const result = await createPortal({});
  window.location.href = result.data.url;
} catch (error) {
  console.error('Portal error:', error);
}
```

#### C. Verify Webhook Events

After completing a test checkout:

1. Check Firestore collections:
   - `ops_user_plans/{uid}` - Should have subscription data
   - `billing_events` - Should log subscription events
   - `billing_invoices` - Should log payment events

2. Check Firebase Functions logs:
   ```bash
   firebase functions:log --only stripeWebhookV2
   ```

   You should see:
   ```
   [webhook] Received event: checkout.session.completed
   [webhook] Checkout completed for user abc123, sub sub_xyz
   [webhook] Subscription sub_xyz for user abc123: active
   ```

---

## 🔧 Environment Variables

Current configuration (from Firebase Functions config):

```bash
STRIPE_SECRET_KEY=sk_test_51SETrwLYNFMhXeTe...
STRIPE_WEBHOOK_SECRET=whsec_NfE2RlLxoXdjuOiZjw6VDYN6sXLVgdXP (NEEDS UPDATE!)
APP_URL=https://from-zero-84253.web.app
```

⚠️ **Important:** Replace `STRIPE_WEBHOOK_SECRET` with the real signing secret from Stripe Dashboard after creating the webhook endpoint.

---

## 📊 Collections Structure

### ops_user_plans/{uid}
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
  },
  "updatedAt": "2025-10-12T19:00:00.000Z"
}
```

### billing_events
```json
{
  "uid": "user123",
  "type": "subscription_activated",
  "plan": "starter",
  "subscriptionId": "sub_...",
  "status": "active",
  "createdAt": "2025-10-12T19:00:00.000Z"
}
```

### billing_invoices/{invoiceId}
```json
{
  "uid": "user123",
  "invoiceId": "in_...",
  "subscriptionId": "sub_...",
  "amount": 900,
  "currency": "usd",
  "status": "paid",
  "paidAt": "2025-10-12T19:00:00.000Z",
  "createdAt": "2025-10-12T19:00:00.000Z"
}
```

---

## 🚀 What's Next

After confirming webhook stability:

1. ✅ Deploy `reconcileSubscriptions` - Nightly sync with Stripe
2. ✅ Deploy paid marketplace functions - Entitlement-gated items
3. ✅ Create frontend UI components (PricingTable, Paywall, etc.)
4. ✅ Test quota enforcement and entitlement gates

---

## 📞 Troubleshooting

### Webhook not receiving events?
- Verify endpoint URL in Stripe Dashboard matches deployed URL
- Check Firebase Functions logs for errors
- Ensure webhook secret matches in config

### Checkout session fails?
- Verify Price IDs are correct in Firestore
- Check that Stripe keys are test mode keys (start with `sk_test_`)
- Verify user is authenticated before calling checkout

### Subscription not updating in Firestore?
- Check webhook events are being sent from Stripe
- Verify firebaseUID is in checkout session metadata
- Check Functions logs for webhook processing errors

---

**Deployment Time:** 2025-10-12 19:03:33 UTC
**Build:** `77f286a8-5ecc-4c1b-9324-ca0e52d0e255`
**Revision:** `stripewebhookv2-00002-xun`
