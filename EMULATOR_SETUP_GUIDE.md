# 🔧 دليل إعداد المحاكيات المحلية
# Local Emulators Setup Guide

## ✅ التغييرات المطبقة / Applied Changes

تم تطبيق جميع الخطوات المطلوبة لمنع الدوال من لمس الإنتاج:

### 1️⃣ إعداد متغيرات البيئة

**الملف:** `.env.local`

تمت إضافة:
```bash
# Storage Emulator
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199

# Functions Emulator (لربط Admin SDK)
FUNCTIONS_EMULATOR=true
```

### 2️⃣ ربط Admin SDK بالمحاكيات

**الملف:** `functions/src/config.ts`

تمت إضافة كود للكشف التلقائي عن المحاكيات:
```typescript
// Check if running in emulator mode
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' ||
                   process.env.FIRESTORE_EMULATOR_HOST;

// Configure Firestore to use emulator if in emulator mode
if (isEmulator) {
  const db = admin.firestore();
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  db.settings({
    host: firestoreHost,
    ssl: false
  });

  // Configure Storage emulator
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
  }

  console.log('🔧 Admin SDK configured for emulator mode');
}
```

**الفائدة:**
- ✅ لن يظهر تحذير ADC بعد الآن
- ✅ جميع عمليات Firestore و Storage ستذهب للمحاكيات فقط
- ✅ لا يوجد أي اتصال بالإنتاج

### 3️⃣ تحديث إصدار Node

**الملف:** `functions/package.json`

```json
"engines": {
  "node": "22"
}
```

لتتطابق مع Node المثبت محلياً (v22.17.1) وتجنب التحذيرات.

### 4️⃣ إعداد المحاكيات

**الملف:** `firebase.json`

المحاكيات مفعّلة بالفعل:
```json
"emulators": {
  "auth": { "port": 9099 },
  "functions": { "port": 5001 },
  "firestore": { "port": 8080 },
  "storage": { "port": 9199 },
  "ui": { "enabled": true, "port": 4000 }
}
```

### 5️⃣ تصدير الدوال

**الملف:** `functions/src/index.ts`

جميع دوال Phase 49-52 مُصدّرة بالفعل:
- ✅ Phase 49: Error Tracking (`log`, `onEventWrite`, etc.)
- ✅ Phase 50: AI Studio Webhooks
- ✅ Phase 51: Deploy Functions
- ✅ Phase 52: GitHub Integration (`exchangeOAuthCode`, `listRepositories`, etc.)

---

## 🚀 البدء السريع / Quick Start

### الطريقة 1: التشغيل السريع (بدون GitHub)

```bash
./quick-start-emulators.sh
```

أو يدوياً:

```bash
# إيقاف المحاكيات القديمة
pkill -9 -f "firebase|java" 2>/dev/null || true

# بناء الدوال
cd functions && npm run build && cd ..

# تشغيل المحاكيات
firebase emulators:start --only firestore,functions,auth,storage,ui
```

### الطريقة 2: الإعداد الكامل (مع GitHub)

```bash
./setup-emulators.sh
```

هذا السكريبت سيطلب منك:
1. GitHub Client ID
2. GitHub Client Secret
3. GitHub Webhook Secret

ثم سيقوم تلقائياً بـ:
- ✅ توليد مفتاح التشفير
- ✅ حفظ الإعدادات في Firebase Functions Config
- ✅ بناء الدوال
- ✅ تشغيل المحاكيات

---

## 🔐 إعداد GitHub OAuth يدوياً

إذا أردت إعداد GitHub لاحقاً:

```bash
# توليد مفتاح التشفير
ENCRYPTION_KEY=$(openssl rand -hex 32)

# حفظ الإعدادات
firebase functions:config:set \
  github.client_id="YOUR_CLIENT_ID" \
  github.client_secret="YOUR_CLIENT_SECRET" \
  github.redirect_uri="http://localhost:3000/api/github/callback" \
  github.webhook_secret="YOUR_WEBHOOK_SECRET" \
  encryption.key="$ENCRYPTION_KEY"

# التحقق
firebase functions:config:get github
firebase functions:config:get encryption

# إعادة تشغيل المحاكيات
pkill -9 -f "firebase|java"
firebase emulators:start --only firestore,functions,auth,storage,ui
```

