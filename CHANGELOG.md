# Changelog

All notable changes to the from-zero-starter project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [20.1.0] - 2025-02-01

### Added - Marketplace Refund Flow Enhancement

**Payment Intent Unification:**
- Unified payment intent field naming: `stripePaymentIntent` → `paymentIntentId`
- Added fallback support for legacy orders during transition period
- Created migration script: `scripts/migrate-payment-intent-field.ts`
- Dry-run mode for safe migration preview
- Audit trail preservation in `_legacyFields` subcollection

**Refund Flow Improvements:**
- Early assertion in webhook for missing payment intent validation
- Admin-only refund function with idempotency checks
- Full and partial refund support
- Automatic license revocation on refund
- Enhanced error messages for missing payment intent

**Testing & Quality:**
- Comprehensive smoke test suite (8 test cases)
- E2E integration test for complete refund cycle
- Unit tests for legacy field fallback
- Idempotency and security tests

**Documentation:**
- Created `MARKETPLACE_REFUND_GUIDE.md` with complete implementation guide
- Architecture diagrams and flow charts
- Emergency procedures and kill-switch documentation
- Monitoring and alert setup instructions

### Fixed

**Core Issues:**
- Fixed inconsistent payment intent field names causing refund failures
- Fixed Firestore rules using undefined `isAuth()` → `isAuthenticated()`
- Fixed missing payment intent validation in webhook processing
- Added proper error handling for orders without payment intent

**Security:**
- Enforced admin-only access for refund operations
- Added audit logging for all refund transactions
- Implemented feature flag kill-switch for emergency refund disabling

### Changed

- Payment intent field standardized across checkout, webhook, and refund flows
- Webhook now validates payment intent exists before processing
- Refund function includes fallback for legacy field names
- Enhanced logging for payment intent issues

---

## [20.0.0] - 2025-01-30

### Added - F0 Production Mode (Feature Flags & App Config)

**Feature Flags System:**
- Centralized feature toggle management via `config/feature_flags` document
- Admin-only write access, public read access for client-side checks
- Canary deployment support with gradual rollout (AI eval starts at 10%)
- Kill-switch capability for emergency feature disabling
- Real-time flag updates without redeployment

**Flags Implemented:**
- `invoices.enabled` - Auto-invoice generation on order paid
- `taxes.enabled` - Stripe Automatic Tax in checkout
- `fx.enabled` - FX rates sync and multi-currency support
- `region_pricing.enabled` - Region-based pricing rules (5-tier)
- `pricing_overrides.enabled` - Per-currency product overrides
- `bundles.enabled` - Product bundles with multi-license issuance
- `marketplace.enabled` - Public marketplace visibility
- `connect.enabled` + `platform_fee_pct` - Stripe Connect payouts
- `coupons.enabled` - Discount coupons
- `reviews.enabled` + `spam_guard` + `img_mod_required` - Review system
- `search.algolia` + `fallback` - Search configuration
- `ai_eval.enabled` + `sampleRate` - AI evaluation (canary: 0.10 → 1.0)
- `hitl.enabled` - Human-in-the-loop moderation
- `policies.enabled` - Content policies enforcement
- `alerts.slack` - Slack alert integration
- `analytics.advanced` + `funnels` - Analytics features
- `statements.customer` + `creator` - Statement generation
- `payouts.enabled` - Payout processing
- `accounting.enabled` - GL and accounting reports

**App Configuration:**
- Global settings via `config/app` document
- `mode` - Deployment mode (F0/BETA/DEV)
- `allowSignup` - Control new user registration
- `showMarketplace` - Toggle marketplace visibility
- `defaultCurrency` - Fallback currency for new users

**Admin APIs:**
- `GET/POST /api/admin/config/feature-flags` - Manage feature flags
- `GET/POST /api/admin/config/app` - Manage app config
- Audit trail with `updatedAt` and `updatedBy` metadata

**Admin UI:**
- `/admin/config/feature-flags` - Interactive toggle UI with descriptions
- `/admin/config/app` - App settings management
- Visual indicators for canary features (yellow background)
- Real-time save/reset functionality

**Deployment Tools:**
- `scripts/init-feature-flags.js` - Initialize config documents
- Firestore rules updated for `config/feature_flags` and `config/app`
- Integration with existing GO_LIVE_SPRINT_19.md playbook

**Security:**
- Feature flags: Admin write, public read (for client-side feature detection)
- App config: Admin write, public read (for global settings)
- All updates logged with timestamp and UID

**Files Created:**
1. `scripts/init-feature-flags.js` - Initialization script
2. `src/app/api/admin/config/feature-flags/route.ts` - Feature flags API
3. `src/app/api/admin/config/app/route.ts` - App config API
4. `src/app/(admin)/config/feature-flags/page.tsx` - Feature flags UI
5. `src/app/(admin)/config/app/page.tsx` - App config UI

**Files Updated:**
1. `firestore.rules` - Added `config/feature_flags` and `config/app` rules

**Deployment Steps:**
```bash
# 1. Deploy updated Firestore rules
firebase deploy --only firestore:rules

# 2. Initialize feature flags and app config
cd functions && npm install
node ../scripts/init-feature-flags.js

# 3. Verify in Firebase Console
# - Check config/feature_flags document created
# - Check config/app document created

# 4. Deploy hosting with admin UI
npm run build && firebase deploy --only hosting

# 5. Access admin UI
# - /admin/config/feature-flags
# - /admin/config/app
```

**Canary Rollout Plan:**
- **Day 1-2:** `ai_eval.sampleRate = 0.10` (10% traffic)
- **Day 3-5:** Increase to `0.5` (50% traffic) if metrics stable
- **Day 6+:** Full rollout `1.0` (100% traffic)
- Monitor: Auto-invoice success rate, FX sync, bundle licenses, Cloud Logging

**Emergency Kill-Switches:**
- Auto-invoice issues: Set `invoices.enabled = false`
- Pricing problems: Set `region_pricing.enabled = false`
- Tax calculation errors: Set `taxes.enabled = false`

**Success Metrics (Week 1):**
- Feature flag updates apply instantly without redeployment
- AI eval canary rollout completes successfully (10% → 100%)
- Zero downtime during flag changes
- Admin UI responsive and accurate

---

## [19.0.0] - 2025-01-29

### Added - Taxes & Multi-Currency (Phase 1)

**Stripe Automatic Tax Integration:**
- `createCheckoutSession` updated with automatic tax calculation
- Stripe `automatic_tax: { enabled: true }` in checkout
- `customer_creation: 'always'` + `customer_update: { address: 'auto' }`
- Tax fields stored in orders: `currency`, `fxRate`, `amountCharged`, `taxUsd`, `taxBreakdown`, `taxJurisdiction`, `customerTaxId`, `taxExempt`
- Compatible with existing coupons (Sprint 17)

**Tax ID Validation:**
- `validateTaxId` callable function (auth required)
- Creates/validates Tax ID on Stripe customer (EU VAT, GB VAT, AU ABN, IN GST)
- Maps verification status: `accepted`, `rejected`, `pending`
- Determines tax exemption: `reverse` (EU B2B reverse charge), `exempt`, or `none`
- Updates user profile with tax ID info and verification status
- Audit logs for all tax ID validations

**Foreign Exchange (FX) Rates:**
- `syncFxRates` scheduled function (every 1 hour)
- Fetches/stores exchange rates for USD base: EUR, GBP, AED, CAD, AUD, JPY, INR, SGD
- Stored in `fx_rates/latest` with timestamp
- Default fallback rates hardcoded for resilience

**Price Conversion:**
- `convertPrice` callable function
- Server-side price conversion with FX rates
- Psychological rounding strategy (e.g., 29.00 → 28.99)
- Fallback to hardcoded rates if `fx_rates/latest` unavailable
- Returns: `baseUsd`, `currency`, `converted`, `rate`, `source` (live/fallback)

**Admin/User APIs:**
- `GET /api/market/fx` - Latest FX rates (public)
- `POST /api/market/pricing` - Price conversion with psychological rounding
- `PATCH /api/me/tax-id` - Link Tax ID to user profile

