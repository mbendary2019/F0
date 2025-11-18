# Phase 45.2 - دليل الاختبار السريع 🧪

## 📋 ملخص سريع

تم نشر 3 دوال جديدة لإدارة السوق المدفوعة والمزامنة الليلية:
1. ✅ `reconcileSubscriptions` - مزامنة ليلية (03:00)
2. ✅ `checkMarketplaceAccess` - التحقق من الصلاحيات
3. ✅ `installPaidItem` - تثبيت العناصر المدفوعة

---

## 🛍️ 1. إعداد عناصر السوق

### إضافة عنصر تجريبي في Firestore

**المسار:** `ops_marketplace_paid/analytics-pro`

```json
{
  "id": "analytics-pro",
  "title": "Analytics Pro Pack",
  "description": "Advanced analytics and reporting",
  "category": "analytics",
  "requiresPaid": true,
  "entitlement": "advanced_analytics",
  "price": 0,
  "icon": "📊",
  "verified": true
}
```

**خطوات الإضافة اليدوية:**
1. افتح [Firestore Console](https://console.firebase.google.com/project/from-zero-84253/firestore)
2. انتقل إلى `ops_marketplace_paid` (أنشئها إذا لم تكن موجودة)
3. أضف Document بـ ID: `analytics-pro`
4. أضف الحقول أعلاه (تأكد من النوع الصحيح لكل حقل)

---

## 🧪 2. اختبار checkMarketplaceAccess

### من Firebase Console (Test Function):

**URL:**
```
https://us-central1-from-zero-84253.cloudfunctions.net/checkMarketplaceAccess
```

### اختبار 1: مستخدم بدون صلاحيات
```javascript
// في متصفح الواجهة (Frontend)
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const checkAccess = httpsCallable(functions, 'checkMarketplaceAccess');

// اختبر مع مستخدم Trial
const result = await checkAccess({ itemId: 'analytics-pro' });
console.log(result.data);

// النتيجة المتوقعة:
// {
//   allowed: false,
//   requiredEntitlement: 'advanced_analytics',
//   reason: 'Missing advanced_analytics'
// }
```

### اختبار 2: مستخدم Pro (لديه صلاحيات)

**الخطوات:**
1. سجل دخول بمستخدم لديه خطة Pro
2. تأكد أن `ops_user_plans/{uid}` يحتوي على:
   ```json
   {
     "entitlements": ["advanced_analytics"],
     "limits": { "marketplacePaid": true }
   }
   ```
3. نفذ نفس الكود أعلاه

**النتيجة المتوقعة:**
```json
{
  "allowed": true,
  "reason": "User has entitlement"
}
```

---

## 📦 3. اختبار installPaidItem

### شرط الاختبار:
- المستخدم لديه الصلاحية المطلوبة (`advanced_analytics`)
- العنصر موجود في `ops_marketplace_paid`

### كود الاختبار:
```javascript
const installItem = httpsCallable(functions, 'installPaidItem');

try {
  const result = await installItem({ itemId: 'analytics-pro' });
  console.log('✅ نجح التثبيت:', result.data);
  // { success: true, item: { id, title, description } }
} catch (error) {
  console.error('❌ فشل التثبيت:', error.message);
  // "This item requires the 'advanced_analytics' entitlement..."
}
```

### التحقق من النتيجة:

1. **في Firestore - ops_installs:**
   ```
   Document ID: {uid}_analytics-pro
   ```
   ```json
   {
     "uid": "user123",
     "itemId": "analytics-pro",
     "itemTitle": "Analytics Pro Pack",
     "installedAt": "2025-10-12T...",
     "status": "active"
   }
   ```

2. **في Firestore - ops_audit:**
   ```json
   {
     "action": "install_paid_item",
     "uid": "user123",
     "itemId": "analytics-pro",
     "requiresPaid": true,
     "ts": "2025-10-12T..."
   }
   ```

---

## 🔄 4. اختبار reconcileSubscriptions

### الاختبار التلقائي:
- ستعمل الدالة تلقائياً غداً الساعة 03:00 (توقيت الكويت)

### الاختبار اليدوي (عبر Cloud Scheduler):

```bash
# عرض الجدولة
gcloud scheduler jobs list --project from-zero-84253

# تشغيل يدوي (اختياري)
gcloud scheduler jobs run reconcileSubscriptions --project from-zero-84253
```

### مراقبة اللوقات:
```bash
firebase functions:log --only reconcileSubscriptions --lines 50
```

**النتيجة المتوقعة:**
```
[reconcile] Starting nightly reconciliation
[reconcile] User subscription check { uid: 'abc123', status: 'active' }
[reconcile] Fixing plan mismatch { uid: 'abc123', currentPlan: 'trial', newPlan: 'starter' }
[reconcile] Reconciliation complete { reconciled: 3, errors: 0 }
```

---

## 📊 5. سيناريوهات الاختبار الكاملة

### سيناريو 1: مستخدم Free يحاول التثبيت ❌

**الإعداد:**
```javascript
// ops_user_plans/{uid}
{
  "plan": "trial",
  "entitlements": [],
  "limits": { "marketplacePaid": false }
}
```

**الاختبار:**
```javascript
// 1. التحقق من الصلاحية
const access = await checkMarketplaceAccess({ itemId: 'analytics-pro' });
// ✅ النتيجة: { allowed: false }

// 2. محاولة التثبيت
try {
  await installPaidItem({ itemId: 'analytics-pro' });
} catch (error) {
  // ✅ النتيجة: "Requires advanced_analytics entitlement..."
  console.error(error.message);
}
```

---

### سيناريو 2: مستخدم Starter (صلاحيات محدودة)

**الإعداد:**
```javascript
// ops_user_plans/{uid}
{
  "plan": "starter",
  "entitlements": ["priority_support"],
  "limits": { "marketplacePaid": false }
}
```

**الاختبار:**
```javascript
// العنصر 1: Priority Support (متاح)
const access1 = await checkMarketplaceAccess({ itemId: 'priority-support' });
// ✅ { allowed: true }

await installPaidItem({ itemId: 'priority-support' });
// ✅ نجح التثبيت

// العنصر 2: Analytics Pro (غير متاح)
const access2 = await checkMarketplaceAccess({ itemId: 'analytics-pro' });
// ✅ { allowed: false, requiredEntitlement: 'advanced_analytics' }

try {
  await installPaidItem({ itemId: 'analytics-pro' });
} catch (error) {
  // ✅ "Missing advanced_analytics"
}
```

---

### سيناريو 3: مستخدم Pro (صلاحيات كاملة) ✅

**الإعداد:**
```javascript
// ops_user_plans/{uid}
{
  "plan": "pro",
  "entitlements": ["priority_support", "advanced_analytics", "custom_branding"],
  "limits": { "marketplacePaid": true }
}
```

**الاختبار:**
```javascript
// جميع العناصر متاحة
const items = ['analytics-pro', 'custom-branding', 'priority-support'];

for (const itemId of items) {
  const access = await checkMarketplaceAccess({ itemId });
  // ✅ { allowed: true }

  const result = await installPaidItem({ itemId });
  // ✅ { success: true }
}
```

---

## 🔍 6. التحقق من النتائج

### في Firestore Console:

1. **ops_installs** - سجلات التثبيت:
   ```
   {uid}_analytics-pro
   {uid}_custom-branding
   {uid}_priority-support
   ```

2. **ops_audit** - سجل المراجعة:
   ```
   action: "install_paid_item"
   action: "reconcile_subscriptions"
   ```

3. **ops_user_plans** - تحديثات الخطط:
   ```
   updatedAt: [آخر تحديث من reconcile]
   ```

---

## 🚨 7. استكشاف الأخطاء

### خطأ: "Login required"
**الحل:** تأكد من تسجيل دخول المستخدم قبل الاستدعاء

### خطأ: "Item not found"
**الحل:** تحقق من وجود العنصر في `ops_marketplace_paid/{itemId}`

### خطأ: "Requires ... entitlement"
**الحل:** المستخدم لا يملك الصلاحية المطلوبة - يحتاج ترقية الخطة

### خطأ: "Permission denied" في Firestore
**الحل:** تحقق من نشر `firestore.rules` الجديدة

---

## ✅ قائمة تحقق الاختبار

- [ ] عنصر واحد على الأقل في `ops_marketplace_paid`
- [ ] اختبار `checkMarketplaceAccess` مع مستخدم free
- [ ] اختبار `checkMarketplaceAccess` مع مستخدم pro
- [ ] اختبار `installPaidItem` (نجاح)
- [ ] اختبار `installPaidItem` (رفض - بدون صلاحية)
- [ ] التحقق من سجل `ops_installs`
- [ ] التحقق من سجل `ops_audit`
- [ ] مراقبة `reconcileSubscriptions` غداً الساعة 03:00

---

## 📞 أوامر المراقبة السريعة

```bash
# لوقات جميع دوال Phase 45.2
firebase functions:log --only reconcileSubscriptions,checkMarketplaceAccess,installPaidItem

# التحقق من حالة الدوال
firebase functions:list | grep -E "reconcile|marketplace|install"

# عرض آخر 20 سطر من لوقات المزامنة
firebase functions:log --only reconcileSubscriptions --lines 20
```

---

**جاهز للاختبار!** 🚀

ابدأ بإضافة عنصر واحد في `ops_marketplace_paid` ثم اختبر التدفق الكامل من الواجهة.
