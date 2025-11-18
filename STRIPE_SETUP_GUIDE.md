# 🚀 Stripe Setup - Choose Your Method

## ⚡ Method 1: Dashboard (RECOMMENDED - 5 minutes)

**Fastest and easiest way!**

### Step 1: Get API Keys (1 min)

1. Open: **https://dashboard.stripe.com/test/apikeys**
2. Make sure **Test mode** is ON (toggle top-right)
3. Copy both keys:
   - **Publishable key** (pk_test_...)
   - **Secret key** (sk_test_...) - Click "Reveal test key token"

### Step 2: Create Price (2 min)

1. Open: **https://dashboard.stripe.com/test/products/prod_TDTNgO97R3MMU9**
2. Click **"Add another price"**
3. Fill in:
   - **Price model:** Standard pricing
   - **Price:** $29.00
   - **Billing period:** Monthly
   - **Currency:** USD
4. Click **"Add price"**
5. Copy the **Price ID** (starts with `price_`)

### Step 3: Update .env.local (2 min)

```bash
cd /Users/abdo/Downloads/from-zero-starter
code .env.local  # or: nano .env.local
```

Find and replace these lines:

```bash
STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_PRICE_MONTHLY=price_YOUR_PRICE_ID_HERE
```

Save and you're done! ✅

---

## 🔧 Method 2: CLI (After Xcode Tools Install)

**Use this if you prefer command-line tools.**

### Step 1: Wait for Xcode Command Line Tools

The installation was triggered. It may take 5-10 minutes.

Check if complete:
```bash
xcode-select -p
```

If it shows a path like `/Library/Developer/CommandLineTools`, you're ready!

### Step 2: Run Setup Script

```bash
cd /Users/abdo/Downloads/from-zero-starter
./setup-stripe-cli.sh
```

This will:
- Install Stripe CLI
- Login to Stripe
- Create the $29/month price
- Auto-update .env.local

---

## ✅ Verify Setup

After either method:

```bash
# Check values
cat .env.local | grep STRIPE

# Should show:
# STRIPE_PUBLIC_KEY=pk_test_51...
# STRIPE_SECRET_KEY=sk_test_51...
# STRIPE_PRICE_MONTHLY=price_1...
```

---

## 🧪 Test Stripe

```bash
# Start dev server
source ~/.zshrc
pnpm dev

# Visit: http://localhost:3000
# Try checkout with test card: 4242 4242 4242 4242
```

---

## 📚 References

- **Stripe Test Cards:** https://stripe.com/docs/testing#cards
- **Dashboard:** https://dashboard.stripe.com/test
- **API Docs:** https://stripe.com/docs/api

---

## ❓ Troubleshooting

### "Command not found: stripe"
- Xcode Command Line Tools not installed yet
- Use Dashboard method instead (faster!)

### "Invalid API key"
- Make sure you're in **TEST MODE** (not live mode)
- Check that you copied the full key (no spaces)

### Price not showing in checkout
- Verify STRIPE_PRICE_MONTHLY in .env.local
- Restart dev server: `pnpm dev`

---

**Need help?** Check `SETUP_CHECKLIST.md`

