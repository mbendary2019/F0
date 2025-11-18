# Sprint 15: Marketplace (MVP) Deployment Guide

## Overview

Sprint 15 delivers a complete marketplace MVP with:
- Digital product listings with Stripe checkout
- Order processing with webhook validation
- License management with secure download URLs
- User dashboard for purchased products

---

## Components Delivered

### Cloud Functions (3)
- ✅ `createCheckoutSession` - Generate Stripe checkout session (callable)
- ✅ `marketplaceWebhook` - Process Stripe payment webhooks
- ✅ `generateDownloadUrl` - Create signed download URLs for licensed users

### Admin APIs (3)
- ✅ `GET /api/market/products` - List active products
- ✅ `GET /api/market/product/[slug]` - Get product by slug
- ✅ `GET /api/me/licenses` - Get user's licenses with product details

### Public Pages (4)
- ✅ `/market` - Marketplace listing page
- ✅ `/market/[slug]` - Product detail page with buy button
- ✅ `/market/success` - Payment success page
- ✅ `/market/cancel` - Payment cancel page

### Protected Pages (1)
- ✅ `/account/licenses` - User licenses dashboard with download buttons

### Firestore Collections (3)
- ✅ `products` - Digital products catalog
- ✅ `orders` - Purchase orders with payment status
- ✅ `licenses` - User licenses with download tracking

### Firestore Rules
- ✅ Products: Active products readable by all, admin write
- ✅ Orders: Owner or admin read, server-side write only
- ✅ Licenses: Owner or admin read, server-side write only

---

## Prerequisites

### 1. Install Dependencies

```bash
# Cloud Functions
cd functions
npm install stripe
cd ..

# Frontend
npm install @stripe/stripe-js
```

### 2. Environment Variables

**Create/Update `.env.local`:**

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Firebase Functions Config:**

```bash
firebase functions:config:set \
  stripe.secret_key="sk_test_..." \
  stripe.webhook_secret="whsec_..." \
  app.url="https://your-domain.com"
```

**Notes:**
- Use test keys for development: `pk_test_...` and `sk_test_...`
- Use live keys for production: `pk_live_...` and `sk_live_...`
- `app.url` is used for success/cancel redirect URLs

---

## Deployment Steps

### 1. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

**Expected Output:**
```
✔  firestore: released rules firestore.rules to cloud.firestore
```

### 2. Deploy Cloud Functions

```bash
firebase deploy --only functions:createCheckoutSession,functions:marketplaceWebhook,functions:generateDownloadUrl
```

**Expected Output:**
```
✔  functions[createCheckoutSession(us-central1)] Successful create operation.
✔  functions[marketplaceWebhook(us-central1)] Successful create operation.
✔  functions[generateDownloadUrl(us-central1)] Successful create operation.
```

### 3. Configure Stripe Webhook

#### Production Deployment:

1. **Get Function URL:**
   ```bash
   firebase functions:config:get
   # Or check Firebase Console → Functions
   ```

   URL format: `https://us-central1-<PROJECT-ID>.cloudfunctions.net/marketplaceWebhook`

2. **Create Webhook in Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - **Endpoint URL:** `https://us-central1-<PROJECT-ID>.cloudfunctions.net/marketplaceWebhook`
   - **Events to send:**
     - `checkout.session.completed`
   - Click "Add endpoint"

3. **Copy Signing Secret:**
   - Click on the created webhook
   - Reveal "Signing secret" (starts with `whsec_...`)
   - Update Firebase config:
     ```bash
     firebase functions:config:set stripe.webhook_secret="whsec_..."
     firebase deploy --only functions:marketplaceWebhook
     ```

#### Local Development:

Use Stripe CLI to forward webhooks to local emulator:

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks (keep running in terminal)
stripe listen --forward-to http://127.0.0.1:5001/<PROJECT-ID>/us-central1/marketplaceWebhook

