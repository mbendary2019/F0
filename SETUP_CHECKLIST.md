# ✅ Setup Checklist

**Complete these steps to finish local development setup:**

---

## 🔥 Firebase (✅ DONE)

- [x] Service account file moved to `~/.secrets/firebase.json`
- [x] Permissions set to 600
- [x] Environment variables added to `~/.zshrc`
- [x] Project ID: `from-zero-84253`

---

## 💳 Stripe (⏳ TODO)

### Step 1: Get API Keys

1. Open: https://dashboard.stripe.com/test/apikeys
2. Make sure **Test mode** is ON (toggle in top-right)
3. Copy both keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

### Step 2: Create Price ($29/month)

1. Open: https://dashboard.stripe.com/test/products/prod_TDTNgO97R3MMU9
2. Click **"Add another price"**
3. Fill in:
   - **Price:** $29.00
   - **Billing period:** Monthly
   - **Currency:** USD
4. Click **"Add price"**
5. Copy the **Price ID** (starts with `price_`)

### Step 3: Update .env.local

Edit `/Users/abdo/Downloads/from-zero-starter/.env.local`:

```bash
# Stripe (from Dashboard)
STRIPE_PUBLIC_KEY=pk_test_PASTE_HERE
STRIPE_SECRET_KEY=sk_test_PASTE_HERE
STRIPE_PRICE_MONTHLY=price_PASTE_HERE
```

---

## 🔥 Firebase Web Config (⏳ TODO)

### Step 1: Get Web App Config

1. Open: https://console.firebase.google.com/project/from-zero-84253/settings/general
2. Scroll to **"Your apps"** section
3. If no web app exists, click **"Add app"** → Web
4. Click the **gear icon** next to your web app
5. Copy the config values

### Step 2: Update .env.local

Add to `/Users/abdo/Downloads/from-zero-starter/.env.local`:

```bash
# Firebase Web Config (from Console)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza_PASTE_HERE
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=PASTE_HERE
NEXT_PUBLIC_FIREBASE_APP_ID=1:PASTE_HERE:web:PASTE_HERE
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-PASTE_HERE
```

---

## 🧪 Verify Setup

### Check .env.local

```bash
cat .env.local | grep -E "(STRIPE_|FIREBASE_)"
```

Expected output should show all values filled (no `xxx` placeholders).

### Start Development

```bash
# Load Firebase environment variables
source ~/.zshrc

# Start Next.js
cd /Users/abdo/Downloads/from-zero-starter
pnpm dev
```

### Test

1. **Firebase:** Should connect without errors in console
2. **Stripe:** Try checkout with test card `4242 4242 4242 4242`

---

## 🎉 When Complete

- [ ] Stripe API keys added to .env.local
- [ ] Stripe Price ID added to .env.local
- [ ] Firebase Web config added to .env.local
- [ ] `pnpm dev` runs without errors
- [ ] Can access http://localhost:3000

---

**Next:** Start building! 🚀

