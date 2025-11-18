# 🎯 Final Setup Instructions

## ✅ Completed:

1. ✅ **Firebase Service Account**
   - Location: `~/.secrets/firebase.json`
   - Permissions: `600` (secure)
   - Environment variables added to `~/.zshrc`

2. ✅ **Firebase Web Configuration**
   - All values added to `.env.local`:
     - API Key: `AIzaSyBhDfrCv_uqu-rs4WNH0Kav2BMK4xD4j4k`
     - Auth Domain: `from-zero-84253.firebaseapp.com`
     - Project ID: `from-zero-84253`
     - Storage Bucket: `from-zero-84253.firebasestorage.app`
     - Messaging Sender ID: `39741106357`
     - App ID: `1:39741106357:web:709d5ce8639e63d21cb6fc`
     - Measurement ID: `G-DGHKQEJGBC`

---

## ⏳ Remaining: Stripe Setup (3 minutes)

### Step 1: Get API Keys (1 minute)

1. Open: **https://dashboard.stripe.com/test/apikeys**
2. Make sure **Test mode** is ON (toggle in top-right corner)
3. Copy both keys:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (click "Reveal test key" → starts with `sk_test_...`)

### Step 2: Create Price (1 minute)

1. Open: **https://dashboard.stripe.com/test/products/prod_TDTNgO97R3MMU9**
2. Click **"Add another price"**
3. Fill in:
   - **Price:** `$29.00`
   - **Billing period:** `Monthly`
   - **Currency:** `USD`
4. Click **"Add price"**
5. Copy the **Price ID** (starts with `price_...`)

### Step 3: Update .env.local (1 minute)

Open `.env.local`:
```bash
code .env.local
# or
nano .env.local
```

Find these lines (at the bottom of the file):
```bash
STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_PRICE_MONTHLY=price_YOUR_PRICE_ID_HERE
```

Replace `YOUR_PUBLISHABLE_KEY_HERE`, `YOUR_SECRET_KEY_HERE`, and `YOUR_PRICE_ID_HERE` with the actual values from Steps 1 & 2.

**Example (with fake values):**
```bash
STRIPE_PUBLIC_KEY=pk_test_51A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6
STRIPE_SECRET_KEY=sk_test_51A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6
STRIPE_PRICE_MONTHLY=price_1A1B2C3D4E5F6G7H8I9J0K1L
```

Save the file (Ctrl+S or Cmd+S).

---

## 🚀 Start Development

Once you've added the Stripe keys:

```bash
# Load Firebase environment variables
source ~/.zshrc

# Start the development server
cd /Users/abdo/Downloads/from-zero-starter
pnpm dev
```

---

## 🧪 Test Your Setup

1. **Open your app:**
   ```
   http://localhost:3000
   ```

2. **Test Stripe Checkout:**
   - Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/25`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

3. **Check Firebase Connection:**
   - Open browser console (F12)
   - Should see no Firebase errors

---

## 📋 Quick Reference

| Service | Dashboard URL |
|---------|---------------|
| **Stripe (Test)** | https://dashboard.stripe.com/test |
| **Stripe API Keys** | https://dashboard.stripe.com/test/apikeys |
| **Stripe Product** | https://dashboard.stripe.com/test/products/prod_TDTNgO97R3MMU9 |
| **Firebase Console** | https://console.firebase.google.com/project/from-zero-84253 |
| **Test Cards** | https://stripe.com/docs/testing#cards |

---

## ❓ Troubleshooting

### "Stripe key is invalid"
- Make sure you're in **TEST MODE** (not live mode)
- Check that you copied the entire key (no spaces or line breaks)

### "Price not found"
- Verify the `STRIPE_PRICE_MONTHLY` value in `.env.local`
- Make sure the price is for product `prod_TDTNgO97R3MMU9`
- Restart the dev server: `pnpm dev`

### "Firebase connection error"
- Check that all Firebase values are in `.env.local`
- Run: `cat .env.local | grep FIREBASE`
- Restart the dev server

---

## 📚 Additional Resources

- **Full Setup Guide:** `cat FIREBASE_STRIPE_SETUP.md`
- **Stripe Guide:** `cat STRIPE_SETUP_GUIDE.md`
- **Setup Checklist:** `cat SETUP_CHECKLIST.md`

---

**You're almost there! Just add those 3 Stripe values and you're ready to code! 🎉**

