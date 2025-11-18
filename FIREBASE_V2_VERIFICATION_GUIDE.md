# دليل التحقق من Firebase Functions v2 ✅

## الحالة: جاهز للتحقق والنشر

تم الترحيل بنجاح إلى Firebase Functions v2. هذا الدليل يوضح كيفية التحقق والاختبار.

---

## 1. التحقق من البناء ✅

```bash
cd functions
pnpm build
```

**النتيجة المتوقعة**:
```
> functions@1.0.0 build
> tsc

✅ البناء نجح بدون أخطاء
```

---

## 2. قائمة الدوال المُحدّثة (10 دوال)

### A) Collab Triggers (3 دوال)
**ملف**: `functions/src/collab/triggers.ts`

```typescript
✅ onSessionWrite         - onDocumentWritten (v2)
✅ cleanupOldSessions     - onSchedule (v2)
✅ monitorRoomActivity    - onSchedule (v2)
```

### B) Deploy Trigger (1 دالة)
**ملف**: `functions/src/deploy/triggerDeploy.ts`

```typescript
✅ triggerDeploy - onCall (v2)
```

### C) Export Incidents (2 دوال)
**ملف**: `functions/src/exportIncidentsCsv.ts`

```typescript
✅ exportIncidentsCsv         - onRequest (v2)
✅ exportIncidentsCsvCallable - onCall (v2)
```

### D) Studio Webhooks (4 دوال)
**ملف**: `functions/src/studio/webhooks.ts`

```typescript
✅ runwayWebhook  - onRequest (v2)
✅ veoWebhook     - onRequest (v2)
✅ studioWebhook  - onRequest (v2)
✅ onJobComplete  - onDocumentUpdated (v2)
```

---

## 3. تشغيل المحاكيات (Emulators)

### تشغيل Functions + Firestore
```bash
firebase emulators:start --only functions,firestore
```

### التحقق من السجل
راقب سجل التشغيل - يجب أن ترى:

```
✔  functions[us-central1-triggerDeploy]: http function initialized (v2)
✔  functions[us-central1-exportIncidentsCsv]: http function initialized (v2)
✔  functions[us-central1-exportIncidentsCsvCallable]: http function initialized (v2)
✔  functions[us-central1-runwayWebhook]: http function initialized (v2)
✔  functions[us-central1-veoWebhook]: http function initialized (v2)
✔  functions[us-central1-studioWebhook]: http function initialized (v2)
✔  functions[us-central1-onSessionWrite]: firestore function initialized (v2)
✔  functions[us-central1-onJobComplete]: firestore function initialized (v2)
✔  functions[cleanupOldSessions]: scheduled function initialized (v2)
✔  functions[monitorRoomActivity]: scheduled function initialized (v2)
```

**علامة (v2)** بجانب كل دالة تؤكد الترحيل الناجح.

---

## 4. اختبار الدوال المحلية

### A) اختبار onRequest (HTTP Endpoint)

#### exportIncidentsCsv
```bash
# اختبار GET request
curl "http://localhost:5001/from-zero-84253/us-central1/exportIncidentsCsv?limit=10&level=error"

# النتيجة المتوقعة: ملف CSV أو 404 إذا لم توجد أحداث
```

#### runwayWebhook
```bash
# اختبار POST request
curl -X POST http://localhost:5001/from-zero-84253/us-central1/runwayWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test_123",
    "status": "done",
    "outputUrl": "https://example.com/output.mp4",
    "timestamp": "2025-11-07T13:00:00Z"
  }'

# النتيجة المتوقعة: {"success":true,"message":"Job status updated"}
```

### B) اختبار onCall (Callable Function)

#### من كود JavaScript/TypeScript
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

// اختبار exportIncidentsCsvCallable
const exportIncidents = httpsCallable(functions, 'exportIncidentsCsvCallable');

try {
  const result = await exportIncidents({
    dateFrom: '2025-01-01',
    dateTo: '2025-11-07',
    level: 'error',
    limit: 100
  });

  console.log('✅ Export successful:', result.data);
  // النتيجة: { success: true, csv: "...", count: 10, timestamp: "..." }
} catch (error) {
  console.error('❌ Error:', error.message);
}

