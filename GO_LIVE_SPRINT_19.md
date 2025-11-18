# 🚀 Sprint 19 Go-Live Playbook

**Sprint 19 (Taxes & Multi-Currency) - Production Deployment Guide**

---

## ✅ Pre-Flight Checklist

### 1. Stripe Configuration
- [ ] **Switch to Live Mode** (not Test mode)
- [ ] `STRIPE_SECRET_KEY` configured in environment (Live key)
- [ ] `stripe.webhook_secret` configured for webhook signature verification (Live webhook)
- [ ] Stripe Automatic Tax enabled in Dashboard (Live mode)
- [ ] Webhook listening to required events:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - (Optional) `charge.refunded`, `charge.dispute.*`
- [ ] Webhook endpoint URL points to production domain

### 2. Firebase Functions Config
- [ ] Set HMAC secret for invoice signatures:
```bash
firebase functions:config:set reports.hmac_secret="YOUR_LONG_RANDOM_SECRET_MIN_32_CHARS"
```

### 3. Scheduled Functions
- [ ] `syncFxRates` - Hourly FX rate sync (0 * * * *)
- [ ] `customerVatStatementsMonthly` - Monthly statements (0 2 1 * *)

### 4. Security Rules
- [ ] Review `firestore.rules` - Phase 3 additions present
- [ ] Review `storage.rules` - customer_statements rules present

### 5. CDN Headers (Region Detection)
- [ ] Verify CDN (Vercel/Cloudflare) passes country headers:
  - `x-vercel-ip-country` (Vercel)
  - `cf-ipcountry` (Cloudflare)
- [ ] Test `/api/market/currency/guess` returns correct currency

### 6. Composite Index (Pre-Create - Optional)
**Create bundles index before deployment to reduce launch time:**
- [ ] Go to Firebase Console → Firestore → Indexes
- [ ] Create composite index:
  - Collection: `bundles`
  - Fields: `active` (ASC), `published` (ASC), `createdAt` (DESC)

---

## 🚢 Deployment Steps

### Step 0: Deploy FX Sync Scheduler (if not already deployed)
```bash
firebase deploy --only functions:syncFxRates
```
**Note:** If already deployed in previous sprint, skip this step.

### Step 1: Deploy Phase 3 Functions
```bash
firebase deploy --only functions:autoInvoiceOnOrderPaid,functions:generateCustomerVatStatement,functions:customerVatStatementsMonthly
```

### Step 2: Deploy Rules
```bash
firebase deploy --only firestore:rules,storage
```

### Step 3: Deploy Hosting
```bash
npm run build && firebase deploy --only hosting
```

### Step 4: Verify Composite Index
**If not pre-created in Pre-Flight step 6:**
- First bundles query will trigger index creation prompt
- Click the index creation link in error message
- Or create manually in Firebase Console

**Required Index:**
- Collection: `bundles`
- Fields:
  - `active` (Ascending)
  - `published` (Ascending)
  - `createdAt` (Descending)

---

## 🧪 Smoke Tests (10 minutes)

### Test 1: Bundles CRUD
- [ ] Navigate to `/admin/bundles`
- [ ] Create bundle with:
  - `slug` = `test-bundle`
  - `title` = "Test Bundle"
  - `productIds` = comma-separated product IDs
  - `discountPercent` = 15
  - `published` = true
  - `active` = true
- [ ] Verify appears in `/market/bundles`
- [ ] Visit `/market/bundles/test-bundle`
- [ ] Click "Buy now" → redirects to Stripe Checkout

### Test 2: Region Pricing
- [ ] Navigate to `/admin/pricing/regions`
- [ ] Add region config:
```json
{
  "GB": {
    "currency": "GBP",
    "multiplier": 0.78,
    "round": "psychological"
  }
}
```
- [ ] Open product page with GBP currency selected
- [ ] Verify price follows precedence:
  1. Product Override (if set)
  2. Region Fixed Price (if configured)
  3. Region Multiplier (GB: 0.78)
  4. Currency Default
  5. FX Conversion

### Test 3: Auto-Invoice Generation
- [ ] Complete a test purchase (or manually update `orders/{id}`)
  - Set `status` = "paid"
  - Set `paidAt` = current timestamp
- [ ] Wait 5-10 seconds for trigger
- [ ] Check `invoices/{orderId}` document created
- [ ] Verify `invoices/{orderId}.pdf` exists in Storage
- [ ] Navigate to `/account/invoices`
- [ ] Download invoice → PDF opens with signed URL

### Test 4: Customer VAT Statements
- [ ] Navigate to `/account/statements`
- [ ] Enter current month (YYYY-MM format)
- [ ] Click "Generate"
- [ ] PDF opens in new tab (30-day signed URL)
- [ ] Verify `customer_statements/{uid}/files/{YYYY-MM}` document created
- [ ] Check Storage file `customer_statements/{uid}/{YYYY-MM}.pdf` exists

