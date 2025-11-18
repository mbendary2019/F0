# 🚀 أوامر المحاكيات السريعة
# Quick Emulator Commands

## تشغيل المحاكيات / Start Emulators

### الطريقة الأسرع / Fastest Way
```bash
./quick-start-emulators.sh
```

### يدوياً / Manual
```bash
# إيقاف القديم + بناء + تشغيل
pkill -9 -f "firebase|java" 2>/dev/null || true
cd functions && npm run build && cd ..
firebase emulators:start --only firestore,functions,auth,storage,ui
```

---

## إعداد GitHub / Setup GitHub

```bash
./setup-emulators.sh
```

أو يدوياً:

```bash
# توليد مفتاح
ENCRYPTION_KEY=$(openssl rand -hex 32)

# حفظ
firebase functions:config:set \
  github.client_id="YOUR_ID" \
  github.client_secret="YOUR_SECRET" \
  github.redirect_uri="http://localhost:3000/api/github/callback" \
  github.webhook_secret="YOUR_WEBHOOK_SECRET" \
  encryption.key="$ENCRYPTION_KEY"

# التحقق
firebase functions:config:get
```

---

## اختبارات سريعة / Quick Tests

### Health Check
```bash
curl http://127.0.0.1:5001/from-zero-84253/us-central1/readyz
```

### Audit Test
```bash
curl http://127.0.0.1:5001/from-zero-84253/us-central1/auditTest
```

### Error Log Test
```bash
curl -X POST http://127.0.0.1:5001/from-zero-84253/us-central1/log \
  -H "Content-Type: application/json" \
  -d '{"level":"error","message":"Test","metadata":{}}'
```

### فتح UI / Open UI
```bash
open http://127.0.0.1:4000
```

---

## إدارة العمليات / Process Management

### إيقاف المحاكيات / Stop Emulators
```bash
pkill -9 -f "firebase|java"
```

### إيقاف Ports محددة / Kill Specific Ports
```bash
lsof -ti:4000 -ti:5001 -ti:8080 -ti:9099 -ti:9199 | xargs kill -9
```

### التحقق من Ports / Check Ports
```bash
lsof -i :4000 -i :5001 -i :8080 -i :9099 -i :9199
```

---

## بناء الدوال / Build Functions

### بناء عادي / Normal Build
```bash
cd functions && npm run build && cd ..
```

### بناء مع Watch / Build with Watch
```bash
cd functions && npm run build -- --watch
```

### مسح وبناء / Clean Build
```bash
cd functions
rm -rf lib/
npm run build
cd ..
```

---

## Firebase Config Management

### عرض الكل / Show All
```bash
firebase functions:config:get
```

### عرض GitHub فقط / Show GitHub Only
```bash
firebase functions:config:get github
```

### عرض Encryption فقط / Show Encryption Only
```bash
firebase functions:config:get encryption
```

### حذف Config / Delete Config
```bash
firebase functions:config:unset github
firebase functions:config:unset encryption
```

---

## فحص الملفات / File Checks

### فحص .env.local
```bash
cat .env.local | grep EMULATOR
```

### فحص functions/.env
```bash
cat functions/.env
```

### فحص firebase.json
```bash
cat firebase.json | grep -A 20 emulators
```

---

## لوجز / Logs

### عرض لوجز Functions
```bash
# أثناء التشغيل في terminal المحاكيات
# In emulator terminal while running
```

### عرض لوجز الإنتاج / Production Logs
```bash
firebase functions:log --only log
firebase functions:log --only onEventWrite
```

---

## نشر للإنتاج / Deploy to Production

### نشر الدوال فقط / Functions Only
```bash
firebase deploy --only functions
```

### نشر دالة واحدة / Single Function
```bash
firebase deploy --only functions:log
firebase deploy --only functions:exchangeOAuthCode
```

### نشر كل شيء / Deploy All
```bash
firebase deploy
```

---

## تنظيف / Cleanup

### مسح البيانات المحلية / Clear Local Data
```bash
# إيقاف المحاكيات أولاً
pkill -9 -f "firebase|java"

# مسح بيانات Emulator
rm -rf ~/.config/firebase/
```

### مسح node_modules
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
cd ..
```

---

## استكشاف الأخطاء / Troubleshooting

### مشكلة: Port مستخدم
```bash
# اقتل كل شيء
pkill -9 -f "firebase|java"
lsof -ti:4000 -ti:5001 -ti:8080 -ti:9099 -ti:9199 | xargs kill -9

# أعد التشغيل
./quick-start-emulators.sh
```

### مشكلة: Build فاشل
```bash
cd functions
rm -rf lib/ node_modules/
npm install
npm run build
cd ..
```

### مشكلة: تحذير ADC
```bash
# تأكد من المتغيرات
echo "FUNCTIONS_EMULATOR=true" >> functions/.env
echo "FIRESTORE_EMULATOR_HOST=127.0.0.1:8080" >> functions/.env
echo "FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199" >> functions/.env
```

---

## عناوين مهمة / Important URLs

| الخدمة | العنوان |
|--------|---------|
| Emulator UI | http://127.0.0.1:4000 |
| Firestore | http://127.0.0.1:8080 |
| Auth | http://127.0.0.1:9099 |
| Functions | http://127.0.0.1:5001 |
| Storage | http://127.0.0.1:9199 |

---

## نصائح سريعة / Quick Tips

### تشغيل في الخلفية / Run in Background
```bash
firebase emulators:start --only firestore,functions,auth,storage,ui > emulator.log 2>&1 &
```

### مراقبة اللوجز / Watch Logs
```bash
tail -f emulator.log
```

### إيقاف الخلفية / Stop Background
```bash
pkill -9 -f "firebase|java"
```

---

## سكريبتات مخصصة / Custom Scripts

### إنشاء مستخدم تجريبي / Create Test User
```bash
# في Emulator UI: http://127.0.0.1:4000
# Auth → Add User
```

### إضافة بيانات تجريبية / Add Test Data
```bash
# في Emulator UI: http://127.0.0.1:4000
# Firestore → Start Collection
```

---

**💡 نصيحة:** احفظ هذا الملف كمرجع سريع!
**💡 Tip:** Bookmark this file as a quick reference!
