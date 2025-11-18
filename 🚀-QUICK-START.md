# 🚀 From Zero - ابدأ الآن!

> كل ما تحتاجه في 3 خطوات!

---

## ⚡ البدء السريع (3 خطوات)

```bash
# 1️⃣ إعداد البيئة
cp .env.local.example .env.local && nano .env.local

# 2️⃣ تشغيل كل شيء
./start-local.sh

# 3️⃣ افتح المتصفح
open http://localhost:3000
```

**هذا كل شيء! 🎉**

---

## 📋 الأوامر الأساسية

| الأمر | الوصف |
|------|--------|
| `./start-local.sh` | **ابدأ التطوير** |
| `./stop-local.sh` | أوقف كل شيء |
| `./quick-test.sh` | اختبار سريع (10 ث) |
| `./test-services.sh` | اختبار شامل (30 ث) |
| `./deploy-production.sh all` | انشر على الإنتاج |

---

## 🧪 الأوامر التفاعلية

```bash
# تحميل الأوامر
source useful-commands.sh

# استخدامها
test_orchestrator        # اختبار الأوركستريتور
test_error_log           # تسجيل حدث خطأ
test_firestore           # اختبار Firestore
health_check_all         # فحص جميع الخدمات
watch_logs nextjs        # مراقبة logs
```

---

## 📚 التوثيق

| الملف | متى تقرأه |
|------|-----------|
| **[START-HERE-AR.md](START-HERE-AR.md)** | أول مرة |
| **[INDEX.md](INDEX.md)** | فهرس شامل |
| **[COMMANDS-CHEATSHEET.md](COMMANDS-CHEATSHEET.md)** | مرجع الأوامر |

---

## 🌐 الخدمات

بعد التشغيل:
- **App:** http://localhost:3000
- **Firestore:** http://localhost:8080
- **Auth:** http://localhost:9099
- **Functions:** http://localhost:5001

---

## 🆘 مشكلة؟

```bash
./stop-local.sh
./start-local.sh
```

راجع [START-HERE-AR.md](START-HERE-AR.md) للتفاصيل.

---

**✨ استمتع ببناء شيء مذهل! 🚀**