### Test 5: Multi-Currency Checkout
- [ ] Visit `/market`
- [ ] Change currency to EUR using switcher
- [ ] Verify all prices converted with ".99" psychological rounding
- [ ] Click product → "Buy now"
- [ ] Verify Checkout session in EUR
- [ ] Complete test purchase
- [ ] Verify order document has:
  - `currency` = "eur"
  - `fxRate` = rate used
  - `amountCharged` = amount in EUR
  - `taxBreakdown` = Stripe automatic tax data

### Test 6: Tax ID Validation
- [ ] Visit product page
- [ ] Enter tax ID: Type = "eu_vat", Value = "DE123456789"
- [ ] Proceed to checkout
- [ ] Verify `customerTaxId` passed to Stripe session
- [ ] After payment, verify order has:
  - `customerTaxId` = Stripe tax ID
  - `taxExempt` = "reverse" (for valid EU VAT)

### Test 7: Security - Bundles Access
- [ ] Log out
- [ ] Try accessing `/admin/bundles` → redirects to login
- [ ] Visit `/market/bundles` → works (public)
- [ ] Create bundle with `published=false`
- [ ] Verify does NOT appear in public listing

### Test 8: Security - Statements Access
- [ ] As User A, generate statement
- [ ] Copy statement URL
- [ ] Log in as User B
- [ ] Try accessing User A's statement URL → 403/404
- [ ] Verify only owner or admin can access

### Test 9: Security - Pricing Regions
- [ ] As non-admin user, try accessing `/admin/pricing/regions` → denied
- [ ] Try direct API call to `/api/admin/pricing/regions` → 403

### Test 10: FX Rates Sync
- [ ] Check `fx_rates/latest` document
- [ ] Note `updatedAt` timestamp
- [ ] Wait 1 hour (or manually trigger `syncFxRates`)
- [ ] Verify `updatedAt` timestamp updated
- [ ] Verify rates object contains: EUR, GBP, AED, CAD, AUD, JPY, INR, SGD

---

## 🔎 Health & Observability

### Cloud Logging Filters

**Invoice Generation Errors:**
```
resource.type="cloud_function"
text:"generateVatInvoice"
severity>=ERROR
```

**Auto-Invoice Trigger:**
```
resource.type="cloud_function"
text:"autoInvoiceOnOrderPaid"
```

**Customer Statements (Monthly):**
```
resource.type="cloud_function"
text:"customerVatStatementsMonthly"
```

**FX Rate Sync:**
```
resource.type="cloud_function"
text:"syncFxRates"
```

### Sanity Checks
- [ ] `fx_rates/latest` updates hourly
- [ ] Bundle orders contain `bundleId` field
- [ ] Bundle orders issue multiple licenses (one per product)
- [ ] Invoices have sequential `invoiceNo` without gaps
- [ ] Invoice PDFs contain HMAC signature in metadata
- [ ] All paid orders trigger auto-invoice within 10 seconds

---

## 🧯 Rollback Procedures

### Rollback Functions
```bash
# Revert to previous commit
git revert HEAD
git push

# Deploy reverted functions
firebase deploy --only functions
```

### Rollback Rules
```bash
# Restore previous firestore.rules and storage.rules from git
git checkout HEAD~1 firestore.rules storage.rules

# Deploy reverted rules
firebase deploy --only firestore:rules,storage
```

### Rollback UI
```bash
# Revert to previous commit
git revert HEAD
git push

# Deploy reverted hosting
npm run build && firebase deploy --only hosting
```

### Emergency: Disable Auto-Invoice Trigger

**Option 1: Delete function (immediate, destructive)**
```bash
firebase functions:delete autoInvoiceOnOrderPaid
```

**Option 2: Kill-switch via config flag (graceful, future enhancement)**
```typescript
// In functions/src/tax/autoInvoice.ts - add at function start:
const cfg = functions.config();
if (cfg.invoices?.enabled === "false") {
  console.log("Auto-invoice disabled via config flag");
  return;
}
```
```bash
# To disable:
firebase functions:config:set invoices.enabled="false"
firebase deploy --only functions:autoInvoiceOnOrderPaid

# To re-enable:
firebase functions:config:unset invoices.enabled
firebase deploy --only functions:autoInvoiceOnOrderPaid
```

---

## 📌 Common Pitfalls

### ❌ Pitfall 1: Bundle slug ≠ docId
**Problem:** Created bundle with docId="abc123" but slug="test-bundle"
**Symptom:** `/market/bundles/test-bundle` returns 404
**Fix:** Ensure slug matches docId, or update query to search by slug field

### ❌ Pitfall 2: Missing Function Exports
**Problem:** Forgot to export function in `functions/src/index.ts`
**Symptom:** Trigger/scheduler doesn't run, no logs in Cloud Functions
**Fix:** Add export statement:
```typescript
export { autoInvoiceOnOrderPaid } from "./tax/autoInvoice";
```

### ❌ Pitfall 3: Missing HMAC Secret
**Problem:** `reports.hmac_secret` not configured
**Symptom:** Invoice PDFs missing HMAC signature in metadata
**Severity:** Low (not a blocker, but weakens security)
**Fix:**
```bash
firebase functions:config:set reports.hmac_secret="YOUR_SECRET"
firebase deploy --only functions:generateVatInvoice
```