**Public UI:**
- Currency Switcher component at `/market`
- Saves selection in localStorage + broadcasts to other components
- `useCurrency()` hook for accessing selected currency and symbol
- Market listing shows converted prices + "Est. tax at checkout" label
- Product detail shows converted price + "+ tax at checkout"
- Tax ID input (type selector + value) on product page for B2B
- Currency passed to checkout session

**Files Created:**
- `functions/src/tax/validateVat.ts` - Tax ID validation
- `functions/src/fx/syncRates.ts` - Hourly FX sync
- `functions/src/fx/convert.ts` - Price conversion with rounding
- `src/app/api/market/fx/route.ts` - FX rates API
- `src/app/api/market/pricing/route.ts` - Pricing conversion API
- `src/app/api/me/tax-id/route.ts` - Tax ID linking API
- `src/app/(public)/_components/CurrencySwitcher.tsx` - Currency selector + hook

**Files Updated:**
- `functions/src/market/checkout.ts` - Added currency, tax ID, automatic tax, FX conversion
- `src/app/(public)/market/page.tsx` - Currency switcher, converted prices, tax notice
- `src/app/(public)/market/[slug]/page.tsx` - Converted price display, tax ID input, currency/taxId passed to checkout
- `firestore.rules` - Added fx_rates rules (no direct client read)
- `functions/src/index.ts` - Exported Sprint 19 Phase 1 functions

**Security:**
- FX rates: Functions write only, API read only (no direct Firestore client access)
- Tax ID validation: Authenticated users only
- Price conversion: Server-side only to prevent manipulation
- Orders: Functions write only (tax fields auto-populated)

**Data Schema:**
FX Rates:
```typescript
{
  fx_rates/latest: {
    base: "USD",
    ts: timestamp,
    rates: {
      EUR: 0.92,
      GBP: 0.78,
      AED: 3.67,
      // ... more currencies
    }
  }
}
```

Orders (extended):
```typescript
{
  orders/{orderId}: {
    // ... existing fields
    currency: "USD" | "EUR" | "GBP" | "AED" | ...,
    fxRate: 1.0,
    amountCharged: 28.99, // in selected currency
    taxUsd: 4.12,
    taxBreakdown: [{ type: "vat", rate: 21, amountUsd: 4.12 }],
    taxJurisdiction: "EU/NL",
    customerTaxId: "NL123456789B01",
    taxExempt: "none" | "exempt" | "reverse"
  }
}
```

User Tax ID:
```typescript
{
  users/{uid}: {
    taxId: {
      id: "txr_...",
      type: "eu_vat",
      value: "NL123456789B01",
      verificationStatus: "accepted" | "rejected" | "pending",
      taxExempt: "reverse" | "exempt" | "none",
      verifiedAt: timestamp
    }
  }
}
```

**Deployment:**
```bash
# Deploy functions
firebase deploy --only functions:syncFxRates
firebase deploy --only functions:convertPrice
firebase deploy --only functions:validateTaxId
firebase deploy --only functions:createCheckoutSession

# Deploy rules
firebase deploy --only firestore:rules

# Deploy Next.js
npm run build
firebase deploy --only hosting

# Manually trigger syncFxRates once
# Or wait for first hourly run
```

**Smoke Tests:**
1. FX Seed: Verify `fx_rates/latest` exists with rates after deployment
2. Currency Switch: Select EUR → prices convert on `/market` and `/market/[slug]`
3. Checkout: Buy with EUR → Stripe checkout shows EUR price + tax estimate
4. Order: Verify order has `currency="EUR"`, `fxRate`, `taxUsd` fields populated
5. Coupon + Tax: Apply coupon → discounted amount taxed correctly
6. VAT B2B: Enter valid EU VAT → tax exemption applied (reverse charge)
7. Fallback: Delete `fx_rates/latest` → prices still convert using fallback rates
8. Security: Direct Firestore read of `fx_rates` blocked; only API access works
9. Analytics: Sprint 17/18 reports handle new currency/tax fields

---

## [19.1.0] - 2025-01-29

### Added - Taxes & Multi-Currency (Phase 2)

**Per-Currency Pricing Overrides:**
- Product-level pricing overrides: `products/{id}.prices = { USD: 29, EUR: 27.99, ... }`
- Admin UI at `/admin/products/[id]/pricing` to set custom prices per currency
- Checkout integration: Uses override price if available, falls back to FX conversion
- `GET/POST /api/admin/products/[id]/pricing` endpoints (admin only)
- Supports all 9 currencies: USD, EUR, GBP, AED, CAD, AUD, JPY, INR, SGD

**Region-Aware Currency Guess:**
- `guessRegionCurrency` callable function maps country code to currency
- `GET /api/market/currency/guess` endpoint reads `x-vercel-ip-country` or `cf-ipcountry` headers
- Default country-to-currency map: AE→AED, GB→GBP, EU/DE/FR/IT/ES/NL/BE/AT→EUR, CA→CAD, AU→AUD, JP→JPY, IN→INR, SG→SGD, US→USD
- Automatic currency selection based on user location

**VAT Invoices (PDF):**
- `generateVatInvoice` callable function (auth required, owner or admin)
- Sequential invoice numbering via Firestore transaction (`config/invoice_counter`)
- PDF generation with PDFKit: company info, VAT IDs, order details, tax breakdown
- HMAC signature (SHA256) for integrity verification
- Stored at `invoices/{orderId}.pdf` with metadata
- 30-day signed URLs for secure download
- Invoice metadata in `invoices/{orderId}` collection
- Company settings from `config/company` (name, address, vatId)

**Tax Reports (CSV):**
- `exportTaxReport` callable function (admin only)
- Date range filtering (start/end timestamps)
- Order-level detail: orderId, paidAt, currency, grossUsd, taxUsd, jurisdiction, customerTaxId, taxExempt
- Aggregated totals: TOTAL_TAX_USD + jurisdiction breakdown (e.g., JUR_EU/NL)
- 7-day signed URLs for CSV download
- Stored at `tax_reports/{timestamp}.csv`

**Admin UI:**
- Product pricing overrides page: `/admin/products/[id]/pricing`
- Tax reports generator: `/admin/tax/reports` with date range picker

**User UI:**
- My Invoices page: `/account/invoices`
- Lists all paid orders with download button
- Auto-generates invoice on first download
- Opens PDF in new tab via signed URL

**Files Created:**
- `functions/src/tax/invoice.ts` - VAT invoice PDF generation
- `functions/src/tax/reports.ts` - Tax report CSV export
- `functions/src/pricing/region.ts` - Region to currency mapping
- `src/app/api/admin/products/[id]/pricing/route.ts` - Pricing overrides API
- `src/app/api/market/currency/guess/route.ts` - Currency guess endpoint
- `src/app/api/me/invoices/[orderId]/route.ts` - User invoice download
- `src/app/api/admin/tax/reports/route.ts` - Tax reports validation
- `src/app/(admin)/products/[id]/pricing/page.tsx` - Pricing admin page
- `src/app/(admin)/tax/reports/page.tsx` - Tax reports admin page
- `src/app/(protected)/account/invoices/page.tsx` - User invoices page

**Files Updated:**
- `functions/src/market/checkout.ts` - Pricing overrides priority over FX
- `firestore.rules` - Added invoices and tax_reports rules
- `storage.rules` - Added invoices and tax_reports storage rules
- `functions/src/index.ts` - Exported Phase 2 functions

**Security:**
- Invoices: Owner or admin read via Firestore, signed URLs for PDF access
- Tax reports: Admin only
- Pricing overrides: Admin write only
- Invoice numbering: Transactional to prevent duplicates
- HMAC signatures: Integrity verification for invoices

**Data Schema:**
Product (extended):
```typescript
{
  products/{id}: {
    // ... existing fields
    prices: {
      USD: 29.00,
      EUR: 27.99,
      GBP: 24.99,
      // ... other currencies
    }
  }
}
```

