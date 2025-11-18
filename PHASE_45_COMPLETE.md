# Phase 45 - Monetization & Premium Upgrades

## ✅ Implementation Complete

**Date:** 2025-10-12
**Status:** Ready for deployment

---

## 📦 What Was Built

### Cloud Functions (6 files)

1. **`functions/src/billing/plans.ts`** - Plan catalog management
   - `getPlanByPriceId()` - Lookup by Stripe price ID
   - `getPlanById()` - Lookup by plan ID
   - `listPlans()` - List all available plans

2. **`functions/src/billing/entitlements.ts`** - User entitlement management
   - `grantPlan()` - Grant plan and entitlements to user
   - `setStripeState()` - Update Stripe subscription state
   - `hasEntitlement()` - Check user entitlement
   - `revokeSubscription()` - Downgrade to trial
   - `getUserEntitlements()` - Get user's current entitlements

3. **`functions/src/billing/checkout.ts`** - Stripe checkout sessions
   - `createCheckoutSession()` - Create Stripe checkout for subscriptions
   - Handles customer creation/lookup
   - Returns checkout URL

4. **`functions/src/billing/portal.ts`** - Stripe customer portal
   - `createPortalSession()` - Create portal session
   - Allows users to manage their subscriptions

5. **`functions/src/billing/stripeWebhook.ts`** - Stripe webhook handler
   - Handles `checkout.session.completed`
   - Handles `customer.subscription.created/updated/deleted`
   - Handles `invoice.paid/payment_failed`
   - Syncs subscription state to Firestore
   - Grants/revokes entitlements automatically

6. **`functions/src/billing/reconcile.ts`** - Nightly reconciliation
   - Scheduled function runs at 2 AM UTC daily
   - Ensures Firebase entitlements match Stripe state
   - Fixes mismatches automatically

7. **`functions/src/marketplace/paidInstalls.ts`** - Paid marketplace items
   - `installPaidItem()` - Install with entitlement check
   - `checkMarketplaceAccess()` - Check user's paid access

### Next.js API Routes (3 files)

1. **`src/app/api/billing/create-checkout/route.ts`**
   - POST endpoint for creating checkout sessions
   - Verifies Firebase auth token
   - Calls Stripe API directly from server

2. **`src/app/api/billing/create-portal/route.ts`**
   - POST endpoint for customer portal sessions
   - Returns Stripe portal URL

3. **`src/app/api/billing/me/route.ts`**
   - GET endpoint for current user's billing info
   - Returns plan, quota, entitlements, Stripe state

### UI Components (3 files)

1. **`src/components/PricingTable.tsx`**
   - Displays plans in responsive grid
   - Shows features and pricing
   - Handles plan selection with loading states
   - Highlights current plan

2. **`src/components/Paywall.tsx`**
   - Shows upgrade prompt when quota exceeded
   - Displays usage stats
   - Links to pricing page

3. **`src/components/EntitlementGate.tsx`**
   - Conditionally renders content based on entitlements
   - Shows upgrade prompt for premium features
   - Supports custom fallback content

### UI Pages (2 files)

1. **`src/app/(public)/pricing/page.tsx`**
   - Public pricing page
   - Displays all available plans
   - Initiates checkout flow
   - Shows trial information

2. **`src/app/account/plan/page.tsx`**
   - User account billing dashboard
   - Displays current plan and subscription status
   - Shows token usage with progress bar
   - Lists active entitlements
   - Manage subscription button (opens Stripe portal)
   - Success message after checkout

### Infrastructure Files

1. **`src/lib/server/stripe.ts`**
   - Server-side Stripe helper
   - Environment-based key selection
   - Test/live mode detection

2. **`functions/src/index.ts`** (updated)
   - Added Phase 45 function exports

3. **`firestore.rules`** (updated)
   - Added security rules for:
     - `ops_billing_plans` (public read, admin write)
     - `billing_events` (user read own, CF write)
     - `billing_invoices` (user read own, CF write)
     - `ops_marketplace_paid` (public read, admin write)

### Deployment Scripts

1. **`scripts/deploy-phase45.sh`**
   - Configures Firebase Functions with Stripe keys
   - Builds and deploys Cloud Functions
   - Deploys Firestore rules and indexes
   - Provides post-deployment instructions