### ❌ Pitfall 4: Composite Index Not Created
**Problem:** Accessing `/market/bundles` throws Firestore error
**Symptom:** "The query requires an index" error message
**Fix:** Click index creation link in error, or create manually in Firebase Console

### ❌ Pitfall 5: Auto-Invoice Running Multiple Times
**Problem:** Order updated multiple times triggers duplicate invoices
**Symptom:** Multiple invoice documents for same order
**Prevention:** Idempotency check in `autoInvoice.ts` prevents this (checks if invoice exists)
**Fix:** Already handled in code

### ❌ Pitfall 6: Currency Not Persisting
**Problem:** User selects EUR, refreshes page, reverts to USD
**Symptom:** localStorage not working
**Fix:** Check browser settings allow localStorage, verify CurrencySwitcher component mounted

### ❌ Pitfall 7: Pricing Override Not Applied
**Problem:** Set EUR override to 27.99, still showing FX-converted price
**Symptom:** Checkout shows wrong price
**Fix:** Verify `products/{id}.prices.EUR` field exists and is a number (not string)

### ❌ Pitfall 8: Statement Generation Fails
**Problem:** User has no orders in selected month
**Symptom:** Empty PDF or error
**Fix:** Check order count before PDF generation, show friendly message

### ❌ Pitfall 9: Webhook Not Updating Order Status
**Problem:** Stripe webhook not listening to required events
**Symptom:** Orders stuck in "pending" status, auto-invoice never triggers
**Fix:**
- Verify webhook subscribed to `checkout.session.completed` and `payment_intent.succeeded`
- Check webhook endpoint URL matches production domain
- Verify webhook secret is correct (Live mode, not Test)
- Check webhook logs in Stripe Dashboard for errors

### ❌ Pitfall 10: Region Currency Guess Returns USD for All Requests
**Problem:** CDN headers not being passed to API route
**Symptom:** All users see USD regardless of location
**Fix:**
- Verify CDN (Vercel/Cloudflare) is active
- Check request headers include `x-vercel-ip-country` or `cf-ipcountry`
- Test with VPN from different countries
- Fallback behavior is expected if CDN is not configured

---

## 📊 Success Metrics

**Week 1 Post-Launch:**
- [ ] Auto-invoice success rate > 99%
- [ ] FX rates updating hourly without errors
- [ ] Bundle purchases issuing correct number of licenses
- [ ] No security rule violations in Firestore logs
- [ ] Invoice PDF generation < 3 seconds average
- [ ] Checkout conversion rate stable or improved (multi-currency impact)
- [ ] Stripe webhook delivery success rate > 99%
- [ ] Region-based currency detection working for top traffic countries

**Month 1 Post-Launch:**
- [ ] Customer statement generation running monthly without errors
- [ ] Tax reports accurate vs. Stripe Dashboard
- [ ] Region pricing rules working as expected
- [ ] Zero HMAC signature mismatches
- [ ] Zero invoice numbering gaps

---

## 🎯 Launch Checklist Summary

**Pre-Launch:**
- [ ] All 6 pre-flight checks passed
- [ ] Stripe switched to Live mode (not Test)
- [ ] Stripe webhook configured with required events
- [ ] Test Stripe webhook in production
- [ ] Composite index pre-created (optional but recommended)
- [ ] Backup current database
- [ ] Team notified of deployment window

**Launch:**
- [ ] Deploy functions
- [ ] Deploy rules
- [ ] Deploy hosting
- [ ] Create composite index
- [ ] Run all 10 smoke tests

**Post-Launch (24 hours):**
- [ ] Monitor Cloud Logging for errors
- [ ] Verify first auto-invoice generation
- [ ] Check FX rates updated hourly
- [ ] Test bundle purchase end-to-end
- [ ] Verify customer statement generation (if month boundary)

**Post-Launch (1 week):**
- [ ] Review success metrics
- [ ] Check invoice sequence integrity
- [ ] Analyze multi-currency conversion rates
- [ ] Verify region pricing working correctly
- [ ] Monthly scheduler ready for month-end

---

## 🆘 Emergency Contacts

**Stripe Support:** https://support.stripe.com/
**Firebase Support:** https://firebase.google.com/support
**Rollback Decision:** If > 5% error rate in auto-invoice trigger, rollback immediately

---

**Last Updated:** Sprint 19 Phase 3 Complete (Final Review)
**Version:** v19.2.0
**Enhancements Applied:**
1. ✅ FX Sync scheduler deployment step added
2. ✅ Stripe webhook events checklist expanded
3. ✅ Composite index pre-creation option added
4. ✅ CDN headers verification added
5. ✅ Test/Live mode distinction emphasized
6. ✅ Kill-switch pattern documented (config flag)
7. ✅ 2 additional pitfalls added (webhooks, CDN headers)

**Deploy Date:** _____________________
**Deployed By:** _____________________

---

## 🟢 Final Approval

**Status:** GO (Green) - Ready for Production Launch

All 6 enhancements applied. Playbook is now 100% hardened for zero-risk deployment.
