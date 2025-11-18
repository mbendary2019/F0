# 🔐 دليل إعداد Paywall والصلاحيات

## المشكلة
صفحة Incidents محمية بـ Paywall أو EntitlementGate وتتطلب صلاحيات معينة.

---

## الحل 1: إعداد Claims على Emulator (موصى به)

### الخطوات:

#### 1. افتح Auth Emulator
```
http://localhost:4000/auth
```

#### 2. اختر المستخدم الحالي
- ابحث عن المستخدم الذي تستخدمه
- اضغط **Edit**

#### 3. أضف Custom Claims
في حقل **Custom Claims**، ضع:

```json
{
  "admin": true,
  "pro": true,
  "entitlements": {
    "developers": true,
    "ops": true,
    "incidents": true
  }
}
```

**ملاحظة:** اختر الـ claims التي يحتاجها مشروعك:
- `admin` - صلاحيات إدارة كاملة
- `pro` - اشتراك Pro
- `entitlements` - صلاحيات محددة لكل قسم

#### 4. احفظ وأعد تسجيل الدخول
- اضغط **Save**
- سجّل خروج من التطبيق
- سجّل دخول مرة أخرى
- أو امسح Cookies وأعد تحميل الصفحة

---

## الحل 2: تعطيل Paywall محلياً

### الطريقة 1: عبر Environment Variables

أضف في [.env.local](.env.local):

```bash
# تعطيل Paywall محلياً
NEXT_PUBLIC_REQUIRE_SUBSCRIPTION=false
NEXT_PUBLIC_DISABLE_BILLING=1
NEXT_PUBLIC_DISABLE_PAYWALL=1

# أو تفعيل وضع التطوير
NEXT_PUBLIC_DEV_MODE=true
```

### الطريقة 2: تعديل Paywall Component مؤقتاً

إذا كان عندك `src/components/Paywall.tsx`:

```typescript
// Development bypass
if (process.env.NODE_ENV === 'development' || 
    process.env.NEXT_PUBLIC_DISABLE_PAYWALL === '1') {
  return <>{children}</>;
}
```

---

## الحل 3: استخدام Dev User خاص

### إنشاء مستخدم تطوير بصلاحيات كاملة

```bash
# إذا كان عندك سكريبت
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
node scripts/create-dev-user.js
```

أو يدوياً من Auth Emulator:
1. افتح http://localhost:4000/auth
2. اضغط **Add User**
3. Email: `dev@test.com`
4. Password: `dev123456`
5. Custom Claims:
```json
{
  "admin": true,
  "pro": true,
  "superAdmin": true,
  "entitlements": {
    "developers": true,
    "ops": true,
    "incidents": true,
    "analytics": true,
    "admin": true
  }
}
```

---

## 🔍 التحقق من الصلاحيات

### من Console المتصفح:

```javascript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

if (user) {
  user.getIdTokenResult().then(token => {
    console.log('All Claims:', token.claims);
    console.log('Is Admin?', token.claims.admin);
    console.log('Is Pro?', token.claims.pro);
    console.log('Entitlements:', token.claims.entitlements);
  });
}
```

**النتيجة المتوقعة:**
```javascript
All Claims: {
  admin: true,
  pro: true,
  entitlements: { developers: true, ops: true, ... }
}
Is Admin? true
Is Pro? true
Entitlements: { developers: true, ops: true, incidents: true }
```

---

## 📋 Claims المطلوبة حسب الصفحة

| الصفحة | Claims المطلوبة |
|--------|-----------------|
| `/ops/incidents` | `admin: true` أو `entitlements.ops: true` |
| `/developers` | `entitlements.developers: true` |
| `/admin/*` | `admin: true` |
| `/analytics` | `entitlements.analytics: true` |
| `/org/*` | عضوية في Organization |

---

## 🛠️ Component Examples

### EntitlementGate
```typescript
// src/components/EntitlementGate.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { ReactNode } from 'react';

export default function EntitlementGate({
  children,
  feature,
  fallback,
}: {
  children: ReactNode;
  feature: string;
  fallback?: ReactNode;
}) {
  const { user, claims } = useAuth();

  // Development bypass
  if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
    return <>{children}</>;
  }

  // Check entitlements
  if (!user || !claims?.entitlements?.[feature]) {
    return fallback || <div>ليس لديك صلاحية الوصول</div>;
  }

  return <>{children}</>;
}
```

### Usage في الصفحات:
```typescript
// src/app/[locale]/ops/incidents/page.tsx
import EntitlementGate from '@/components/EntitlementGate';

export default function IncidentsPage() {
  return (
    <EntitlementGate
      feature="ops"
      fallback={<div>يجب أن تكون Admin للوصول</div>}
    >
      <IncidentsDashboard />
    </EntitlementGate>
  );
}
```

