# ✅ Phase 49: قائمة التحقق النهائية والاختبار

## 🎯 الإعدادات الأساسية - تم التحقق ✅

### 1. Environment Variables ([.env.local](.env.local))

```bash
# ✅ Phase 49: Error Tracking (محلي)
NEXT_PUBLIC_CF_LOG_URL=http://127.0.0.1:5001/from-zero-84253/us-central1/log
NEXT_PUBLIC_LOG_ENDPOINT=/api/log

# ✅ Firebase Configuration
NEXT_PUBLIC_FIREBASE_PROJECT_ID=from-zero-84253
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBhDfrCv_uqu-rs4WNH0Kav2BMK4xD4j4k
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=from-zero-84253.firebaseapp.com
```

**حالة:** ✅ كل المتغيرات موجودة ومضبوطة

---

## 🚀 خطوات الاختبار السريع

### الطريقة 1: اختبار تلقائي كامل (موصى به)

```bash
# Terminal 1: شغّل الخدمات
./start-local.sh

# Terminal 2: شغّل الاختبارات
./test-phase49-local.sh
```

**ما سيحدث:**
1. ✅ يتحقق من Next.js على port 3000
2. ✅ يتحقق من Firestore Emulator على port 8080
3. 📝 يرسل error واحد
4. ⚡ يرسل 15 error (spike test)
5. ⚠️ يرسل warning
6. ℹ️ يرسل info
7. 🔥 يتحقق من Firestore data

---

### الطريقة 2: اختبار يدوي سريع

#### A) اختبار Log Endpoint مباشرة

```bash
curl -X POST "http://127.0.0.1:5001/from-zero-84253/us-central1/log" \
  -H 'Content-Type: application/json' \
  -d '{
    "level":"error",
    "service":"web",
    "code":500,
    "message":"TEST_500 manual from CLI",
    "context":{"route":"/api/test"}
  }'
```

**التوقع:** `{"ok":true,"eventId":"web:500:/api/test"}`

#### B) اختبار عبر API Proxy

```bash
curl -X POST "http://localhost:3000/api/log" \
  -H 'Content-Type: application/json' \
  -d '{
    "level":"error",
    "service":"web",
    "code":500,
    "message":"TEST via proxy",
    "context":{"test":true}
  }'
```

**التوقع:** `{"ok":true,"eventId":"..."}`

#### C) إنشاء Spike لاختبار Incidents

```bash
# أرسل 15 error بسرعة
for i in {1..15}; do
  curl -s -X POST "http://127.0.0.1:5001/from-zero-84253/us-central1/log" \
    -H 'Content-Type: application/json' \
    -d "{\"level\":\"error\",\"service\":\"test\",\"code\":500,\"message\":\"Spike test $i\",\"fingerprint\":\"test:500:/spike\"}" > /dev/null
  echo -n "."
done
echo ""
echo "✅ Sent 15 errors - check Dashboard!"
```

---

## 🌐 فتح Dashboard والتحقق

### 1. Dashboard الرئيسي

```bash
open http://localhost:3000/ops/incidents
```

**يجب أن ترى:**
- ✅ جدول مع Incidents
- ✅ Severity badges (low, medium, high, critical)
- ✅ Status badges (open, acknowledged, resolved)
- ✅ eventCount يزداد مع كل error جديد
- ✅ أزرار Acknowledge و Resolve

### 2. Emulator UI

```bash
open http://localhost:4000
```

**تحقق من Collections:**
- ✅ `ops_events` - يجب أن يحتوي على events
- ✅ `ops_incidents` - يجب أن يحتوي على incident واحد على الأقل
- ✅ `ops_incident_updates` - timeline للحوادث
- ✅ `_alerts_queue` - إذا وصل Spike لـ High/Critical

---

## 🧪 اختبار من الكود (Smoke Test)

### مثال: اختبار Logger في Component

إنشئ ملف اختبار مؤقت:

