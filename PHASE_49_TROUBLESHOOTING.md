# 🔧 Phase 49 Troubleshooting Guide

## 🚨 مشاكل شائعة وحلولها

---

## Problem 1: Dashboard يظهر "Access Denied" أو Redirect إلى /billing

### الأعراض:
- عند فتح `/ar/ops/incidents` يتم redirect
- رسالة "You need admin access"
- يتم توجيهك إلى صفحة الدفع

### الأسباب:
1. Custom claims غير موجودة
2. لم تقم بتسجيل الدخول
3. Paywall/Entitlements تمنع الوصول

### الحل:

#### الخطوة 1: تحقق من تسجيل الدخول
```bash
# افتح Browser Console على الصفحة
firebase.auth().currentUser
# يجب أن يرجع user object، إذا رجع null → لم تسجل دخول
```

#### الخطوة 2: أضف Custom Claims
1. افتح: http://localhost:4000/auth
2. ابحث عن المستخدم
3. انقر "Edit Custom Claims"
4. الصق:
```json
{"admin": true, "role": "admin", "pro": true}
```
5. Save

#### الخطوة 3: اعمل Logout + Login
```bash
# في صفحة التطبيق
1. اضغط Logout
2. سجّل دخول مرة أخرى
3. افتح /ar/ops/incidents
```

#### الخطوة 4: تحقق من Claims (في Browser Console)
```javascript
firebase.auth().currentUser.getIdTokenResult()
  .then(result => console.log(result.claims));

// يجب أن تشوف:
// { admin: true, role: 'admin', pro: true }
```

#### الحل البديل: عطّل Paywall
في `.env.local`:
```bash
NEXT_PUBLIC_DISABLE_PAYWALL=1
```

ثم أعد تشغيل Next.js:
```bash
npm run dev
```

---

## Problem 2: Dashboard فاضي (لا يظهر incidents)

### الأعراض:
- Dashboard يفتح بنجاح
- لكن لا يظهر أي incidents
- قد يظهر "No incidents found"

### الأسباب:
1. لم يتم إرسال أي errors بعد
2. الـ trigger (`onEventWrite`) لم يعمل
3. Firestore rules تمنع القراءة
4. مشكلة في query

### الحل:

#### الخطوة 1: تحقق من Firestore
افتح: http://localhost:4000/firestore

**تحقق من Collections:**
- ✅ `ops_events` موجود → Log API شغال
- ✅ `ops_incidents` موجود → Trigger شغال
- ❌ `ops_events` فاضي → لم يتم إرسال errors
- ❌ `ops_incidents` فاضي → Trigger لم يعمل

#### الخطوة 2: أرسل Test Errors
```bash
bash seed-incidents.sh
```

أو يدويًا:
```bash
for i in {1..12}; do
  curl -s -X POST "http://localhost:3000/api/log" \
    -H 'Content-Type: application/json' \
    -d "{\"level\":\"error\",\"service\":\"web\",\"code\":500,\"message\":\"Test $i\",\"fingerprint\":\"test-incident\"}" >/dev/null
done
```

#### الخطوة 3: إصلاح Trigger

**تحقق من Export:**
```bash
grep "onEventWrite" functions/lib/index.js
```

**إذا لم يظهر شيء:**
```bash
# افتح functions/src/index.ts وأضف:
export { onEventWrite } from './incidents/onEventWrite';

# ثم:
cd functions && npm run build
```

#### الخطوة 4: أعد تشغيل Emulators
```bash
pkill -f "firebase emulators"
firebase emulators:start --only functions,firestore,auth
```

---

## Problem 3: Log API يرجع 404 أو 500

### الأعراض:
- `curl http://localhost:3000/api/log` → 404
- أو response: `{"ok": false, "error": "..."}`

### الأسباب:
1. Next.js لم يبدأ
2. Route handler غير موجود
3. Cloud Function غير متاح

### الحل:

#### الخطوة 1: تحقق من Next.js
```bash
curl -I http://localhost:3000
# يجب أن يرجع 200 أو 307
```

إذا لم يعمل:
```bash
npm run dev
```

#### الخطوة 2: اختبر Cloud Function مباشرة
```bash
curl -X POST "http://127.0.0.1:5001/from-zero-84253/us-central1/log" \
  -H 'Content-Type: application/json' \
  -d '{"level":"error","message":"Direct test"}'
```