---

## 🐛 استكشاف الأخطاء

### المشكلة: "Access Denied" أو "Requires Subscription"

**الأسباب المحتملة:**

#### 1. Claims غير صحيحة
**تحقق:**
```javascript
// في Console
getAuth().currentUser.getIdTokenResult().then(t => console.log(t.claims))
```

**الحل:** أضف Claims المطلوبة في Auth Emulator

#### 2. Token لم يتجدد
**الحل:**
```javascript
// Force token refresh
getAuth().currentUser.getIdToken(true)
  .then(() => location.reload());
```

#### 3. Paywall Component يتحقق من Subscription
**الحل المؤقت:**
```bash
# في .env.local
NEXT_PUBLIC_DISABLE_PAYWALL=1
```

---

### المشكلة: التعديلات لا تظهر

**الحل:**
```bash
# 1. أعد تشغيل dev server
pnpm dev

# 2. امسح cache المتصفح
Ctrl + Shift + R

# 3. سجّل خروج/دخول
```

---

### المشكلة: "Entitlements undefined"

**السبب:** Claims object فارغ

**الحل:**
```json
// تأكد من structure صحيح في Claims:
{
  "admin": true,
  "entitlements": {
    "ops": true
  }
}

// ❌ خطأ:
{
  "admin": true,
  "ops": true
}
```

---

## 📝 ملاحظات للإنتاج

### ⚠️ تحذير مهم:

**لا تعطّل Paywall في الإنتاج!**

هذه الطرق للتطوير المحلي فقط.

### الطريقة الآمنة للإنتاج:

#### 1. Cloud Function لإدارة الصلاحيات
```typescript
// functions/src/admin/setEntitlements.ts
export const setUserEntitlements = functions.https.onCall(
  async (data, context) => {
    // Verify caller is admin
    if (!context.auth?.token.admin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can set entitlements'
      );
    }

    const { uid, entitlements } = data;
    
    // Set custom claims
    await admin.auth().setCustomUserClaims(uid, {
      entitlements,
      updatedAt: Date.now(),
    });

    // Log to audit trail
    await admin.firestore().collection('audit_log').add({
      action: 'set_entitlements',
      actor: context.auth.uid,
      target: uid,
      entitlements,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);
```

#### 2. Stripe Webhook لتفعيل Claims
```typescript
// عند نجاح الدفع
if (event.type === 'checkout.session.completed') {
  const customerId = session.customer;
  const uid = session.metadata.uid;

  // Set pro claim
  await admin.auth().setCustomUserClaims(uid, {
    pro: true,
    stripeCustomerId: customerId,
    subscriptionTier: 'pro',
  });
}
```

#### 3. Database Rules للتحقق
```javascript
// firestore.rules
match /ops_incidents/{doc} {
  allow read: if request.auth != null &&
    (request.auth.token.admin == true ||
     request.auth.token.entitlements.ops == true);
}
```

---

## 🎯 Quick Reference

### Claims Structure
```json
{
  "admin": true,
  "superAdmin": false,
  "pro": true,
  "subscriptionTier": "pro",
  "entitlements": {
    "developers": true,
    "ops": true,
    "incidents": true,
    "analytics": true,
    "admin": false
  },
  "orgId": "org_123456",
  "role": "owner"
}
```

### Environment Variables
```bash
# Development
NEXT_PUBLIC_DEV_MODE=true
NEXT_PUBLIC_DISABLE_PAYWALL=1
NEXT_PUBLIC_REQUIRE_SUBSCRIPTION=false

# Production (never disable!)
NEXT_PUBLIC_DEV_MODE=false
NEXT_PUBLIC_DISABLE_PAYWALL=0
NEXT_PUBLIC_REQUIRE_SUBSCRIPTION=true
```

---

## ✅ Checklist

- [ ] فتحت Auth Emulator
- [ ] أضفت Claims المطلوبة
- [ ] سجّلت خروج/دخول
- [ ] تحققت من Claims في Console
- [ ] الصفحة تحمّل بدون "Access Denied"
- [ ] يمكنني رؤية البيانات
- [ ] الأزرار تعمل

---

## 🔗 روابط سريعة

- [Auth Emulator](http://localhost:4000/auth) - إدارة المستخدمين
- [ADMIN_CLAIMS_SETUP.md](ADMIN_CLAIMS_SETUP.md) - دليل Admin Claims
- [.env.local](.env.local) - Environment Variables

---

**الآن Dashboard يجب أن يعمل بدون مشاكل!** 🎉