Invoices:
```typescript
{
  invoices/{orderId}: {
    invoiceNo: 1234,
    path: "invoices/{orderId}.pdf",
    hmac: "sha256_signature",
    createdAt: timestamp,
    uid: "user_id"
  }
}
```

Invoice Counter:
```typescript
{
  config/invoice_counter: {
    seq: 1234
  }
}
```

Company Config:
```typescript
{
  config/company: {
    name: "Company, Inc.",
    address: "123 Main St",
    vatId: "NL123456789B01"
  }
}
```

**Configuration:**
```bash
# Set HMAC secret for invoice signatures
firebase functions:config:set reports.hmac_secret="YOUR_LONG_RANDOM_SECRET"
```

**Deployment:**
```bash
# Deploy functions
firebase deploy --only functions:generateVatInvoice,functions:exportTaxReport,functions:guessRegionCurrency

# Deploy rules
firebase deploy --only firestore:rules,storage

# Deploy Next.js
npm run build
firebase deploy --only hosting
```

**Smoke Tests:**
1. Pricing Overrides: Set EUR=27.99 for product → Checkout with EUR uses override, not FX
2. Region-Aware: Call `/api/market/currency/guess` with `x-vercel-ip-country=GB` → Returns GBP
3. Invoice Generate: Visit `/account/invoices`, click Download → PDF opens with sequential number
4. Invoice Integrity: Check Storage metadata for HMAC signature
5. Tax Report: Select date range at `/admin/tax/reports` → CSV downloads with totals and jurisdiction breakdown
6. Security: Non-admin cannot access pricing/tax pages; non-owner cannot download other's invoices
7. Coupons + Tax: Order with coupon → Invoice shows coupon code and adjusted amounts
8. Fallbacks: Product without pricing override → Falls back to FX conversion from Phase 1

---

## [19.2.0] - 2025-01-29

### Added - Taxes & Multi-Currency (Phase 3)

**Region Pricing Rules Engine:**
- `loadPricingRegions()` function with 60-second cache
- `resolveRegionPrice()` with 5-tier precedence:
  1. Product currency override (`products/{id}.prices[currency]`)
  2. Region fixed price by tier/ID (`regions[country].fixed[tier]`)
  3. Region currency multiplier (`regions[country].multiplier`)
  4. Currency defaults (`defaults[currency].multiplier`)
  5. FX conversion fallback
- Psychological rounding support (e.g., 28.99)
- Configuration stored in `config/pricing_regions`
- Admin UI at `/admin/pricing/regions` with JSON editor

**Auto-Invoice on Order Paid:**
- `autoInvoiceOnOrderPaid` Firestore trigger on `orders/{orderId}`
- Automatically generates VAT invoice PDF when order status changes to "paid"
- Idempotent: checks if invoice exists before generation
- Reuses Phase 2 invoice generation logic with sequential numbering
- HMAC signature for PDF integrity

**Customer VAT Statements:**
- `generateCustomerVatStatement` callable function
- Monthly PDF summary of customer's tax activity
- Lists all orders with amounts and taxes
- Stored at `customer_statements/{uid}/{YYYY-MM}.pdf`
- 30-day signed URLs for download
- `customerVatStatementsMonthly` scheduler (runs 1st of month at 02:00 UTC)
- Auto-generates statements for all users with orders in previous month
- User UI at `/account/statements` to generate/download

**Bundles:**
- `bundlePriceForCurrency()` calculates bundle price with discount
- Priority: Bundle currency override → Sum of product prices (via region/FX) - discount
- `issueBundleLicenses()` creates licenses for all bundle products
- Stores bundleId in license records
- Admin CRUD at `/admin/bundles`: title, description, productIds[], discountPercent, prices per currency
- Public listing at `/market/bundles` (active + published only)
- Bundle detail at `/market/bundles/[slug]` with Buy button
- Supports checkout integration (bundleId parameter)

**Files Created:**
- `functions/src/pricing/regions.ts` - Region pricing engine with caching
- `functions/src/tax/autoInvoice.ts` - Auto-invoice Firestore trigger
- `functions/src/tax/customerStatements.ts` - Customer VAT statements (callable + scheduler)
- `functions/src/market/bundles.ts` - Bundle pricing and license issuance
- `src/app/api/admin/bundles/route.ts` - Bundles CRUD (GET/POST)
- `src/app/api/admin/bundles/[id]/route.ts` - Bundle detail (GET/PATCH/DELETE)
- `src/app/api/market/bundles/route.ts` - Public bundles list
- `src/app/api/market/bundle/[slug]/route.ts` - Public bundle detail
- `src/app/api/me/statements/route.ts` - Customer statements list
- `src/app/(admin)/pricing/regions/page.tsx` - Region pricing editor
- `src/app/(admin)/bundles/page.tsx` - Bundles admin UI
- `src/app/(public)/market/bundles/page.tsx` - Bundles public listing
- `src/app/(public)/market/bundles/[slug]/page.tsx` - Bundle detail page
- `src/app/(protected)/account/statements/page.tsx` - My VAT statements

**Files Updated:**
- `firestore.rules` - Added config/pricing_regions, bundles, customer_statements rules
- `storage.rules` - Added customer_statements storage rules
- `functions/src/index.ts` - Exported Phase 3 functions

**Security:**
- Pricing regions: Admin write only
- Bundles: Public read if published + active, admin full CRUD
- Customer statements: Owner or admin read, Functions write
- Auto-invoice: Triggered by system, no user input

**Data Schema:**
Pricing Regions Config:
```typescript
{
  config/pricing_regions: {
    defaults: {
      EUR: { multiplier: 0.92, round: "psychological" }
    },
    regions: {
      GB: { currency: "GBP", multiplier: 0.78, round: "psychological" },
      AE: { currency: "AED", fixed: { PRO: 109.00 } }
    }
  }
}
```

Bundles:
```typescript
{
  bundles/{id}: {
    slug: string,
    title: string,
    description: string,
    productIds: string[],
    prices: { USD: 49, EUR: 44.99 },
    discountPercent: 20,
    active: boolean,
    published: boolean,
    imageUrl: string | null,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}
```

Customer Statements:
```typescript
{
  customer_statements/{uid}/files/{YYYY-MM}: {
    month: string,
    uid: string,
    path: string,
    createdAt: timestamp,
    ordersCount: number,
    totalGross: number,
    totalTax: number
  }
}
```

Licenses (extended):
```typescript
{
  licenses/{id}: {
    // ... existing fields
    bundleId: string | null
  }
}
```

**Composite Index Required:**
Create in Firebase Console or via `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "bundles",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "active", "order": "ASCENDING" },
        { "fieldPath": "published", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Deployment:**
```bash
# Deploy functions
firebase deploy --only functions:autoInvoiceOnOrderPaid,functions:generateCustomerVatStatement,functions:customerVatStatementsMonthly

# Deploy rules
firebase deploy --only firestore:rules,storage