# Copy the webhook signing secret (whsec_...) and set it:
firebase functions:config:set stripe.webhook_secret="whsec_..."
```

### 4. Deploy Next.js Application

```bash
# Build and deploy
npm run build

# If using Vercel
vercel --prod

# If using Firebase Hosting
firebase deploy --only hosting
```

---

## Smoke Tests

### Test 1: Seed Product Data

**Action:**
1. Open Firebase Console → Firestore Database
2. Create document in `products` collection:

```json
{
  "slug": "starter-kit",
  "title": "From-Zero Starter Kit",
  "description": "Complete boilerplate with authentication, payments, and deployment.\n\nIncludes:\n- Firebase setup\n- Stripe integration\n- Admin dashboard\n- Documentation",
  "priceUsd": 49,
  "active": true,
  "assetPath": "products/starter-kit/v1.zip",
  "version": "1.0.0",
  "createdAt": 1700000000000
}
```

3. Upload test file to Cloud Storage:
   ```bash
   # Create a test zip file
   echo "Test content" > test.txt
   zip test.zip test.txt

   # Upload to Storage (match assetPath above)
   gsutil cp test.zip gs://<YOUR-BUCKET>/products/starter-kit/v1.zip
   ```

**Expected Result:**
- Product document created successfully
- Test file uploaded to Storage

---

### Test 2: Marketplace Listing

**Action:**
1. Navigate to `https://your-domain.com/market`
2. Verify product appears in listing

**Expected Result:**
- Page loads successfully
- "Starter Kit" product card displayed with:
  - Title: "From-Zero Starter Kit"
  - Description preview (truncated at 120 chars)
  - Price: "$49"
- Clicking card navigates to `/market/starter-kit`

---

### Test 3: Product Detail & Checkout

**Action:**
1. Navigate to `/market/starter-kit`
2. Click "Buy with Stripe" button
3. Log in if prompted
4. Complete Stripe checkout with test card:
   - **Card Number:** `4242 4242 4242 4242`
   - **Expiry:** Any future date (e.g., `12/34`)
   - **CVC:** Any 3 digits (e.g., `123`)
   - **ZIP:** Any 5 digits (e.g., `12345`)

**Expected Result:**
- Product detail page shows full description and price
- "Buy with Stripe" button redirects to Stripe checkout
- Test payment succeeds
- Redirects to `/market/success` page
- Success message displayed

---

### Test 4: Webhook Processing

**Action:**
1. After completing Test 3 payment
2. Wait 5-10 seconds for webhook processing
3. Check Firestore collections:

**Expected Result in Firestore:**

**`orders/{orderId}`:**
```json
{
  "uid": "your-user-id",
  "productId": "product-doc-id",
  "amountUsd": 49,
  "currency": "usd",
  "status": "paid",
  "stripeSessionId": "cs_test_...",
  "stripePaymentIntent": "pi_...",
  "createdAt": 1700000000000,
  "paidAt": 1700000123000
}
```

**`licenses/{licenseId}`:**
```json
{
  "uid": "your-user-id",
  "productId": "product-doc-id",
  "orderId": "order-doc-id",
  "grantedAt": 1700000123000,
  "downloadCount": 0,
  "lastDownloadAt": null
}
```

**`audit_logs/{logId}`:**
```json
{
  "ts": 1700000123000,
  "kind": "payment_completed",
  "actor": "system",
  "meta": {
    "uid": "your-user-id",
    "orderId": "order-doc-id",
    "productId": "product-doc-id",
    "sessionId": "cs_test_..."
  }
}
```

---

### Test 5: Download License

**Action:**
1. Navigate to `/account/licenses`
2. Verify license appears in table
3. Click "Download" button

**Expected Result:**
- Licenses page shows purchased product:
  - Product title: "From-Zero Starter Kit"
  - Granted date
  - Download count: `0`
- Clicking "Download" initiates file download
- Browser downloads `test.zip` file
- After download, refresh page:
  - Download count: `1`
  - Last download timestamp updated

