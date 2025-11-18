# Sprint 17 — Growth Features (Phase 1) — Deployment Guide

**Version**: v17.0.0
**Features**: Search, Reviews, Coupons, Analytics

---

## Overview

Sprint 17 Phase 1 adds critical growth features to the marketplace:

1. **Search** — MVP client-side product search by title/description
2. **Reviews** — Product review system with auto-moderation and license verification
3. **Coupons** — Stripe coupon/discount support in checkout
4. **Analytics** — Daily metrics dashboard for orders and revenue

---

## Architecture

### Search
- **Client-side filtering** (MVP approach) — fetches all active+published products and filters by query
- Future optimization: Algolia or Typesense for production-scale search

### Reviews
- **License verification** — users must own product to submit review
- **Auto-moderation** — simple toxic word detection (pending vs approved status)
- **Product aggregates** — `ratingAvg` and `ratingCount` updated after approval
- **Callable functions**: `submitReview`, `approveReview` (admin only)

### Coupons
- **Optional Firestore mapping** — `coupons` collection maps custom codes to Stripe coupon IDs
- **Direct Stripe coupons** — also supports direct Stripe coupon codes
- **Applied at checkout** — discounts parameter in Stripe session

### Analytics
- **Daily aggregation** — scheduled function runs every 24 hours
- **Metrics tracked**: total orders, total revenue, platform revenue, creator revenue
- **Admin-only dashboard** — `/admin/analytics` page

---

## Files Created

### Cloud Functions
1. **functions/src/reviews/reviews.ts** — `submitReview`, `approveReview` callables
2. **functions/src/analytics/daily.ts** — `analyticsDaily` scheduled function

### API Routes
1. **src/app/api/market/search/route.ts** — GET search endpoint
2. **src/app/api/market/product/[slug]/reviews/route.ts** — GET reviews for product
3. **src/app/api/admin/analytics/summary/route.ts** — GET analytics summary (admin only)

### Pages
1. **src/app/(admin)/analytics/page.tsx** — Analytics dashboard

### Updates
1. **src/app/(public)/market/page.tsx** — Added search UI
2. **src/app/(public)/market/[slug]/page.tsx** — Added reviews section + coupon input
3. **functions/src/market/checkout.ts** — Added coupon support
4. **firestore.rules** — Added rules for `product_reviews`, `analytics_daily`, `coupons`
5. **functions/src/index.ts** — Exported new functions

---

## Firestore Schema

### Collection: `product_reviews`
```typescript
{
  productId: string;        // Product document ID
  uid: string;              // Reviewer user ID
  rating: number;           // 1-5
  comment: string;          // Review text
  status: "pending" | "approved";  // Moderation status
  createdAt: number;        // Timestamp
  updatedAt: number;        // Timestamp
}
```

**Indexes Required**:
```bash
productId ASC, status ASC, createdAt DESC
```

### Collection: `analytics_daily`
```typescript
{
  date: string;             // YYYY-MM-DD
  totalOrders: number;      // Orders in last 24h
  totalRevenue: number;     // Total USD
  platformRevenue: number;  // Platform fees USD
  creatorRevenue: number;   // Creator payouts USD
  computedAt: number;       // Timestamp
}
```

**Indexes Required**:
```bash
computedAt DESC
```

### Collection: `coupons` (Optional)
```typescript
{
  id: string;               // Custom coupon code (document ID)
  stripeCouponId: string;   // Stripe coupon/promo code ID
  description?: string;     // Optional description
  active: boolean;          // Whether coupon is active
}
```

---

## Deployment Steps

### 1. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

**What it does**:
- Adds rules for `product_reviews` (read approved, server-write only)
- Adds rules for `analytics_daily` (admin read, server-write only)
- Adds rules for `coupons` (admin read/write)

---

### 2. Create Firestore Indexes

```bash
# Create composite index for product_reviews
firebase firestore:indexes --create
```

**Index 1**: `product_reviews`
- Collection ID: `product_reviews`
- Fields: `productId` (ASC), `status` (ASC), `createdAt` (DESC)
- Query scope: Collection

**Index 2**: `analytics_daily`
- Collection ID: `analytics_daily`
- Fields: `computedAt` (DESC)
- Query scope: Collection

**Or manually via Firebase Console**:
1. Go to Firestore > Indexes
2. Add composite index for `product_reviews`:
   - `productId` (Ascending)
   - `status` (Ascending)
   - `createdAt` (Descending)
3. Add index for `analytics_daily`:
   - `computedAt` (Descending)

---

### 3. Deploy Cloud Functions

```bash
cd functions
npm install  # Install dependencies if needed
npm run build
cd ..
firebase deploy --only functions
```

**New Functions Deployed**:
1. `submitReview` (HTTPS callable)
2. `approveReview` (HTTPS callable)
3. `analyticsDaily` (v2 scheduler, runs every 24 hours)

**Note**: The `analyticsDaily` function uses Firebase Functions v2 scheduler. Ensure you have billing enabled.

---

### 4. Deploy Next.js App

```bash
npm run build
# Deploy to your hosting platform (Vercel, Firebase Hosting, etc.)

# If using Firebase Hosting:
firebase deploy --only hosting
```

---

### 5. (Optional) Create Stripe Coupons

If you want to use Stripe coupons:

**Option 1: Direct Stripe Coupons**
1. Create coupon in Stripe Dashboard
2. Users enter Stripe coupon code directly in product page

**Option 2: Firestore Mapping**
1. Create coupon in Stripe Dashboard
2. Add mapping in Firestore `coupons` collection:
```typescript
{
  id: "SUMMER2024",          // Custom code users enter
  stripeCouponId: "25OFF",   // Stripe coupon ID
  description: "25% off summer sale",
  active: true
}
```