// اختبار triggerDeploy
const deploy = httpsCallable(functions, 'triggerDeploy');

try {
  const result = await deploy({
    target: 'firebase',
    env: 'staging',
    config: {}
  });

  console.log('✅ Deploy triggered:', result.data);
} catch (error) {
  console.error('❌ Error:', error.message);
}
```

#### من Firebase CLI (للاختبار السريع)
```bash
# استخدام Firebase Admin SDK في Node.js
node -e "
const admin = require('firebase-admin');
admin.initializeApp();

const functions = admin.functions();

// استدعاء callable function
functions.httpsCallable('exportIncidentsCsvCallable')({
  dateFrom: '2025-01-01',
  limit: 10
}).then(result => {
  console.log('Result:', result.data);
}).catch(err => {
  console.error('Error:', err);
});
"
```

### C) اختبار Firestore Triggers

#### onSessionWrite (يُطلق عند كتابة session)
```bash
# في المحاكي، أضف document جديد:
firebase firestore:set collab_rooms/room1/sessions/sess1 \
  '{"userId":"user123","displayName":"Test User","role":"editor","joinedAt":1699900000}' \
  --project from-zero-84253

# راقب السجل - يجب أن ترى:
# 👤 User user123 joined room room1
```

#### onJobComplete (يُطلق عند تحديث job)
```bash
# أنشئ job أولاً
firebase firestore:set studio_jobs/job1 \
  '{"userId":"user123","status":"processing"}' \
  --project from-zero-84253

# ثم حدثه
firebase firestore:set studio_jobs/job1 \
  '{"userId":"user123","status":"done","outputUrl":"https://example.com/output.mp4"}' \
  --project from-zero-84253

# راقب السجل - يجب أن ترى:
# Job job1 completed with status: done
```

### D) اختبار Scheduled Functions

الدوال المجدولة تعمل تلقائيًا حسب الجدول:
- `cleanupOldSessions`: كل 24 ساعة
- `monitorRoomActivity`: كل ساعة

للاختبار اليدوي في المحاكي:
```bash
# لا يمكن تشغيلها يدويًا في المحاكي بسهولة
# لكن يمكن تعديل الجدول مؤقتاً إلى "every 1 minutes" للاختبار
```

---

## 5. النشر في الإنتاج 🚀

### نشر جميع الدوال
```bash
firebase deploy --only functions
```

### نشر دالة واحدة فقط
```bash
firebase deploy --only functions:triggerDeploy
```

### نشر مجموعة محددة
```bash
firebase deploy --only functions:exportIncidentsCsv,functions:exportIncidentsCsvCallable
```

---

## 6. التحقق بعد النشر

### A) Firebase Console
1. افتح [Firebase Console](https://console.firebase.google.com)
2. اذهب إلى **Functions** → **Dashboard**
3. تحقق من:
   - ✅ جميع الدوال تظهر في القائمة
   - ✅ عمود **"Version"** يعرض **"2nd gen"** أو **"v2"**
   - ✅ عمود **"Region"** يعرض **"us-central1"**
   - ✅ عمود **"Memory"** يعرض القيم الصحيحة (256 MiB, 2 GiB, إلخ)

### B) اختبار Functions في الإنتاج

#### onRequest Endpoints
```bash
# استبدل PROJECT_ID بمعرف مشروعك
PROJECT_ID="from-zero-84253"

# اختبار exportIncidentsCsv
curl "https://us-central1-${PROJECT_ID}.cloudfunctions.net/exportIncidentsCsv?limit=5"

# اختبار webhook
curl -X POST "https://us-central1-${PROJECT_ID}.cloudfunctions.net/runwayWebhook" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"test","status":"done","timestamp":"2025-11-07T13:00:00Z"}'
```

#### Callable Functions من التطبيق
```typescript
// في تطبيق العميل (Web/Mobile)
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

// اختبار في الإنتاج
const exportIncidents = httpsCallable(functions, 'exportIncidentsCsvCallable');

const result = await exportIncidents({
  dateFrom: '2025-01-01',
  dateTo: '2025-11-07',
  limit: 10
});

