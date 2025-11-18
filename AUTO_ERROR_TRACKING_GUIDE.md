# 🚨 دليل التقاط الأخطاء التلقائي

## 📊 Overview

تم إعداد نظام لالتقاط الأخطاء تلقائياً من React/Next.js وتسجيلها في Incidents Dashboard.

---

## ✅ ما تم إضافته

### 1. Global Error Boundary
**الملف:** [src/app/global-error.tsx](src/app/global-error.tsx)

**يلتقط:**
- أخطاء غير معالجة في أي مكان في التطبيق
- Crashes على مستوى الـ App
- Unhandled exceptions

**الميزات:**
- ✅ تسجيل تلقائي لـ `/api/log`
- ✅ إرسال stack trace كاملة
- ✅ عرض واجهة مستخدم لطيفة
- ✅ زر "حاول مرة أخرى"
- ✅ تفاصيل الخطأ في Development mode

### 2. Developers Page Error Boundary
**الملف:** [src/app/[locale]/developers/error.tsx](src/app/[locale]/developers/error.tsx)

**يلتقط:**
- أخطاء خاصة بصفحة `/developers`
- Loading errors
- Runtime errors في المكونات

**الميزات:**
- ✅ Context محدد للمسار
- ✅ زر "العودة للرئيسية"
- ✅ تفاصيل في Dev mode

---

## 🎯 كيف يعمل النظام؟

### Flow Diagram

```
┌─────────────────┐
│  React Error    │
│  في التطبيق     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Error Boundary │
│  يلتقط الخطأ    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  POST /api/log  │
│  level: error   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Cloud Function │
│  log()          │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  ops_events     │
│  في Firestore   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Trigger        │
│  onEventWrite   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  ops_incidents  │
│  Incident جديد  │
└─────────────────┘
```

---

## 📝 الأمثلة

### مثال 1: Global Error

```typescript
// أي خطأ غير معالج في التطبيق
throw new Error('Something went wrong!');

// → يُلتقط بواسطة global-error.tsx
// → يُسجل في /api/log
// → ينشئ Incident تلقائياً
```

### مثال 2: Async Error

```typescript
// في أي component
useEffect(() => {
  async function fetchData() {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
  }
  fetchData(); // لو فشل، سيُلتقط
}, []);
```

### مثال 3: Component Error

```typescript
// في developers page
function DevelopersList() {
  // Runtime error
  const data = undefined;
  return <div>{data.map(x => x)}</div>; // Error!
  
  // → يُلتقط بواسطة developers/error.tsx
  // → Context: route='/developers'
}
```

---

## 🔧 الإعداد

### ✅ تم بالفعل

الملفات التالية تم إنشاؤها:

1. **[src/app/global-error.tsx](src/app/global-error.tsx)**
   - يعمل تلقائياً
   - لا يحتاج تفعيل

2. **[src/app/[locale]/developers/error.tsx](src/app/[locale]/developers/error.tsx)**
   - خاص بمسار `/developers`
   - يعمل تلقائياً

### 📝 لإضافة Error Boundaries لمسارات أخرى

#### لأي route معين:

```typescript
// src/app/[locale]/YOUR_ROUTE/error.tsx
'use client';
import { useEffect } from 'react';

export default function YourRouteError({ error, reset }) {
  useEffect(() => {
    fetch('/api/log', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        level: 'error',
        message: error.message,
        context: { route: '/YOUR_ROUTE' },
        fingerprint: `YOUR_ROUTE-error-${error.name}`
      })
    });
  }, [error]);

  return (
    <div>
      <h2>خطأ في YOUR_ROUTE</h2>
      <button onClick={reset}>حاول مرة أخرى</button>
    </div>
  );
}
```

---

## 🧪 الاختبار

### Test 1: Global Error

**في أي صفحة، افتح Console:**

```javascript
// تسبب خطأ عمداً
throw new Error('Test global error');
```

**النتيجة المتوقعة:**
1. صفحة خطأ تظهر
2. يظهر زر "حاول مرة أخرى"
3. في Firestore: حدث جديد في `ops_events`
4. في Dashboard: incident جديد

---

### Test 2: Developers Page Error

**افتح:** `/ar/developers`

**في Console:**
```javascript
// تسبب خطأ في هذا المسار
throw new Error('Test developers error');
```

**النتيجة المتوقعة:**
1. صفحة خطأ خاصة بـ developers
2. Context يحتوي `route: '/developers'`
3. Incident في Dashboard بـ fingerprint مميز

---

### Test 3: Component Crash

**أنشئ component مؤقت:**

```typescript
// src/app/test-crash/page.tsx
'use client';

export default function TestCrash() {
  // Intentional crash
  const data: any = undefined;
  
  return (
    <div>
      {data.map((x: any) => x)} {/* Will crash! */}
    </div>
  );
}
```

**افتح:** `/test-crash`

**النتيجة:** Global error boundary يلتقط الخطأ

---

## 📊 ما يتم تسجيله

### في ops_events

