# 🚀 Phase 49 - خطوات النشر

## ✅ التحقق من الجاهزية (تم!)

```bash
./scripts/check-phase49-ready.sh
```

**النتيجة:** ✅ جميع الفحوصات نجحت!

---

## 📝 الخطوات التالية

### الخطوة 1️⃣: النشر (اختياري - للإنتاج فقط)

⚠️ **تحذير:** هذا سينشر على Firebase الإنتاجي!

```bash
./scripts/deploy-phase49.sh
```

**ما سيحدث:**
1. تحديث Firestore Rules
2. تحديث Firestore Indexes
3. بناء ونشر Cloud Functions:
   - `log` - استقبال السجلات
   - `onEventWrite` - اكتشاف الحوادث
   - `processAlerts` - إرسال التنبيهات
   - `testAlert` - اختبار التنبيهات
4. بناء ونشر Next.js App

**الوقت المتوقع:** 5-10 دقائق

---

### الخطوة 2️⃣: الاختبار المحلي (موصى به أولاً!)

```bash
# تشغيل المحاكيات محليًا
firebase emulators:start --only functions,firestore,auth

# في terminal آخر، شغّل Next.js
pnpm dev

# في terminal ثالث، اختبر
./scripts/test-phase49.sh
```

**أو استخدم السكريبت الشامل:**

```bash
./start-local.sh
# ثم في terminal آخر:
./scripts/test-phase49.sh
```

---

### الخطوة 3️⃣: إعداد التنبيهات عبر Telegram (اختياري)

#### 3.1 إنشاء Telegram Bot