console.log('✅ Result:', result.data);
```

### C) مراقبة السجلات

#### من Firebase Console
1. اذهب إلى **Functions** → **Logs**
2. اختر الدالة من القائمة المنسدلة
3. راقب السجلات المباشرة

#### من سطر الأوامر
```bash
# عرض سجلات جميع الدوال
firebase functions:log

# عرض سجلات دالة محددة
firebase functions:log --only triggerDeploy

# متابعة السجلات المباشرة
firebase functions:log --only exportIncidentsCsvCallable --follow
```

---

## 7. قائمة التحقق النهائية ✅

- [ ] ✅ البناء ناجح (`pnpm build`)
- [ ] ✅ جميع الدوال تستخدم v2 imports
- [ ] ✅ لا توجد أخطاء TypeScript
- [ ] ✅ المحاكيات تعمل بدون مشاكل
- [ ] ✅ اختبار onRequest endpoints محلياً
- [ ] ✅ اختبار onCall functions محلياً
- [ ] ✅ اختبار Firestore triggers محلياً
- [ ] ✅ النشر في الإنتاج ناجح
- [ ] ✅ Firebase Console يعرض "v2" لجميع الدوال
- [ ] ✅ اختبار endpoints في الإنتاج
- [ ] ✅ مراقبة السجلات للتأكد من عدم وجود أخطاء

---

## 8. الاختبارات الآلية (اختياري)

### إنشاء ملف اختبار
**ملف**: `functions/test/v2-functions.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import * as functions from '../src/index';

describe('Firebase Functions v2', () => {
  it('should export all v2 functions', () => {
    // التحقق من وجود الدوال
    expect(functions.triggerDeploy).toBeDefined();
    expect(functions.exportIncidentsCsv).toBeDefined();
    expect(functions.exportIncidentsCsvCallable).toBeDefined();
    expect(functions.runwayWebhook).toBeDefined();
    expect(functions.veoWebhook).toBeDefined();
    expect(functions.studioWebhook).toBeDefined();
    expect(functions.onJobComplete).toBeDefined();
    expect(functions.onSessionWrite).toBeDefined();
    expect(functions.cleanupOldSessions).toBeDefined();
    expect(functions.monitorRoomActivity).toBeDefined();
  });
});
```

### تشغيل الاختبارات
```bash
cd functions
pnpm add -D vitest
pnpm vitest run
```

---

## 9. مراقبة الأداء

### Metrics في Firebase Console
1. اذهب إلى **Functions** → **Dashboard**
2. راقب:
   - **Invocations**: عدد الاستدعاءات
   - **Execution time**: وقت التنفيذ
   - **Memory usage**: استخدام الذاكرة
   - **Error rate**: معدل الأخطاء

### تنبيهات (Alerts)
قم بإعداد تنبيهات للأخطاء:
1. اذهب إلى **Functions** → **Health**
2. اضغط **Create Alert**
3. اختر:
   - **Metric**: Error rate
   - **Threshold**: > 5%
   - **Notification**: Email

---

## 10. استكشاف الأخطاء

### خطأ: "Function not found"
**الحل**: تأكد من النشر بنجاح
```bash
firebase deploy --only functions:functionName
```

### خطأ: "UNAUTHENTICATED"
**الحل**: تأكد من تسجيل الدخول في التطبيق العميل
```typescript
import { getAuth, signInAnonymously } from 'firebase/auth';
await signInAnonymously(getAuth());
```

### خطأ: "PERMISSION_DENIED"
**الحل**: تحقق من Custom Claims
```typescript
// في Functions
if (!request.auth.token.admin) {
  throw new HttpsError('permission-denied', 'Must be admin');
}
```

### خطأ: "Missing index"
**الحل**: انشر Firestore indexes
```bash
firebase deploy --only firestore:indexes
```

---

## خلاصة

✅ جميع الدوال تم ترحيلها إلى v2 بنجاح
✅ البناء ناجح بدون أخطاء
✅ جاهز للاختبار في المحاكيات
✅ جاهز للنشر في الإنتاج

**الخطوة التالية**:
```bash
firebase emulators:start --only functions,firestore
```

ثم:
```bash
firebase deploy --only functions
```

---

**التاريخ**: 2025-11-07
**الإصدار**: Firebase Functions v2 (firebase-functions ^6.6.0)
**الحالة**: ✅ جاهز للإنتاج
