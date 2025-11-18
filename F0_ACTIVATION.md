# 🚀 F0 Production Mode - Activation Guide

**Version:** 20.0.0
**Status:** Ready for Activation
**Mode:** Canary Start (10% AI Eval) → Full Rollout

---

## 📋 Quick Activation Checklist

### ✅ Prerequisites (from GO_LIVE_SPRINT_19.md)
- [ ] Sprint 19 deployed successfully (all 3 phases)
- [ ] Stripe switched to Live mode
- [ ] Webhook events configured (`checkout.session.completed`, `payment_intent.succeeded`)
- [ ] Composite index created for bundles
- [ ] FX rates syncing hourly
- [ ] All 10 smoke tests passed

---

## 🔧 Step-by-Step Activation

### Step 1: Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```
**What it does:** Adds read access for `config/feature_flags` and `config/app`

### Step 2: Initialize Feature Flags & App Config
```bash
cd functions && npm install
node ../scripts/init-feature-flags.js
```

**Expected Output:**
```
🚀 Initializing Feature Flags & App Config...

📋 Feature Flags:
{
  "invoices": { "enabled": true },
  "taxes": { "enabled": true },
  "fx": { "enabled": true },
  "region_pricing": { "enabled": true },
  "pricing_overrides": { "enabled": true },
  "bundles": { "enabled": true },
  "marketplace": { "enabled": true },
  "connect": { "enabled": true, "platform_fee_pct": 15 },
  "coupons": { "enabled": true },
  "reviews": { "enabled": true, "spam_guard": true, "img_mod_required": false },
  "search": { "algolia": true, "fallback": true },
  "ai_eval": { "enabled": true, "sampleRate": 0.10 },  // ← Canary 10%
  "hitl": { "enabled": true },
  "policies": { "enabled": true },
  "alerts": { "slack": true },
  "analytics": { "advanced": true, "funnels": true },
  "statements": { "customer": true, "creator": true },
  "payouts": { "enabled": true },
  "accounting": { "enabled": true }
}
✅ config/feature_flags created

⚙️  App Config:
{
  "mode": "F0",
  "allowSignup": true,
  "showMarketplace": true,
  "defaultCurrency": "USD"
}
✅ config/app created

🟢 Status: F0 Activated (Canary Mode)
```

### Step 3: Deploy Admin UI
```bash
cd .. # Back to project root
npm run build && firebase deploy --only hosting
```

### Step 4: Verify in Firebase Console
1. Open Firebase Console → Firestore Database
2. Navigate to `config` collection
3. Verify documents exist:
   - ✅ `feature_flags` - All flags present
   - ✅ `app` - Mode = "F0"

### Step 5: Access Admin UI
1. Login as admin user
2. Navigate to:
   - **Feature Flags:** `/admin/config/feature-flags`
   - **App Config:** `/admin/config/app`
3. Verify all toggles are functional

---

## 📊 Canary Rollout Schedule

### Day 1-2: Initial Canary (10%)
- **AI Eval Sample Rate:** 0.10 (10% of traffic)
- **Image Moderation:** `img_mod_required = false` (auto-approve)
- **Monitor:**
  - Auto-invoice success rate > 99%
  - FX rates updating hourly
  - Bundle purchases issuing licenses
  - No security rule violations

**Cloud Logging Filters:**
```
# Auto-invoice errors
resource.type="cloud_function" text:"autoInvoiceOnOrderPaid" severity>=ERROR

# AI eval errors
resource.type="cloud_function" text:"ai_eval" severity>=ERROR
```

### Day 3-5: Expand to 50%
**If metrics are stable:**
1. Open `/admin/config/feature-flags`
2. Update `ai_eval.sampleRate` to `0.5`
3. Click "Save Changes"
4. Continue monitoring

### Day 6+: Full Rollout (100%)
**If no issues detected:**
1. Update `ai_eval.sampleRate` to `1.0`
2. (Optional) Enable `reviews.img_mod_required = true` if needed
3. Monitor for 24 hours

---

## 🧯 Emergency Kill-Switches

### Disable Auto-Invoice
```typescript
// Via Admin UI: /admin/config/feature-flags
invoices.enabled = false
```
**Effect:** Stops automatic invoice generation on order paid