---

### Test 6: Security - Unauthorized Access

**Action:**
1. Create second user account (different email)
2. Log in as second user
3. Navigate to `/account/licenses`
4. Try to call `generateDownloadUrl` for first user's product

**Expected Result:**
- Licenses page shows empty state: "No licenses yet"
- Attempting to download product via direct function call throws:
  - Error code: `permission-denied`
  - Message: `"No license"`

---

## Firestore Schema Details

### Products Collection

**Path:** `products/{productId}`

**Fields:**
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `slug` | `string` | URL-friendly identifier | ✅ |
| `title` | `string` | Product name | ✅ |
| `description` | `string` | Full description (supports markdown) | ✅ |
| `priceUsd` | `number` | Price in USD | ✅ |
| `active` | `boolean` | Published/unpublished state | ✅ |
| `assetPath` | `string` | Cloud Storage path to file | ✅ |
| `version` | `string` | Product version (e.g., "1.0.0") | ❌ |
| `createdAt` | `number` | Timestamp (milliseconds) | ✅ |

**Security Rules:**
- **Read:** Active products OR admin
- **Write:** Admin only

---

### Orders Collection

**Path:** `orders/{orderId}`

**Fields:**
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `uid` | `string` | Buyer user ID | ✅ |
| `productId` | `string` | Product document ID | ✅ |
| `amountUsd` | `number` | Purchase amount | ✅ |
| `currency` | `string` | Currency code (always "usd") | ✅ |
| `status` | `string` | `pending` \| `paid` \| `failed` | ✅ |
| `stripeSessionId` | `string` | Checkout session ID | ✅ |
| `stripePaymentIntent` | `string` | Payment intent ID | ❌ |
| `createdAt` | `number` | Order creation timestamp | ✅ |
| `paidAt` | `number` | Payment completion timestamp | ❌ |

**Status Flow:**
1. `pending` - Order created, checkout session initiated
2. `paid` - Payment successful (set by webhook)
3. `failed` - Payment failed (future implementation)

**Security Rules:**
- **Read:** Owner OR admin
- **Write:** Server-side only (webhook/functions)

---

### Licenses Collection

**Path:** `licenses/{licenseId}`

**Fields:**
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `uid` | `string` | License owner user ID | ✅ |
| `productId` | `string` | Product document ID | ✅ |
| `orderId` | `string` | Order document ID | ✅ |
| `grantedAt` | `number` | License grant timestamp | ✅ |
| `downloadCount` | `number` | Total downloads | ✅ |
| `lastDownloadAt` | `number` \| `null` | Last download timestamp | ✅ |

**Security Rules:**
- **Read:** Owner OR admin
- **Write:** Server-side only (webhook/functions)

---

## Cloud Logging Queries

### View Checkout Sessions

**GCP Console → Logging → Query:**

```
resource.type="cloud_function"
resource.labels.function_name="createCheckoutSession"
severity>=INFO
```

**Expected Logs:**
- `[createCheckoutSession] Creating session for product: abc123`
- `[createCheckoutSession] Session created: cs_test_...`

---

### View Webhook Events

**GCP Console → Logging → Query:**

```
resource.type="cloud_function"
resource.labels.function_name="marketplaceWebhook"
severity>=INFO
```

**Expected Logs:**
- `[marketplaceWebhook] checkout.session.completed: cs_test_...`
- `[marketplaceWebhook] Order abc123 marked as paid`
- `[marketplaceWebhook] License granted to uid: xyz789`

---

### View Download Requests

**GCP Console → Logging → Query:**

```
resource.type="cloud_function"
resource.labels.function_name="generateDownloadUrl"
severity>=INFO
```

**Expected Logs:**
- `[generateDownloadUrl] Generating URL for product: abc123, user: xyz789`
- `[generateDownloadUrl] Signed URL expires at: 2024-01-01T12:00:00Z`

---

## Troubleshooting

### Issue: Webhook not receiving events

