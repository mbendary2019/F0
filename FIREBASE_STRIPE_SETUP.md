# 🔥💳 Firebase & Stripe Setup Guide

**Quick Reference for Local Development**

---

## 🔥 Firebase Setup

### 1. Move Service Account File

```bash
# Create secrets directory
mkdir -p ~/.secrets

# Move Firebase service account (matches any admin SDK filename)
mv ~/Downloads/from-zero-84253-firebase-adminsdk-*.json ~/.secrets/firebase.json

# Set secure permissions (read/write for user only)
chmod 600 ~/.secrets/firebase.json
```

### 2. Set Environment Variables

**For Current Session:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.secrets/firebase.json"
export FIREBASE_PROJECT_ID="from-zero-84253"
export GOOGLE_CLOUD_PROJECT="$FIREBASE_PROJECT_ID"
export GCLOUD_PROJECT="$FIREBASE_PROJECT_ID"
```

**For Persistence (Add to ~/.zshrc):**
```bash
{
  echo ''
  echo '# Firebase Configuration'
  echo 'export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.secrets/firebase.json"'
  echo 'export FIREBASE_PROJECT_ID="from-zero-84253"'
  echo 'export GOOGLE_CLOUD_PROJECT="$FIREBASE_PROJECT_ID"'
  echo 'export GCLOUD_PROJECT="$FIREBASE_PROJECT_ID"'
} >> ~/.zshrc

source ~/.zshrc
```

### 3. Verify Configuration

```bash
# Check environment variables
echo "$GOOGLE_APPLICATION_CREDENTIALS"
echo "$FIREBASE_PROJECT_ID"

# Check project ID in service account file
cat ~/.secrets/firebase.json | grep project_id
```

**Expected Output:**
```
/Users/abdo/.secrets/firebase.json
from-zero-84253
"project_id": "from-zero-84253"
```

---

## 💳 Stripe Setup

### Option 1: Stripe Dashboard (Easiest)

1. **Open Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com/test/products/prod_TDTNgO97R3MMU9
   - Make sure **Test mode** is enabled (toggle in top-right)

2. **Add Price:**
   - Inside product page → Click **"Add another price"**
   - **Pricing model:** Standard pricing
   - **Price:** $29.00
   - **Billing period:** Monthly
   - **Currency:** USD
   - Click **"Add price"**

3. **Copy Price ID:**
   - The new price ID will look like: `price_XXXXXXXXXXXX`
   - Copy this ID

### Option 2: Stripe CLI

**Prerequisites:**
```bash
# Install Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Login (follow prompts)
stripe login
```

**Create Price:**
```bash
stripe prices create \
  --unit-amount 2900 \
  --currency usd \
  --recurring interval=month \
  --product prod_TDTNgO97R3MMU9
```

**Expected Output:**
```json
{
  "id": "price_1Qabc123...",
  "object": "price",
  "active": true,
  "currency": "usd",
  "product": "prod_TDTNgO97R3MMU9",
  "type": "recurring",
  "unit_amount": 2900,
  "recurring": {
    "interval": "month",
    "interval_count": 1
  }
}
```

**Copy the `id` value** (e.g., `price_1Qabc123...`)

---

## 📝 Update Environment Files

### Web App (.env.local)

Create `.env.local` in project root:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and update:

```bash
# Firebase
FIREBASE_PROJECT_ID=from-zero-84253
GOOGLE_APPLICATION_CREDENTIALS=/Users/abdo/.secrets/firebase.json

# Stripe (Test Mode)
STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxx  # From Stripe Dashboard
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxx  # From Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxx  # From Stripe Webhooks