### Disable Region Pricing
```typescript
region_pricing.enabled = false
```
**Effect:** Falls back to FX conversion + pricing overrides only

### Disable Stripe Tax
```typescript
taxes.enabled = false
```
**Effect:** Checkout without automatic tax calculation

### Disable Bundles
```typescript
bundles.enabled = false
```
**Effect:** Hides bundles from marketplace, disables bundle checkout

---

## 📈 Success Metrics

### Week 1 Targets
- [ ] Auto-invoice success rate > 99%
- [ ] FX rates updating every hour
- [ ] Bundle purchases issuing correct number of licenses
- [ ] No Firestore security violations
- [ ] Invoice PDF generation < 3 seconds average
- [ ] Stripe webhook delivery > 99%
- [ ] Region currency detection working
- [ ] Feature flag changes apply instantly (no redeploy)
- [ ] AI eval canary rollout completes smoothly

### Month 1 Targets
- [ ] Customer statements generating monthly
- [ ] Tax reports accurate vs. Stripe Dashboard
- [ ] Region pricing rules working correctly
- [ ] Zero HMAC signature mismatches
- [ ] Zero invoice numbering gaps

---

## 🔍 Monitoring Commands

### Check Feature Flags
```bash
# Via Firebase CLI
firebase firestore:get config/feature_flags
```

### Check App Config
```bash
firebase firestore:get config/app
```

### Monitor Auto-Invoice Trigger
```bash
# Cloud Logging
gcloud logging read "resource.type=cloud_function AND textPayload:autoInvoiceOnOrderPaid" --limit 50 --format json
```

### Check FX Rates Freshness
```bash
firebase firestore:get fx_rates/latest
# Look for updatedAt timestamp (should be < 1 hour old)
```

---

## 🎯 Post-Activation Tasks

### Immediate (Day 1)
- [ ] Verify all flags toggleable in admin UI
- [ ] Test one flag change (e.g., toggle `coupons.enabled` on/off)
- [ ] Check audit trail (`updatedAt`, `updatedBy`)
- [ ] Monitor Cloud Logging for first 4 hours

### Week 1
- [ ] Daily review of error rates
- [ ] Gradually increase AI eval sample rate (10% → 50% → 100%)
- [ ] Verify invoice sequence integrity
- [ ] Test emergency kill-switch procedure (in staging)

### Month 1
- [ ] Review all success metrics
- [ ] Document any issues encountered
- [ ] Adjust flags based on usage patterns
- [ ] Plan next sprint features

---

## 📞 Support & Troubleshooting

### Feature Flags Not Loading
**Problem:** Admin UI shows "Loading feature flags..." indefinitely
**Fix:**
1. Check Firestore rules deployed: `firebase deploy --only firestore:rules`
2. Verify `config/feature_flags` document exists
3. Check browser console for API errors
4. Verify admin session valid (re-login)

### Flag Changes Not Applied
**Problem:** Toggle flag in UI but no effect
**Fix:**
1. Check "Save Changes" button clicked
2. Verify success message appears
3. Refresh page and verify flag state persisted
4. Check client-side code respects flag
5. Clear browser cache/localStorage

### Script Initialization Fails
**Problem:** `init-feature-flags.js` throws error
**Fix:**
1. Ensure Firebase Admin SDK initialized: `firebase login`
2. Check project ID: `firebase use --add`
3. Verify service account permissions
4. Run with debug: `NODE_ENV=development node scripts/init-feature-flags.js`

---

## 🟢 Final Approval

**Pre-Activation Checklist:**
- ✅ GO_LIVE_SPRINT_19.md playbook completed
- ✅ All Sprint 19 smoke tests passed
- ✅ Firestore rules deployed
- ✅ Feature flags initialized
- ✅ Admin UI accessible
- ✅ Monitoring dashboards configured

**Decision:** ACTIVATE F0 (Canary Mode)

---

**Activation Date:** _____________________
**Activated By:** _____________________
**Initial Sample Rate:** 0.10 (10%)
**Full Rollout Target:** Day 6+

🚀 **F0 Production Mode Active**
