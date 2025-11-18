# 🚀 ابدأ هنا: تشغيل المحاكيات المحلية
# START HERE: Local Emulators Setup

> ✅ **تم الإعداد بالكامل!** جميع الخطوات المطلوبة تم تطبيقها.

---

## 📋 ماذا تم؟ / What's Done?

✅ إعداد متغيرات البيئة للمحاكيات
✅ ربط Admin SDK بالمحاكيات (لا يلمس الإنتاج)
✅ تحديث إصدار Node إلى 22
✅ تفعيل Storage و UI Emulator
✅ تصدير جميع الدوال (Phase 49-52)
✅ إنشاء سكريبتات التشغيل السريع
✅ إزالة تحذير ADC نهائياً

---

## 🎯 التشغيل في 3 خطوات

### 1️⃣ تشغيل المحاكيات

```bash
./quick-start-emulators.sh
```

### 2️⃣ فتح المتصفح

```bash
open http://127.0.0.1:4000
```

### 3️⃣ ابدأ التطوير! 🎉

---

## 📚 الملفات المرجعية

| الملف | المحتوى |
|-------|---------|
| [SETUP_COMPLETE_AR.md](SETUP_COMPLETE_AR.md) | ملخص شامل بالعربي |
| [EMULATOR_SETUP_GUIDE.md](EMULATOR_SETUP_GUIDE.md) | دليل تفصيلي بالإنجليزي |
| [EMULATOR_COMMANDS.md](EMULATOR_COMMANDS.md) | أوامر سريعة مرجعية |

---

## 🔐 إعداد GitHub (اختياري)

إذا كنت بحاجة لـ GitHub Integration:

```bash
./setup-emulators.sh
```

سيطلب منك إدخال:
- GitHub Client ID
- GitHub Client Secret
- GitHub Webhook Secret

ثم سيعمل كل شيء تلقائياً.

---

## 🌐 العناوين المهمة

| الخدمة | العنوان |
|--------|---------|
| **UI واجهة المحاكيات** | http://127.0.0.1:4000 |
| **Firestore قاعدة البيانات** | http://127.0.0.1:8080 |
| **Auth المصادقة** | http://127.0.0.1:9099 |
| **Functions الدوال** | http://127.0.0.1:5001 |
| **Storage التخزين** | http://127.0.0.1:9199 |

---

## ✅ اختبار سريع

```bash
# Health Check
curl http://127.0.0.1:5001/from-zero-84253/us-central1/readyz

# Audit Test
curl http://127.0.0.1:5001/from-zero-84253/us-central1/auditTest

# Error Tracking Test
curl -X POST http://127.0.0.1:5001/from-zero-84253/us-central1/log \
  -H "Content-Type: application/json" \
  -d '{"level":"error","message":"Test"}'
```

---

## 🛑 إيقاف المحاكيات

```bash
pkill -9 -f "firebase|java"
```

---

## 🔍 استكشاف الأخطاء

### المحاكيات لا تعمل؟

```bash
# إيقاف كل شيء
pkill -9 -f "firebase|java"

# إعادة التشغيل
./quick-start-emulators.sh
```

### Port مستخدم؟

```bash
lsof -ti:4000 -ti:5001 -ti:8080 -ti:9099 -ti:9199 | xargs kill -9
./quick-start-emulators.sh
```

### Build فاشل؟

```bash
cd functions
rm -rf lib/ node_modules/
npm install
npm run build
cd ..
```

---

## 📖 مراجع مفيدة

- [Firebase Emulator Suite Docs](https://firebase.google.com/docs/emulator-suite)
- [Firebase Functions Config](https://firebase.google.com/docs/functions/config-env)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)

---

## 💡 نصائح

### 1. لا تنشر مفاتيح الإنتاج

- ✅ استخدم المحاكيات للتطوير
- ✅ استخدم Firebase Config للإنتاج
- ⚠️ لا تنشر `functions/.env` في Git

### 2. افحص Emulator UI

افتح http://127.0.0.1:4000 وتحقق من:
- Auth: المستخدمون التجريبيون
- Firestore: البيانات المحلية
- Functions: اللوجز المباشرة
- Storage: الملفات المحملة

### 3. استخدم الأوامر السريعة

راجع [EMULATOR_COMMANDS.md](EMULATOR_COMMANDS.md) لجميع الأوامر المفيدة.

---

## 🎉 جاهز!

الآن يمكنك:
- ✅ تطوير محلياً بدون لمس الإنتاج
- ✅ اختبار الدوال مباشرة
- ✅ مراقبة البيانات في الوقت الفعلي
- ✅ تصحيح الأخطاء بسهولة

---

## 📞 المساعدة

واجهتك مشكلة؟ تحقق من:

1. [SETUP_COMPLETE_AR.md](SETUP_COMPLETE_AR.md) - للحلول الشاملة
2. [EMULATOR_COMMANDS.md](EMULATOR_COMMANDS.md) - للأوامر السريعة
3. [EMULATOR_SETUP_GUIDE.md](EMULATOR_SETUP_GUIDE.md) - للدليل المفصل

---

**🚀 ابدأ الآن:**

```bash
./quick-start-emulators.sh
```

**ثم افتح:** http://127.0.0.1:4000

---

✨ **تم بواسطة:** Claude Code
📅 **التاريخ:** 2025-01-05
🏷️ **الإصدار:** Phase 52 + Emulator Setup Complete