```javascript
{
  type: 'log',
  level: 'error',
  service: 'web',
  code: 500,
  message: 'Error message here',
  stack: 'Full stack trace...',
  context: {
    route: '/developers',
    digest: 'abc123',
    userAgent: 'Mozilla/5.0...',
    timestamp: 1234567890
  },
  fingerprint: 'developers-error-TypeError',
  ipHash: 'sha1:...',
  ts: 1234567890,
  expireAt: 1234567890
}
```

### في ops_incidents

```javascript
{
  fingerprint: 'developers-error-TypeError',
  service: 'web',
  message: 'Cannot read property...',
  severity: 'low', // or medium/high/critical
  status: 'open',
  eventCount: 1,
  firstSeen: 1234567890,
  lastSeen: 1234567890,
  updatedAt: 1234567890
}
```

---

## 🎨 تخصيص واجهة الخطأ

### تعديل Global Error UI

```typescript
// src/app/global-error.tsx
// غيّر المحتوى حسب حاجتك:

return (
  <html>
    <body>
      <div className="error-page">
        <h1>عنوان مخصص</h1>
        <p>رسالة مخصصة</p>
        <button onClick={reset}>نص مخصص</button>
      </div>
    </body>
  </html>
);
```

### إضافة Branding

```typescript
<div className="error-page">
  <img src="/logo.svg" alt="Logo" />
  <h1>حدث خطأ</h1>
  <p>فريق الدعم تم إشعاره</p>
</div>
```

---

## 🔔 الإشعارات

### لإضافة إشعار فوري عند الخطأ

```typescript
// في error boundary
useEffect(() => {
  // 1. سجّل الخطأ
  fetch('/api/log', { ... });

  // 2. أرسل إشعار
  import('sonner').then(({ toast }) => {
    toast.error('حدث خطأ غير متوقع', {
      description: 'تم تسجيل المشكلة وسيتم حلها',
    });
  });
}, [error]);
```

---

## 📈 المراقبة والتحليل

### Dashboard View

افتح: http://localhost:3000/ar/ops/incidents

**ستشاهد:**
- جميع الأخطاء المُلتقطة تلقائياً
- تجميع حسب Fingerprint
- Severity بناءً على التكرار
- Stack traces كاملة

### Firestore View

افتح: http://localhost:4000/firestore

**تحقق من:**
- `ops_events` - جميع الأخطاء
- `ops_incidents` - الحوادث المُجمّعة
- `ops_incident_updates` - التحديثات

---

## 🐛 استكشاف الأخطاء

### المشكلة: Error Boundary لا يلتقط

**الأسباب:**
1. الخطأ خارج React tree
2. Event handlers (تحتاج try/catch يدوي)
3. Async code بدون proper error handling

**الحل:**
```typescript
// For event handlers
onClick={async () => {
  try {
    await doSomething();
  } catch (error) {
    // سجّل يدوياً
    fetch('/api/log', {...});
  }
}}
```

---

### المشكلة: Too many errors

**إذا كانت بعض الأخطاء تتكرر كثيراً:**

```typescript
// أضف debounce
let lastErrorTime = 0;
const MIN_INTERVAL = 5000; // 5 seconds

useEffect(() => {
  const now = Date.now();
  if (now - lastErrorTime < MIN_INTERVAL) {
    return; // Skip logging
  }
  lastErrorTime = now;
  
  fetch('/api/log', {...});
}, [error]);
```

---

## ✅ Best Practices

### 1. استخدم Fingerprints مميزة
```typescript
fingerprint: `${route}-${errorType}-${errorName}`
// مثال: 'developers-TypeError-undefined'
```

### 2. أضف Context مفيد
```typescript
context: {
  route: window.location.pathname,
  userAgent: navigator.userAgent,
  timestamp: Date.now(),
  userId: user?.uid,
}
```

### 3. لا تسجّل معلومات حساسة
```typescript
// ❌ خطأ
context: { password: user.password }

// ✅ صحيح
context: { userId: user.id }
```

### 4. استخدم Severity مناسب
```typescript
level: error.critical ? 'fatal' : 'error'
```

---

## 📚 الملفات المتعلقة

| الملف | الوصف |
|------|-------|
| [src/app/global-error.tsx](src/app/global-error.tsx) | Global error boundary |
| [src/app/[locale]/developers/error.tsx](src/app/[locale]/developers/error.tsx) | Developers error boundary |
| [src/app/api/log/route.ts](src/app/api/log/route.ts) | Log API endpoint |
| [functions/src/http/log.ts](functions/src/http/log.ts) | Log Cloud Function |
| [functions/src/incidents/onEventWrite.ts](functions/src/incidents/onEventWrite.ts) | Incident trigger |

---

## 🎉 الخلاصة

**الآن لديك:**

✅ التقاط تلقائي للأخطاء
✅ تسجيل في Dashboard
✅ إنشاء Incidents تلقائياً
✅ Severity calculation
✅ واجهة مستخدم لطيفة للأخطاء

**أي خطأ في التطبيق سيُسجّل تلقائياً!** 🚀