**Symptoms:**
- Payment succeeds in Stripe
- Order status remains `pending`
- No license created

**Debug Steps:**

1. **Check Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com/test/events
   - Find `checkout.session.completed` event
   - Check "Webhook attempts" tab
   - Verify endpoint received event (200 response)

2. **Check Function Logs:**
   ```bash
   # View logs
   firebase functions:log --only marketplaceWebhook

   # Look for errors
   firebase functions:log --only marketplaceWebhook | grep ERROR
   ```

3. **Verify Webhook Secret:**
   ```bash
   # Check current config
   firebase functions:config:get

   # Ensure stripe.webhook_secret matches Stripe dashboard
   ```

4. **Test Webhook Manually:**
   ```bash
   stripe trigger checkout.session.completed
   ```

**Common Fixes:**
- Wrong webhook secret → Update config and redeploy
- Function not deployed → Run `firebase deploy --only functions:marketplaceWebhook`
- CORS issues → Check Express raw body middleware in webhook.ts

---

### Issue: Download button not working

**Symptoms:**
- "Permission denied" error when clicking download
- Download count not incrementing

**Debug Steps:**

1. **Verify License Exists:**
   - Firebase Console → Firestore → `licenses`
   - Find document where `uid` matches current user
   - Verify `productId` matches product being downloaded

2. **Check Product Asset:**
   ```bash
   # Verify file exists in Storage
   gsutil ls gs://<YOUR-BUCKET>/products/

   # Check file at exact path from product.assetPath
   gsutil ls gs://<YOUR-BUCKET>/products/starter-kit/v1.zip
   ```

3. **Check Function Logs:**
   ```bash
   firebase functions:log --only generateDownloadUrl
   ```

**Common Fixes:**
- Missing license → Check webhook processed successfully
- Wrong assetPath → Update product document in Firestore
- Missing Storage file → Upload file to correct path
- Expired signed URL → URLs expire after 60 minutes (expected behavior)

---

### Issue: Checkout redirects to localhost

**Symptoms:**
- After clicking "Buy", redirected to `http://localhost:3000/market/success`

**Cause:**
`app.url` Firebase config is set to localhost

**Fix:**
```bash
# Update config with production URL
firebase functions:config:set app.url="https://your-domain.com"

# Redeploy
firebase deploy --only functions:createCheckoutSession
```

---

### Issue: Test payment fails in production

**Cause:**
Using test card (`4242 4242 4242 4242`) with live Stripe keys

**Fix:**
- Production: Use real payment card
- Development: Use test Stripe keys (`pk_test_...`, `sk_test_...`)

**Switch to Test Mode:**
```bash
# Update .env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Update Firebase functions config
firebase functions:config:set stripe.secret_key="sk_test_..."

# Redeploy
npm run build
firebase deploy
```

---

## Post-Deployment Checklist

- [ ] Deployed Firestore rules for marketplace collections
- [ ] Deployed all 3 Cloud Functions (checkout, webhook, download)
- [ ] Configured Stripe webhook endpoint in Stripe Dashboard
- [ ] Set webhook signing secret in Firebase functions config
- [ ] Verified `app.url` config matches production domain
- [ ] Updated `.env.local` with Stripe publishable key
- [ ] Deployed Next.js application with marketplace pages
- [ ] Seeded at least 1 product in Firestore
- [ ] Uploaded product file to Cloud Storage
- [ ] Tested end-to-end purchase flow with test card
- [ ] Verified webhook processing (order + license created)
- [ ] Tested download functionality from licenses page
- [ ] Verified security (unauthorized users cannot download)
- [ ] Checked Cloud Logging for errors
- [ ] (Production) Switched to live Stripe keys

---

## Metrics to Monitor

### Key Performance Indicators (KPIs)

1. **Conversion Rate:**
   - % of product page views → checkout sessions → completed purchases
   - Query: `COUNT(orders where status="paid") / COUNT(checkout sessions created)`
   - Target: ≥5% conversion

