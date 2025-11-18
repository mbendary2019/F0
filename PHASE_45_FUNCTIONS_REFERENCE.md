# Phase 45 Cloud Functions Reference

## 🎯 Deployed Functions (3/7)

### ✅ createCheckoutSession
**Type:** Callable (HTTPS)
**Purpose:** Create Stripe checkout session for subscription purchase
**URL:** `https://us-central1-from-zero-84253.cloudfunctions.net/createCheckoutSession`

**Usage:**
```javascript
const result = await createCheckoutSession({
  priceId: 'price_1SH2QsLYNFMhXeTeuOtumXG9',
  successUrl: 'https://yourapp.com/success',
  cancelUrl: 'https://yourapp.com/pricing'
});

// Redirect to Stripe Checkout
window.location.href = result.url;
```

**Parameters:**
- `priceId` (required): Stripe Price ID
- `successUrl` (optional): Redirect after successful payment
- `cancelUrl` (optional): Redirect if user cancels

**Returns:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

---

### ✅ createPortalSession
**Type:** Callable (HTTPS)
**Purpose:** Create Stripe customer portal session for subscription management
**URL:** `https://us-central1-from-zero-84253.cloudfunctions.net/createPortalSession`

**Usage:**
```javascript
const result = await createPortalSession({
  returnUrl: 'https://yourapp.com/account/plan'
});

// Redirect to Stripe Portal
window.location.href = result.url;
```

**Parameters:**
- `returnUrl` (optional): URL to return after managing subscription

**Returns:**
```json
{
  "url": "https://billing.stripe.com/p/session/..."
}
```

---

### ✅ stripeWebhookV2
**Type:** HTTP Request (onRequest)
**Purpose:** Handle Stripe webhook events for subscription lifecycle
**URL:** `https://stripewebhookv2-vpxyxgcfbq-uc.a.run.app`

**Events Handled:**
- `checkout.session.completed` → Save customer ID
- `customer.subscription.created` → Grant plan and entitlements
- `customer.subscription.updated` → Update plan status
- `customer.subscription.deleted` → Revoke subscription
- `invoice.paid` → Log successful payment
- `invoice.payment_failed` → Log failed payment

**Configuration Required:**
1. Add endpoint URL in [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks)
2. Update webhook secret:
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_YOUR_SECRET"
   firebase deploy --only functions:stripeWebhookV2
   ```

**Firestore Updates:**
- Writes to: `ops_user_plans/{uid}`
- Logs to: `billing_events`
- Logs to: `billing_invoices`

---

## ⏸️ Pending Functions (4/7)

### ⏸️ reconcileSubscriptions
**Type:** Scheduled (every 24 hours)
**Purpose:** Nightly sync with Stripe to catch missed webhook events
**Status:** Not yet deployed

**What it does:**
- Fetches all active subscriptions from Stripe
- Compares with Firestore state
- Updates any mismatches
- Logs discrepancies

**Deploy command:**
```bash
firebase deploy --only functions:reconcileSubscriptions
```

---

### ⏸️ installPaidItem
**Type:** Callable (HTTPS)
**Purpose:** Install paid marketplace items (requires entitlement)
**Status:** Not yet deployed

**What it does:**
- Checks user has required entitlement
- Verifies item requires paid plan
- Creates install record
- Grants access to item

**Usage:**
```javascript
await installPaidItem({
  itemId: 'analytics-pro'
});
```

---

### ⏸️ checkMarketplaceAccess
**Type:** Callable (HTTPS)
**Purpose:** Check if user can access paid marketplace item
**Status:** Not yet deployed

**Returns:**
```json
{
  "hasAccess": true,
  "reason": "User has required entitlement: advanced_analytics"
}
```

---

### ⏸️ verifyEntitlement
**Type:** Helper function (not exposed)
**Purpose:** Check if user has specific entitlement
**Status:** Not yet deployed

**Usage (server-side only):**
```typescript
const hasAnalytics = await verifyEntitlement(uid, 'advanced_analytics');
```

---

## 📦 Helper Modules

### stripeClient.ts
Shared Stripe client initialization

**Functions:**
- `getStripeClient()` → Returns initialized Stripe instance
- `getAppUrl()` → Returns app URL from env

---

### plans.ts
Plan catalog management

**Functions:**
- `getPlanByPriceId(priceId)` → Get plan details from Firestore
- `getPlanById(planId)` → Get plan by ID

---

### entitlements.ts
Entitlement and access control

**Functions:**
- `grantPlan(uid, plan)` → Grant plan and entitlements to user
- `revokeSubscription(uid)` → Revoke all entitlements
- `setStripeState(uid, stripe)` → Update Stripe metadata
- `verifyEntitlement(uid, entitlement)` → Check entitlement access

---

## 🔐 Required Environment Variables

Set via Firebase Functions config:

```bash
# Stripe Keys
firebase functions:config:set \
  stripe.secret="sk_test_YOUR_SECRET_KEY" \
  stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"