---

## Testing & Smoke Tests

### Test 1: Search Functionality
1. Go to `/market`
2. Enter search query (e.g., "guide")
3. Verify products are filtered by title/description
4. Clear search → all products return

**Expected**: Search filters products instantly

---

### Test 2: Submit Review (Requires License)
1. Purchase a product via Stripe checkout
2. Go to product page
3. Submit a review (rating + comment)
4. Verify review appears if auto-approved
5. Check Firestore `product_reviews` collection

**Expected**: Review created with `status: "approved"` (if no toxic words)

---

### Test 3: Review Moderation
1. Submit review with toxic word (e.g., "spam", "scam")
2. Verify review gets `status: "pending"`
3. Admin calls `approveReview` function with reviewId
4. Verify review now appears on product page
5. Check product `ratingAvg` and `ratingCount` updated

**Expected**: Auto-moderation works, admin approval updates aggregates

---

### Test 4: Review Without License (Should Fail)
1. As user without product license
2. Try to submit review via callable function
3. Verify error: `permission-denied: You must own this product to review it`

**Expected**: Review submission blocked

---

### Test 5: Coupon Code
1. Create Stripe coupon (e.g., 20% off)
2. Add mapping to `coupons` collection (optional) or use direct Stripe code
3. Go to product page
4. Enter coupon code
5. Click "Buy with Stripe"
6. Verify discount applied in Stripe checkout

**Expected**: Discount reflected in checkout session

---

### Test 6: Analytics Dashboard
1. Ensure some orders exist in last 24h
2. Trigger `analyticsDaily` function manually:
```bash
firebase functions:shell
> analyticsDaily()
```
3. Go to `/admin/analytics` as admin
4. Verify KPIs displayed:
   - Total orders (24h)
   - Total revenue
   - Platform revenue
   - Creator revenue

**Expected**: Dashboard shows accurate metrics

---

## Troubleshooting

### Issue: Search returns no results

**Cause**: Products may not have `active: true` and `published: true`

**Fix**:
```typescript
// Verify products in Firestore
await adminDb.collection("products").get().then(snap => {
  snap.docs.forEach(doc => {
    console.log(doc.id, doc.data());
  });
});
```

---

### Issue: Review submission fails with "You must own this product"

**Cause**: User doesn't have license for product

**Fix**:
1. Purchase product first via Stripe checkout
2. Verify license exists in `licenses` collection:
```typescript
licenses/{licenseId}
{
  uid: "user-id",
  productId: "product-id",
  grantedAt: 1234567890
}
```

---

### Issue: Reviews not appearing on product page

**Cause**: Review has `status: "pending"` (auto-moderated)

**Fix**:
1. Check review in Firestore `product_reviews` collection
2. If pending, admin calls `approveReview`:
```typescript
import { getFunctions, httpsCallable } from "firebase/functions";
const fn = httpsCallable(getFunctions(), "approveReview");
await fn({ reviewId: "review-id" });
```

---

### Issue: Product aggregates not updating

**Cause**: `updateProductAggregates` helper only runs on approved reviews

**Fix**:
1. Verify review is approved
2. Manually trigger aggregate update:
```typescript
// In functions shell
const { updateProductAggregates } = require("./reviews/reviews");
await updateProductAggregates("product-id");
```

---

### Issue: Coupon not applied in checkout

**Cause**: Coupon doesn't exist in Stripe or Firestore mapping

**Fix**:
1. Create coupon in Stripe Dashboard
2. If using Firestore mapping, add document:
```typescript
coupons/SUMMER2024
{
  stripeCouponId: "25OFF",
  active: true
}
```

---

### Issue: Analytics dashboard shows 0 for all metrics

**Cause**: `analyticsDaily` function hasn't run yet, or no orders in last 24h

**Fix**:
1. Manually trigger function:
```bash
firebase functions:shell
> analyticsDaily()
```
2. Verify `analytics_daily` collection has documents
3. Check orders have `status: "paid"` and `createdAt` in last 24h

---

### Issue: `analyticsDaily` function not deploying (v2 scheduler)

**Cause**: Firebase billing not enabled or region mismatch

**Fix**:
1. Enable Firebase Blaze plan
2. Verify region in `firebase.json` matches function region
3. Check Cloud Scheduler is enabled in GCP Console

---

## Security Notes

1. **Review moderation**: Only server-side functions can write to `product_reviews`
2. **License verification**: `submitReview` checks `licenses` collection before allowing review
3. **Admin-only approval**: `approveReview` requires `admin` custom claim
4. **Analytics privacy**: Only admins can read `analytics_daily` collection
5. **Coupon validation**: Server-side validation prevents client manipulation

---

## What's Next?

**Sprint 17 Phase 2** (Future enhancements):
- Advanced search with Algolia/Typesense
- Review voting (helpful/not helpful)
- Review images/media uploads
- Review replies from creators
- Detailed analytics with charts and trends
- Coupon usage tracking and limits
- A/B testing for pricing/coupons

---

## Rollback

If you need to rollback Sprint 17:

```bash
# 1. Revert Firestore rules
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules

# 2. Remove new functions
# Edit functions/src/index.ts to remove Sprint 17 exports
firebase deploy --only functions

# 3. Revert Next.js changes
git checkout HEAD~1 src/app
npm run build
firebase deploy --only hosting
```

---

## Support

For issues or questions:
- Check Firestore logs: Firebase Console → Firestore → Usage
- Check function logs: `firebase functions:log --only submitReview,approveReview,analyticsDaily`
- Review error messages in browser console
- Verify user has required licenses/permissions

---

**Sprint 17 Phase 1 Complete** ✅

All growth features (Search, Reviews, Coupons, Analytics) are now live!
