# 🔐 إعداد Admin Claims للـ Emulator

## المشكلة
لوحة الـ Incidents فارغة أو الأزرار (Acknowledge/Resolve) معطّلة لأن المستخدم ليس لديه صلاحيات Admin.

## الحل السريع

### الطريقة 1: عبر Emulator UI (موصى بها)

#### الخطوات:
1. **افتح Auth Emulator UI:**
   ```
   http://localhost:4000/auth
   ```

2. **ابحث عن المستخدم:**
   - سترى قائمة بالمستخدمين المُسجّلين
   - اختر المستخدم الذي تريد إعطاءه صلاحيات Admin

3. **عدّل Custom Claims:**
   - اضغط على المستخدم → زر **Edit**
   - في حقل **Custom Claims** ضع:
   ```json
   {"admin": true}
   ```
   - اضغط **Save**

4. **سجّل خروج/دخول:**
   - في تطبيق الويب: سجّل خروج ثم دخول مرة أخرى
   - أو: امسح Session/Cookies وأعد تسجيل الدخول

5. **حدّث الصفحة:**
   ```
   http://localhost:3000/ar/ops/incidents
   ```

---

### الطريقة 2: عبر Firebase CLI

```bash
# Set project to use emulator
export FIRESTORE_EMULATOR_HOST=localhost:8080
export FIREBASE_AUTH_EMULATOR_HOST=localhost:9099

# Get user UID first (check in Emulator UI or from your app)
# Then set custom claims (requires admin SDK script)
```

**ملاحظة:** هذه الطريقة تحتاج سكريبت Node.js مع Admin SDK.

---

### الطريقة 3: عبر سكريبت Node.js (الأفضل للأتمتة)

إذا كان لديك سكريبت مثل `scripts/set-admin.js`:

```bash
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
node scripts/set-admin.js "user@example.com"
```

أو إذا كان السكريبت بـ mjs:
```bash
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
node scripts/set-admin.mjs "user@example.com"
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
    console.log('Custom Claims:', token.claims);
    console.log('Is Admin?', token.claims.admin === true);
  });
}
```

**النتيجة المتوقعة:**
```javascript
Custom Claims: { admin: true, ... }
Is Admin? true
```

---

## 📋 Firestore Rules للـ Incidents

الـ Rules تتحقق من `admin` claim:

```javascript
// firestore.rules
match /ops_incidents/{incidentId} {
  // Read: يحتاج admin
  allow read: if request.auth != null && 
                 request.auth.token.admin == true;
  
  // Update (Acknowledge/Resolve): يحتاج admin
  allow update: if request.auth != null && 
                   request.auth.token.admin == true;
}
```

---

## 🐛 استكشاف الأخطاء

### المشكلة: "Permission denied" في Console
**السبب:** المستخدم ليس لديه `admin: true` claim

**الحل:**
1. افتح Auth Emulator UI
2. تأكد من `{"admin": true}` في Custom Claims
3. سجّل خروج/دخول
4. حدّث الصفحة

---

### المشكلة: Claims لا تتحدث بعد التعديل
**السبب:** Token لم يتجدد

**الحل:**
```javascript
// Force token refresh
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

if (user) {
  user.getIdToken(true).then(token => {
    console.log('Token refreshed!');
    location.reload(); // Reload page
  });
}
```

---

### المشكلة: الجدول ما زال فارغاً
**الأسباب المحتملة:**

#### 1. لا توجد بيانات
**تحقق:**
```bash
# افتح Firestore Emulator
open http://localhost:4000/firestore

# ابحث عن ops_incidents
# يجب أن يحتوي على مستندات
```

**الحل:** شغّل سكريبت التوليد:
```bash
./seed-incidents.sh
```

#### 2. Trigger لم يعمل
**تحقق:**
```bash
# تأكد من أن ops_events موجودة لكن ops_incidents فارغة
```

**الحل:**
```bash
cd functions
npm run build
# أعد تشغيل Emulator
```

#### 3. Network Error
**تحقق:** افتح Console المتصفح (F12)

**الحل:** تأكد من أن Firestore Emulator مشغل:
```bash
curl http://localhost:8080
```

---

## 🎯 الاختبار السريع

### 1. تأكد من Admin Claims
```bash
# افتح Auth Emulator
open http://localhost:4000/auth

# تحقق من المستخدم → Custom Claims
# يجب أن ترى: {"admin": true}
```

### 2. أرسل أخطاء جديدة
```bash
./seed-incidents.sh
```

### 3. افتح Dashboard
```bash
open http://localhost:3000/ar/ops/incidents
```

### 4. يجب أن ترى:
- ✅ قائمة incidents
- ✅ أزرار Acknowledge/Resolve مُفعّلة
- ✅ لا "Permission denied" errors

---

## 📝 ملاحظات للإنتاج

### ⚠️ تحذير:
**لا تضع `admin: true` يدوياً في الإنتاج!**

### الطريقة الآمنة:
1. **إنشاء Cloud Function:**
```typescript
// functions/src/admin/setAdmin.ts
export const setAdminRole = functions.https.onCall(async (data, context) => {
  // Verify caller is super admin
  if (!context.auth?.token.superAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only super admins can set admin role'
    );
  }

  const { uid } = data;
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  
  return { message: `Admin role set for ${uid}` };
});
```

2. **استخدام Admin Dashboard:**
   - إنشاء صفحة `/admin/users` محمية
   - فقط Super Admins يمكنهم الوصول
   - واجهة لإدارة صلاحيات المستخدمين

3. **Audit Logging:**
   - تسجيل كل تغيير في الصلاحيات
   - من غيّر، متى، لمن

---

## 🔗 روابط سريعة

| الرابط | الوصف |
|--------|-------|
| http://localhost:4000/auth | Auth Emulator UI |
| http://localhost:4000/firestore | Firestore Emulator UI |
| http://localhost:3000/ar/ops/incidents | Incidents Dashboard |
| http://localhost:3000/test-toast | صفحة الاختبار |

---

## ✅ Checklist

- [ ] فتحت Auth Emulator UI
- [ ] وجدت المستخدم
- [ ] أضفت `{"admin": true}` في Custom Claims
- [ ] سجّلت خروج/دخول
- [ ] حدّثت صفحة Incidents
- [ ] الجدول يعرض البيانات
- [ ] الأزرار مُفعّلة

إذا اكتملت جميع النقاط، Dashboard جاهز! 🎉