# App URL
firebase functions:config:set \
  app.url="https://from-zero-84253.web.app"
```

**Current values:**
```bash
stripe.secret = sk_test_51SETrwLYNFMhXeTe...
stripe.webhook_secret = whsec_NfE2RlLxoXdjuOiZjw6VDYN6sXLVgdXP
app.url = https://from-zero-84253.web.app
```

---

## 🗄️ Firestore Collections

### ops_billing_plans (Public Read)
Plan catalog with pricing and entitlements

**Documents:** `trial`, `starter`, `pro`

**Fields:**
- `id`: Plan identifier
- `title`: Display name
- `price`: Monthly price in USD
- `stripePriceId`: Stripe Price ID
- `limits`: { dailyQuota, marketplacePaid }
- `entitlements`: Array of entitlement strings

---

### ops_user_plans (User Read)
User subscription and entitlement state

**Document ID:** `{uid}`

**Fields:**
- `plan`: Current plan ID
- `status`: Subscription status
- `stripe`: { customerId, subscriptionId, priceId, status }
- `entitlements`: Array of active entitlements
- `limits`: { dailyQuota, usedToday, marketplacePaid }

---

### billing_events (User Read, Cloud Functions Write)
Audit log of billing events

**Fields:**
- `uid`: User ID
- `type`: Event type (subscription_activated, payment_failed, etc.)
- `plan`: Plan ID
- `subscriptionId`: Stripe subscription ID
- `status`: Status at time of event
- `createdAt`: Timestamp

---

### billing_invoices (User Read, Cloud Functions Write)
Invoice payment records

**Document ID:** `{invoiceId}` (Stripe invoice ID)

**Fields:**
- `uid`: User ID
- `invoiceId`: Stripe invoice ID
- `subscriptionId`: Stripe subscription ID
- `amount`: Amount in cents
- `currency`: Currency code
- `status`: 'paid' or 'failed'
- `paidAt`: Payment timestamp (if paid)
- `createdAt`: Record creation timestamp

---

### ops_marketplace_paid (Public Read)
Paid marketplace items requiring entitlements

**Documents:** Item IDs (e.g., `analytics-pro`)

**Fields:**
- `id`: Item ID
- `title`: Display name
- `description`: Item description
- `category`: Category
- `price`: Price (0 for included in plan)
- `requiresPaid`: Boolean (requires paid plan)
- `entitlement`: Required entitlement string
- `icon`: Emoji icon
- `verified`: Boolean

---

## 🧪 Testing Commands

### Test Checkout Flow
```bash
# 1. Create test checkout session (from frontend)
# 2. Complete payment in Stripe Checkout
# 3. Verify webhook events in logs
firebase functions:log --only stripeWebhookV2

# 4. Check Firestore for subscription data
# Go to: https://console.firebase.google.com/project/from-zero-84253/firestore/data/ops_user_plans
```

### Test Webhook Locally
```bash
# Forward webhook events to deployed function
stripe listen --forward-to https://stripewebhookv2-vpxyxgcfbq-uc.a.run.app

# Trigger test event
stripe trigger checkout.session.completed
```

### View Logs
```bash
# All Phase 45 functions
firebase functions:log --only createCheckoutSession,createPortalSession,stripeWebhookV2

# Just webhook
firebase functions:log --only stripeWebhookV2 --lines 50
```

---

## 📊 Security Rules

Phase 45 Firestore rules are deployed:

```rules
// Billing plans - public read
match /ops_billing_plans/{planId} {
  allow read: if true;
  allow write: if isAdmin();
}

// User plans - user can read their own
match /ops_user_plans/{uid} {
  allow read: if isSignedIn() && request.auth.uid == uid;
  allow write: if false; // Cloud Functions only
}

// Billing events - user can read their own
match /billing_events/{id} {
  allow read: if isSignedIn() && resource.data.uid == request.auth.uid;
  allow write: if false;
}

// Invoices - user can read their own
match /billing_invoices/{invoiceId} {
  allow read: if isSignedIn() && resource.data.uid == request.auth.uid;
  allow write: if false;
}

// Paid marketplace - public read
match /ops_marketplace_paid/{itemId} {
  allow read: if true;
  allow write: if isAdmin();
}
```

---

## 🚀 Deployment Summary

**Deployed:** 2025-10-12 19:03:33 UTC

**Build Hash:** `0d5b8c8eaaa14f6a8777a2a219abb6d3429e17ce`

**Functions:**
- ✅ createCheckoutSession
- ✅ createPortalSession
- ✅ stripeWebhookV2

**Next to deploy:**
- ⏸️ reconcileSubscriptions
- ⏸️ installPaidItem
- ⏸️ checkMarketplaceAccess

**Status:** Ready for testing and validation
