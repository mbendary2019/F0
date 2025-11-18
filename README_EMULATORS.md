# 🔥 Firebase Emulators - دليل سريع

> ✅ **جاهز للاستخدام!** جميع الإعدادات مكتملة.

## 🚀 تشغيل سريع (خطوة واحدة)

```bash
./quick-start-emulators.sh
```

ثم افتح: **http://127.0.0.1:4000**

---

## 🎯 ما تم إنجازه؟

| الإعداد | الحالة |
|--------|--------|
| **Admin SDK → Emulators** | ✅ مربوط |
| **Storage Emulator** | ✅ مفعّل |
| **تحذير ADC** | ✅ تم الإزالة |
| **Node Version** | ✅ 22 |
| **جميع الدوال** | ✅ مُصدّرة |

---

## 📂 الملفات المرجعية

| اقرأ هذا إذا... | الملف |
|-----------------|-------|
| تريد البدء فوراً | [START_HERE_EMULATORS.md](START_HERE_EMULATORS.md) |
| تريد فهم كل شيء | [PHASE_52_EMULATOR_COMPLETE.md](PHASE_52_EMULATOR_COMPLETE.md) |
| تريد أوامر سريعة | [EMULATOR_COMMANDS.md](EMULATOR_COMMANDS.md) |
| تريد ملخص بالعربي | [SETUP_COMPLETE_AR.md](SETUP_COMPLETE_AR.md) |

---

## 🔐 إعداد GitHub (اختياري)

إذا احتجت GitHub Integration:

```bash
./setup-emulators.sh
```

سيطلب منك الـ credentials ويعمل كل شيء تلقائياً.

---

## ⚡ الأوامر الأساسية

### تشغيل
```bash
./quick-start-emulators.sh
```

### إيقاف
```bash
pkill -9 -f "firebase|java"
```

### اختبار
```bash
curl http://127.0.0.1:5001/from-zero-84253/us-central1/readyz
```

### UI
```bash
open http://127.0.0.1:4000
```

---

## 🌐 العناوين

| الخدمة | العنوان |
|--------|---------|
| UI | http://127.0.0.1:4000 |
| Firestore | http://127.0.0.1:8080 |
| Auth | http://127.0.0.1:9099 |
| Functions | http://127.0.0.1:5001 |
| Storage | http://127.0.0.1:9199 |

---

## ❓ مشاكل شائعة

### Port مستخدم؟
```bash
pkill -9 -f "firebase|java"
lsof -ti:4000 | xargs kill -9
```

### Build فاشل؟
```bash
cd functions && rm -rf lib/ && npm run build && cd ..
```

### تحذير ADC؟
```bash
# تأكد من وجود:
cat functions/.env | grep FUNCTIONS_EMULATOR
# يجب أن ترى: FUNCTIONS_EMULATOR=true
```

---

## 🔒 أمان

- ⚠️ **لا تنشر** `functions/.env` في Git
- ✅ **استخدم** مفاتيح تجريبية فقط
- ✅ **معزول** تماماً عن الإنتاج

---

## 📚 مراجع إضافية

- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Firebase Functions](https://firebase.google.com/docs/functions)

---

**🎉 جاهز للتطوير المحلي بدون لمس الإنتاج!**