2. **`scripts/seed-phase45.js`**
   - Seeds 3 billing plans (trial, starter, pro)
   - Seeds 2 paid marketplace items
   - Uses Firebase Admin SDK

---

## 📊 Data Model

### Firestore Collections

#### `ops_billing_plans`
```typescript
{
  id: string;                 // 'trial' | 'starter' | 'pro'
  title: string;
  price: number;
  interval: string;           // 'month' | 'year'
  stripePriceId: string;      // Stripe Price ID
  limits: {
    dailyQuota: number;
    marketplacePaid: boolean;
  };
  entitlements: string[];     // ['priority_support', 'marketplace_paid', ...]
  createdAt: Timestamp;
}
```

#### `ops_user_plans` (Phase 44, enhanced in Phase 45)
```typescript
{
  plan: string;               // Current plan ID
  dailyQuota: number;
  usedToday: number;
  resetAt: string;            // YYYY-MM-DD
  entitlements: string[];
  stripe: {
    customerId: string;
    subscriptionId?: string;
    priceId?: string;
    status?: string;          // 'active' | 'canceled' | ...
  };
  updatedAt: Timestamp;
}
```

#### `billing_events`
```typescript
{
  uid: string;
  type: string;               // 'subscription_activated' | 'subscription_deactivated' | ...
  plan?: string;
  subscriptionId?: string;
  invoiceId?: string;
  status?: string;
  createdAt: Timestamp;
}
```

#### `billing_invoices`
```typescript
{
  uid: string;
  invoiceId: string;          // Stripe Invoice ID
  subscriptionId: string;
  amount: number;
  currency: string;
  status: string;             // 'paid' | 'failed'
  paidAt?: Timestamp;
  createdAt: Timestamp;
}
```

#### `ops_marketplace_paid`
```typescript
{
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  requiresPaid: boolean;
  entitlement: string;        // Required entitlement key
  icon: string;
  verified: boolean;
  createdAt: Timestamp;
}
```

---

## 🚀 Deployment Instructions

### Prerequisites

1. **Stripe Account**
   - Create products and prices in Stripe Dashboard
   - Get your API keys (test and/or live)
   - Note down price IDs for each plan

2. **Environment Variables**
   ```bash
   # Stripe Keys
   export STRIPE_SECRET_KEY="sk_test_..."
   export STRIPE_WEBHOOK_SECRET="whsec_..."
   export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

   # Stripe Price IDs
   export STRIPE_PRICE_STARTER="price_..."
   export STRIPE_PRICE_PRO="price_..."

   # App URL
   export NEXT_PUBLIC_APP_URL="https://your-app.com"
   ```

### Deployment Steps

```bash
# Step 1: Set environment variables (above)

# Step 2: Deploy Phase 45
cd /Users/abdo/Downloads/from-zero-starter
./scripts/deploy-phase45.sh

# Step 3: Seed data
node scripts/seed-phase45.js

# Step 4: Update Stripe Price IDs in Firebase Console
# Go to: https://console.firebase.google.com/project/from-zero-84253/firestore
# Collection: ops_billing_plans
# Update stripePriceId fields with your actual Stripe price IDs
```

### Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint:
   - **URL:** `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/stripeWebhookV2`
   - **Events to send:**
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
3. Copy webhook signing secret
4. Update Firebase config:
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_..."
   firebase deploy --only functions:stripeWebhookV2
   ```

---

## 🧪 Testing

### Test Checkout Flow

1. Go to `/pricing`
2. Click "Upgrade" on a paid plan
3. Use Stripe test card: `4242 4242 4242 4242`
4. Complete checkout
5. Verify redirect to `/account/plan?session_id=...`
6. Check entitlements are granted

### Test Webhook

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local function
stripe listen --forward-to http://localhost:5001/from-zero-84253/us-central1/stripeWebhookV2

# Trigger test event
stripe trigger checkout.session.completed
```

### Test Quota System

```bash
# Consume tokens
curl -X POST http://localhost:3000/api/billing/consume \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tokens": 100}'

# Check usage
curl http://localhost:3000/api/billing/usage \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

---

## 🔧 Integration Notes

### Integrate with Existing Code

#### 1. Add Paywall to Protected Routes

```tsx
import Paywall from '@/components/Paywall';

