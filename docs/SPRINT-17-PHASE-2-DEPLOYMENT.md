# Sprint 17 — Phase 2 (Reviews with Images + Enhanced Moderation) — Deployment Guide

**Version**: v17.1.0
**Features**: Review Images, Enhanced Moderation, Admin Moderation UI

---

## Overview

Sprint 17 Phase 2 enhances the review system with:

1. **Review Images** — Upload up to 3 images per review (private → public on approval)
2. **Enhanced Moderation** — Stronger toxicity detection + duplicate prevention with content hashing
3. **Rating Buckets** — Star distribution histogram (1-5 stars)
4. **Admin Moderation UI** — Dedicated page for pending reviews approval/rejection

---

## Architecture

### Image Upload Flow
1. User submits review → `submitReview` callable creates review document
2. Client uploads images to private path: `review_media/<uid>/<reviewId>/...`
3. Admin approves review → `onReviewStatusChange` Firestore trigger fires
4. Trigger copies images to public path: `review_media_public/<reviewId>/...`
5. Trigger updates review document with `mediaUrls` array (public URLs)

### Enhanced Moderation
- **FNV-1a content hashing** — Prevents duplicate submissions
- **Regex + optional evaluator** — Toxicity detection from Sprint 13 (fallback to heuristic)
- **Toxicity threshold** — Score ≥50 → pending, <50 → auto-approved
- **Content length limit** — 1500 characters max

### Rating Buckets
- **Star distribution** — `ratingBuckets: { 1: n, 2: n, 3: n, 4: n, 5: n }`
- **Histogram display** — Visual bar chart on product page
- **Auto-aggregation** — Updated after each approval

---

## Files Created

### Cloud Functions
1. **functions/src/reviews/media.ts** — `onReviewStatusChange` Firestore trigger

### Storage Rules
1. **storage.rules** — ACL for review_media (private) and review_media_public (public)

### API Routes
1. **src/app/api/admin/reviews/route.ts** — GET pending reviews (admin only)

### Pages
1. **src/app/(admin)/reviews/page.tsx** — Admin moderation UI

### Updates
1. **functions/src/reviews/reviews.ts** — Enhanced with toxicity detection, duplicate prevention, buckets
2. **src/app/(public)/market/[slug]/page.tsx** — Image upload, histogram display, image rendering
3. **functions/src/index.ts** — Exported `onReviewStatusChange`

---

## Firestore Schema Updates

### Collection: `product_reviews` (Enhanced)
```typescript
{
  productId: string;
  uid: string;
  rating: number;              // 1-5
  text: string;                // Changed from "comment" to "text"
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  approvedAt: number | null;
  contentHash: string;         // NEW: FNV-1a hash for duplicate detection
  mediaUrls?: string[];        // NEW: Public image URLs (added after approval)
}
```

**New Composite Index Required**:
```
productId ASC, uid ASC, contentHash ASC
```

### Collection: `products` (Enhanced)
```typescript
{
  // Existing fields...
  ratingAvg: number;
  ratingCount: number;
  ratingBuckets: {             // NEW: Star distribution
    1: number,
    2: number,
    3: number,
    4: number,
    5: number
  }
}
```

---

## Storage Rules

