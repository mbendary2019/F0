# Sprint 17 Phase 4 Deployment Guide
**Search 2.0 + Funnels/Attribution**

This guide covers deployment of Sprint 17 Phase 4: Algolia search integration, anti-spam review detection, image moderation queue, and conversion funnels tracking.

---

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Algolia Setup](#algolia-setup)
4. [Environment Variables](#environment-variables)
5. [Firestore Indexes](#firestore-indexes)
6. [Deployment Steps](#deployment-steps)
7. [Smoke Tests](#smoke-tests)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### Features
- **Search 2.0**: Algolia-powered product search with automatic indexing
- **Anti-Spam Reviews**: Spam detection algorithm with automatic flagging
- **Image Moderation Queue**: Optional manual approval for review images
- **Funnels/Attribution**: Track view → checkout → purchase conversion rates

### Architecture Decisions
- Feature flags for gradual rollout (`SEARCH_V2_ENABLED`, `REVIEWS_IMG_MOD_REQUIRED`)
- Firestore fallback when Algolia disabled
- Server-side event tracking (no authentication required)
- Client-generated session IDs for privacy

---

## Prerequisites

✅ Sprint 17 Phases 1-3 deployed
✅ Algolia account (free tier works)
✅ Firebase CLI installed and authenticated
✅ Node.js 18+ and npm installed

---

## Algolia Setup

### 1. Create Algolia Account
1. Sign up at [algolia.com](https://www.algolia.com/)
2. Create a new application (or use existing)
3. Note your **Application ID**

### 2. Generate API Keys
Navigate to **Settings > API Keys** in Algolia dashboard:

- **Admin API Key**: For write operations (indexing)
- **Search-Only API Key**: For client-side searches

### 3. Create Index
1. Go to **Indices** in Algolia dashboard
2. Create new index named `products_prod` (or custom name)
3. Configure searchable attributes:
   - `title` (ordered)
   - `description` (ordered)
4. Configure ranking criteria:
   - `ratingAvg` (descending)
   - `ratingCount` (descending)

---

## Environment Variables

### Functions Environment (`.env` or Firebase config)

```bash
# Search 2.0
SEARCH_V2_ENABLED=true
ALGOLIA_APP_ID=YOUR_APP_ID
ALGOLIA_API_KEY=YOUR_ADMIN_API_KEY
ALGOLIA_INDEX_PRODUCTS=products_prod

# Image Moderation (optional)
REVIEWS_IMG_MOD_REQUIRED=false
```

### Next.js Environment (`.env.local`)

```bash
# Public search key for client-side searches
NEXT_PUBLIC_ALGOLIA_APP_ID=YOUR_APP_ID
NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=YOUR_SEARCH_ONLY_KEY
NEXT_PUBLIC_ALGOLIA_INDEX_PRODUCTS=products_prod
```

### Set Firebase Functions Config

```bash
# Set all environment variables at once
firebase functions:config:set \
  search.v2_enabled="true" \
  algolia.app_id="YOUR_APP_ID" \
  algolia.api_key="YOUR_ADMIN_API_KEY" \
  algolia.index_products="products_prod" \
  reviews.img_mod_required="false"

# Or set individually
firebase functions:config:set algolia.app_id="YOUR_APP_ID"
firebase functions:config:set algolia.api_key="YOUR_ADMIN_API_KEY"

# View current config
firebase functions:config:get
```

**Note**: After setting config, redeploy functions for changes to take effect.

---

## Firestore Indexes

### Required Composite Indexes

#### 1. Events by Timestamp
```
Collection: events
Fields: ts (Ascending)
```

#### 2. Orders by Payment Date
```
Collection: orders
Fields: paidAt (Ascending)
```

### Create Indexes via Firebase Console

1. Navigate to **Firestore Database > Indexes**
2. Click **Create Index**
3. Add the indexes above

### Or Deploy via `firestore.indexes.json`

Add to your `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ts", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "paidAt", "order": "ASCENDING" }
      ]
    }
  ]
}
```

Then deploy:
```bash
firebase deploy --only firestore:indexes
```

---

## Deployment Steps

### 1. Install Dependencies

```bash
# Root project (Next.js)
npm install uuid
npm install --save-dev @types/uuid

# Functions directory
cd functions
npm install algoliasearch
cd ..
```

### 2. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

Verify `events` collection rules:
```javascript
match /events/{id} {
  allow read: if isAdmin();
  allow write: if false; // API/Functions only
}
```

### 3. Deploy Cloud Functions

```bash
firebase deploy --only functions
```

New functions deployed:
- `onProductWrite` - Firestore trigger for Algolia indexing
- `reindexProducts` - Callable function for bulk reindex
- `analyticsFunnelsHourly` - Scheduled function (every 60 minutes)

### 4. Deploy Next.js Application

```bash
npm run build
# Then deploy to your hosting platform (Vercel, Firebase Hosting, etc.)
```

### 5. Initial Index Population

After deployment, populate Algolia index with existing products:

1. Sign in as admin user
2. Navigate to `/admin/search`
3. Click **"Reindex All Products"** button
4. Verify success message shows indexed count

Or use Firebase CLI:
```bash
firebase functions:call reindexProducts
```

---

## Smoke Tests

### Test 1: Algolia Search
1. Add 3 test products (if not already present)
2. Navigate to `/admin/search` and click **Reindex**
3. Go to `/market`
4. Search for product title
5. ✅ Results appear instantly via Algolia

### Test 2: Fallback Search
1. Set `SEARCH_V2_ENABLED=false` in functions config
2. Redeploy functions
3. Search on `/market` page
4. ✅ Results appear via Firestore filtering

### Test 3: Auto-Indexing
1. Create new product as admin
2. Check Algolia dashboard
3. ✅ Product appears in index within seconds

### Test 4: Anti-Spam Detection
1. Submit review with spam keywords: "Buy now! Visit my site: example.com"
2. Check Firestore `product_reviews` collection
3. ✅ Review has `status: "pending"` and `spamScore >= 60` in audit logs

### Test 5: Image Moderation Queue
1. Set `REVIEWS_IMG_MOD_REQUIRED=true` in functions config
2. Redeploy functions
3. Submit review with image attachment
4. Navigate to `/admin/reviews/images`
5. ✅ Review appears in moderation queue
6. Click **Approve**
7. ✅ Images copied to public path and review approved

### Test 6: Event Tracking (View)
1. Visit product page: `/market/test-product?utm_source=email&utm_medium=campaign`
2. Check Firestore `events` collection
3. ✅ Document with `kind: "view_product"`, `productId`, `sessionId`, `utm` exists

### Test 7: Event Tracking (Checkout)
1. Click **"Buy with Stripe"** button
2. Check `events` collection
3. ✅ Document with `kind: "start_checkout"` exists with same `sessionId`

### Test 8: Funnels Dashboard
1. Generate test events (view, checkout, purchase)
2. Wait for hourly aggregation or manually trigger function
3. Navigate to `/admin/analytics/funnels`
4. ✅ Conversion rates displayed with 24h data

---

## Troubleshooting

### Issue: Algolia Search Not Working

**Symptoms**: Search returns Firestore results instead of Algolia

**Solutions**:
1. Verify `SEARCH_V2_ENABLED=true` in functions config
2. Check Algolia credentials are correct
3. Verify index name matches `ALGOLIA_INDEX_PRODUCTS`
4. Run reindex function to populate index
5. Check Cloud Functions logs for Algolia errors

### Issue: Products Not Auto-Indexing

**Symptoms**: New products don't appear in Algolia

**Solutions**:
1. Verify `onProductWrite` function deployed successfully
2. Check Firestore trigger is active in Firebase Console
3. Review Cloud Functions logs for trigger errors
4. Verify product has `active: true` and `published: true`
5. Check Algolia API key has write permissions

### Issue: Spam Detection Too Aggressive

**Symptoms**: Legitimate reviews marked as spam

**Solutions**:
1. Adjust spam threshold in `reviews.ts` (current: 60)
2. Modify spam scoring weights in `spamGuard.ts`
3. Review spam scores in audit logs to calibrate thresholds

### Issue: Funnels Dashboard Empty

**Symptoms**: No data in funnels dashboard

**Solutions**:
1. Verify event tracking is working (check `events` collection)
2. Wait for hourly aggregation or manually trigger `analyticsFunnelsHourly`
3. Check composite index for `events.ts` is built
4. Verify orders have `paidAt` field populated
5. Review Cloud Functions logs for aggregation errors

### Issue: Session IDs Not Persisting

**Symptoms**: New session ID generated on each page load

**Solutions**:
1. Check browser localStorage is enabled
2. Verify client-side JavaScript is not blocked
3. Check for console errors related to `uuid` import
4. Verify `getSessionId()` function is called correctly

### Issue: UTM Parameters Not Captured

**Symptoms**: UTM fields null in events collection

**Solutions**:
1. Verify URL includes `utm_source`, `utm_medium`, or `utm_campaign`
2. Check `parseUTM()` function is receiving `searchParams`
3. Review browser console for tracking errors
4. Verify API endpoint accepts UTM parameters

### Issue: Image Moderation Not Enforcing

**Symptoms**: Reviews with images approved immediately

**Solutions**:
1. Verify `REVIEWS_IMG_MOD_REQUIRED=true` in functions config
2. Redeploy functions after config change
3. Clear function cache: `firebase functions:config:unset reviews.img_mod_required` then reset
4. Check `submitReview` function logs for moderation logic

---

## Monitoring

### Cloud Functions Logs

```bash
# View all Phase 4 function logs
firebase functions:log --only onProductWrite,analyticsFunnelsHourly

# View specific function
firebase functions:log --only onProductWrite --lines 50
```

### Key Metrics to Monitor

1. **Search Performance**
   - Algolia dashboard: Queries per day, search latency
   - Fallback usage (when Algolia fails)

2. **Spam Detection**
   - Review rejection rate
   - Spam score distribution (audit logs)
   - False positive rate (legitimate reviews marked as spam)

3. **Conversion Funnels**
   - View → Checkout conversion rate
   - Checkout → Purchase conversion rate
   - End-to-end conversion rate
   - Drop-off points in funnel

4. **Event Tracking**
   - Events created per hour
   - UTM parameter coverage
   - Session ID uniqueness

---

## Security Notes

- ✅ Events collection: Admin read only, server-side write
- ✅ Analytics collection: Admin read only, server-side write
- ✅ Event tracking endpoint: No authentication (public by design)
- ✅ Session IDs: Client-generated for privacy (no PII)
- ✅ Algolia API keys: Admin key server-only, search key public
- ⚠️ Event tracking accepts any data: Consider rate limiting for abuse prevention

---

## Next Steps (Post-Deployment)

1. **Tune Spam Detection**: Review spam scores after 1 week, adjust thresholds
2. **Optimize Algolia**: Configure synonyms, stop words, ranking formula
3. **A/B Test Search**: Compare Algolia vs Firestore conversion rates
4. **Attribution Reports**: Build reports from UTM data (future sprint)
5. **Cohort Analysis**: Track user behavior across sessions (future sprint)

---

## Rollback Plan

If Phase 4 causes issues:

1. **Disable Algolia**: Set `SEARCH_V2_ENABLED=false`, redeploy functions
2. **Disable Image Moderation**: Set `REVIEWS_IMG_MOD_REQUIRED=false`, redeploy
3. **Remove Event Tracking**: Comment out tracking calls in product page
4. **Revert Functions**: Deploy previous version via Firebase Console

No data loss occurs during rollback (Firestore data intact).

---

## Support

For issues or questions:
- Check [Algolia documentation](https://www.algolia.com/doc/)
- Review Firebase Functions logs
- Open GitHub issue with logs and error messages

---

**Deployment Date**: 2025-01-26
**Version**: 17.3.0
**Author**: From-Zero Team