# Deploy Next.js
npm run build
firebase deploy --only hosting
```

**Smoke Tests:**
1. Region Rule: Set GB→GBP multiplier in config → Prices show correctly for GB users
2. Product Override Wins: Product with EUR=27.99 ignores region rules
3. Bundle Pricing: Create bundle with 2 products + 20% discount → Correct price calculation
4. Bundle Purchase: Buy bundle → Multiple licenses created with bundleId
5. Auto-Invoice: Order changes to paid → Invoice PDF auto-generated
6. Customer Statement: Generate at `/account/statements` → PDF downloads
7. Security: Non-admin cannot read unpublished bundles; users only see own statements
8. Idempotency: Re-updating paid order doesn't create duplicate invoice

---

## [18.3.0] - 2025-01-29

### Added - Creator Finance Phase 4 (Accounting)

**Monthly Accounting Export:**
- `accountingMonthlyExport` callable function (admin only)
- Generates 3 CSV files for specified month:
  - `journal.csv` - Double-entry journal with debits/credits
  - `orders.csv` - Order detail (gross, platform fee, creator payout)
  - `refunds.csv` - Refund detail
- GL account mapping: Revenue (4000), Platform Fees (4050), Creator Payouts (5000), Refunds (4090), Cash (1000), A/R (1100)
- Configurable GL mapping via `config/accounting_gl` (admin-editable)
- Files stored at `platform_accounting/{YYYY-MM}/{file}.csv`
- 7-day signed URLs for download
- Metadata tracked in `platform_accounting/files/months/{YYYY-MM}`

**Daily Accounting Rollups:**
- `accountingDailyRollup` scheduled function (every 24 hours)
- Aggregates last 24h: revenue, platform fees, creator payouts, refunds
- Stores in `analytics_accounting/daily/days/{YYYY-MM-DD}`
- Fields: `revenueUsd`, `platformFeesUsd`, `creatorPayoutsUsd`, `refundsUsd`, `ordersCount`, `refundsCount`

**GL Configuration API:**
- `GET /api/admin/accounting/config` - Fetch GL mapping (admin only)
- `POST /api/admin/accounting/config` - Update GL mapping (admin only)
- Validates GL accounts are numeric strings
- Audit logs for all GL configuration changes

**Accounting Exports API:**
- `GET /api/admin/accounting/exports` - List last 12 months of exports (admin only)
- Returns: month, generated timestamp, orders/refunds counts, signed URLs

**Admin UI:**
- Accounting dashboard at `/admin/accounting`
- GL Mapping editor: 6 configurable accounts
- Export generator: Enter month (YYYY-MM), generate all 3 CSVs
- Past exports list: Download journal/orders/refunds CSVs
- Real-time export generation via callable function

**Double-Entry Bookkeeping:**
Orders:
```
DR Cash          (gross)
  CR Revenue     (gross - platform fee)
  CR Platform Fees (platform fee)
DR Creator Payouts (creator payout amount)
```

Refunds:
```
DR Refunds (contra-revenue)
  CR Cash
```

**Files Created:**
- `functions/src/accounting/export.ts` - Monthly export generator
- `functions/src/accounting/daily.ts` - Daily rollup aggregator
- `src/app/api/admin/accounting/config/route.ts` - GL config API
- `src/app/api/admin/accounting/exports/route.ts` - Exports list API
- `src/app/(admin)/accounting/page.tsx` - Accounting admin dashboard

**Files Updated:**
- `firestore.rules` - Added config/accounting_gl, platform_accounting, analytics_accounting rules
- `storage.rules` - Added platform_accounting/{month}/{file} access rules
- `functions/src/index.ts` - Exported Sprint 18 Phase 4 functions

**Security:**
- GL config: Admin read/write
- Accounting exports metadata: Admin read, Functions write
- Accounting analytics: Admin read, Functions write
- CSV files in Storage: Admin read, Functions write
- All operations audit logged

**Data Schema:**
GL Config:
```typescript
{
  config/accounting_gl: {
    revenue: "4000",
    platformFees: "4050",
    creatorPayouts: "5000",
    refunds: "4090",
    cash: "1000",
    ar: "1100"
  }
}
```

Exports Metadata:
```typescript
{
  platform_accounting/files/months/{YYYY-MM}: {
    month: string,
    generatedAt: timestamp,
    generatedBy: string,
    journal: { path: string, url: string },
    orders: { path: string, url: string },
    refunds: { path: string, url: string },
    ordersCount: number,
    refundsCount: number
  }
}
```

Daily Analytics:
```typescript
{
  analytics_accounting/daily/days/{YYYY-MM-DD}: {
    dayKey: string,
    revenueUsd: number,
    platformFeesUsd: number,
    creatorPayoutsUsd: number,
    refundsUsd: number,
    ordersCount: number,
    refundsCount: number,
    computedAt: timestamp
  }
}
```

**Deployment:**
```bash
# Deploy functions
firebase deploy --only functions:accountingMonthlyExport
firebase deploy --only functions:accountingDailyRollup

# Deploy rules
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

**Smoke Tests:**
1. Admin: Visit `/admin/accounting`, verify GL mapping loaded
2. Admin: Update GL accounts (e.g., Revenue to 4001), save, verify audit log
3. Admin: Enter month "2025-01" (with paid orders), click Generate Export
4. Verify: 3 signed URLs returned, download CSVs, verify journal has DR/CR entries
5. Check: `analytics_accounting/daily/days/{today-1}` has rollup data

---

## [18.2.0] - 2025-01-29

### Added - Creator Finance Phase 3 (Recon • Evidence • Alerts • Platform Reports)

**Payout Reconciliation:**
- `creatorPayoutReconDaily` scheduled function (every 24 hours)
- Compares net earnings from orders vs actual Stripe payouts
- Stores daily deltas: `creator_payouts/{uid}/recon/{YYYYMMDD}`
- Fields: `netFromOrdersUsd`, `payoutsUsd`, `deltaUsd`, `ts`
- Warns on mismatches > $1
- Processes creators with paid orders in last 24 hours

**Dispute Evidence Submission:**
- `submitDisputeEvidence` callable function (admin only)
- Upload files from Storage to Stripe Files API (purpose: dispute_evidence)
- Submit text evidence + file attachments to disputes
- Stores evidence log: `disputes/{id}/evidence/{autoId}`
- Temporary file handling with cleanup
- Audit logging for all evidence submissions

**Enhanced Alerts:**
- `alertsWatcherQuarterHour` scheduled function (every 15 minutes)
- Large refund alerts (configurable threshold, default ≥$100)
- Dispute burst alerts (configurable threshold, default ≥3 in 24h)
- Slack webhook integration (optional, non-blocking)
- Configurable thresholds: `alerts.large_refund_usd`, `alerts.disputes_threshold`
- Audit logs for alert checks

**Platform Monthly Reports:**
- `generatePlatformMonthlyReport` callable function (admin only)
- Aggregates: orders, gross, platform fees, creator payments, refunds, disputes
- Top 10 products by revenue
- Top 10 coupons by usage
- PDF stored at `platform_reports/{YYYY-MM}.pdf`
- Admin UI at `/admin/platform/reports`
- `GET /api/admin/platform/reports` endpoint

**Dispute Detail UI:**
- Dispute detail page at `/admin/disputes/[id]`
- View dispute metadata: payment intent, amount, status, reason, evidence due date
- Upload evidence files directly from browser
- Files uploaded to `disputes_evidence/{disputeId}/{filename}`
- Submit text + attachments in single operation

**Files Created:**
- `functions/src/finance/payoutRecon.ts` - Daily payout reconciliation
- `functions/src/market/disputesEvidence.ts` - Evidence submission handler
- `functions/src/alerts/refundWatcher.ts` - Quarterly alerts watcher
- `functions/src/platform/reports.ts` - Platform monthly report generator
- `src/app/api/admin/platform/reports/route.ts` - Platform reports API
- `src/app/(admin)/platform/reports/page.tsx` - Platform reports dashboard
- `src/app/(admin)/disputes/[id]/page.tsx` - Dispute detail with evidence upload

**Files Updated:**
- `firestore.rules` - Added recon, platform_reports, dispute evidence rules
- `storage.rules` - Added disputes_evidence and platform_reports access rules
- `functions/src/index.ts` - Exported Sprint 18 Phase 3 functions

**Security:**
- Payout recon: Admin or creator (own data) read, Functions write
- Platform reports: Admin read only, Functions write
- Dispute evidence: Admin write only, no public read (Functions use only)
- Evidence submission: Admin only
- Alerts: System-generated, Slack webhook optional

**Data Schema:**
Creator_payouts recon:
```typescript
{
  recon/{YYYYMMDD}: {
    ts: timestamp,
    netFromOrdersUsd: number,
    payoutsUsd: number,
    deltaUsd: number
  }
}
```

Dispute evidence:
```typescript
{
  disputes/{id}/evidence/{autoId}: {
    ts: timestamp,
    by: string,
    text: string,
    stripeFiles: string[]
  }
}
```

Platform reports:
```typescript
{
  platform_reports/files/months/{YYYY-MM}: {
    month: string,
    path: string,
    size: number,
    createdAt: timestamp,
    orders: number,
    gross: number,
    platform: number,
    creators: number,
    refundsTotal: number,
    disputes: number
  }
}
```

