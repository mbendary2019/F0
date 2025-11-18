# 🧪 Phase 49: دليل التشغيل والاختبار المحلي

## ✅ تم الإنجاز

- ✅ نشر Firestore Rules و Indexes
- ✅ نشر 3 Cloud Functions (log, onEventWrite, processAlerts)
- ✅ إعداد .env.local للبيئة المحلية
- ✅ جميع السكربتات جاهزة

## 🚀 خطوات التشغيل المحلي

### 1️⃣ تشغيل الخدمات (Terminal 1)

```bash
./start-local.sh
```

**سيتم تشغيل:**
- ✅ Next.js على المنفذ **3000**
- ✅ Firestore Emulator على المنفذ **8080**
- ✅ Functions Emulator على المنفذ **5001**
- ✅ Emulator UI على المنفذ **4000**

### 2️⃣ اختبار Phase 49 (Terminal 2)

افتح terminal جديد وقم بتشغيل:

```bash
./test-phase49-local.sh
```

**الاختبارات المضمنة:**
1. ✅ التحقق من عمل Next.js (port 3000)
2. ✅ التحقق من عمل Firestore Emulator (port 8080)
3. 📝 إرسال خطأ واحد
4. ⚡ إرسال 15 خطأ (Spike Test)
5. ⚠️ إرسال Warning
6. ℹ️ إرسال Info
7. 🔥 التحقق من البيانات في Firestore

### 3️⃣ فتح لوحة التحكم

```bash
open http://localhost:3000/ops/incidents
```

أو افتح المتصفح على: `http://localhost:3000/ops/incidents`

**ما يجب أن تراه:**
- ✅ Incident تم إنشاؤه أو تحديثه (id = fingerprint)
- ✅ عدّاد eventCount يزداد
- ✅ status = "open"
- ✅ أزرار Acknowledge/Resolve (للـ Admin فقط)

### 4️⃣ التحقق من البيانات في Emulator UI

افتح: `http://localhost:4000`

**تحقق من Collections:**
- `ops_events` - الأحداث الخام
- `ops_incidents` - الحوادث
- `ops_incident_updates` - Timeline
- `_alerts_queue` - التنبيهات (إذا وصل Spike لـ High/Critical)

## 🧪 اختبار يدوي بـ CURL

```bash
# اختبار خطأ واحد
curl -X POST "http://127.0.0.1:5001/from-zero-84253/us-central1/log" \
  -H 'Content-Type: application/json' \
  -d '{
    "level":"error",
    "service":"web",
    "code":500,
    "message":"TEST_500 manual",
    "context":{"route":"/api/test"}
  }'
```

## ✅ معايير القبول (DoD)

| المعيار | التوقع |
|---------|---------|
| مستند في ops_events | ✅ level="error" أو code>=500 |
| Incident في ops_incidents | ✅ id = fingerprint |
| Timeline في ops_incident_updates | ✅ نوع الحدث مسجل |
| Severity | ✅ medium (≥10), high (≥30), critical (≥100) |
| Alerts | ✅ في _alerts_queue إذا High/Critical |

## 🧯 حل المشاكل الشائعة

### ❌ rate_limited (429)
**السبب:** السكربت يرسل طلبات كثيرة بسرعة

**الحل:**
- قلل عدد الطلبات في السكربت
- أو ارفع الحد مؤقتًا في `functions/src/util/rateLimit.ts`

### ❌ Incident لا يظهر
**التحقق من:**
1. الرسالة `level="error"` أو `code>=500`
2. Trigger شغال (تحقق من Logs في Emulator UI)
3. Indexes تم نشرها

### ❌ Dashboard فارغ
**السبب:** تحتاج صلاحيات Admin

**الحل:**
- سجل دخول بحساب له `token.admin=true`
- أو استخدم السكربت لإضافة admin:
```bash
FIREBASE_SERVICE_ACCOUNT_FILE=/path/to/service-account.json \
node scripts/set-admin.mjs "your-email@example.com"
```

### ❌ تنبيهات Telegram لا تصل
**الحل:** قم بضبط التوكن:
```bash
firebase functions:config:set \
  alerts.telegram_bot_token="YOUR_BOT_TOKEN" \
  alerts.telegram_chat_id="YOUR_CHAT_ID"
```

## 🌐 النشر للإنتاج

بعد التأكد من العمل محلياً:

### 1. نشر Firestore (إذا لم تنشر بعد)
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 2. بناء ونشر Functions
```bash
cd functions
npm run build
cd ..
firebase deploy --only functions:log,functions:onEventWrite,functions:processAlerts
```

### 3. تحويل .env.local للإنتاج

غيّر في `.env.local`:
```bash
# استخدم هذا للإنتاج
NEXT_PUBLIC_CF_LOG_URL=https://us-central1-from-zero-84253.cloudfunctions.net/log
```

### 4. نشر Next.js
```bash
pnpm run build
firebase deploy --only hosting
```

## 📊 URLs المهمة

| الخدمة | URL محلي | URL إنتاج |
|--------|---------|-----------|
| Next.js | http://localhost:3000 | https://from-zero-84253.web.app |
| Emulator UI | http://localhost:4000 | - |
| Functions Emulator | http://localhost:5001 | - |
| log Function | http://127.0.0.1:5001/.../log | https://us-central1-.../log |
| Dashboard | /ops/incidents | /ops/incidents |

## 📝 ملاحظات هامة

1. **Admin Access**: Dashboard يتطلب `admin=true` في Custom Claims
2. **Rate Limiting**: 120 requests/minute per IP
3. **TTL**: البيانات تنتهي بعد 7 أيام تلقائياً
4. **PII Redaction**: يتم حذف البيانات الحساسة تلقائياً

## 🎯 الخطوات التالية

1. ✅ اختبار محلي
2. ⬜ إعداد Telegram Alerts (اختياري)
3. ⬜ دمج Logger في التطبيق
4. ⬜ نشر للإنتاج
5. ⬜ مراقبة Functions logs

---

**تم إنشاء هذا الدليل بواسطة Phase 49 Implementation** 🚀