```typescript
// src/app/test-logger/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { logInfo, logWarn, logError } from '@/lib/logger';

export default function TestLogger() {
  const [status, setStatus] = useState<string[]>([]);

  const runTests = async () => {
    setStatus([]);
    
    // Test 1: Info
    setStatus(s => [...s, 'Sending info...']);
    await logInfo('Test info from UI', { 
      service: 'web',
      context: { page: '/test-logger' }
    });
    setStatus(s => [...s, '✅ Info sent']);
    
    // Test 2: Warning
    setStatus(s => [...s, 'Sending warning...']);
    await logWarn('Test warning from UI', {
      service: 'web',
      context: { page: '/test-logger' }
    });
    setStatus(s => [...s, '✅ Warning sent']);
    
    // Test 3: Error
    setStatus(s => [...s, 'Sending error...']);
    await logError('Test error from UI', {
      service: 'web',
      code: 500,
      context: { page: '/test-logger' }
    });
    setStatus(s => [...s, '✅ Error sent']);
    
    setStatus(s => [...s, '🎉 All tests completed!']);
  };

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Logger Test Page</h1>
      <button
        onClick={runTests}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Run Tests
      </button>
      <div className="mt-4 space-y-2">
        {status.map((s, i) => (
          <div key={i} className="text-sm">{s}</div>
        ))}
      </div>
      <div className="mt-8 text-sm text-gray-600">
        <p>After running tests:</p>
        <ol className="list-decimal ml-6 mt-2">
          <li>Check Dashboard: <a href="/ops/incidents" className="text-blue-600 underline">/ops/incidents</a></li>
          <li>Check Emulator UI: <a href="http://localhost:4000" target="_blank" className="text-blue-600 underline">localhost:4000</a></li>
        </ol>
      </div>
    </main>
  );
}
```

ثم افتح: `http://localhost:3000/test-logger`

---

## 🔧 اختبار أزرار Acknowledge/Resolve

### المتطلبات:
- يجب أن يكون المستخدم لديه `admin = true` في Custom Claims
- على Emulator، يمكن تجاوز هذا مؤقتاً

### إذا لم تعمل الأزرار:

#### الحل 1: تحديث من Emulator UI مباشرة
1. افتح: `http://localhost:4000`
2. اذهب إلى `ops_incidents`
3. اختر incident
4. عدّل حقل `status` يدوياً إلى `"acknowledged"` أو `"resolved"`
5. احفظ

#### الحل 2: إضافة Admin Claim
```bash
# إذا كان لديك script لإضافة admin
FIREBASE_SERVICE_ACCOUNT_FILE=/path/to/key.json \
node scripts/set-admin.mjs "your-email@example.com"
```

#### الحل 3: تعطيل التحقق مؤقتاً (للاختبار فقط)
في [firestore.rules](firestore.rules), غيّر مؤقتاً:
```javascript
// من:
allow create, update, delete: if isAdmin();
// إلى:
allow create, update, delete: if true; // للاختبار فقط!
```

ثم:
```bash
firebase deploy --only firestore:rules
```

⚠️ **تحذير:** لا تنسَ إرجاع Rules للإعداد الآمن بعد الاختبار!

---

## 🧯 حل المشاكل الشائعة

### ❌ Dashboard فارغ

**الأسباب المحتملة:**
1. لم ترسل أي errors بعد
2. Errors ليست `level="error"` أو `code >= 500`
3. Firestore Emulator لا يعمل

**الحلول:**
```bash
# 1. تحقق من Firestore Emulator
curl http://localhost:8080

# 2. أرسل error test
curl -X POST "http://127.0.0.1:5001/from-zero-84253/us-central1/log" \
  -H 'Content-Type: application/json' \
  -d '{"level":"error","service":"test","code":500,"message":"Test"}'

# 3. تحقق من Emulator UI
open http://localhost:4000
```

---

### ❌ CORS Errors

**الحل:** استخدم API Proxy بدلاً من CF مباشرة:
```typescript
// ✅ Good
import { logError } from '@/lib/logger';
logError('test');

// ❌ Bad (CORS issues)
fetch('http://127.0.0.1:5001/.../log', ...)
```

---

### ❌ CF_URL not configured