1. افتح Telegram وابحث عن `@BotFather`
2. أرسل `/newbot`
3. اتبع التعليمات لإنشاء bot
4. احفظ الـ **Bot Token** (مثال: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

#### 3.2 الحصول على Chat ID

**الطريقة 1: للرسائل الشخصية**
1. ابحث عن `@userinfobot` في Telegram
2. ابدأ محادثة معه
3. سيرسل لك معلوماتك بما فيها `Chat ID`

**الطريقة 2: للمجموعات**
1. أضف البوت إلى مجموعة
2. أرسل رسالة في المجموعة
3. افتح: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. ابحث عن `"chat":{"id":-100123...`

#### 3.3 ضبط في Firebase

```bash
firebase functions:config:set \
  alerts.telegram_bot_token="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" \
  alerts.telegram_chat_id="YOUR_CHAT_ID"
```

**ثم أعد نشر processAlerts function:**

```bash
firebase deploy --only functions:processAlerts
```

#### 3.4 اختبار التنبيهات

```bash
# اختبار يدوي
curl -X POST https://YOUR_PROJECT.cloudfunctions.net/testAlert

# أو أرسل خطأ حقيقي
curl -X POST https://YOUR_PROJECT.web.app/api/log \
  -H 'Content-Type: application/json' \
  -d '{
    "level": "error",
    "message": "Test alert from deployment",
    "service": "web"
  }'
```

**يجب أن تصلك رسالة في Telegram خلال دقيقة!**

---

### الخطوة 4️⃣: فتح لوحة التحكم

#### محليًا (للتطوير):

```bash
open http://localhost:3000/ops/incidents
```

#### على الإنتاج:

```bash
open https://YOUR_PROJECT.web.app/ops/incidents
```

**ملاحظة:** ستحتاج إلى تسجيل دخول كـ Admin لرؤية لوحة التحكم.

---

## 🧪 سيناريوهات الاختبار

### السيناريو 1: اختبار خطأ واحد

```bash
curl -X POST http://localhost:3000/api/log \
  -H 'Content-Type: application/json' \
  -d '{
    "level": "error",
    "service": "web",
    "code": 500,
    "message": "Test single error",
    "context": {"route": "/test"},
    "fingerprint": "test:500:/test"
  }'
```

**النتيجة المتوقعة:**
- ✅ حدث جديد في `ops_events`
- ✅ حادث جديد في `ops_incidents`
- ✅ update في `ops_incident_updates`

### السيناريو 2: اختبار موجة أخطاء (Spike)

```bash
# إرسال 15 خطأ لتحفيز incident
for i in {1..15}; do
  curl -s -X POST http://localhost:3000/api/log \
    -H 'Content-Type: application/json' \
    -d "{
      \"level\": \"error\",
      \"message\": \"Test spike error #$i\",
      \"fingerprint\": \"test:spike\"
    }"
  echo "Sent error #$i"
done
```

**النتيجة المتوقعة:**
- ✅ 15 حدث في `ops_events`
- ✅ تحديث severity الحادث إلى `medium` أو `high`
- ✅ alert في `_alerts_queue`
- ✅ رسالة Telegram (إذا مُفعّل)

### السيناريو 3: اختبار من المتصفح

افتح Developer Console في المتصفح وشغّل:

```javascript
// استيراد logger
import logger from '@/lib/logger';

// اختبار أنواع مختلفة
logger.error('Test error from console', { test: true });
logger.warn('Test warning', { level: 'warning' });
logger.info('Test info', { message: 'info message' });

// اختبار مع استثناء
try {
  throw new Error('Test exception');
} catch (error) {
  logger.error('Caught exception', error);
}
```

---

## 📊 التحقق من البيانات

### في Firestore Console

```bash
open https://console.firebase.google.com/project/YOUR_PROJECT/firestore
```

**افحص Collections:**
1. `ops_events` - يجب أن ترى أحداث جديدة
2. `ops_incidents` - يجب أن ترى حادث واحد على الأقل
3. `ops_incident_updates` - timeline الحوادث
4. `_alerts_queue` - قائمة الانتظار للتنبيهات

### عبر Firebase CLI

```bash
# عرض الأحداث
firebase firestore:list ops_events --project YOUR_PROJECT

# عرض الحوادث
firebase firestore:list ops_incidents --project YOUR_PROJECT

# قراءة حادث محدد
firebase firestore:get ops_incidents/test:500:/test --project YOUR_PROJECT
```

---

## 🔍 مراقبة Logs

### Logs المحلية

```bash
# Next.js logs
tail -f logs/nextjs.log

# Emulator logs
tail -f logs/emulators.log
```

### Logs الإنتاج

```bash
# جميع functions
firebase functions:log

# function محددة
firebase functions:log --only log
firebase functions:log --only onEventWrite
firebase functions:log --only processAlerts

# آخر ساعة
firebase functions:log --since 1h

# فقط الأخطاء
firebase functions:log | grep ERROR
```

---

## 🐛 حل المشاكل الشائعة

### المشكلة 1: السجلات لا تظهر في Firestore

**الحلول:**
```bash
# 1. تحقق من logs الـ function
firebase functions:log --only log

# 2. تحقق من URL
echo $NEXT_PUBLIC_CF_LOG_URL

# 3. اختبر مباشرة
curl -X POST $NEXT_PUBLIC_CF_LOG_URL -d '{"level":"info","message":"test"}'
```

### المشكلة 2: الحوادث لا تُنشأ

**الحلول:**
```bash
# 1. تحقق من trigger
firebase functions:log --only onEventWrite

# 2. تأكد أن الحدث error
# level يجب أن يكون 'error' أو code >= 500

# 3. تحقق من indexes
firebase deploy --only firestore:indexes
```

### المشكلة 3: التنبيهات لا تُرسل

**الحلول:**
```bash
# 1. تحقق من config
firebase functions:config:get

# 2. افحص _alerts_queue في Firestore
firebase firestore:list _alerts_queue

# 3. اختبر يدويًا
curl https://YOUR_PROJECT.cloudfunctions.net/testAlert
```

### المشكلة 4: لوحة التحكم لا تُحمّل

**الحلول:**
- تحقق من console المتصفح
- تأكد أن المستخدم admin
- تحقق من Firebase config
- تأكد من Firestore Rules

---

## ✅ قائمة التحقق النهائية

### قبل النشر
- [ ] جميع الفحوصات نجحت (`check-phase49-ready.sh`)
- [ ] اختبار محلي ناجح
- [ ] نسخة احتياطية من Firestore (إذا كان إنتاج)

### بعد النشر
- [ ] Functions منشورة بنجاح
- [ ] Firestore Rules محدّثة
- [ ] Indexes محدّثة
- [ ] Next.js App منشور

### الاختبار
- [ ] إرسال خطأ تجريبي ينجح
- [ ] حادث يُنشأ في Firestore
- [ ] لوحة التحكم تعرض الحادث
- [ ] التنبيهات تعمل (إذا مُفعّلة)

---

## 🎉 النجاح!

إذا اكتملت جميع الخطوات:

✅ **Phase 49 منشور ويعمل!**

**الخطوات التالية:**
1. راقب الحوادث في `/ops/incidents`
2. اضبط thresholds في `onEventWrite.ts` حسب الحاجة
3. أضف alerting channels إضافية (Email, Slack, etc.)
4. ابنِ Phase 50! 🚀

---

**تاريخ آخر تحديث:** 2025-10-14
**الحالة:** ✅ جاهز للنشر
