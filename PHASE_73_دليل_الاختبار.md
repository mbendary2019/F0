# Phase 73: دليل اختبار نظام الخزنة (Vault) للمتغيرات البيئية

## ✅ تم الانتهاء من التنفيذ

تم بناء نظام آمن لإدارة المتغيرات البيئية مع فصل البيانات الوصفية (metadata) عن القيم السرية (vault).

## الملفات المُنشأة/المُحدّثة

### Backend (Cloud Functions)
1. ✅ `functions/src/projects/env.ts` - وظائف حفظ وحذف المتغيرات
2. ✅ `functions/src/index.ts` - إضافة exports للوظائف الجديدة

### Frontend
3. ✅ `src/lib/firebase/functions/envFunctions.ts` - Helper functions للاتصال بالـ Cloud Functions
4. ✅ `src/features/projects/hooks/useProjectEnvVars.ts` - Hook محدّث باستخدام الـ Vault
5. ✅ `src/app/[locale]/projects/[id]/settings/page.tsx` - واجهة محدّثة

### Security
6. ✅ `firestore.rules` - قواعد Firestore للحماية

---

## كيفية الاختبار

### الخطوة 1: تشغيل المحاكيات (Emulators)

```bash
# في Terminal جديد
cd /Users/abdo/Desktop/from-zero-working
firebase emulators:start --only auth,firestore,functions
```

انتظر حتى تظهر رسالة:
```
✔  All emulators ready!
```

### الخطوة 2: تشغيل Next.js

```bash
# في Terminal آخر
cd /Users/abdo/Desktop/from-zero-working
PORT=3030 pnpm dev
```

### الخطوة 3: فتح صفحة إعدادات المشروع

1. افتح المتصفح: http://localhost:3030
2. سجل دخول بحساب تجريبي
3. اذهب لأي مشروع
4. اضغط على "إعدادات المشروع" أو توجه مباشرة لـ:
   ```
   http://localhost:3030/ar/projects/{PROJECT_ID}/settings
   ```

### الخطوة 4: اختبار إضافة متغير جديد

في قسم "Environment Variables":

1. **KEY**: `NEXT_PUBLIC_API_URL`
2. **القيمة**: `https://api.example.com/v1`
3. **Scope**: `Client (PUBLIC)`
4. **ملاحظة**: `API endpoint للمشروع`
5. اضغط **إضافة**

**النتيجة المتوقعة**:
- ✅ ظهور toast بنجاح: "تم إضافة المتغير"
- ✅ ظهور المتغير في القائمة بصيغة: `••••/v1`
- ✅ عرض الـ scope كـ badge
- ✅ ظهور الملاحظة إذا كانت موجودة

### الخطوة 5: التحقق من Firestore

افتح Firestore Emulator UI: http://localhost:4000/firestore

#### تحقق من Metadata:
```
ops_projects/{projectId}/envVars/{envVarId}
```

يجب أن تجد:
```json
{
  "key": "NEXT_PUBLIC_API_URL",
  "scope": "client",
  "note": "API endpoint للمشروع",
  "vaultPath": "vault/projects/{projectId}/envVars/{envVarId}",
  "last4": "/v1",
  "createdAt": "...",
  "updatedAt": "...",
  "createdBy": "uid..."
}
```

#### تحقق من Vault:
```
vault/projects/{projectId}/envVars/{envVarId}
```

يجب أن تجد:
```json
{
  "value": "https://api.example.com/v1",
  "last4": "/v1",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### الخطوة 6: اختبار الحذف

1. اضغط على أيقونة الحذف 🗑️ بجانب المتغير
2. أكد الحذف

**النتيجة المتوقعة**:
- ✅ ظهور toast: "تم حذف المتغير"
- ✅ اختفاء المتغير من القائمة
- ✅ حذف كل من metadata و vault من Firestore

### الخطوة 7: اختبار Scopes المختلفة

أضف 3 متغيرات:

1. **Server only**:
   - KEY: `DATABASE_URL`
   - Value: `postgres://localhost:5432/mydb`
   - Scope: `Server only`

2. **Client (PUBLIC)**:
   - KEY: `NEXT_PUBLIC_APP_NAME`
   - Value: `My Awesome App`
   - Scope: `Client (PUBLIC)`