**الحل:** تأكد من `.env.local`:
```bash
NEXT_PUBLIC_CF_LOG_URL=http://127.0.0.1:5001/from-zero-84253/us-central1/log
```

ثم أعد تشغيل Next.js:
```bash
# Ctrl+C ثم
pnpm dev
```

---

### ❌ rate_limited (429)

**السبب:** أرسلت أكثر من 120 request في دقيقة واحدة

**الحل:**
- انتظر دقيقة
- أو ارفع الحد مؤقتاً في [functions/src/util/rateLimit.ts](functions/src/util/rateLimit.ts)

---

### ❌ Firebase Connection Error

**الحل:** تأكد من تشغيل Emulator:
```bash
# في Terminal منفصل
firebase emulators:start
# أو
./start-local.sh
```

---

## ✅ معايير النجاح (DoD)

قائمة تحقق نهائية:

- [ ] **Environment Variables**
  - [x] `NEXT_PUBLIC_CF_LOG_URL` موجود
  - [x] `NEXT_PUBLIC_LOG_ENDPOINT` موجود
  - [x] Firebase config موجود

- [ ] **Cloud Functions**
  - [x] `log` منشور
  - [x] `onEventWrite` منشور
  - [x] `processAlerts` منشور

- [ ] **Frontend Files**
  - [x] `src/lib/logger.ts` موجود
  - [x] `src/app/api/log/route.ts` موجود
  - [x] `src/app/ops/incidents/page.tsx` موجود

- [ ] **Testing**
  - [ ] `./test-phase49-local.sh` يعمل بدون أخطاء
  - [ ] Dashboard يعرض incidents
  - [ ] Emulator UI يظهر data
  - [ ] Logger من الكود يعمل

- [ ] **Functionality**
  - [ ] Log endpoint يستجيب
  - [ ] Incidents يتم إنشاؤها تلقائياً
  - [ ] eventCount يزداد
  - [ ] Severity يتغير حسب العدد
  - [ ] Timeline يُسجل

---

## 🎯 الخطوات التالية

بعد اكتمال الاختبار:

### 1. للإنتاج:
```bash
# غيّر .env.local
NEXT_PUBLIC_CF_LOG_URL=https://us-central1-from-zero-84253.cloudfunctions.net/log

# أعد بناء ونشر
pnpm build
firebase deploy --only hosting
```

### 2. إعداد Telegram (اختياري):
```bash
firebase functions:config:set \
  alerts.telegram_bot_token="YOUR_TOKEN" \
  alerts.telegram_chat_id="YOUR_CHAT_ID"

firebase deploy --only functions:processAlerts
```

### 3. دمج في التطبيق:
```typescript
// في Error Boundaries
import { logError } from '@/lib/logger';

componentDidCatch(error, errorInfo) {
  logError(error.message, {
    code: 500,
    context: { errorInfo }
  });
}

// في API routes
catch (error) {
  await logError('API error', {
    code: 500,
    context: { endpoint, error }
  });
}

// في Event handlers
onClick={async () => {
  try {
    // action
  } catch (e) {
    logError('Action failed', { 
      context: { action: 'checkout' }
    });
  }
}}
```

---

## 🏆 قائمة التحقق النهائية

```
✅ Firestore Rules منشورة
✅ Firestore Indexes منشورة
✅ Cloud Functions منشورة (3)
✅ Frontend files تم إنشاؤها (3)
✅ Environment variables مضبوطة
✅ Documentation كاملة
✅ Testing scripts جاهزة

🎯 الحالة: جاهز للاختبار والاستخدام!
```

---

## 📞 الدعم

إذا واجهت مشاكل:
1. راجع [PHASE_49_COMPLETE.md](PHASE_49_COMPLETE.md)
2. تحقق من Firebase Logs: `firebase functions:log`
3. راجع Emulator UI: `http://localhost:4000`
4. تحقق من Console logs في المتصفح

---

**🎉 Phase 49 جاهز تماماً!**

**الآن:** قم بتشغيل `./start-local.sh` و `./test-phase49-local.sh` وتحقق من النتائج!

**Good luck! 🚀**
