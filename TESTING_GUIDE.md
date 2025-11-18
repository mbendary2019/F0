# 🧪 Phase 49: دليل الاختبار الشامل

## 🚀 البدء السريع

### 1️⃣ شغّل السكريبت التلقائي
```bash
./test-complete-phase49.sh
```

هذا السكريبت سيختبر:
- ✅ Next.js server
- ✅ i18n routes (/, /ar, /en)
- ✅ Log API
- ✅ Error spike detection
- ✅ Different log levels

---

## 🎨 صفحة الاختبار التفاعلية

### افتح الصفحة:
```
http://localhost:3000/test-toast
```

### ماذا ستجد؟

#### 📢 Basic Toasts
- ✅ Success - رسالة نجاح
- ❌ Error - رسالة خطأ
- ⚠️ Warning - تحذير
- ℹ️ Info - معلومة

#### 🚀 Advanced Toasts
- ⏳ Loading - رسالة تحميل مؤقتة
- 🔄 Promise - رسالة مرتبطة بـ Promise

#### 📡 API Log Testing
- 📝 إرسال خطأ واحد إلى `/api/log`
- ⚡ إرسال 15 خطأ (اختبار spike detection)

#### 🔗 Quick Links
- روابط سريعة للـ Incidents Dashboard بجميع اللغات

---

## 🧪 الاختبارات اليدوية

### 1. اختبار Hydration Error

**الخطوات:**
1. افتح أي صفحة في المتصفح
2. اضغط `F12` لفتح Developer Tools
3. انتقل إلى تبويب **Console**

**النتيجة المتوقعة:**
```
✅ Console نظيف (لا توجد أخطاء hydration)
❌ يجب ألا ترى: "Hydration failed" أو "expected ... but found"
```

---

### 2. اختبار i18n Routes

**المسارات المتاحة:**

| URL | اللغة | الحالة المتوقعة |
|-----|------|-----------------|
| http://localhost:3000/ops/incidents | No locale | ✅ 200 OK |
| http://localhost:3000/ar/ops/incidents | العربية | ✅ 200 OK |
| http://localhost:3000/en/ops/incidents | English | ✅ 200 OK |

**الاختبار:**
```bash
# Test all routes
curl -I http://localhost:3000/ops/incidents
curl -I http://localhost:3000/ar/ops/incidents
curl -I http://localhost:3000/en/ops/incidents
```

**النتيجة المتوقعة:**
```
HTTP/1.1 200 OK
```

---

### 3. اختبار Toast من Console

**افتح Console (F12) واكتب:**

#### Success Toast
```javascript
import('sonner').then(({ toast }) => {
  toast.success('تم الحفظ ✅');
});
```

#### Error Toast
```javascript
import('sonner').then(({ toast }) => {
  toast.error('حدث خطأ 😅', {
    description: 'حاول مرة أخرى'
  });
});
```

#### Warning Toast
```javascript
import('sonner').then(({ toast }) => {
  toast.warning('تحذير ⚠️', {
    description: 'يرجى التحقق'
  });
});
```

#### Info Toast
```javascript
import('sonner').then(({ toast }) => {
  toast.info('معلومة ℹ️');
});
```

#### Loading Toast
```javascript
import('sonner').then(({ toast }) => {
  const id = toast.loading('جاري التحميل...');
  setTimeout(() => {
    toast.success('تم!', { id });
  }, 2000);
});
```

**النتيجة المتوقعة:**
```
✅ يظهر toast notification في أعلى الشاشة
✅ يختفي تلقائياً بعد عدة ثوانٍ
✅ ألوان مناسبة لكل نوع
```

---

### 4. اختبار Log API

#### إرسال خطأ واحد
```javascript
fetch('/api/log', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    level: 'error',
    service: 'web',
    code: 500,
    message: 'Test error from console',
    context: { route: '/test', timestamp: Date.now() }
  })
})
.then(r => r.json())
.then(data => {
  console.log('Response:', data);
  if (data.ok) {
    console.log('✅ Event ID:', data.eventId);
  }
});
```

**النتيجة المتوقعة:**
```json
{
  "ok": true,
  "eventId": "a82a92de22fee94f00d2f0056abac7e4..."
}
```

#### إرسال موجة أخطاء (Spike Test)
```javascript
// Send 15 errors with same fingerprint
for(let i = 0; i < 15; i++) {
  fetch('/api/log', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      level: 'error',
      message: `Spike test ${i}`,
      fingerprint: 'browser-spike-test'
    })
  });
}

console.log('✅ Sent 15 errors. Check /ops/incidents in 3 seconds');
```

**النتيجة المتوقعة:**
```
✅ جميع الطلبات ترجع { "ok": true }
✅ بعد 3 ثوانٍ، افتح /ops/incidents
✅ يجب أن ترى incident واحد بـ eventCount = 15
✅ Severity = medium (10-29 events)
```

---

### 5. اختبار Incidents Dashboard

**افتح:**
```
http://localhost:3000/ops/incidents
```

**ما تتوقع رؤيته:**

#### الواجهة
- ✅ جدول أو cards تعرض الـ incidents
- ✅ كل incident يعرض:
  - `fingerprint` (hash فريد)
  - `service` (مثل "web", "api")
  - `message` (رسالة الخطأ)
  - `severity` (low/medium/high/critical) بألوان مختلفة
  - `status` (open/acknowledged/resolved)
  - `eventCount` (عدد التكرارات)
  - `firstSeen` (أول مرة حدث)
  - `lastSeen` (آخر مرة حدث)

#### Severity Colors
- 🔵 **Low** (1-9 events) - أزرق/رمادي
- 🟡 **Medium** (10-29 events) - أصفر/برتقالي
- 🟠 **High** (30-99 events) - برتقالي
- 🔴 **Critical** (100+ events) - أحمر