export default function ProtectedPage() {
  const [billingInfo, setBillingInfo] = useState(null);

  useEffect(() => {
    // Fetch billing info
  }, []);

  const quotaExceeded = billingInfo?.usedToday >= billingInfo?.dailyQuota;

  return (
    <Paywall
      quotaExceeded={quotaExceeded}
      dailyQuota={billingInfo?.dailyQuota}
      usedToday={billingInfo?.usedToday}
    >
      {/* Your protected content */}
    </Paywall>
  );
}
```

#### 2. Add Entitlement Gate to Premium Features

```tsx
import EntitlementGate from '@/components/EntitlementGate';

export default function PremiumFeature() {
  const userEntitlements = ['priority_support']; // Fetch from API

  return (
    <EntitlementGate
      required="marketplace_paid"
      userEntitlements={userEntitlements}
    >
      {/* Premium feature content */}
    </EntitlementGate>
  );
}
```

#### 3. Consume Tokens in AI Operations

```typescript
// In your AI operation handler
import { checkAndConsume } from '@/lib/server/quota';

export async function POST(req: NextRequest) {
  const uid = await verifyAuth(req);
  const tokens = 50; // Calculate based on operation

  try {
    await checkAndConsume(uid, tokens);
    // Proceed with AI operation
  } catch (error) {
    return NextResponse.json(
      { error: 'TRIAL_QUOTA_EXCEEDED' },
      { status: 429 }
    );
  }
}
```

---

## 📈 Revenue Dashboard (Future Enhancement)

Phase 45 provides the foundation. Future sprint can add:

- Admin dashboard at `/ops/billing`
- MRR (Monthly Recurring Revenue) calculation
- Churn rate tracking
- Subscription analytics
- Revenue charts with Recharts

---

## 🔐 Security Notes

- Stripe webhook signature verification enabled
- All billing mutations happen via Cloud Functions only
- Firestore rules prevent direct user writes to billing data
- API routes verify Firebase auth tokens
- Customer IDs stored securely in Firestore

---

## 📚 Reference

### Stripe API Version
- **API Version:** `2024-06-20`
- **Checkout Sessions:** https://stripe.com/docs/api/checkout/sessions
- **Customer Portal:** https://stripe.com/docs/api/customer_portal/sessions
- **Webhooks:** https://stripe.com/docs/webhooks

### Firebase Functions
- **Callable Functions:** `createCheckoutSession`, `createPortalSession`
- **HTTP Functions:** `stripeWebhookV2`
- **Scheduled Functions:** `reconcileSubscriptions` (daily 2 AM UTC)

### Environment Variables Required

```bash
# Cloud Functions (via firebase functions:config:set)
stripe.secret
stripe.webhook_secret
app.url

# Next.js (via .env.local)
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_STARTER
STRIPE_PRICE_PRO
NEXT_PUBLIC_APP_URL
```

---

## ✅ Completion Checklist

- [x] Cloud Functions for billing operations
- [x] Stripe checkout & portal integration
- [x] Webhook handler with event sync
- [x] Nightly reconciliation scheduler
- [x] Paid marketplace item validation
- [x] Next.js API routes
- [x] UI components (PricingTable, Paywall, EntitlementGate)
- [x] Public pricing page
- [x] User account billing dashboard
- [x] Firestore security rules
- [x] Deployment scripts
- [x] Seed data scripts
- [x] Documentation

---

## 🎯 Next Steps

1. Deploy Phase 45 with deployment script
2. Create Stripe products and prices
3. Configure webhook endpoint
4. Seed billing plans data
5. Test full checkout flow
6. Monitor webhook events in Stripe Dashboard
7. Verify reconciliation runs nightly

---

## 🐛 Troubleshooting

### Webhook Signature Verification Fails
- Check `stripe.webhook_secret` config matches Stripe Dashboard
- Ensure using raw request body (not parsed JSON)
- Verify webhook endpoint URL is correct

### Checkout Session Fails
- Verify `STRIPE_SECRET_KEY` is set correctly
- Check Stripe Dashboard for error details
- Ensure price IDs are valid

### Entitlements Not Granted
- Check webhook events in Stripe Dashboard
- Verify `firebaseUID` metadata is set on checkout session
- Check Cloud Functions logs for errors
- Run reconciliation manually to fix

### Quota Reset Not Working
- Verify `resetDailyQuotas` scheduled function is deployed
- Check function logs for errors
- Timezone is set to Asia/Kuwait

---

**Phase 45 Complete! 🎉**
