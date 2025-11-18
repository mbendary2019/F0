# 🎯 Stripe Billing Setup Guide

Complete guide to setting up Stripe billing and subscription management for F0 Agent.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Stripe Dashboard Setup](#stripe-dashboard-setup)
3. [Environment Configuration](#environment-configuration)
4. [Webhook Configuration](#webhook-configuration)
5. [Firebase Functions Deployment](#firebase-functions-deployment)
6. [Testing](#testing)
7. [Production Checklist](#production-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Stripe account (Test mode for development)
- Firebase project with Firestore enabled
- Node.js 18+ installed
- Firebase CLI installed (`npm i -g firebase-tools`)

---

## Stripe Dashboard Setup

### Step 1: Create Products and Prices

1. **Go to Stripe Dashboard** → [Products](https://dashboard.stripe.com/test/products)

2. **Create Basic Plan:**
   - Click "Add product"
   - Product name: `F0 Agent Basic`
   - Description: `Basic plan with essential features`
   - Pricing model: `Recurring`
   - Price: `$9.00` USD
   - Billing period: `Monthly`
   - Click "Save product"
   - **Copy the Price ID** (starts with `price_`)

3. **Create Pro Plan:**
   - Click "Add product"
   - Product name: `F0 Agent Pro`
   - Description: `Pro plan with all features`
   - Pricing model: `Recurring`
   - Price: `$29.00` USD
   - Billing period: `Monthly`
   - Price nickname: `pro` *(important for tier mapping)*
   - Click "Save product"
   - **Copy the Price ID** (starts with `price_`)

### Step 2: Get API Keys

1. **Go to** → [API Keys](https://dashboard.stripe.com/test/apikeys)
2. **Copy the following:**
   - Publishable key (starts with `pk_test_`)
   - Secret key (starts with `sk_test_`) - **Keep this secure!**

### Step 3: Configure Billing Portal

1. **Go to** → [Customer Portal](https://dashboard.stripe.com/test/settings/billing/portal)
2. **Enable the portal:**
   - Toggle "Customer portal is active"
3. **Configure features:**
   - ✅ Update payment method
   - ✅ View billing history
   - ✅ Cancel subscription
   - ✅ Update subscription (optional)
4. **Set business information:**
   - Business name: `F0 Agent`
   - Support email: `support@yourcompany.com`
   - Privacy policy URL: `https://yourapp.com/privacy`
   - Terms of service URL: `https://yourapp.com/terms`
5. **Save changes**

---

## Environment Configuration

### 1. Local Development (.env.local)

Create or update `.env.local` in your project root:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
NEXT_PUBLIC_STRIPE_PRICE_BASIC=price_YOUR_BASIC_PRICE_ID
NEXT_PUBLIC_STRIPE_PRICE_PRO=price_YOUR_PRO_PRICE_ID
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Firebase Functions Environment

Set environment variables for Firebase Functions:

```bash
firebase functions:config:set \
  stripe.secret_key="sk_test_YOUR_SECRET_KEY" \
  stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"
```

### 3. Vercel Deployment

Add environment variables in Vercel dashboard:

1. Go to **Project Settings** → **Environment Variables**
2. Add all variables from `.env.local`
3. Set for **Production**, **Preview**, and **Development**

---

## Webhook Configuration

### Step 1: Install Stripe CLI (for local testing)

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_amd64.tar.gz
tar -xvf stripe_linux_amd64.tar.gz
```

### Step 2: Local Webhook Testing

```bash
# Login to Stripe
stripe login

# Forward webhooks to local Firebase Functions
stripe listen --forward-to http://localhost:5001/YOUR_PROJECT_ID/us-central1/stripeWebhook

# Copy the webhook signing secret (whsec_...)
# Add it to your .env.local as STRIPE_WEBHOOK_SECRET
```

### Step 3: Production Webhook Setup

1. **Deploy Firebase Functions first** (see next section)

2. **Go to Stripe Dashboard** → [Webhooks](https://dashboard.stripe.com/test/webhooks)

3. **Click "Add endpoint":**
   - Endpoint URL: `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/stripeWebhook`
   - Description: `F0 Agent Subscription Webhook`
   - **Select events to listen to:**
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Click "Add endpoint"

4. **Copy the Signing Secret:**
   - Click on the webhook endpoint you just created
   - Click "Reveal" under "Signing secret"
   - Copy the secret (starts with `whsec_`)
   - Update your Firebase Functions config:
     ```bash
     firebase functions:config:set stripe.webhook_secret="whsec_YOUR_SECRET"
     ```

---

## Firebase Functions Deployment

### Step 1: Install Dependencies

```bash
cd functions
npm install
```

### Step 2: Build Functions

```bash
npm run build
```

### Step 3: Deploy to Firebase

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:stripeWebhook
```

### Step 4: Verify Deployment

```bash
# Check function logs
firebase functions:log

# Test the webhook endpoint
curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/stripeWebhook
```

---

## Testing

### 1. Test Cards

Use Stripe test cards for testing:

| Card Number         | Scenario              |
|--------------------|-----------------------|
| `4242 4242 4242 4242` | Successful payment   |
| `4000 0000 0000 0341` | Payment requires authentication |
| `4000 0000 0000 0002` | Card declined        |

**Expiry:** Any future date
**CVC:** Any 3 digits
**ZIP:** Any 5 digits

### 2. Test Subscription Flow

```bash
# 1. Start your app
npm run dev

# 2. Navigate to pricing page
open http://localhost:3000/pricing

# 3. Click "Subscribe" on a plan
# 4. Complete checkout with test card
# 5. Verify redirect to /account/billing
# 6. Check Firestore for entitlements update
```

### 3. Test Webhook Locally

```bash
# Terminal 1: Start Firebase emulator
firebase emulators:start --only functions

# Terminal 2: Forward Stripe webhooks
stripe listen --forward-to http://localhost:5001/YOUR_PROJECT_ID/us-central1/stripeWebhook

# Terminal 3: Trigger test event
stripe trigger customer.subscription.created
```

### 4. Verify Firestore Updates

Check that `users/{uid}/entitlements` contains:

```json
{
  "provider": "stripe",
  "active": true,
  "tier": "pro",
  "periodEnd": "Timestamp",
  "customerId": "cus_...",
  "subscriptionId": "sub_...",
  "status": "active",
  "cancelAtPeriodEnd": false
}
```

---

## Production Checklist

### Before Going Live

- [ ] Switch from Test mode to Live mode in Stripe
- [ ] Update all API keys to Live keys (`pk_live_`, `sk_live_`)
- [ ] Create production Products and Prices
- [ ] Update environment variables in Vercel/Firebase
- [ ] Configure production webhook endpoint
- [ ] Test end-to-end flow with real card
- [ ] Enable Stripe Radar for fraud prevention
- [ ] Set up email notifications in Stripe
- [ ] Configure tax settings if applicable
- [ ] Add Terms of Service and Privacy Policy links
- [ ] Enable 3D Secure authentication
- [ ] Set up monitoring and alerts

### Security Best Practices

1. **Never expose secret keys**
   - Keep `STRIPE_SECRET_KEY` server-side only
   - Never commit keys to git
   - Use environment variables

2. **Verify webhook signatures**
   - Always validate `stripe-signature` header
   - Use `STRIPE_WEBHOOK_SECRET`

3. **Validate user identity**
   - Check Firebase Auth token before API calls
   - Match `uid` with authenticated user

4. **Rate limiting**
   - Implement rate limits on API routes
   - Use Vercel Edge Config or Redis

5. **Firestore Security Rules**
   - See [ENTITLEMENTS-RULES.md](./ENTITLEMENTS-RULES.md)

---

## Troubleshooting

### Issue: Webhook not receiving events

**Solution:**
```bash
# 1. Check webhook endpoint URL
stripe webhooks list

# 2. Verify signing secret
firebase functions:config:get

# 3. Check function logs
firebase functions:log --only stripeWebhook

# 4. Test webhook manually
stripe events resend evt_xxx
```

### Issue: Entitlements not updating

**Solution:**
1. Check that `uid` is in subscription metadata
2. Verify Firestore rules allow writes
3. Check Firebase Functions logs for errors
4. Ensure webhook events include required types

### Issue: Checkout session fails

**Solution:**
```bash
# 1. Verify price IDs
echo $NEXT_PUBLIC_STRIPE_PRICE_PRO

# 2. Check API key is valid
stripe balance retrieve --api-key $STRIPE_SECRET_KEY

# 3. Inspect browser console for errors
# 4. Check API route logs
```

### Issue: Billing portal not loading

**Solution:**
1. Ensure Customer Portal is enabled in Stripe
2. Verify `customerId` is stored in Firestore
3. Check business information is set
4. Verify return URL is whitelisted

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid API Key` | Wrong/expired key | Update `STRIPE_SECRET_KEY` |
| `No such price` | Price ID incorrect | Verify price IDs in Stripe |
| `Webhook signature verification failed` | Wrong secret | Update `STRIPE_WEBHOOK_SECRET` |
| `No uid in metadata` | Missing user context | Pass `uid` in checkout |

---

## Additional Resources

- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Stripe Billing Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
- [Firebase Functions](https://firebase.google.com/docs/functions)

---

## Support

If you encounter issues:

1. Check Firebase Functions logs: `firebase functions:log`
2. Review Stripe Dashboard logs: [Events](https://dashboard.stripe.com/test/events)
3. Test with Stripe CLI: `stripe listen`
4. Contact support: support@f0agent.com

---

**Last Updated:** October 2025
**Version:** 1.0.0
