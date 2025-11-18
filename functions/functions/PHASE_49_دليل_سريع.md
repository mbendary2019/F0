# Phase 49: دليل الإعداد السريع

## ✅ تم الإعداد بنجاح!

تم إعداد Phase 49 (Error Tracking & Incident Management) بنجاح وهو جاهز للاختبار.

## 🎯 ما تم إضافته

### 1. Cloud Functions
- ✅ `log` - endpoint لاستقبال الأخطاء
- ✅ `onEventWrite` - trigger ينشئ incidents تلقائياً

### 2. API Routes
- ✅ `/api/log` - proxy في Next.js لتسهيل الاستدعاء من المتصفح

### 3. Dashboard
- ✅ `/ops/incidents` - لوحة تحكم لعرض الحوادث

### 4. Utility Functions
- ✅ `redactPII` - إخفاء البيانات الحساسة
- ✅ `hashIP` - تشفير عناوين IP
- ✅ `checkRate` - rate limiting

## 🚀 الاختبار السريع

### 1. تأكد أن الخدمات تعمل
```bash
# يجب أن تكون هذه الخدمات مشغلة:
# - Next.js على port 3000
# - Firebase Emulators (Firestore: 8080, Functions: 5001)
```

### 2. أرسل خطأ اختباري
```bash
curl -X POST "http://localhost:3000/api/log" \
  -H 'Content-Type: application/json' \
  -d '{"level":"error","service":"web","code":500,"message":"TEST_ERROR","context":{"route":"/test"}}'
```

### 3. شغّل السكريبت الكامل
```bash
./test-phase49-local.sh
```

### 4. افتح Dashboard
افتح المتصفح على: http://localhost:3000/ops/incidents

يجب أن ترى:
- قائمة بالـ incidents
- Severity (low/medium/high/critical)
- Status (open/acknowledged/resolved)
- Event count
- First seen / Last seen

## 📊 كيف يعمل النظام؟

1. **تسجيل الخطأ**: يُرسل الخطأ إلى `/api/log`
2. **الحفظ**: يُحفظ في `ops_events` collection
3. **Trigger**: ينشط `onEventWrite` تلقائياً
4. **التحليل**: يحسب عدد الأخطاء المشابهة في آخر 5 دقائق
5. **إنشاء Incident**: إذا كان level=error أو code>=500:
   - يُنشئ أو يحدّث incident في `ops_incidents`
   - يحدد severity بناءً على التكرار:
     - 1-9: low
     - 10-29: medium
     - 30-99: high
     - 100+: critical
6. **Alerts**: إذا كان severity=high أو critical، يُضاف إلى `_alerts_queue`

## 🔧 الإعدادات المطلوبة

### .env.local
```bash
# Functions Emulator (محلي)
NEXT_PUBLIC_CF_LOG_URL=http://127.0.0.1:5001/from-zero-84253/us-central1/log
NEXT_PUBLIC_LOG_ENDPOINT=/api/log

# Firebase (موجود بالفعل)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=from-zero-84253
```

## 🎮 الاختبار من المتصفح Console

افتح http://localhost:3000 ثم في Console:

```javascript
// إرسال خطأ
fetch('/api/log', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    level: 'error',
    service: 'web',
    code: 500,
    message: 'Browser test error',
    context: {page: window.location.pathname}
  })
})

// إرسال موجة أخطاء
for(let i=0; i<15; i++) {
  fetch('/api/log', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      level: 'error',
      message: `Spike test ${i}`,
      fingerprint: 'spike-test'
    })
  })
}
```

## 📝 ملاحظات مهمة

1. **Emulator فقط**: حالياً النظام يعمل مع Firebase Emulators
2. **Admin Required**: لوحة التحكم تتطلب admin claims (حسب firestore.rules)
3. **Local Data**: البيانات محفوظة محلياً في Emulator
4. **Rate Limiting**: 120 request في الدقيقة لكل IP

## 📦 الملفات الجديدة

```
functions/src/
├── http/log.ts                    # Log endpoint
├── incidents/onEventWrite.ts      # Incident trigger
└── util/
    ├── redact.ts                  # PII redaction
    ├── hash.ts                    # IP hashing
    └── rateLimit.ts               # Rate limiting

src/app/
└── ops/incidents/page.tsx         # Dashboard
└── api/log/route.ts               # API proxy
```

## 🎉 الخطوات التالية

1. ✅ **افتح Dashboard**: http://localhost:3000/ops/incidents
2. ✅ **شغّل الاختبارات**: `./test-phase49-local.sh`
3. ✅ **افحص Emulator UI**: http://localhost:4000/firestore
4. ✅ **اختبر من المتصفح**: استخدم Console

---

**تم بنجاح!** 🚀 Phase 49 جاهز للاختبار!