**إذا رجع 404:**
- الـ function غير deployed في الـ emulator
- تحقق من `functions/lib/index.js`

#### الخطوة 3: تحقق من .env.local
```bash
grep NEXT_PUBLIC_CF_LOG_URL .env.local
```

يجب أن يكون:
```bash
NEXT_PUBLIC_CF_LOG_URL=http://127.0.0.1:5001/from-zero-84253/us-central1/log
```

---

## Problem 4: Trigger لا يولّد incidents رغم وجود events

### الأعراض:
- `ops_events` مليان بـ documents
- `ops_incidents` فاضي تمامًا
- لا errors في Functions logs

### الأسباب:
1. Trigger غير مُصدّر (not exported)
2. Trigger condition لا تتطابق
3. Emulator لم يلتقط التغييرات

### الحل:

#### الخطوة 1: تحقق من Functions logs
في Terminal الذي يشغل الـ emulator، ابحث عن:
```
✔  functions[us-central1-onEventWrite]: firestore function initialized.
```

إذا لم تجدها → الـ function غير loaded

#### الخطوة 2: تحقق من index.ts
```bash
cat functions/src/index.ts | grep onEventWrite
```

يجب أن تشوف:
```typescript
export { onEventWrite } from './incidents/onEventWrite';
```

#### الخطوة 3: أعد البناء
```bash
cd functions
npm run build
cd ..
```

#### الخطوة 4: أعد تشغيل Emulator
```bash
pkill -f firebase
firebase emulators:start --only functions,firestore,auth
```

#### الخطوة 5: اختبر Trigger يدويًا
```bash
# أرسل error واحد
curl -X POST "http://localhost:3000/api/log" \
  -H 'Content-Type: application/json' \
  -d '{"level":"error","service":"test","code":500,"message":"Trigger test","fingerprint":"trigger-test"}'

# انتظر 3 ثواني
sleep 3

# تحقق من ops_incidents في Firestore UI
```

---

## Problem 5: Hydration Error في Console

### الأعراض:
```
Warning: Hydration failed because the initial UI does not match...
```

### السبب:
- Toaster component يُرندر بشكل مختلف في server vs client

### الحل:
✅ **تم إصلاحه بالفعل** في:
- `src/components/ClientOnly.tsx`
- `src/app/layout.tsx`
- `src/app/[locale]/layout.tsx`

إذا ظهر الخطأ مرة أخرى:
```bash
# تحقق من أن الـ layouts تستخدم dynamic import:
grep "dynamic.*Toaster" src/app/layout.tsx
```

يجب أن تشوف:
```typescript
const Toaster = dynamic(() => import('sonner').then(m => m.Toaster), { ssr: false });
```

---

## Problem 6: 404 على /ar/ops/incidents

### الأعراض:
- `/ops/incidents` يعمل
- `/ar/ops/incidents` يرجع 404

### السبب:
- ملف re-export للـ i18n غير موجود

### الحل:
✅ **تم إصلاحه بالفعل** في:
- `src/app/[locale]/ops/incidents/page.tsx`

تحقق من وجوده:
```bash
ls -la src/app/[locale]/ops/incidents/page.tsx
```

المحتوى:
```typescript
export { default } from '@/app/ops/incidents/page';
```

---

## Problem 7: Rate Limiting (429 Error)

### الأعراض:
```json
{"ok": false, "error": "rate_limited"}
```

### السبب:
- أرسلت أكثر من 120 request في دقيقة واحدة من نفس الـ IP

### الحل:

**للتطوير:**
عدّل `functions/src/util/rateLimit.ts`:
```typescript
// زوّد الحد:
export function checkRate(key: string, limit = 1000, window = 60_000) {
  // ...
}
```

**أو انتظر دقيقة:**
```bash
sleep 60
# ثم أعد المحاولة
```

---

## Problem 8: PII Redaction يخفي بيانات مهمة

### الأعراض:
- Stack traces تظهر `[REDACTED]`
- Messages تحتوي على `[REDACTED]`

### السبب:
- نظام PII redaction يخفي emails, IPs, tokens

### الحل:

**للتطوير فقط:**
عدّل `functions/src/util/redact.ts`:
```typescript
export function redactPII(text: string): string {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return text; // لا redaction في الـ emulator
  }
  // ... الكود الأصلي
}
```

