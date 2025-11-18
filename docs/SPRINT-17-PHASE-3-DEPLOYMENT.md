# Sprint 17 — Phase 3 (Coupons + Advanced Analytics) — Deployment Guide

**Version**: v17.2.0
**Features**: Stripe Coupons Management, Advanced Analytics Dashboard

---

## Overview

Sprint 17 Phase 3 adds powerful admin capabilities for growth optimization:

1. **Stripe Coupons Management** — Create coupons in Stripe, map to Firestore codes
2. **Coupon Tracking** — Store coupon code in orders for analytics
3. **Advanced Analytics** — 24h/7d metrics with top products and coupon usage

---

## Architecture

### Coupons System
- **Stripe Integration** — Create coupons/promotion codes directly from admin dashboard
- **Firestore Mapping** — Map custom codes to Stripe coupon IDs
- **Flexible Creation**:
  - Create in Stripe + auto-map to Firestore (with promo code)
  - Manual mapping for existing Stripe coupons
- **Discount Types**: Percentage off, fixed amount off
- **Duration**: once, forever, repeating
- **Limits**: Max redemptions, expiry date

### Advanced Analytics
- **Dual Time Windows**: Last 24 hours + last 7 days
- **Key Metrics**: Orders, total revenue, platform revenue, creator revenue
- **Top Products**: By revenue (top 10)
- **Coupon Usage**: By order count (top 10)
- **Scheduled Aggregation**: Runs every 24 hours via `analyticsAdvancedDaily`

---

## Files Created

### Cloud Functions
1. **functions/src/coupons/createStripeCoupon.ts** — Create Stripe coupon + optional promo code
2. **functions/src/coupons/upsertCode.ts** — Map existing Stripe coupon to custom code
3. **functions/src/analytics/advancedDaily.ts** — Advanced analytics aggregation (v2 scheduler)

### API Routes
1. **src/app/api/admin/coupons/route.ts** — GET/POST coupons (admin only)
2. **src/app/api/admin/coupons/[code]/route.ts** — DELETE coupon mapping (admin only)
3. **src/app/api/admin/analytics/advanced/route.ts** — GET advanced analytics (admin only)

### Admin Pages
1. **src/app/(admin)/coupons/page.tsx** — Coupons management dashboard
2. **src/app/(admin)/analytics/advanced/page.tsx** — Advanced analytics dashboard

### Updates
1. **functions/src/market/checkout.ts** — Store `couponCode` in orders + metadata
2. **firestore.rules** — Added rules for `coupons` and `analytics` collections
3. **functions/src/index.ts** — Exported Phase 3 functions

---

## Firestore Schema

### Collection: `coupons/{code}`
```typescript
{
  code: string;                  // Uppercase code (document ID)
  stripeCouponId: string;        // Stripe coupon ID
  promotionCodeId?: string;      // Stripe promotion code ID (optional)
  active: boolean;
  percentOff?: number;           // e.g., 25 for 25%
  amountOff?: number;            // e.g., 10 for $10
  currency?: string;             // e.g., "usd" (required if amountOff)
  duration: "once" | "forever" | "repeating";
  durationInMonths?: number;     // Required if duration="repeating"
  maxRedemptions?: number;
  redeemBy?: number;             // Timestamp (ms)
  createdAt: number;
  createdBy: string;             // Admin UID
}
```

### Collection: `analytics/advanced_daily`
```typescript
{
  ts: number;                    // Computation timestamp
  last24h: {
    orders: number;
    revenueUsd: number;
    platformUsd: number;
    creatorsUsd: number;
  };
  last7d: {
    orders: number;
    revenueUsd: number;
    platformUsd: number;
    creatorsUsd: number;
  };
  topProducts24h: Array<{
    productId: string;
    title?: string;
    orders: number;
    revenueUsd: number;
  }>;
  topProducts7d: Array<{
    productId: string;
    title?: string;
    orders: number;
    revenueUsd: number;
  }>;
  couponUsage24h: Array<{
    code: string;
    orders: number;
    revenueUsd: number;
  }>;
  couponUsage7d: Array<{
    code: string;
    orders: number;
    revenueUsd: number;
  }>;
}
```

### Enhanced: `orders` Collection
```typescript
{
  // Existing fields...
  couponCode?: string;           // NEW: Uppercase coupon code used
  metadata?: {
    couponCode?: string;         // Also stored in Stripe metadata
  };
}
```

---

## Composite Indexes Required

**Create these indexes in Firestore Console:**

1. **orders**: `status ASC, paidAt DESC`
2. **orders**: `productId ASC, paidAt DESC`
3. **coupons**: `createdAt DESC` (for listing)

