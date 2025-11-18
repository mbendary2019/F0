# Phase 45.2 - Seed Paid Marketplace Items

## Manual Seeding via Firebase Console

Since the seed script requires ADC (Application Default Credentials), you can manually add paid marketplace items via Firebase Console.

### 📍 Firebase Console URL

https://console.firebase.google.com/project/from-zero-84253/firestore/data/ops_marketplace_paid

---

## 🛍️ Sample Paid Marketplace Items

### Item 1: Advanced Analytics Pack

**Document ID:** `analytics-pro`

```json
{
  "id": "analytics-pro",
  "title": "Advanced Analytics Pack",
  "description": "Real-time analytics, custom dashboards, and data export features",
  "category": "analytics",
  "requiresPaid": true,
  "entitlement": "advanced_analytics",
  "price": 0,
  "icon": "📊",
  "verified": true,
  "createdAt": [Click "Add server timestamp"],
  "updatedAt": [Click "Add server timestamp"]
}
```

**Steps:**
1. Go to Firestore Console
2. Click on `ops_marketplace_paid` collection (create if not exists)
3. Click "Add document"
4. Document ID: `analytics-pro`
5. Add fields (use exact field names and types above)
6. For timestamp fields, select "timestamp" type and click "server timestamp"

---

### Item 2: Custom Branding Suite

**Document ID:** `custom-branding`

```json
{
  "id": "custom-branding",
  "title": "Custom Branding Suite",
  "description": "White-label your platform with custom logos, colors, and domain",
  "category": "branding",
  "requiresPaid": true,
  "entitlement": "custom_branding",
  "price": 0,
  "icon": "🎨",
  "verified": true,
  "createdAt": [server timestamp],
  "updatedAt": [server timestamp]
}
```

---

### Item 3: Priority Support Access

**Document ID:** `priority-support`

```json
{
  "id": "priority-support",
  "title": "Priority Support Access",
  "description": "24/7 priority support with dedicated account manager",
  "category": "support",
  "requiresPaid": true,
  "entitlement": "priority_support",
  "price": 0,
  "icon": "🆘",
  "verified": true,
  "createdAt": [server timestamp],
  "updatedAt": [server timestamp]
}
```

---

### Item 4: Unlimited API Access

**Document ID:** `api-unlimited`

```json
{
  "id": "api-unlimited",
  "title": "Unlimited API Access",
  "description": "Remove rate limits and get unlimited API calls",
  "category": "api",
  "requiresPaid": true,
  "entitlement": "advanced_analytics",
  "price": 0,
  "icon": "🚀",
  "verified": true,
  "createdAt": [server timestamp],
  "updatedAt": [server timestamp]
}
```

---

### Item 5: Data Export Tools

**Document ID:** `export-tools`

```json
{
  "id": "export-tools",
  "title": "Data Export Tools",
  "description": "Export your data in multiple formats (CSV, JSON, Excel)",
  "category": "tools",
  "requiresPaid": true,
  "entitlement": "advanced_analytics",
  "price": 0,
  "icon": "📤",
  "verified": true,
  "createdAt": [server timestamp],
  "updatedAt": [server timestamp]
}
```

---

## 📋 Field Types Reference

When adding fields in Firestore Console:

| Field Name | Type | Value |
|------------|------|-------|
| id | string | Document ID value |
| title | string | Item title |
| description | string | Item description |
| category | string | analytics, branding, support, api, tools |
| requiresPaid | boolean | true |
| entitlement | string | advanced_analytics, custom_branding, priority_support |
| price | number | 0 |
| icon | string | Emoji character |
| verified | boolean | true |
| createdAt | timestamp | [Click "Add server timestamp"] |
| updatedAt | timestamp | [Click "Add server timestamp"] |

---

## 🎯 Entitlement Mapping

Items are gated by these entitlements (from billing plans):

### Trial Plan
- No paid marketplace access
- `marketplacePaid: false`

### Starter Plan ($9/month)
- Basic marketplace access
- `marketplacePaid: false` (can change to true if desired)
- Entitlements: `["priority_support"]`

### Pro Plan ($29/month)
- Full marketplace access
- `marketplacePaid: true`
- Entitlements: `["priority_support", "advanced_analytics", "custom_branding"]`

---

## 🧪 Testing Access Control

### Test 1: Free User (Trial Plan)
```javascript
// Should be denied
const result = await checkMarketplaceAccess({ itemId: 'analytics-pro' });
// Expected: { allowed: false, reason: 'Missing advanced_analytics' }
```

### Test 2: Starter User
```javascript
// Should be denied for analytics-pro
const result = await checkMarketplaceAccess({ itemId: 'analytics-pro' });
// Expected: { allowed: false, reason: 'Missing advanced_analytics' }

// Should be allowed for priority-support
const result2 = await checkMarketplaceAccess({ itemId: 'priority-support' });
// Expected: { allowed: true }
```

### Test 3: Pro User
```javascript
// Should be allowed for all items
const result = await checkMarketplaceAccess({ itemId: 'analytics-pro' });
// Expected: { allowed: true }
```

---

## 🚀 Quick Test Commands

### Check if items exist:
```bash
# Using gcloud (if authenticated)
gcloud firestore documents list ops_marketplace_paid --project from-zero-84253
```

### Test from Cloud Functions:
```bash
# Test marketplace access (replace TOKEN with Firebase ID token)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://us-central1-from-zero-84253.cloudfunctions.net/checkMarketplaceAccess" \
  -d '{"data":{"itemId":"analytics-pro"}}'
```

---

## ✅ Verification Checklist

After adding items:

- [ ] All 5 items created in `ops_marketplace_paid` collection
- [ ] All fields have correct types (string, boolean, number, timestamp)
- [ ] `requiresPaid` is set to `true` for all items
- [ ] Entitlement fields match plan definitions
- [ ] `verified` is `true` for all items
- [ ] Icons display correctly (emoji characters)

---

## 🔧 Alternative: Import via Firebase CLI

If you have gcloud authenticated, you can try:

```bash
# Set GOOGLE_APPLICATION_CREDENTIALS first
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"

# Then run seed script
node scripts/seed-marketplace-paid.js
```

Or use Firebase Emulator for local testing:

```bash
firebase emulators:start --only firestore
# Then run seed script against emulator
```

---

**Next:** Test marketplace access control from your frontend application!