3. **Shared**:
   - KEY: `API_VERSION`
   - Value: `v2.0.0`
   - Scope: `Shared`

تحقق أن كل scope يظهر بشكل صحيح في الـ badge.

---

## اختبار الأمان (Security Testing)

### اختبار 1: منع الكتابة من الـ Client

جرب في Console المتصفح:

```javascript
// يجب أن يفشل - الكتابة ممنوعة من Client
const { setDoc, doc } = await import('firebase/firestore');
const { db } = await import('/src/lib/firebase.ts');

await setDoc(doc(db, 'ops_projects/test-project/envVars/test-var'), {
  key: 'HACK',
  value: 'malicious'
});
```

**النتيجة المتوقعة**:
```
FirebaseError: Missing or insufficient permissions
```

### اختبار 2: منع القراءة من Vault

```javascript
// يجب أن يفشل - القراءة من Vault ممنوعة من Client
const { getDoc, doc } = await import('firebase/firestore');
const { db } = await import('/src/lib/firebase.ts');

const vaultDoc = await getDoc(doc(db, 'vault/projects/test-project/envVars/test-var'));
console.log(vaultDoc.exists()); // false
```

**النتيجة المتوقعة**:
```
FirebaseError: Missing or insufficient permissions
```

### اختبار 3: السماح بقراءة Metadata

```javascript
// يجب أن ينجح - القراءة من metadata مسموحة
const { getDocs, collection } = await import('firebase/firestore');
const { db } = await import('/src/lib/firebase.ts');

const snapshot = await getDocs(
  collection(db, 'ops_projects/test-project/envVars')
);

console.log('Metadata readable:', snapshot.size > 0);
```

**النتيجة المتوقعة**:
```
Metadata readable: true
```

---

## اختبار Cloud Functions

### اختبار Cloud Function مباشرة

في Console المتصفح:

```javascript
const { httpsCallable } = await import('firebase/functions');
const { functions } = await import('/src/lib/firebase.ts');

// اختبار saveProjectEnvVar
const saveEnvVar = httpsCallable(functions, 'saveProjectEnvVar');

const result = await saveEnvVar({
  projectId: 'test-project',
  key: 'TEST_VAR',
  value: 'test-value-123',
  scope: 'server',
  note: 'Test note'
});

console.log('Saved:', result.data);
```

**النتيجة المتوقعة**:
```javascript
{
  envVarId: "generated-id"
}
```

---

## المشاكل المحتملة وحلولها

### مشكلة 1: Functions not found
**الخطأ**: `Function not found: saveProjectEnvVar`

**الحل**:
```bash
# أعد تشغيل الـ Functions Emulator
firebase emulators:start --only functions
```

### مشكلة 2: Permission Denied
**الخطأ**: `Missing or insufficient permissions`

**الحل**:
1. تأكد أنك مسجل دخول
2. تحقق من `firestore.rules`
3. أعد تشغيل Firestore Emulator

### مشكلة 3: last4 لا يظهر
**السبب**: Cloud Function لم يحفظ last4 في metadata

**الحل**: تحقق أن الـ Cloud Function محدّثة بآخر كود

---

## الخلاصة ✅

إذا نجحت جميع الاختبارات أعلاه، فإن **Phase 73** كاملة وجاهزة للإنتاج (بعد تفعيل التشفير).

### ما تم إنجازه:
✅ نظام vault آمن للمتغيرات البيئية
✅ فصل metadata عن القيم السرية
✅ Cloud Functions للكتابة فقط
✅ Firestore Rules تمنع الوصول المباشر للـ vault
✅ واجهة مستخدم محدّثة مع عرض last4
✅ دعم notes و scopes متعددة

### للإنتاج (Production):
⚠️ إضافة تشفير للقيم في الـ vault
⚠️ تفعيل قيود الصلاحيات (permissions)
⚠️ إضافة audit logging
⚠️ مزامنة مع Vercel/Firebase

---

**تاريخ الإنجاز**: 2025-11-17
**المرحلة**: Phase 73
**الحالة**: ✅ جاهز للاختبار