**Create via Firebase Console**:
1. Go to Firestore > Indexes
2. Add composite indexes as specified above
3. Wait for indexes to build

---

## Deployment Steps

### 1. Deploy Cloud Functions

```bash
cd functions
npm install  # If new dependencies
npm run build
cd ..
firebase deploy --only functions:createStripeCoupon,functions:upsertCouponCode,functions:analyticsAdvancedDaily
```

**New Functions**:
- `createStripeCoupon` — HTTPS callable (admin only)
- `upsertCouponCode` — HTTPS callable (admin only)
- `analyticsAdvancedDaily` — v2 scheduler (runs every 24 hours)

---

### 2. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

**What it does**:
- Adds rules for `coupons` collection (admin read, server-write only)
- Adds rules for `analytics` collection (admin read, server-write only)

---

### 3. Deploy Next.js App

```bash
npm run build
# Deploy to hosting platform

# If using Firebase Hosting:
firebase deploy --only hosting
```

---

### 4. Create Firestore Indexes

**If prompted during deployment**, create indexes:

```bash
firebase firestore:indexes
```

Or manually in Firebase Console → Firestore → Indexes.

---

## Smoke Tests (Phase 3)

### Test 1: Create Coupon in Stripe
1. Go to `/admin/coupons`
2. Enter CODE: "LAUNCH25"
3. Set percentOff: 25
4. Duration: once
5. Click "Create in Stripe"
6. Verify:
   - Coupon appears in Stripe Dashboard
   - Promotion code "LAUNCH25" created in Stripe
   - Document `coupons/LAUNCH25` exists in Firestore
   - All fields populated correctly

**Expected**: Coupon created in both Stripe and Firestore

---

### Test 2: Use Coupon at Checkout
1. Go to product page
2. Enter coupon code "LAUNCH25"
3. Click "Buy with Stripe"
4. Verify:
   - Stripe checkout shows 25% discount
   - Complete payment
5. Check Firestore `orders/{orderId}`:
   - `couponCode: "LAUNCH25"`
   - `status: "paid"`
   - Final amount reflects discount

**Expected**: Coupon applied, order contains couponCode

---

### Test 3: Manual Coupon Mapping
1. Create coupon in Stripe Dashboard manually
2. Copy coupon ID (e.g., `coupon_abc123`)
3. Go to `/admin/coupons`
4. In "Upsert existing Stripe coupon" section:
   - CODE: "SAVE10"
   - Stripe Coupon ID: `coupon_abc123`
5. Click "Upsert Mapping Only"
6. Use "SAVE10" at checkout

**Expected**: Mapping created, coupon works at checkout

---

### Test 4: Advanced Analytics (Manual Trigger)
1. Create several orders with different products and coupons
2. Manually trigger analytics function:
```bash
firebase functions:shell
> analyticsAdvancedDaily()
```
3. Check Firestore `analytics/advanced_daily`:
   - `last24h` has correct order count and revenue
   - `topProducts24h` lists products by revenue
   - `couponUsage24h` lists coupons by order count
4. Go to `/admin/analytics/advanced`
5. Verify dashboard displays all metrics

**Expected**: Analytics computed correctly, dashboard displays data

---

### Test 5: Analytics Auto-Run (24h)
1. Wait 24 hours (or adjust schedule for testing)
2. Check function logs:
```bash
firebase functions:log --only analyticsAdvancedDaily
```
3. Verify `analytics/advanced_daily` updated automatically

**Expected**: Function runs on schedule, data refreshes

---

### Test 6: Coupon Deletion
1. Go to `/admin/coupons`
2. Click "Delete" on a coupon
3. Verify:
   - Document removed from Firestore
   - Coupon still exists in Stripe (intentional)
   - Can no longer use code at checkout (mapping gone)

**Expected**: Firestore mapping deleted, Stripe coupon unchanged

---

### Test 7: Admin Access Control
1. Try to access `/admin/coupons` as non-admin user
2. Verify: Redirected or access denied
3. Try to call `createStripeCoupon` as non-admin
4. Verify: Error "permission-denied: Admin only"

**Expected**: Admin-only endpoints protected

---

### Test 8: Top Products Analytics
1. Create orders for multiple products
2. Trigger analytics function
3. Check `topProducts24h` and `topProducts7d`
4. Verify:
   - Products sorted by revenue (descending)
   - Top 10 products shown
   - Includes product title if available

**Expected**: Top products ranked correctly

---

## Troubleshooting

### Issue: Coupon creation fails with Stripe error

