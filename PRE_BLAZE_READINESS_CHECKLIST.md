# ✅ Pre-Blaze Readiness Checklist

**Complete this checklist BEFORE upgrading to Blaze Plan**

Last validation ensures everything works locally and you're ready for production deployment.

---

## 🎯 Quick Status

Run validation script:
```bash
npx ts-node scripts/validate-preblaze.ts
```

Expected output: ✅ All checks passed (10/10)

---

## 📋 Complete Checklist

### 1. Environment Variables ✅

#### Functions Environment (`functions/.env`)
- [ ] `STRIPE_SECRET_KEY` set (sk_test_... or sk_live_...)
- [ ] `STRIPE_WEBHOOK_SECRET` set (whsec_...)
- [ ] `PORTAL_RETURN_URL` set (http://localhost:3000/developers for dev)
- [ ] `API_KEY_HASH_SECRET` set (32+ character random string)
- [ ] `ADMIN_DASH_TOKEN` set (32+ character random string)

**Verify:**
```bash
cd functions
cat .env | grep -E "STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|PORTAL_RETURN_URL|API_KEY_HASH_SECRET|ADMIN_DASH_TOKEN"
```

#### Next.js Environment (`.env.local`)
- [ ] `FIREBASE_PROJECT_ID=cashout-swap`
- [ ] `FUNCTIONS_REGION=us-central1`
- [ ] `USE_FUNCTIONS_EMULATOR=true` (local) or `false` (prod)
- [ ] `FUNCTIONS_EMULATOR_ORIGIN=http://127.0.0.1:5001` (local only)
- [ ] `PORTAL_RETURN_URL=http://localhost:3000/developers` (local)
- [ ] `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000` (local)
- [ ] `ADMIN_DASH_TOKEN` matches functions token

**Verify:**
```bash
cat .env.local | grep -E "FIREBASE_PROJECT_ID|FUNCTIONS_REGION|ADMIN_DASH_TOKEN"
```

---

### 2. Firebase Functions Build ✅

- [ ] All 18 functions compile successfully
- [ ] No TypeScript errors in Sprint 26/27 files
- [ ] `lib/` directory contains compiled .js files

**Verify:**
```bash
cd functions
npm run build

# Check compiled files exist
ls lib/index-new.js
ls lib/debugSchedulers.js
ls lib/limits.js
ls lib/overage.js
```

**Expected:** Build completes (legacy errors OK, new files must compile)

---

### 3. Firebase Emulator Testing ✅

#### Start Emulator
- [ ] Firebase Emulator starts without errors
- [ ] All 18 functions loaded successfully
- [ ] No function initialization errors

**Test:**
```bash
firebase emulators:start --only functions,firestore
```

**Expected output:**
```
✔  functions[us-central1-createApiKey]: http function initialized
✔  functions[us-central1-debugRollup]: http function initialized
... (18 total)
```

**Check running emulators:**
```bash
# In another terminal
curl http://127.0.0.1:5001
# Should return Firebase Functions Emulator info
```

---

### 4. Developer Portal UI ✅

#### Billing Page
- [ ] `/developers/billing` page loads without errors
- [ ] Plan information displays (Free/Pro/Enterprise)
- [ ] Usage progress bar renders
- [ ] "Open Billing Portal" button present

**Test:**
```bash
# Start Next.js dev server (in new terminal)
npm run dev -- -p 3000

# Visit in browser:
# http://localhost:3000/developers/billing
```

**Expected:** Page loads, shows fallback data (plan: 'free', quota: 10000)

---

### 5. Admin Dashboard UI ✅

#### Admin Ops Page
- [ ] `/admin/ops` page loads without errors
- [ ] 5 scheduler buttons render
- [ ] "Refresh Status" button works
- [ ] Last Runs section displays

**Test:**
```bash
# Visit in browser:
# http://localhost:3000/admin/ops
```

**Expected:** Dashboard loads, buttons clickable (may show empty status initially)

---

### 6. API Routes Functionality ✅

#### Test API Key Creation
```bash
curl -X POST http://localhost:3000/api/devportal/keys \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Key","scopes":["read","write"]}'
```

**Expected response:**
```json
{
  "id": "...",
  "apiKey": "f0_...",
  "name": "Test Key",
  "scopes": ["read", "write"]
}
```

#### Test Billing Portal
```bash
curl -X POST http://localhost:3000/api/billing/portal
```

**Expected response:**
```json
{
  "url": "https://billing.stripe.com/session/..."
}
```

#### Test Subscription API
```bash
curl http://localhost:3000/api/devportal/subscription
```

**Expected response:**
```json
{
  "plan": "free",
  "status": "active",
  "limits": {
    "monthlyQuota": 10000,
    "ratePerMin": 60
  }
}
```

---

### 7. Gate Enforcement ✅

#### Test with Demo User
```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H 'Content-Type: application/json' \
  -d '{"uid":"demo","type":"test.event"}'
```

**Expected:** 200/201 response (gate allows demo user by default)

#### Test Quota Exceeded (requires Firestore setup)
1. Create test user in Firestore:
   ```javascript
   // Firestore Emulator UI: http://localhost:4000/firestore
   // Create document: users/test_blocked/subscription
   {
     plan: 'free',
     status: 'active',
     limits: { monthlyQuota: 100, ratePerMin: 60 }
   }

   // Create document: usage_logs/test_blocked/monthly/2025-10
   {
     total: 150  // Exceeds quota
   }
   ```

2. Test blocked request:
   ```bash
   curl -X POST http://localhost:3000/api/v1/events \
     -H 'Content-Type: application/json' \
     -d '{"uid":"test_blocked","type":"test.event"}'
   ```

**Expected:** 429 response with `"code": "quota_exceeded"`

---

### 8. Admin Scheduler Triggers ✅

#### Test Manual Rollup
1. Visit: http://localhost:3000/admin/ops
2. Click "Run Rollup (Daily→Monthly)"
3. Check response in browser console

**Expected:**
```json
{
  "ok": true,
  "counters": {
    "users": 0,  // Will be 0 if no test users created
    "total": 0,
    "cost": 0
  }
}
```

#### Test Status Fetch
1. Click "Refresh Status"
2. Check "Last Runs" section updates

**Expected:** Shows timestamp of rollup execution

---

### 9. Firestore Indexes ✅

- [ ] `firestore.indexes.json` exists
- [ ] Contains indexes for:
  - `api_keys` (uid, active, createdAt)
  - `monthly` collection group
  - `daily` collection group
  - `webhook_queue`
  - `billing_events`

**Verify:**
```bash
cat firestore.indexes.json | grep -E "api_keys|monthly|daily|webhook_queue|billing_events"
```

**Expected:** 5+ indexes defined

---

### 10. Stripe Test Mode ✅

- [ ] Using Stripe test keys (sk_test_...)
- [ ] Stripe webhook secret is test mode (whsec_...)
- [ ] Test credit card works: `4242 4242 4242 4242`

**Verify Stripe Dashboard:**
1. Visit: https://dashboard.stripe.com/test/dashboard
2. Check API keys match `.env` values
3. Verify no live mode keys in environment files

**⚠️ Critical:** Never commit Stripe keys to git!

---

## 🔧 Pre-Deployment Configuration Review

### Files to Review Before Deploy

#### 1. `.env.local` (Next.js)
```bash
# Development
USE_FUNCTIONS_EMULATOR=true
FUNCTIONS_EMULATOR_ORIGIN=http://127.0.0.1:5001
PORTAL_RETURN_URL=http://localhost:3000/developers
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000

# ⚠️ Change for production:
# USE_FUNCTIONS_EMULATOR=false
# FUNCTIONS_EMULATOR_ORIGIN=
# PORTAL_RETURN_URL=https://cashoutswap.app/developers
# NEXT_PUBLIC_API_BASE_URL=https://cashoutswap.app
```

#### 2. `functions/.env`
```bash
# Verify all secrets present
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORTAL_RETURN_URL=http://localhost:3000/developers
API_KEY_HASH_SECRET=<32+ char random>
ADMIN_DASH_TOKEN=<32+ char random>
```

#### 3. `firebase.json`
```json
{
  "functions": [{
    "source": "functions",
    "codebase": "default",
    "predeploy": []  // Empty for now (avoids legacy build errors)
  }]
}
```

#### 4. `functions/package.json`
```json
{
  "main": "lib/index-new.js"  // Points to clean exports
}
```

---

## 🧪 End-to-End Test Scenarios

### Scenario 1: New User Journey

1. **Create API Key**
   ```bash
   curl -X POST http://localhost:3000/api/devportal/keys \
     -H 'Content-Type: application/json' \
     -d '{"name":"My First Key","scopes":["read"]}'
   ```

2. **Make API Request**
   ```bash
   curl -X POST http://localhost:3000/api/v1/events \
     -H 'Content-Type: application/json' \
     -d '{"uid":"new_user","type":"welcome"}'
   ```

3. **Check Usage**
   ```bash
   curl http://localhost:3000/api/devportal/usage-month
   ```

**Expected:** Usage increments (if tracking implemented)

---

### Scenario 2: Quota Warning Flow

1. **Create user at 85% quota** (via Firestore Emulator)
2. **Trigger quota warning:**
   - Visit: http://localhost:3000/admin/ops
   - Click "Send Quota Warnings"
3. **Check `billing_events` collection** in Firestore

**Expected:** New event with type: 'quota_warn'

---

### Scenario 3: Overage Billing

1. **Create Pro user with overage enabled**
   ```javascript
   // Firestore: users/pro_user/subscription
   {
     plan: 'pro',
     status: 'active',
     limits: {
       monthlyQuota: 1000,
       overage: { enabled: true, pricePer1k: 5 }
     },
     stripe: {
       overagePriceItemId: 'si_test_...'
     }
   }
   ```

2. **Add usage exceeding quota**
   ```javascript
   // Firestore: usage_logs/pro_user/monthly/2025-10
   {
     total: 1200
   }
   ```

3. **Trigger overage push:**
   - Visit: http://localhost:3000/admin/ops
   - Click "Push Usage to Stripe"

**Expected:** Stripe API called (check logs), usage recorded

---

## 🔍 Common Issues & Fixes

### Issue 1: "Module not found: @/lib/functionsClient"

**Cause:** TypeScript paths not configured

**Fix:**
```bash
# Restart Next.js dev server
pkill -f "next dev"
npm run dev -- -p 3000
```

---

### Issue 2: Functions not loading in emulator

**Cause:** Build errors or missing exports

**Fix:**
```bash
cd functions
npm run build 2>&1 | grep -E "(src/(debugSchedulers|limits|overage))"

# If errors found in new files, fix them
# If only legacy errors, safe to proceed
```

---

### Issue 3: Admin dashboard shows "Permission Denied"

**Cause:** `ADMIN_DASH_TOKEN` mismatch

**Fix:**
```bash
# Verify tokens match
grep ADMIN_DASH_TOKEN .env.local
grep ADMIN_DASH_TOKEN functions/.env

# Should be identical
```

---

### Issue 4: Firestore access denied in emulator

**Cause:** Firestore rules too restrictive

**Fix:**
```javascript
// firestore.rules (for emulator testing only)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // Wide open for local testing
    }
  }
}
```

**⚠️ NEVER deploy this to production!**

---

## ✅ Final Validation

Run all checks:
```bash
# 1. Validate environment
npx ts-node scripts/validate-preblaze.ts

# 2. Build functions
cd functions && npm run build

# 3. Start emulator
firebase emulators:start --only functions,firestore

# 4. Start Next.js (in new terminal)
npm run dev -- -p 3000

# 5. Run smoke tests
./scripts/smoke-local.sh  # Create this script (similar to smoke-prod.sh)
```

**All green?** ✅ Ready for Blaze Plan upgrade!

---

## 🚀 Ready for Blaze?

### Pre-Upgrade Checklist Summary

- [ ] ✅ All 18 functions compile
- [ ] ✅ Emulator runs without errors
- [ ] ✅ Both UIs load (billing + admin)
- [ ] ✅ API routes respond correctly
- [ ] ✅ Gate enforcement works
- [ ] ✅ Admin triggers functional
- [ ] ✅ Firestore indexes configured
- [ ] ✅ Stripe test mode verified
- [ ] ✅ Environment variables correct
- [ ] ✅ End-to-end scenarios pass

**Score: __/10**

**Minimum to proceed:** 8/10 ✅

---

## 📚 Next Steps

**After Blaze Upgrade:**
1. Update production environment variables
2. Deploy all 18 functions
3. Configure Stripe webhook
4. Deploy Firestore indexes
5. Run production smoke tests
6. Monitor for 24 hours

**Documentation:**
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Full deployment process
- [QUICK_START.md](./QUICK_START.md) - Fast track (15 mins)
- [MONITORING_SETUP.md](./MONITORING_SETUP.md) - Alerts & dashboards

---

**Ready to upgrade? Visit:** https://console.firebase.google.com/project/cashout-swap/usage/details