**أو:**
استخدم context بدلاً من message:
```javascript
fetch('/api/log', {
  method: 'POST',
  body: JSON.stringify({
    level: 'error',
    message: 'Payment failed', // عام
    context: {
      // تفاصيل هنا
      userId: '123',
      amount: 50,
      reason: 'Card declined'
    }
  })
});
```

---

## 🔍 سكربت التشخيص السريع

```bash
bash debug-phase49.sh
```

هذا السكربت يتحقق من:
- ✅ Firebase Emulators (Firestore, Functions, Auth)
- ✅ Next.js server
- ✅ Functions build
- ✅ Log endpoint
- ✅ Environment variables
- ✅ Next.js proxy

---

## 📊 فحص صحة النظام يدويًا

### 1. تحقق من Ports
```bash
lsof -ti:3000  # Next.js
lsof -ti:5001  # Functions
lsof -ti:8080  # Firestore
lsof -ti:9099  # Auth
```

### 2. تحقق من Logs
```bash
# Functions logs (في Terminal الـ emulator)
# ابحث عن:
✔  functions[us-central1-log]: http function initialized
✔  functions[us-central1-onEventWrite]: firestore function initialized
```

### 3. اختبر الـ Pipeline كاملاً
```bash
# 1. أرسل error
curl -X POST "http://localhost:3000/api/log" \
  -H 'Content-Type: application/json' \
  -d '{"level":"error","service":"pipeline-test","code":500,"message":"Pipeline test","fingerprint":"pipeline-test"}'

# 2. تحقق من ops_events
# افتح: http://localhost:4000/firestore
# Collections → ops_events
# يجب أن يكون آخر document fingerprint="pipeline-test"

# 3. انتظر 3 ثواني
sleep 3

# 4. تحقق من ops_incidents
# Collections → ops_incidents
# ابحث عن document بـ id="pipeline-test"
```

---

## 🆘 آخر حل: إعادة تشغيل كل شيء

```bash
# 1. أوقف كل العمليات
pkill -f "firebase emulators"
pkill -f "next dev"

# 2. امسح node_modules (اختياري)
# rm -rf node_modules functions/node_modules
# npm install
# cd functions && npm install && cd ..

# 3. أعد البناء
cd functions && npm run build && cd ..

# 4. ابدأ Emulators
firebase emulators:start --only functions,firestore,auth

# 5. في terminal آخر: ابدأ Next.js
npm run dev

# 6. اختبر
bash debug-phase49.sh
```

---

## 📞 الحصول على مساعدة

### Log Files مفيدة:
```bash
# Functions logs
# في terminal الـ emulator، شوف الـ output

# Next.js logs
# في terminal npm run dev

# Browser Console
# افتح DevTools → Console
```

### معلومات مفيدة للإبلاغ عن مشكلة:
```bash
# نسخة Node
node --version

# نسخة Firebase
firebase --version

# نسخة npm/pnpm
npm --version

# System
uname -a
```

---

## ✅ Checklist للتحقق من أن كل شيء يعمل

- [ ] Firebase Emulators شغالة (ports 5001, 8080, 9099, 4000)
- [ ] Next.js شغال (port 3000)
- [ ] `functions/lib/index.js` موجود
- [ ] `log` و `onEventWrite` exported في lib/index.js
- [ ] `.env.local` يحتوي على `NEXT_PUBLIC_CF_LOG_URL`
- [ ] `curl` لـ `/api/log` يرجع `{"ok":true}`
- [ ] `curl` لـ Cloud Function مباشرة يرجع `{"ok":true}`
- [ ] Custom claims مضافة للمستخدم
- [ ] تسجيل دخول نشط في التطبيق
- [ ] `/ar/ops/incidents` يفتح بدون redirect
- [ ] Spike test يولّد incident في Firestore
- [ ] Dashboard يعرض incidents

---

**إذا اتبعت كل هذه الخطوات ولا يزال هناك مشكلة:**

راجع [PHASE_49_COMPLETE_SUMMARY.md](PHASE_49_COMPLETE_SUMMARY.md) للدليل الكامل أو افتح issue في المشروع.

---

**Created for Phase 49 - Error Tracking & Incident Management** 🚀