2. **Payment Success Rate:**
   - % of checkout sessions that complete successfully
   - Query: `COUNT(orders where status="paid") / COUNT(orders total)`
   - Target: ≥95% success

3. **Webhook Latency:**
   - Time from Stripe event → license granted
   - Monitor via audit logs: `meta.grantedAt - event.created`
   - Target: <5 seconds

4. **Download Engagement:**
   - % of licenses with at least 1 download within 24 hours
   - Query: `COUNT(licenses where downloadCount > 0 and lastDownloadAt - grantedAt < 86400000)`
   - Target: ≥80% engagement

5. **Revenue Metrics:**
   - Total sales: `SUM(orders.amountUsd where status="paid")`
   - Average order value: `AVG(orders.amountUsd where status="paid")`
   - Daily sales trend

---

## Security Best Practices

### 1. Webhook Signature Verification

✅ **Already Implemented:**
```typescript
event = stripe.webhooks.constructEvent(req.body, sig, functions.config().stripe.webhook_secret);
```

**Why:** Ensures webhook requests actually come from Stripe, preventing malicious order creation.

---

### 2. License Verification Before Download

✅ **Already Implemented:**
```typescript
const licSnap = await db.collection("licenses")
  .where("uid", "==", context.auth.uid)
  .where("productId", "==", productId)
  .limit(1)
  .get();

if (licSnap.empty) throw new functions.https.HttpsError("permission-denied", "No license");
```

**Why:** Prevents unauthorized downloads of paid products.

---

### 3. Signed URLs with Expiry

✅ **Already Implemented:**
```typescript
const [url] = await file.getSignedUrl({
  action: "read",
  expires: Date.now() + 60 * 60 * 1000 // 60 minutes
});
```

**Why:** Download links expire after 1 hour, preventing URL sharing.

**Adjust Expiry:**
```typescript
// Shorter expiry (15 minutes)
expires: Date.now() + 15 * 60 * 1000

// Longer expiry (24 hours)
expires: Date.now() + 24 * 60 * 60 * 1000
```

---

### 4. Idempotency in Webhook

✅ **Already Implemented:**
```typescript
if ((order.data() as any).status === "paid") {
  return res.json({ received: true });
}
```

**Why:** If Stripe sends duplicate webhook events, license is not granted multiple times.

---

## Next Steps (Future Sprints)

### Sprint 16: Admin Product Management
- [ ] Products CRUD dashboard (`/admin/products`)
- [ ] Image upload for product thumbnails
- [ ] Markdown editor for descriptions
- [ ] Bulk import/export products

### Sprint 17: Creator Program
- [ ] Stripe Connect for seller payouts
- [ ] Creator dashboard (`/creator/dashboard`)
- [ ] Product submission workflow
- [ ] HITL integration for product approval (Sprint 14)
- [ ] Revenue split configuration

### Sprint 18: Enhanced Features
- [ ] Refunds API + order cancellation
- [ ] Receipt/invoice email (Sprint 12 SMTP)
- [ ] Product reviews and ratings
- [ ] Bundle deals (buy multiple products)
- [ ] Discount codes and promotions

### Sprint 19: Analytics & Reporting
- [ ] Sales dashboard with charts
- [ ] Top products by revenue
- [ ] Customer lifetime value (CLV)
- [ ] Conversion funnel visualization
- [ ] Abandoned cart tracking

---

## 🎉 Sprint 15 Complete!

**Status:** ✅ MVP READY

**Delivered:**
- 3 Cloud Functions
- 3 API routes
- 5 pages (marketplace + licenses)
- 3 Firestore collections with security rules
- Stripe integration (checkout + webhook)
- Signed download URLs
- Complete deployment guide

**Total Implementation Time:** ~2 hours

**Ready for Production:** Yes (with live Stripe keys)

---

**Next Sprint Preview:** Sprint 16 - Admin Product Management CRUD