**Audit Logs:**
- `dispute_evidence_submitted` - Evidence submission with file count
- `alerts_check` - Periodic alert check results

**Environment Variables:**
- `ALERTS_SLACK_WEBHOOK` (optional) - Slack webhook URL
- `ALERTS_LARGE_REFUND_USD` (optional, default: 100) - Large refund threshold
- `ALERTS_DISPUTES_THRESHOLD` (optional, default: 3) - Dispute burst threshold

**Configuration:**
```bash
firebase functions:config:set \
  alerts.slack_webhook="https://hooks.slack.com/..." \
  alerts.large_refund_usd="100" \
  alerts.disputes_threshold="3"
```

---

## [18.1.0] - 2025-01-28

### Added - Creator Finance Phase 2 (Payouts • Disputes • Statements)

**Payouts Reconciliation:**
- `creatorPayoutsDaily` scheduled function (every 24 hours)
- Fetches payouts from Stripe Connect for each creator
- Stores payouts under `creator_payouts/{uid}/payouts/{payoutId}`
- 30-day aggregate metrics: count, total amount
- Processes creators with paid orders in last 24 hours

**Disputes Management:**
- `charge.dispute.created` webhook event handling
- `charge.dispute.closed` webhook event handling
- Automatic dispute logging to `disputes` collection
- Links disputes to orders via payment intent lookup
- Admin disputes dashboard at `/admin/disputes`
- `GET /api/admin/disputes` endpoint (admin only)
- Displays dispute status, reason, amount, evidence due date

**Slack Alerts:**
- Optional Slack webhook integration via `alerts.slack_webhook` config
- Dispute creation alerts with payment intent and amount
- Large refund alerts (≥$100) with order details
- Graceful fallback if Slack webhook fails (non-blocking)

**Monthly Statements:**
- `generateCreatorStatement` callable function for on-demand PDF generation
- `generateMonthlyStatements` scheduled function (1st of month, 02:00 UTC)
- PDF includes: orders, gross, platform fee, net earnings, top 10 products
- Stored at `creator_statements/{uid}/{YYYY-MM}.pdf` in Cloud Storage
- 7-day signed URLs for secure download
- Creator statements page at `/creator/statements`
- `GET /api/creator/statements` endpoint (creator-only)

**Files Created:**
- `functions/src/finance/payouts.ts` - Daily payouts reconciliation
- `functions/src/creator/statements.ts` - Monthly PDF statements generator
- `src/app/api/admin/disputes/route.ts` - Admin disputes API
- `src/app/api/creator/statements/route.ts` - Creator statements API
- `src/app/(admin)/disputes/page.tsx` - Admin disputes dashboard
- `src/app/(protected)/creator/statements/page.tsx` - Creator statements page

**Files Updated:**
- `functions/src/market/webhook.ts` - Added dispute handlers + Slack alerts
- `firestore.rules` - Added disputes, creator_payouts, creator_statements rules
- `storage.rules` - Added creator_statements PDF access rules
- `functions/src/index.ts` - Exported Sprint 18 Phase 2 functions

**Security:**
- Disputes: Admin read only, webhook write
- Payouts: Admin or creator (own data) read, Functions write
- Statements metadata: Admin or creator (own data) read, Functions write
- Statements PDFs: Admin or creator (own data) read via Storage rules

**Data Schema:**
Disputes collection:
```typescript
{
  id: string,
  paymentIntentId: string,
  chargeId: string,
  status: string,
  amountUsd: number,
  reason: string,
  evidenceDueBy: timestamp,
  createdAt: timestamp,
  closedAt: timestamp,
  orderId: string,
  outcome: string
}
```

Creator_payouts collection:
```typescript
{
  agg_last30: { count: number, amountUsd: number, ts: timestamp },
  payouts/{payoutId}: {
    id: string,
    amountUsd: number,
    currency: string,
    status: string,
    arrivalDate: timestamp,
    createdAt: timestamp,
    stripeAccount: string,
    type: string
  }
}
```

Creator_statements collection:
```typescript
{
  files/{YYYY-MM}: {
    month: string,
    path: string,
    size: number,
    createdAt: timestamp
  }
}
```

**Audit Logs:**
- `dispute_created` - Dispute opened
- `dispute_closed` - Dispute resolved

**Environment Variables:**
- `ALERTS_SLACK_WEBHOOK` (optional) - Slack webhook URL for alerts

---

## [18.0.0] - 2025-01-27

### Added - Creator Finance Phase 1 (Refunds • Reconciliation • Earnings)

**Refunds System:**
- `refundOrder` callable function for admin-initiated refunds
- Automatic license revocation on refund
- Stripe refund integration with payment intent lookup
- Order status tracking: `paid` → `refunded`
- Audit logging for all refund operations
- Admin orders page at `/admin/orders` with refund button

**Transfer Reconciliation:**
- `reconcileTransfersHourly` scheduled function (every 60 minutes)
- Validates Stripe Connect transfer destinations match expected creator accounts
- Processes orders from last 7 days
- Mismatch detection with audit log alerts
- `transferReconciled` and `transferDestinationAccount` fields on orders

**Creator Earnings:**
- `creatorEarningsDaily` scheduled function (every 24 hours)
- Aggregates earnings per creator: orders, gross, platform fee, net
- `analytics_creator` collection with last24h metrics
- Creator earnings page at `/creator/earnings` with KPI cards
- CSV export functionality for creator earnings
- `GET /api/creator/earnings` - JSON earnings summary + recent orders
- `GET /api/creator/earnings.csv` - CSV export (creator-only access)

**Webhook Extensions:**
- `charge.refunded` event handling in `marketplaceWebhook`
- Automatic order status update and license revocation on Stripe-initiated refunds
- Payment intent lookup for order matching

**Admin Features:**
- Admin orders list with status filter (paid/refunded)
- `GET /api/admin/orders?status=paid|refunded` endpoint
- One-click refund button with confirmation dialog
- Order metadata display: payment intent, creator UID, amount

**Files Created:**
- `functions/src/market/refunds.ts` - Refund callable function
- `functions/src/market/reconcile.ts` - Hourly transfer reconciliation
- `functions/src/creator/earnings.ts` - Daily earnings aggregation
- `src/app/api/creator/earnings/route.ts` - Creator earnings API (JSON)
- `src/app/api/creator/earnings.csv/route.ts` - Creator earnings API (CSV)
- `src/app/api/admin/orders/route.ts` - Admin orders list API
- `src/app/(protected)/creator/earnings/page.tsx` - Creator earnings dashboard
- `src/app/(admin)/orders/page.tsx` - Admin orders management page

**Files Updated:**
- `functions/src/market/webhook.ts` - Added `charge.refunded` event handler
- `firestore.rules` - Added `analytics_creator` collection rules (server-only)
- `functions/src/index.ts` - Exported Sprint 18 Phase 1 functions

**Security:**
- Refunds: Admin-only access via custom claims
- Creator earnings: Creator can only access own data (token verification)
- Admin orders: Admin-only access with role verification
- Analytics creator collection: Server-side read/write only (API enforces access)

**Data Schema Extensions:**
Orders collection:
- `status`: "paid" | "refunded"
- `refundedAt`: timestamp
- `refund`: { id, amountUsd, status }
- `transferReconciled`: boolean
- `reconciledAt`: timestamp
- `transferDestinationAccount`: string

Licenses collection:
- `revoked`: boolean
- `revokedAt`: timestamp
- `revokeReason`: string

Analytics_creator collection:
- `ts`: timestamp
- `last24h`: { orders, grossUsd, platformUsd, netUsd }

**Audit Logs:**
- `order_refund` - Admin-initiated refunds
- `charge_refunded` - Stripe-initiated refunds
- `transfer_mismatch` - Reconciliation alerts

---

## [17.3.0] - 2025-01-26

### Added - Search 2.0 + Funnels (Phase 4)