# Pricing
STRIPE_PRODUCT_ID=prod_TDTNgO97R3MMU9
STRIPE_PRICE_MONTHLY=price_XXXXXXXXXXXX      # ← Paste your Price ID here
SUB_PRICE_USD=29
FZ_RATE_PER_USD=1                            # 1 USD = 1 FZ token
```

### Functions (.env in functions/)

If you have a `.env` file in `functions/`:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/Users/abdo/.secrets/firebase.json
FIREBASE_PROJECT_ID=from-zero-84253
GOOGLE_CLOUD_PROJECT=from-zero-84253
GCLOUD_PROJECT=from-zero-84253

STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxx
STRIPE_PRICE_MONTHLY=price_XXXXXXXXXXXX
```

---

## 🧪 Testing

### 1. Test Firebase Connection

```bash
cd /Users/abdo/Downloads/from-zero-starter

# Start Next.js dev server
pnpm dev

# Or start functions emulator
cd functions
pnpm serve
```

**Verify:** Check console logs for Firebase connection success.

### 2. Test Stripe Checkout

**Use Stripe Test Cards:**

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0025 0000 3155` | Requires authentication |

**Expiration:** Any future date (e.g., `12/25`)  
**CVC:** Any 3 digits (e.g., `123`)  
**ZIP:** Any 5 digits (e.g., `12345`)

### 3. Test Webhook

**Local Webhook Forwarding:**

```bash
# In a separate terminal
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy the webhook signing secret (starts with whsec_)
# Update STRIPE_WEBHOOK_SECRET in .env.local
```

**Trigger Test Event:**

```bash
stripe trigger checkout.session.completed
```

**Expected Flow:**
1. Webhook received
2. User FZ balance increased by 29 (or configured amount)
3. Event logged in Firestore `stripe_events` collection

---

## 🔍 Troubleshooting

### Firebase Errors

**Error:** "Could not load the default credentials"

**Fix:**
```bash
# Verify file exists
ls -l ~/.secrets/firebase.json

# Verify environment variable
echo $GOOGLE_APPLICATION_CREDENTIALS

# Restart terminal or source ~/.zshrc
source ~/.zshrc
```

**Error:** "Permission denied" on firebase.json

**Fix:**
```bash
chmod 600 ~/.secrets/firebase.json
```

---

### Stripe Errors

**Error:** "No such price"

**Fix:**
- Verify Price ID in .env.local matches Stripe Dashboard
- Ensure you're in Test mode
- Recreate price if needed

**Error:** "Invalid API key"

**Fix:**
- Verify `STRIPE_SECRET_KEY` starts with `sk_test_`
- Copy from Stripe Dashboard → Developers → API keys

**Error:** "Webhook signature verification failed"

**Fix:**
- Use `stripe listen` for local testing
- Copy webhook secret from `stripe listen` output
- Update `STRIPE_WEBHOOK_SECRET` in `.env.local`

---

## 📚 References

### Firebase

- **Console:** https://console.firebase.google.com/project/from-zero-84253
- **Docs:** https://firebase.google.com/docs/admin/setup
- **Service Accounts:** https://console.cloud.google.com/iam-admin/serviceaccounts

### Stripe

- **Dashboard:** https://dashboard.stripe.com/test
- **Product:** https://dashboard.stripe.com/test/products/prod_TDTNgO97R3MMU9
- **API Keys:** https://dashboard.stripe.com/test/apikeys
- **Webhooks:** https://dashboard.stripe.com/test/webhooks
- **Test Cards:** https://stripe.com/docs/testing

---

## ✅ Verification Checklist

Before starting development, verify:

- [ ] Firebase service account file at `~/.secrets/firebase.json`
- [ ] Permissions set to `600` on firebase.json
- [ ] Environment variables in `~/.zshrc`
- [ ] `.env.local` created and populated
- [ ] Stripe Price created ($29/month)
- [ ] Price ID copied to `.env.local`
- [ ] Stripe webhook secret configured
- [ ] Test checkout completes successfully
- [ ] Webhook triggers and updates user balance

---

**Status:** Ready for local development! 🚀

**Project:** F0 Agent - from-zero-84253  
**Date:** 2025-10-11