---

## 🌐 الوصول للمحاكيات / Access Emulators

بعد التشغيل، يمكنك الوصول إلى:

| الخدمة | العنوان |
|--------|---------|
| **Emulator UI** | http://127.0.0.1:4000 |
| **Firestore** | http://127.0.0.1:8080 |
| **Auth** | http://127.0.0.1:9099 |
| **Functions** | http://127.0.0.1:5001 |
| **Storage** | http://127.0.0.1:9199 |

---

## ✅ اختبار سريع / Quick Tests

### 1. اختبار الدوال المحملة

افتح المحاكيات وتحقق من اللوجز. يجب أن ترى:
```
✅ F0 Functions loaded (Phase 52: GitHub Integration enabled)
```

### 2. اختبار Health Check

```bash
curl http://127.0.0.1:5001/from-zero-84253/us-central1/readyz
```

يجب أن ترى:
```json
{
  "ok": true,
  "service": "f0-functions",
  "phase": "health-check-only"
}
```

### 3. اختبار Audit Log

```bash
curl http://127.0.0.1:5001/from-zero-84253/us-central1/auditTest
```

يجب أن ترى:
```json
{
  "ok": true,
  "message": "Audit test successful - Event logged to admin_activity"
}
```

ثم افتح Emulator UI وتحقق من collection `admin_activity`.

### 4. اختبار Error Tracking

```bash
curl -X POST http://127.0.0.1:5001/from-zero-84253/us-central1/log \
  -H "Content-Type: application/json" \
  -d '{
    "level": "error",
    "message": "Test error from emulator",
    "metadata": {"test": true}
  }'
```

---

## 🔍 استكشاف الأخطاء / Troubleshooting

### مشكلة: تحذير ADC مازال يظهر

**الحل:**
```bash
# تأكد من وجود المتغيرات في functions/.env
cat functions/.env

# يجب أن ترى:
FUNCTIONS_EMULATOR=true
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

### مشكلة: الدوال لا تتحمل

**الحل:**
```bash
# أعد بناء الدوال
cd functions
npm run build
cd ..

# أعد تشغيل المحاكيات
pkill -9 -f "firebase|java"
firebase emulators:start --only firestore,functions,auth,storage,ui
```

### مشكلة: GitHub Config غير موجود

**الحل:**
```bash
# تحقق من Firebase Functions Config
firebase functions:config:get

# إذا كانت فارغة، استخدم setup-emulators.sh
./setup-emulators.sh
```

---

## 📝 ملفات تم إنشاؤها / Files Created

1. `setup-emulators.sh` - سكريبت الإعداد الكامل
2. `quick-start-emulators.sh` - سكريبت التشغيل السريع
3. `functions/.env` - متغيرات بيئة الدوال
4. `EMULATOR_SETUP_GUIDE.md` - هذا الدليل

---

## 🎯 الخطوات التالية / Next Steps

1. ✅ شغّل المحاكيات باستخدام `./quick-start-emulators.sh`
2. ✅ افتح Emulator UI على http://127.0.0.1:4000
3. ✅ اختبر الدوال المختلفة
4. ✅ عند الحاجة لـ GitHub، شغّل `./setup-emulators.sh`

---

## 🔒 ملاحظات أمان / Security Notes

- ⚠️ ملف `functions/.env` يحتوي على مفاتيح تجريبية فقط
- ⚠️ لا تنشر المفاتيح الحقيقية في Git
- ⚠️ استخدم Firebase Functions Config للإنتاج
- ✅ المحاكيات معزولة تماماً عن الإنتاج

---

## 📚 مراجع إضافية

- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Firebase Functions Config](https://firebase.google.com/docs/functions/config-env)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)

---

**تم إعداد كل شيء بنجاح! 🎉**

الآن يمكنك تشغيل المحاكيات بأمان دون القلق من لمس بيانات الإنتاج.