**Search 2.0 with Algolia:**
- Algolia integration with automatic product indexing
- `onProductWrite` Firestore trigger for real-time index synchronization
- `reindexProducts` callable function for bulk reindexing
- Feature flag support: `SEARCH_V2_ENABLED` for gradual rollout
- Fallback to Firestore filtering when Algolia disabled
- Only indexes active+published products
- Admin reindex page at `/admin/search`
- Environment variables: `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY`, `ALGOLIA_SEARCH_KEY`, `ALGOLIA_INDEX_PRODUCTS`

**Anti-Spam Review Detection:**
- Spam scoring algorithm (0-100) with multiple heuristics
- Detection of: short reviews (<5 chars), URLs, spam keywords, repeated characters, all caps
- Threshold: spam score ≥60 → automatic pending status
- Combined with existing toxicity detection
- Spam scores logged in audit logs
- `spamGuard.ts` helper utility

**Image Moderation Queue:**
- Optional image moderation feature flag: `REVIEWS_IMG_MOD_REQUIRED`
- When enabled, all reviews with images remain pending until admin approval
- Admin moderation page at `/admin/reviews/images`
- Separate workflow from text-only review moderation
- Automatic image publishing via existing `onReviewStatusChange` trigger
- `GET /api/admin/reviews/images` endpoint (admin only)

**Funnels & Attribution Tracking:**
- Event tracking system: `view_product`, `start_checkout`
- Server-side event logging via `POST /api/events/track`
- UTM parameter capture (source, medium, campaign)
- Session tracking with client-generated UUID (localStorage)
- `analyticsFunnelsHourly` scheduled function (every 60 minutes)
- Conversion metrics: view→checkout, checkout→purchase, view→purchase
- 24-hour rolling window analysis
- Admin dashboard at `/admin/analytics/funnels`
- `GET /api/admin/analytics/funnels` endpoint (admin only)

**Files Created:**
- `functions/src/search/indexer.ts` - Algolia indexer with Firestore trigger
- `functions/src/reviews/spamGuard.ts` - Spam detection utility
- `functions/src/analytics/funnelsHourly.ts` - Funnels aggregation
- `src/app/api/events/track/route.ts` - Event tracking endpoint (no auth)
- `src/app/api/admin/reviews/images/route.ts` - Image moderation API
- `src/app/api/admin/analytics/funnels/route.ts` - Funnels API
- `src/app/(admin)/search/page.tsx` - Reindex admin page
- `src/app/(admin)/reviews/images/page.tsx` - Image moderation page
- `src/app/(admin)/analytics/funnels/page.tsx` - Funnels dashboard

**Files Updated:**
- `src/app/api/market/search/route.ts` - Added Algolia support with Firestore fallback
- `functions/src/reviews/reviews.ts` - Added spam detection and image moderation flag
- `src/app/(public)/market/[slug]/page.tsx` - Added event tracking (view, checkout)
- `firestore.rules` - Added `events` collection rules
- `functions/src/index.ts` - Exported Phase 4 functions
- `package.json` - Added `uuid` and `@types/uuid`

**Security:**
- Events collection: admin read only, server-side write via API
- Analytics collection: admin read only, server-side write
- No authentication required for event tracking (public endpoint)
- Session IDs client-generated (privacy-preserving)

**Dependencies:**
- Added `uuid` for session ID generation
- Added `algoliasearch` to Cloud Functions

**Documentation:**
- Complete deployment guide (pending)
- Algolia setup instructions
- Composite indexes for events and funnels
- 8 smoke tests for all Phase 4 features

---

## [17.2.0] - 2025-01-25

### Added - Coupons + Advanced Analytics (Phase 3)

**Stripe Coupons Management:**
- `createStripeCoupon` callable — Create Stripe coupons + promo codes
- `upsertCouponCode` callable — Manual coupon mapping
- Firestore `coupons` collection with code mapping
- Percentage off and fixed amount discounts
- Duration: once, forever, repeating
- Max redemptions and expiry date support
- `/admin/coupons` dashboard

**Coupon Tracking:**
- `couponCode` field in orders (uppercase)
- Stored in Stripe metadata for analytics
- Validation via Firestore or direct Stripe

**Advanced Analytics:**
- `analyticsAdvancedDaily` scheduled function (every 24h)
- Metrics: 24h/7d orders, revenue, platform, creators
- Top products by revenue (top 10)
- Coupon usage by orders (top 10)
- `/admin/analytics/advanced` dashboard

**Files Created:**
- `functions/src/coupons/createStripeCoupon.ts`
- `functions/src/coupons/upsertCode.ts`
- `functions/src/analytics/advancedDaily.ts`
- `src/app/api/admin/coupons/route.ts`
- `src/app/api/admin/coupons/[code]/route.ts`
- `src/app/api/admin/analytics/advanced/route.ts`
- `src/app/(admin)/coupons/page.tsx`
- `src/app/(admin)/analytics/advanced/page.tsx`

**Files Updated:**
- `functions/src/market/checkout.ts` — Store couponCode
- `firestore.rules` — Added coupons/analytics
- `functions/src/index.ts` — Exported Phase 3 functions

**Documentation:**
- `docs/SPRINT-17-PHASE-3-DEPLOYMENT.md`
- 8 smoke tests + troubleshooting

---

## [17.1.0] - 2025-01-24

### Added - Reviews with Images + Enhanced Moderation (Phase 2)

**Review Images:**
- Upload up to 3 images per review (max 5MB each, images only)
- Private storage path before approval: `review_media/<uid>/<reviewId>/...`
- Public storage path after approval: `review_media_public/<reviewId>/...`
- `onReviewStatusChange` Firestore trigger automatically copies images on approval
- `mediaUrls` array added to review documents with public image URLs
- Image display on product pages (thumbnail grid)
- Storage ACL enforcement (owner-only read for private, public read for approved)

**Enhanced Moderation:**
- FNV-1a content hashing for duplicate detection
- `contentHash` field prevents spam and duplicate submissions
- Stronger toxicity detection with regex + optional evaluator from Sprint 13
- Toxicity scoring with threshold (≥50 → pending, <50 → approved)
- Content length limit (1500 characters)
- Improved error handling with specific error codes (`already-exists`, etc.)

**Rating Buckets & Histogram:**
- `ratingBuckets` field on products: `{ 1: n, 2: n, 3: n, 4: n, 5: n }`
- Visual histogram on product pages showing star distribution
- Auto-aggregation after each approval
- Proportional bar chart display

**Admin Moderation UI:**
- `/admin/reviews` page for pending reviews management
- Approve/Reject actions with instant UI update
- `GET /api/admin/reviews?status=pending` endpoint (admin only)
- Review metadata display (timestamp, product ID, rating, text)