**Cause**: Invalid parameters or Stripe API rate limit

**Fix**:
1. Check Stripe Dashboard → Developers → Logs for error details
2. Verify coupon parameters:
   - `percentOff` OR `amountOff` (not both)
   - `currency` required if `amountOff` present
   - `duration` valid: "once", "forever", or "repeating"
3. Check Stripe API rate limits (100 req/sec)

---

### Issue: Coupon not applying at checkout

**Cause**: Mapping doesn't exist or Stripe coupon invalid

**Fix**:
1. Verify `coupons/{CODE}` document exists in Firestore
2. Check `stripeCouponId` field matches Stripe coupon
3. Verify coupon active in Stripe Dashboard
4. Check coupon not expired or max redemptions reached
5. Review checkout function logs:
```bash
firebase functions:log --only createCheckoutSession
```

---

### Issue: Analytics showing 0 for all metrics

**Cause**: No paid orders in time window or function not run

**Fix**:
1. Create test orders with `status: "paid"` and recent `paidAt`
2. Manually trigger function:
```bash
firebase functions:shell
> analyticsAdvancedDaily()
```
3. Check function logs for errors:
```bash
firebase functions:log --only analyticsAdvancedDaily
```
4. Verify composite indexes created (required for queries)

---

### Issue: Coupon usage not tracked in analytics

**Cause**: `couponCode` not stored in orders

**Fix**:
1. Verify checkout function stores `couponCode`:
```typescript
await db.collection("orders").add({
  // ...
  couponCode: couponCode ? String(couponCode).toUpperCase() : null
});
```
2. Check existing orders have `couponCode` field
3. Re-run analytics function to recompute

---

### Issue: Advanced analytics function timeout

**Cause**: Too many orders to process in single run

**Fix**:
1. Increase function timeout (default 60s, max 540s):
```typescript
export const analyticsAdvancedDaily = onSchedule({
  schedule: "every 24 hours",
  timeoutSeconds: 300
}, async () => { ... });
```
2. Optimize query with pagination if >10k orders
3. Consider caching product titles to reduce Firestore reads

---

### Issue: Promotion code already exists in Stripe

**Cause**: Code previously created

**Fix**:
1. Use different code OR
2. Map existing code:
   - Get promotion code ID from Stripe
   - Use "Upsert Mapping Only" in admin dashboard
3. Delete old promotion code in Stripe if needed

---

## Security Notes

1. **Admin-only operations** — All coupon and analytics endpoints require `admin` claim
2. **Server-side write** — Coupons and analytics collections are server-write only
3. **Coupon validation** — Stripe validates coupon existence and eligibility
4. **Rate limiting** — Stripe API has rate limits (monitor usage)
5. **Coupon deletion** — Only removes Firestore mapping, Stripe coupon remains (intentional)

---

## Performance Considerations

1. **Analytics aggregation** — Runs daily, not real-time
   - **Mitigation**: Schedule during low-traffic hours
2. **Large order volumes** — May need pagination for >10k orders
   - **Mitigation**: Implement batched processing or incremental updates
3. **Firestore reads** — Each analytics run reads all paid orders in time window
   - **Mitigation**: Use composite indexes, cache results
4. **Coupon lookup** — Extra Firestore read on checkout
   - **Mitigation**: Minimal overhead (<100ms), cached by Firestore

---

## What's Next?

**Future Enhancements**:
- Real-time analytics dashboard (Firestore listeners)
- Coupon usage limits per user
- Automatic coupon expiry notifications
- A/B testing for coupon effectiveness
- Revenue forecasting based on trends
- Cohort analysis (customer lifetime value)
- Automated coupon generation (bulk)
- Integration with email campaigns

---

## Rollback

If you need to rollback Phase 3:

```bash
# 1. Revert Firestore rules
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules

# 2. Remove new functions
# Edit functions/src/index.ts to remove Phase 3 exports
firebase deploy --only functions

# 3. Revert Next.js changes
git checkout HEAD~1 src/app
npm run build
firebase deploy --only hosting
```

**Note**: Existing coupons and analytics data will remain in Firestore until manually deleted.

---

## Support

For issues or questions:
- Check Stripe logs: Stripe Dashboard → Developers → Logs
- Check function logs: `firebase functions:log --only createStripeCoupon,upsertCouponCode,analyticsAdvancedDaily`
- Verify Firestore indexes: Firebase Console → Firestore → Indexes
- Review coupon validation in checkout logs

---

**Sprint 17 Phase 3 Complete** ✅

Coupons management and advanced analytics are now live!