New file: **storage.rules**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAuth() { return request.auth != null; }

    // Private uploads (owner-only read/write)
    match /review_media/{uid}/{reviewId}/{fileName} {
      allow read: if isAuth() && request.auth.uid == uid;
      allow write: if isAuth() && request.auth.uid == uid
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // Public approved images (read-only for all)
    match /review_media_public/{reviewId}/{fileName} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

**Limits**:
- Max file size: 5 MB
- Only image/* content types allowed
- Max 3 images per review (enforced client-side)

---

## Deployment Steps

### 1. Deploy Storage Rules

```bash
firebase deploy --only storage
```

**What it does**:
- Sets ACL for `review_media` (private)
- Sets ACL for `review_media_public` (public read-only)

**Verify**:
```bash
# Test private path (should fail without auth)
curl https://firebasestorage.googleapis.com/v0/b/<bucket>/o/review_media%2F...

# Test public path (should succeed)
curl https://firebasestorage.googleapis.com/v0/b/<bucket>/o/review_media_public%2F...
```

---

### 2. Create Firestore Composite Index

**Required Index**: `product_reviews`
- Collection ID: `product_reviews`
- Fields:
  - `productId` (Ascending)
  - `uid` (Ascending)
  - `contentHash` (Ascending)
- Query scope: Collection

**Create via Firebase Console**:
1. Go to Firestore > Indexes
2. Add composite index with above fields
3. Wait for index to build (~1-2 minutes)

**Or via CLI** (if prompted during first deployment):
```bash
firebase firestore:indexes
```

---

### 3. Deploy Cloud Functions

```bash
cd functions
npm install  # If new dependencies
npm run build
cd ..
firebase deploy --only functions
```

**New/Updated Functions**:
1. `submitReview` — Enhanced with toxicity detection, duplicate prevention
2. `approveReview` — Now supports reject action
3. `onReviewStatusChange` — NEW: Firestore trigger for image copy

**Note**: `onReviewStatusChange` is a Firestore trigger (v1), not callable. It runs automatically on review document writes.

---

### 4. Deploy Next.js App

```bash
npm run build
# Deploy to hosting platform

# If using Firebase Hosting:
firebase deploy --only hosting
```

---

## Smoke Tests (Phase 2)

### Test 1: Submit Review with Images
1. Purchase a product
2. Go to product page
3. Submit review with text + upload 2 images (≤5MB each)
4. Verify review is created in `product_reviews` collection
5. Verify images uploaded to `review_media/<uid>/<reviewId>/...`
6. Check review status: `approved` (if no toxic words) or `pending`

**Expected**: Review created, images uploaded privately

---

### Test 2: Auto-Moderation (Toxicity)
1. Submit review with toxic word (e.g., "scam", "spam", "hate")
2. Verify review status: `pending`
3. Verify `toxScore` in audit_logs ≥50

**Expected**: Review flagged as pending

---

### Test 3: Duplicate Prevention
1. Submit review with text "Great product!"
2. Try to submit same review again (same text, same product)
3. Verify error: `already-exists: Duplicate review`

**Expected**: Duplicate submission blocked

---

### Test 4: Admin Approve Review (Images Published)
1. As admin, go to `/admin/reviews`
2. See pending review from Test 2
3. Click "Approve"
4. Verify review status → `approved` in Firestore
5. Verify images copied to `review_media_public/<reviewId>/...`
6. Verify `mediaUrls` array added to review document
7. Go to product page → see review with images displayed

**Expected**: Images published, visible on product page

---

### Test 5: Admin Reject Review
1. Submit pending review
2. Admin clicks "Reject" in `/admin/reviews`
3. Verify review status → `rejected`
4. Verify review does NOT appear on product page
5. Verify product aggregates (ratingAvg, buckets) unchanged

**Expected**: Review hidden, aggregates not affected

---

### Test 6: Rating Histogram Display
1. Submit multiple reviews with different ratings (1★, 3★, 5★)
2. Approve all reviews
3. Go to product page
4. Verify histogram shows:
   - 5★: 1 review (bar proportional)
   - 3★: 1 review (bar proportional)
   - 1★: 1 review (bar proportional)
5. Verify `ratingAvg` calculated correctly

**Expected**: Histogram displays star distribution

---

### Test 7: Storage ACL Enforcement
1. Upload review image → get private URL
2. Try to access private URL without auth:
```bash
curl https://firebasestorage.googleapis.com/v0/b/<bucket>/o/review_media%2F<uid>%2F<reviewId>%2Fimage.jpg?alt=media
```
3. Verify: Access denied (401/403)
4. Approve review → get public URL
5. Access public URL (no auth):
```bash
curl https://firebasestorage.googleapis.com/v0/b/<bucket>/o/review_media_public%2F<reviewId>%2Fimage.jpg?alt=media
```
6. Verify: Image displayed

**Expected**: Private URLs blocked, public URLs accessible

---

### Test 8: Image Size Limit
1. Try to upload image >5MB
2. Verify: Upload rejected by Storage rules

**Expected**: Large uploads blocked

---

## Troubleshooting

### Issue: Images not appearing after approval

**Cause**: `onReviewStatusChange` trigger didn't fire or failed

**Fix**:
1. Check function logs:
```bash
firebase functions:log --only onReviewStatusChange
```
2. Verify review document has `status: "approved"`
3. Manually check if files exist in `review_media/<uid>/<reviewId>/`
4. Re-trigger by toggling status:
```typescript
await db.collection("product_reviews").doc(reviewId).update({ status: "pending" });
await db.collection("product_reviews").doc(reviewId).update({ status: "approved" });
```

---

### Issue: Duplicate detection failing

**Cause**: Composite index not created or contentHash missing

**Fix**:
1. Create composite index (see step 2 above)
2. Verify index status in Firestore Console
3. Check review documents have `contentHash` field
4. Re-submit review to generate hash

---

### Issue: Toxicity detection not working

**Cause**: evaluator from Sprint 13 not available (optional)

**Fix**:
1. Verify fallback heuristic is working (check for words: hate, kill, bomb, etc.)
2. If using evaluator, ensure Sprint 13 module exists:
```bash
ls functions/src/aiGovernance/evaluator.ts
```
3. Check function logs for errors

---

### Issue: Storage upload fails with 403

**Cause**: Storage rules not deployed or user not authenticated

**Fix**:
1. Deploy storage rules: `firebase deploy --only storage`
2. Verify user is authenticated (check `getAuth().currentUser`)
3. Verify file size <5MB and content-type is image/*

---

### Issue: Admin reviews page shows empty

**Cause**: No pending reviews or index not created

**Fix**:
1. Submit review with toxic word to create pending review
2. Create index for `status` field:
```
product_reviews: status ASC, createdAt DESC
```
3. Check API response:
```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/admin/reviews?status=pending
```

---

### Issue: Rating buckets not displaying

**Cause**: Product doesn't have `ratingBuckets` field

**Fix**:
1. Approve a review to trigger aggregate update
2. Verify product document has `ratingBuckets` field:
```typescript
{
  ratingAvg: 4.5,
  ratingCount: 2,
  ratingBuckets: { 1:0, 2:0, 3:0, 4:1, 5:1 }
}
```
3. Manually set if missing:
```typescript
await db.collection("products").doc(productId).set({
  ratingBuckets: { 1:0, 2:0, 3:0, 4:0, 5:0 }
}, { merge: true });
```

---

## Security Notes

1. **Private uploads** — Only review owner can read/write before approval
2. **Public after approval** — Images only visible after admin approval
3. **Content hashing** — Prevents spam and duplicate submissions
4. **Toxicity detection** — Auto-flags potentially harmful content
5. **Admin-only moderation** — Only users with `admin` claim can approve/reject
6. **File size limits** — Prevents storage abuse (5MB max per image)
7. **Content type validation** — Only images allowed (no executables, scripts)

---

## Performance Considerations

1. **Trigger overhead** — `onReviewStatusChange` adds latency to approval flow
   - **Mitigation**: Uses async copy, doesn't block response
2. **Image copying** — Large images take longer to copy
   - **Mitigation**: 5MB limit enforces reasonable sizes
3. **Storage costs** — Images stored in two locations (private + public)
   - **Mitigation**: Delete private copies after approval (optional cleanup function)
4. **Histogram rendering** — Client-side calculation on each page load
   - **Mitigation**: Pre-computed in Firestore, just display

---

## What's Next?

**Sprint 17 Phase 3** (Future enhancements):
- Review voting (helpful/not helpful)
- Review replies from creators
- Advanced search with review filtering
- Review flagging by users
- Automated cleanup of private images after approval
- Image compression/optimization
- Video review support
- Review analytics dashboard
- Sentiment analysis integration

---

## Rollback

If you need to rollback Phase 2:

```bash
# 1. Revert storage rules (if needed)
git checkout HEAD~1 storage.rules
firebase deploy --only storage

# 2. Remove new functions
# Edit functions/src/index.ts to remove onReviewStatusChange
firebase deploy --only functions

# 3. Revert Next.js changes
git checkout HEAD~1 src/app
npm run build
firebase deploy --only hosting
```

**Note**: Existing images in `review_media_public` will remain until manually deleted.

---

## Support

For issues or questions:
- Check Storage logs: Firebase Console → Storage → Usage
- Check function logs: `firebase functions:log --only onReviewStatusChange,submitReview,approveReview`
- Review error messages in browser console
- Verify storage rules in Firebase Console → Storage → Rules

---

**Sprint 17 Phase 2 Complete** ✅

Review images, enhanced moderation, and admin UI are now live!
