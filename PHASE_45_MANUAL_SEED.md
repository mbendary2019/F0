# Phase 45 - إدخال البيانات يدوياً

## ⚠️ Seed Script فشل بسبب ADC

نظراً لعدم توفر Application Default Credentials، يمكنك إدخال البيانات يدوياً عبر Firebase Console.

---

## 📝 الخطوات

### 1. افتح Firestore في Firebase Console
```
https://console.firebase.google.com/project/from-zero-84253/firestore
```

### 2. أنشئ Collection جديد
**Collection ID:** `ops_billing_plans`

---

## 📦 البيانات المطلوبة

### Document 1: `trial`
```json
{
  "id": "trial",
  "title": "Trial",
  "price": 0,
  "interval": "month",
  "stripePriceId": "",
  "limits": {
    "dailyQuota": 500,
    "marketplacePaid": false
  },
  "entitlements": [],
  "createdAt": "2025-10-12T18:45:00.000Z"
}
```

**خطوات الإدخال:**
1. اضغط "Start collection"
2. Collection ID: `ops_billing_plans`
3. Document ID: `trial`
4. أضف الحقول التالية:

| Field | Type | Value |
|-------|------|-------|
| `id` | string | `trial` |
| `title` | string | `Trial` |
| `price` | number | `0` |
| `interval` | string | `month` |
| `stripePriceId` | string | (فارغ) |
| `limits` | map | ↓ |
| `limits.dailyQuota` | number | `500` |
| `limits.marketplacePaid` | boolean | `false` |
| `entitlements` | array | (فارغ) |
| `createdAt` | timestamp | الآن |

---

### Document 2: `starter`
```json
{
  "id": "starter",
  "title": "Starter",
  "price": 9,
  "interval": "month",
  "stripePriceId": "price_1SH2QsLYNFMhXeTeuOtumXG9",
  "limits": {
    "dailyQuota": 5000,
    "marketplacePaid": false
  },
  "entitlements": [
    "priority_support"
  ],
  "createdAt": "2025-10-12T18:45:00.000Z"
}
```

**خطوات الإدخال:**
1. في `ops_billing_plans` collection
2. اضغط "Add document"
3. Document ID: `starter`
4. أضف الحقول:

| Field | Type | Value |
|-------|------|-------|
| `id` | string | `starter` |
| `title` | string | `Starter` |
| `price` | number | `9` |
| `interval` | string | `month` |
| `stripePriceId` | string | `price_1SH2QsLYNFMhXeTeuOtumXG9` |
| `limits` | map | ↓ |
| `limits.dailyQuota` | number | `5000` |
| `limits.marketplacePaid` | boolean | `false` |
| `entitlements` | array | ↓ |
| `entitlements[0]` | string | `priority_support` |
| `createdAt` | timestamp | الآن |

---

### Document 3: `pro`
```json
{
  "id": "pro",
  "title": "Pro",
  "price": 29,
  "interval": "month",
  "stripePriceId": "price_1SH2QsLYNFMhXeTeuOtumXG9",
  "limits": {
    "dailyQuota": 50000,
    "marketplacePaid": true
  },
  "entitlements": [
    "priority_support",
    "marketplace_paid",
    "advanced_analytics",
    "custom_branding"
  ],
  "createdAt": "2025-10-12T18:45:00.000Z"
}
```

**خطوات الإدخال:**
1. في `ops_billing_plans` collection
2. اضغط "Add document"
3. Document ID: `pro`
4. أضف الحقول:

| Field | Type | Value |
|-------|------|-------|
| `id` | string | `pro` |
| `title` | string | `Pro` |
| `price` | number | `29` |
| `interval` | string | `month` |
| `stripePriceId` | string | `price_1SH2QsLYNFMhXeTeuOtumXG9` |
| `limits` | map | ↓ |
| `limits.dailyQuota` | number | `50000` |
| `limits.marketplacePaid` | boolean | `true` |
| `entitlements` | array | ↓ |
| `entitlements[0]` | string | `priority_support` |
| `entitlements[1]` | string | `marketplace_paid` |
| `entitlements[2]` | string | `advanced_analytics` |
| `entitlements[3]` | string | `custom_branding` |
| `createdAt` | timestamp | الآن |

---

## 📦 Paid Marketplace Items (اختياري)

### Collection: `ops_marketplace_paid`

#### Document 1: `analytics-pro`
```json
{
  "id": "analytics-pro",
  "title": "Analytics Pro",
  "description": "Advanced analytics dashboard with custom reports",
  "category": "analytics",
  "price": 0,
  "requiresPaid": true,
  "entitlement": "advanced_analytics",
  "icon": "📊",
  "verified": true,
  "createdAt": "2025-10-12T18:45:00.000Z"
}
```

#### Document 2: `custom-branding-pack`
```json
{
  "id": "custom-branding-pack",
  "title": "Custom Branding Pack",
  "description": "White-label your instance with custom branding",
  "category": "branding",
  "price": 0,
  "requiresPaid": true,
  "entitlement": "custom_branding",
  "icon": "🎨",
  "verified": true,
  "createdAt": "2025-10-12T18:45:00.000Z"
}
```

---

## ✅ التحقق

بعد الإدخال، تحقق من:

1. **عدد Documents:** يجب أن ترى 3 documents في `ops_billing_plans`
2. **stripePriceId:** تأكد من تحديث القيم بـ price IDs الحقيقية من Stripe Dashboard
3. **Security Rules:** تحقق من أن القراءة public والكتابة admin only

### كيف تحصل على Stripe Price IDs:

1. اذهب إلى [Stripe Dashboard - Products](https://dashboard.stripe.com/test/products)
2. أنشئ منتجات جديدة إذا لم تكن موجودة:
   - **Starter Plan:** $9/month
   - **Pro Plan:** $29/month
3. انسخ Price ID لكل خطة (يبدأ بـ `price_...`)
4. حدّث `stripePriceId` في Firestore

---

## 🔄 البديل: استخدام REST API

إذا كنت تفضل، يمكنك استخدام curl:

```bash
# احصل على access token
firebase login:ci

# ثم استخدم Firestore REST API
curl -X POST \
  "https://firestore.googleapis.com/v1/projects/from-zero-84253/databases/(default)/documents/ops_billing_plans" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "id": {"stringValue": "trial"},
      "title": {"stringValue": "Trial"},
      "price": {"integerValue": "0"}
    }
  }'
```

---

## 📞 المساعدة

إذا واجهت مشاكل:
1. تحقق من [Firebase Console](https://console.firebase.google.com/project/from-zero-84253/firestore)
2. راجع [Firestore Rules](https://console.firebase.google.com/project/from-zero-84253/firestore/rules)
3. تحقق من Logs: `firebase functions:log`

---

**بمجرد إدخال البيانات، انتقل إلى اختبار Checkout!** 🚀