**Storage Rules:**
- New `storage.rules` file with granular ACL
- Private path: owner-only read/write, 5MB limit, image/* only
- Public path: read-only for all, server-side write only

**Function Updates:**
- `submitReview` — Enhanced with hash, toxicity, limit enforcement
- `approveReview` — Added `approve` parameter for reject action
- `onReviewStatusChange` — NEW: Firestore trigger for image publishing

**Documentation:**
- `docs/SPRINT-17-PHASE-2-DEPLOYMENT.md` - Complete deployment guide
- 8 smoke tests covering upload, moderation, ACL, histogram

**Files Created:**
- `storage.rules` — Cloud Storage ACL
- `functions/src/reviews/media.ts` — Image copy trigger
- `src/app/api/admin/reviews/route.ts` — Moderation API
- `src/app/(admin)/reviews/page.tsx` — Admin moderation UI

**Files Updated:**
- `functions/src/reviews/reviews.ts` — Enhanced moderation logic
- `src/app/(public)/market/[slug]/page.tsx` — Image upload + histogram
- `functions/src/index.ts` — Exported `onReviewStatusChange`

---

## [17.0.0] - 2025-01-23

### Added - Growth Features (Phase 1)

**Product Search:**
- MVP client-side search by title and description
- `GET /api/market/search?q={query}` endpoint
- Search UI with input field and button on marketplace page
- Real-time filtering of active+published products

**Product Reviews System:**
- `product_reviews` Firestore collection with rating, comment, status
- `submitReview` callable function with license ownership verification
- `approveReview` callable function (admin only) for manual moderation
- Auto-moderation with toxic word detection (pending vs approved status)
- Product aggregate updates: `ratingAvg` and `ratingCount`
- Review display on product detail pages
- Review submission form for authenticated users with licenses
- `GET /api/market/product/[slug]/reviews` endpoint for fetching approved reviews
- Audit logging for review submissions and approvals

**Stripe Coupon Support:**
- Optional `coupons` Firestore collection for code mapping
- `couponCode` parameter in `createCheckoutSession` function
- Coupon input field on product pages
- Support for direct Stripe coupons and custom Firestore mappings
- Discount application in Stripe checkout sessions

**Analytics Dashboard:**
- `analyticsDaily` scheduled function (runs every 24 hours)
- Daily aggregation of orders and revenue metrics
- `analytics_daily` Firestore collection with date-keyed snapshots
- Metrics tracked: total orders, total revenue, platform revenue, creator revenue
- `GET /api/admin/analytics/summary` endpoint (admin only)
- `/admin/analytics` dashboard page with KPI cards
- Last 24-hour metrics display

**Security & Rules:**
- Firestore rules for `product_reviews` (read approved, server-write only)
- Firestore rules for `analytics_daily` (admin read, server-write only)
- Firestore rules for `coupons` (admin read/write)
- License verification before review submission
- Admin-only analytics access

**Documentation:**
- `docs/SPRINT-17-DEPLOYMENT.md` - Complete deployment guide
- Firestore schema for reviews, analytics, coupons
- Composite index requirements
- 6 smoke tests covering search, reviews, coupons, analytics
- Troubleshooting guide for common issues
- Security notes and best practices

**Files Created:**
- `functions/src/reviews/reviews.ts` - Review callable functions
- `functions/src/analytics/daily.ts` - Analytics scheduled function
- `src/app/api/market/search/route.ts` - Search API endpoint
- `src/app/api/market/product/[slug]/reviews/route.ts` - Reviews API endpoint
- `src/app/api/admin/analytics/summary/route.ts` - Analytics API endpoint
- `src/app/(admin)/analytics/page.tsx` - Analytics dashboard page

**Files Updated:**
- `src/app/(public)/market/page.tsx` - Added search UI
- `src/app/(public)/market/[slug]/page.tsx` - Added reviews section and coupon input
- `functions/src/market/checkout.ts` - Added coupon support
- `firestore.rules` - Added Sprint 17 collections
- `functions/src/index.ts` - Exported new functions

---

## [16.0.0] - 2025-01-22

### Added - Creator Program + Admin Products CRUD

**Stripe Connect Integration:**
- Creator onboarding with Stripe Express accounts
- `createConnectAccount` - Create/retrieve Stripe Connect account
- `createAccountLink` - Generate onboarding/refresh links
- `createDashboardLink` - Generate Stripe dashboard access links
- Automatic capability updates via `account.updated` webhook events

**Revenue Sharing:**
- Configurable revenue split (default 85% creator, 15% platform)
- Automatic payment distribution using `transfer_data.destination`
- Platform fee collection via `application_fee_amount`
- Revenue tracking in orders: `platformFeeUsd`, `amountToCreatorUsd`, `destinationAccount`

**Creator Management:**
- Creators collection with Stripe account status (`chargesEnabled`, `payoutsEnabled`)
- Creator dashboard page displaying account capabilities
- One-click access to Stripe Express dashboard
- Automatic status synchronization via webhooks

**Admin Product Management:**
- Full CRUD interface for products (`/admin/products`)
- Creator assignment via `ownerUid` and `creatorStripeAccountId` fields
- Revenue share configuration per product (`creatorSharePct`)
- Published/active status control
- Bulk product listing with creator details

**Enhanced Product Schema:**
- `ownerUid` - Creator user ID
- `creatorStripeAccountId` - Stripe Connect account ID
- `creatorSharePct` - Revenue share percentage (0-1)
- `published` - Visibility control (separate from active flag)

**APIs:**
- `GET /api/admin/products` - List all products (admin only)
- `POST /api/admin/products` - Create/update products (admin only)
- `DELETE /api/admin/products/[id]` - Delete product (admin only)
- `GET /api/me/creator` - Get current user's creator profile

**Security:**
- Firestore rules for `creators` collection (owner or admin read, server-side write)
- Enhanced product rules (active AND published for public visibility)
- Creator data privacy enforcement
- Revenue manipulation prevention (server-side calculation)

**Webhook Extensions:**
- `marketplaceWebhook` now handles `account.updated` events
- Creator account status synchronization
- Audit logging for creator account changes

**Documentation:**
- `docs/SPRINT-16-DEPLOYMENT.md` - Complete deployment guide
- Stripe Connect setup instructions
- Revenue sharing technical details
- 6 smoke tests covering onboarding to payout
- Troubleshooting guide for common issues
- Security considerations and best practices

---

## [15.0.0] - 2025-01-20

### Added - Marketplace (MVP)

**Digital Products Catalog:**
- Products collection with slug, title, description, price, and Cloud Storage asset path
- Active/inactive product status control
- Version tracking for product updates

**Stripe Checkout Integration:**
- `createCheckoutSession` callable function for payment processing
- Secure checkout with Stripe-hosted payment page
- Pre-order creation with pending status before payment
- Success/cancel redirect URLs

**Webhook Processing:**
- `marketplaceWebhook` endpoint for Stripe event handling
- Signature verification for webhook security
- Idempotent order status updates (prevent duplicate license grants)
- Automatic license creation on successful payment
- Audit logging for payment events

**License Management:**
- Licenses collection linking users to purchased products
- Download count and last download timestamp tracking
- `generateDownloadUrl` function with signed URLs (60-minute expiry)
- Secure download access (license verification before URL generation)

**Public Pages:**
- `/market` - Marketplace listing with active products
- `/market/[slug]` - Product detail page with buy button
- `/market/success` - Payment success confirmation
- `/market/cancel` - Payment cancellation page

**User Dashboard:**
- `/account/licenses` - User licenses table with download buttons
- Product details inline display (title, granted date, download stats)
- One-click secure downloads

**APIs:**
- `GET /api/market/products` - List active products
- `GET /api/market/product/[slug]` - Get product by slug
- `GET /api/me/licenses` - Get user licenses with product join

**Security:**
- Firestore rules: Active products readable by all, admin write only
- Orders/licenses: Owner or admin read, server-side write only
- License verification before download URL generation
- Webhook signature validation
- Signed URLs with expiration

**Deployment:**
- Complete deployment guide with Stripe setup instructions
- Local development support with Stripe CLI
- 6 smoke tests covering end-to-end purchase flow
- Cloud Logging queries for monitoring
- Troubleshooting guide for common issues

**Documentation:**
- `docs/SPRINT-15-DEPLOYMENT.md` - Full deployment and testing guide
- Firestore schema documentation
- Security best practices
- Metrics to monitor (conversion rate, payment success, webhook latency)
- Next steps roadmap (Admin CRUD, Creator Program, Analytics)

**Dependencies:**
- Added `stripe` to Cloud Functions
- Added `@stripe/stripe-js` to Next.js frontend

---

## [13.0.0] - 2025-01-15

### Added - AI Governance & Model Evaluation

**Evaluation Engine:**
- AI output evaluation for quality, bias, toxicity, and PII leakage
- Privacy-first design: stores only FNV-1a hashes by default, not full prompts/outputs
- Configurable thresholds via Firestore or environment variables
- Server-side evaluation to prevent tampering

**Admin Dashboard:**
- `/admin/ai-governance` dashboard with 8 KPIs and risk assessment
- Quality trends visualization and model performance breakdown
- Recent flagged outputs with color-coded risk levels
- Top models analytics with evaluation counts

**Governance Reports:**
- PDF report generator with HMAC-SHA256 signatures for tamper detection
- 7-day signed URLs for secure report downloads
- Aggregated metrics across all models and time ranges

**Feature Flags & Sampling:**
- Dynamic configuration via `config/ai_governance` Firestore document
- Enable/disable evaluations without redeployment
- Sampling rate control (0-1) to reduce costs
- Live threshold adjustment for toxicity and bias
- ConfigPanel UI for admin management

**Alerts & Monitoring:**
- Scheduled job monitors flagged rate every 60 minutes
- Slack/Discord webhook integration for alerts
- Configurable alert threshold (default: 10% flagged rate)
- 24-hour rolling window analysis

**Cleanup & Retention:**
- Scheduled cleanup job (every 24 hours)
- Automatic deletion of old evaluation runs based on retention policies
- PDF report cleanup (30-day retention)
- Batch processing for efficient Firestore operations

**APIs:**
- `POST /api/admin/ai-evals/config` - Update governance configuration
- `GET /api/admin/ai-evals/config` - Retrieve current configuration
- `GET /api/admin/ai-evals/summary` - Aggregated evaluation metrics
- `GET /api/admin/ai-evals/recent` - Recent flagged outputs

**Cloud Functions:**
- `logAiEval` - Callable function to log and evaluate AI outputs
- `createAIGovernanceReport` - Generate PDF governance reports
- `aiGovCleanup` - Scheduled cleanup of old data
- `aiGovFlagRateAlert` - Scheduled alert monitoring

**Security:**
- Admin-only access to all governance features
- Firestore rules enforce RBAC for configuration
- HMAC signatures prevent report tampering
- Hash-based deduplication without storing sensitive data

**Documentation:**
- [SPRINT-13-SUMMARY.md](docs/SPRINT-13-SUMMARY.md) - Technical reference
- [SPRINT-13-DEPLOYMENT.md](docs/SPRINT-13-DEPLOYMENT.md) - Deployment guide with runbook
- [SPRINT-13-TESTING.md](docs/SPRINT-13-TESTING.md) - Testing scenarios with 12 test cases
- Integration examples for client and server usage

**Infrastructure:**
- GitHub Actions workflow for automated function deployment
- Firebase config setup script for HMAC secrets
- Environment variable templates updated
- Firestore security rules expanded

### Changed
- Firestore rules: Added `config/ai_governance` and `ai_evals` collections
- Environment template: Added `AI_EVAL_SAMPLE_RATE` variable
- Functions index: Exported 4 new Sprint 13 functions

### Fixed
- N/A (new feature)

### Security
- All governance data is admin-only (custom claim required)
- Client writes to `ai_evals` collection are blocked (server-only)
- PDF reports include HMAC signatures for integrity verification

---

## [12.0.0] - 2025-01-10

### Added - Compliance Automation

**Auto-Processing:**
- Auto-approval for premium/enterprise tier DSAR requests
- Auto-rejection for new accounts (< 1 day old)
- Notifications system with real-time Firebase sync

**Retention Management:**
- Configurable retention policies per collection
- Manual trigger for cleanup jobs
- Admin UI for retention configuration

**Audit Dashboard v2:**
- Enhanced audit dashboard with KPIs and breakdowns
- CSV/JSON export functionality
- Time range selector (7/30/90 days)

**Legal Reports:**
- PDF generation for DSAR requests with HMAC signatures
- Cloud Storage integration with signed URLs
- Email notifications via SMTP

---

## [11.0.0] - 2025-01-05

### Added - Data Export & Compliance (GDPR/DSAR)

**DSAR Request System:**
- User-initiated data export requests
- Admin approval workflow
- Automated data collection from all Firebase collections

**Data Exports:**
- JSON format exports with comprehensive user data
- Secure Cloud Storage with signed URLs (24-hour expiration)
- Export history tracking

**Deletion Queue:**
- Account deletion requests with grace period
- Scheduled deletion processing
- Audit trail for all deletion operations

**Retention Policies:**
- Configurable retention periods per collection
- Automated cleanup jobs
- Policy enforcement for GDPR compliance

---

## [10.0.0] - 2024-12-28

### Added - AI Evaluations & Prompt Audit

**LLM-as-a-Judge:**
- Automated evaluation of AI outputs
- Self-consistency with multiple judge votes
- Configurable evaluation criteria

**Drift Detection:**
- Monitor performance degradation over time
- Baseline comparison (7-day rolling window)
- Automated alerts on drift threshold breach

**Red Team Testing:**
- Automated adversarial testing
- Scheduled hourly runs
- Failure detection and alerting

---

## [9.0.0] - 2024-12-20

### Added - Observability & Alerts

**Error Tracking:**
- Sentry integration for error monitoring
- Source maps for production debugging
- User context and breadcrumbs

**Alerting System:**
- Error rate monitoring with thresholds
- Auth failure detection
- Quota breach alerts
- Slack/email notifications

**Monitoring Functions:**
- `watchErrorRate` - Monitor application error rates
- `watchAuthFails` - Detect authentication attacks
- `watchQuotaBreach` - Alert on quota violations

---

## [8.0.0] - 2024-12-15

### Added - Usage Analytics & Quotas

**Usage Tracking:**
- Event-based usage logging
- Daily aggregation with Cloud Functions
- Per-user quota enforcement

**Quota System:**
- Tier-based daily limits (Free/Pro/Enterprise)
- Real-time quota checks
- Automatic quota reset at midnight UTC

**Admin Analytics:**
- Usage statistics dashboard
- User activity monitoring
- Quota breach detection

---

## [7.0.0] - 2024-12-10

### Added - Workspace Collaboration (RBAC)

**Multi-User Workspaces:**
- Create and manage workspaces
- Role-based permissions (Owner/Admin/Member/Viewer)
- Invite system with secure tokens

**Invitation System:**
- Email-based invitations
- Time-limited invite tokens (7-day expiry)
- Role assignment on acceptance

**RBAC Enforcement:**
- Firestore rules for workspace access
- API-level authorization checks
- Custom claims for workspace roles

---

## [6.0.0] - 2024-12-05

### Added - Security Hardening

**Rate Limiting:**
- Upstash Redis integration (optional)
- Firestore-based fallback rate limiting
- Per-endpoint and per-user limits

**Audit Logging:**
- Comprehensive audit trail
- IP hashing for privacy
- Automatic logging for sensitive operations

**Security Headers:**
- CSP, HSTS, X-Frame-Options
- Protection against common vulnerabilities

---

## [5.0.0] - 2024-11-28

### Added - WebAuthn / Passkeys

**Passwordless Authentication:**
- Passkey registration and authentication
- Device credential management
- Biometric authentication support

**Multi-Factor Authentication:**
- TOTP-based 2FA
- Backup recovery codes
- MFA enforcement options

---

## [4.0.0] - 2024-11-20

### Added - Stripe Billing Integration

**Subscription Management:**
- Stripe Checkout integration
- Webhook handling for subscription events
- Entitlement sync with Firestore

**Billing Portal:**
- Customer portal access
- Subscription management UI
- Payment method updates

**Tiered Access:**
- Free, Pro, and Enterprise tiers
- Feature gates based on entitlements
- Automatic access control

---

## [3.0.0] - 2024-11-10

### Added - Apple Sign-In

**OAuth Integration:**
- Apple authentication provider
- Automatic account linking
- Profile data sync

---

## [2.0.0] - 2024-11-01

### Added - Core Authentication

**Email/Password:**
- Standard email/password authentication
- Email verification
- Password reset flows

**Google Sign-In:**
- Google OAuth integration
- One-tap sign-in

---

## [1.0.0] - 2024-10-20

### Added - Initial Release

**Project Foundation:**
- Next.js 14 App Router setup
- Firebase integration (Auth, Firestore, Storage, Functions)
- Tailwind CSS styling
- TypeScript configuration

**Basic Features:**
- User authentication
- Protected routes
- Admin dashboard layout
- Firebase Admin SDK setup

---

[13.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v13.0.0
[12.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v12.0.0
[11.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v11.0.0
[10.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v10.0.0
[9.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v9.0.0
[8.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v8.0.0
[7.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v7.0.0
[6.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v6.0.0
[5.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v5.0.0
[4.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v4.0.0
[3.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v3.0.0
[2.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v2.0.0
[1.0.0]: https://github.com/YOUR_ORG/from-zero-starter/releases/tag/v1.0.0