#### أزرار Actions
- ✅ **Acknowledge** - الاعتراف بالحادث
- ✅ **Resolve** - حل الحادث وإغلاقه

**ملاحظة:** الأزرار تحتاج إلى admin claims على الـ Emulator.

---

### 6. اختبار Severity Escalation

**الهدف:** اختبار أن النظام يزيد الـ severity تلقائياً عند زيادة الأخطاء

**الخطوات:**

#### Step 1: أرسل 5 أخطاء (Low)
```javascript
for(let i = 0; i < 5; i++) {
  fetch('/api/log', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      level: 'error',
      fingerprint: 'escalation-test',
      message: `Escalation test ${i}`
    })
  });
}
```

**توقع:** Severity = **low**

#### Step 2: أرسل 10 أخطاء إضافية (Total 15 = Medium)
```javascript
for(let i = 5; i < 15; i++) {
  fetch('/api/log', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      level: 'error',
      fingerprint: 'escalation-test',
      message: `Escalation test ${i}`
    })
  });
}
```

**توقع:** Severity = **medium** (تم التصعيد!)

#### Step 3: أرسل 20 أخطاء إضافية (Total 35 = High)
```javascript
for(let i = 15; i < 35; i++) {
  fetch('/api/log', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      level: 'error',
      fingerprint: 'escalation-test',
      message: `Escalation test ${i}`
    })
  });
}
```

**توقع:** Severity = **high** (تصعيد مرة أخرى!)

---

### 7. اختبار Different Log Levels

```javascript
// Test all log levels
const levels = ['info', 'warn', 'error', 'fatal'];

levels.forEach(level => {
  fetch('/api/log', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      level: level,
      message: `Test ${level} message`,
      service: 'test'
    })
  })
  .then(r => r.json())
  .then(data => console.log(`${level}:`, data.ok ? '✅' : '❌'));
});
```

**النتيجة المتوقعة:**
```
info: ✅
warn: ✅
error: ✅
fatal: ✅
```

**ملاحظة:** فقط `error` و `fatal` و `code >= 500` تُنشئ incidents.

---

## 📊 نتائج الاختبار المتوقعة

### ✅ Checklist

- [ ] Console نظيف (لا hydration errors)
- [ ] جميع المسارات تعم�� (/, /ar, /en)
- [ ] Toast notifications تظهر وتختفي
- [ ] Log API يستقبل الأخطاء
- [ ] Incidents يتم إنشاؤها تلقائياً
- [ ] Severity يتصاعد مع زيادة الأخطاء
- [ ] Dashboard يعرض البيانات صحيحة
- [ ] eventCount يزداد عند التكرار
- [ ] firstSeen و lastSeen صحيحان

---

## 🐛 استكشاف الأخطاء

### المشكلة: Hydration Error ما زال يظهر
**الحل:**
1. تأكد من أن Next.js تم إعادة تشغيله بعد التغييرات
2. امسح cache المتصفح (`Ctrl + Shift + R`)
3. تأكد من وجود `ClientOnly` wrapper حول `Toaster`

### المشكلة: 404 على /ar/ops/incidents
**الحل:**
1. تأكد من وجود [src/app/[locale]/ops/incidents/page.tsx](src/app/[locale]/ops/incidents/page.tsx)
2. أعد تشغيل Next.js

### المشكلة: Toast لا يظهر
**الحل:**
1. تأكد من تثبيت `sonner`: `pnpm add sonner`
2. تأكد من وجود `<Toaster />` في layout
3. تحقق من Console للأخطاء

### المشكلة: Log API يرجع 500
**الحل:**
1. تأكد من أن Functions Emulator مشغل
2. تحقق من `NEXT_PUBLIC_CF_LOG_URL` في `.env.local`
3. أعد بناء Functions: `cd functions && npm run build`

### المشكلة: Incidents لا يتم إنشاؤها
**الحل:**
1. تأكد من أن Firestore Emulator مشغل
2. تحقق من أن `onEventWrite` trigger مُصدّر في `functions/src/index.ts`
3. أرسل خطأ بـ `level: 'error'` أو `code >= 500`

---

## 🎯 الاختبار النهائي الشامل

```bash
# 1. شغّل السكريبت التلقائي
./test-complete-phase49.sh

# 2. افتح صفحة الاختبار
open http://localhost:3000/test-toast

# 3. جرّب جميع الأزرار

# 4. افتح Dashboard
open http://localhost:3000/ops/incidents

# 5. تحقق من Console (يجب أن يكون نظيف)

# 6. تحقق من Firestore Emulator UI
open http://localhost:4000/firestore
# ابحث عن:
# - ops_events (الأحداث)
# - ops_incidents (الحوادث)
# - ops_incident_updates (التحديثات)
```

---

## 📚 الخلاصة

إذا مرت جميع الاختبارات بنجاح:

✅ **Hydration Error** - مُصلح
✅ **i18n Routing** - يعمل
✅ **Toast Notifications** - تعمل
✅ **Log API** - يعمل
✅ **Incident Detection** - يعمل
✅ **Severity Escalation** - يعمل
✅ **Dashboard** - يعرض البيانات

**🎉 Phase 49 جاهز للإنتاج!**

---

## 🔗 روابط مفيدة

- [PHASE_49_دليل_سريع.md](PHASE_49_دليل_سريع.md) - الدليل الكامل
- [HYDRATION_FIX_SUMMARY.md](HYDRATION_FIX_SUMMARY.md) - تفاصيل إصلاح Hydration
- [test-complete-phase49.sh](test-complete-phase49.sh) - السكريبت التلقائي
- [src/app/test-toast/page.tsx](src/app/test-toast/page.tsx) - صفحة الاختبار
