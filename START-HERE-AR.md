# 🚀 ابدأ من هنا - From Zero

> دليل البداية السريع الكامل باللغة العربية

## 📋 جدول المحتويات السريع

| الأمر | الوصف |
|-------|-------|
| `./start-local.sh` | **تشغيل كل شيء محليًا** (موصى به) |
| `./stop-local.sh` | إيقاف جميع الخدمات |
| `./quick-test.sh` | اختبارات دخان سريعة |
| `./deploy-production.sh` | النشر على الإنتاج |
| `node scripts/seed-all.js` | بذر البيانات الأولية |

---

## ⚡ البداية السريعة (3 خطوات فقط!)

### الخطوة 1️⃣: التحضير

```bash
# تأكد من المتطلبات
node -v        # v22.x ✅
pnpm -v        # موجود ✅
firebase --version  # موجود ✅

# نسخ ملف البيئة
cp .env.local.example .env.local
# عدّل .env.local بقيم Firebase الخاصة بك
```

### الخطوة 2️⃣: التشغيل

```bash
# سكريبت واحد يشغّل كل شيء!
./start-local.sh
```

هذا السكريبت سيقوم بـ:
- ✅ التحقق من جميع المتطلبات
- ✅ تثبيت التبعيات إذا لزم الأمر
- ✅ تشغيل Firebase Emulators
- ✅ بذر البيانات الأولية
- ✅ تشغيل Next.js على البورت 3000
- ✅ تشغيل Orchestrator (اختياري)

### الخطوة 3️⃣: التصفح

افتح المتصفح:
```
http://localhost:3000
```

**هذا كل شيء! 🎉**

---

## 🎯 الأوامر الأساسية

### التطوير المحلي

```bash
# التشغيل الكامل (موصى به)
./start-local.sh

# أو يدويًا:
firebase emulators:start --only functions,firestore,auth  # في terminal
pnpm dev                                                   # في terminal آخر
```

### الإيقاف

```bash
./stop-local.sh
```

### الاختبارات

```bash
# اختبارات دخان سريعة
./quick-test.sh

# أو السكريبت الموجود
pnpm -w test:smoke
```

### بذر البيانات

```bash
# للمحاكي المحلي (تلقائي في start-local.sh)
FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed-all.js

# للإنتاج
FIREBASE_SERVICE_ACCOUNT_FILE=~/.secrets/firebase.json node scripts/seed-all.js
```

### النشر

```bash
# نشر كامل
./deploy-production.sh all

# أو منفصل
./deploy-production.sh functions   # Functions فقط
./deploy-production.sh hosting     # Hosting فقط
./deploy-production.sh firestore   # Rules & Indexes فقط

# أو يدويًا
firebase deploy --only functions
firebase deploy --only hosting
```

---

## 🔧 هيكل المشروع

```
from-zero-starter/
├── 🚀 start-local.sh          # تشغيل محلي شامل
├── 🛑 stop-local.sh           # إيقاف الخدمات
├── 🧪 quick-test.sh           # اختبارات سريعة
├── 📦 deploy-production.sh    # نشر على الإنتاج
│
├── scripts/
│   ├── seed-all.js            # بذر شامل للبيانات
│   ├── seed-phase45.js        # خطط الفوترة
│   └── seed-marketplace-paid.js
│
├── src/                       # Next.js App
├── functions/                 # Cloud Functions
├── orchestrator/              # AI Orchestrator
├── logs/                      # ملفات الـ Logs
│
├── .env.local                 # بيئة التطوير
├── functions/.env             # بيئة Functions
└── firebase.json              # إعدادات Firebase
```

---

## 📊 البيانات المبذورة (Collections)

عند تشغيل `seed-all.js` يتم إنشاء:

| Collection | الوصف | المستندات |
|-----------|-------|-----------|
| `ops_branding` | الهوية البصرية | prod |
| `ops_billing_plans` | خطط الفوترة | trial, starter, pro |
| `ops_marketplace_items` | عناصر مجانية | 3 عناصر |
| `ops_marketplace_paid` | عناصر احترافية | 2 عناصر |
| `ops_system_settings` | إعدادات النظام | global |

---

## 🌐 البورتات والعناوين

| الخدمة | URL | الوصف |
|--------|-----|--------|
| **Next.js** | http://localhost:3000 | التطبيق الرئيسي |
| **Firestore** | http://localhost:8080 | قاعدة البيانات |
| **Auth** | http://localhost:9099 | المصادقة |
| **Functions** | http://localhost:5001 | Cloud Functions |
| **Orchestrator** | http://localhost:9090 | AI Orchestrator |

---

## 🔐 إعداد Stripe (للفوترة)

### 1. إنشاء حساب Stripe Test

1. افتح https://dashboard.stripe.com
2. اختر Test Mode
3. احصل على مفاتيح API

### 2. تحديث المتغيرات

```bash
# في .env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx

# في functions/.env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 3. إنشاء Products و Prices

```bash
# في Stripe Dashboard:
# 1. Products > Create Product
# 2. أنشئ "Starter Plan" → احصل على price_xxx
# 3. أنشئ "Pro Plan" → احصل على price_yyy

# ثم حدّث في Firestore:
# ops_billing_plans/starter → stripePriceId: price_xxx
# ops_billing_plans/pro → stripePriceId: price_yyy
```

### 4. اختبار Webhooks محليًا

```bash
# ثبّت Stripe CLI
brew install stripe/stripe-cli/stripe

# استمع للـ webhooks
stripe listen --forward-to localhost:9090/webhook/stripe

# في terminal آخر، اختبر حدث
stripe trigger payment_intent.succeeded
```

---

## 🐛 حل المشاكل الشائعة

### المشكلة: `EADDRINUSE` - البورت محجوز

```bash
./stop-local.sh
# أو
lsof -ti:3000 | xargs kill -9
```

### المشكلة: `Missing NEXT_PUBLIC_*`

```bash
# تأكد من وجود .env.local
cat .env.local

# تأكد أن المتغيرات تبدأ بـ NEXT_PUBLIC_
# ثم أعد التشغيل
./stop-local.sh
./start-local.sh
```

### المشكلة: "الموقع فارغ - لا بيانات"

```bash
# ابذر البيانات
FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed-all.js

# تحقق من البيانات
firebase firestore:get ops_billing_plans/pro --project demo-project
```

### المشكلة: Functions لا تعمل

```bash
# ابنِ Functions
cd functions
npm run build
cd ..

# أعد تشغيل Emulators
firebase emulators:restart
```

### المشكلة: `npm ci` خطأ

```bash
# ❌ لا تستخدم npm أبدًا!
# ✅ استخدم pnpm فقط
pnpm install
```

---

## 📚 الملفات المرجعية الإضافية

- **[دليل-التشغيل-السريع.md](./دليل-التشغيل-السريع.md)** - دليل شامل مفصّل
- **[PHASE_48_COMPLETE.md](./PHASE_48_COMPLETE.md)** - آخر مرحلة تطوير
- **[QUICK_START.md](./QUICK_START.md)** - دليل إنجليزي
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - دليل النشر
- **[TROUBLESHOOTING.md](./حل-المشاكل-الشائعة.md)** - حل المشاكل

---

## 🎓 الخطوات التالية

بعد التشغيل الناجح:

### 1. إضافة مستخدم مسؤول

```bash
# باستخدام Firebase Console
open "https://console.firebase.google.com/project/YOUR_PROJECT/authentication"

# أو عبر السكريبت (إذا موجود)
FIREBASE_SERVICE_ACCOUNT_FILE=~/.secrets/firebase.json \
  node scripts/set-admin.js "your-email@example.com"
```

### 2. تخصيص الهوية البصرية

```bash
# عدّل في Firestore:
# ops_branding/prod

# أو عبر Admin Dashboard:
# http://localhost:3000/admin/branding
```

### 3. إضافة محتوى للمتجر

```bash
# يدويًا في Firestore Console
# أو استخدم Admin Dashboard:
# http://localhost:3000/admin/marketplace
```

### 4. إعداد الفوترة

- أنشئ Products في Stripe
- حدّث Price IDs في `ops_billing_plans`
- اختبر flow الاشتراك

### 5. النشر على الإنتاج

```bash
# تأكد من تحديث .env.production
./deploy-production.sh all
```

---

## 🆘 الدعم

إذا واجهت مشاكل:

1. ✅ راجع [حل المشاكل الشائعة](#-حل-المشاكل-الشائعة)
2. 📖 اقرأ [دليل-التشغيل-السريع.md](./دليل-التشغيل-السريع.md)
3. 🔍 افحص logs: `tail -f logs/*.log`
4. 💬 افتح issue في GitHub
5. 📧 support@fromzero.app

---

## 📝 أوامر سريعة مفيدة

```bash
# عرض Logs مباشرة
tail -f logs/nextjs.log
tail -f logs/emulators.log

# تنظيف شامل
./stop-local.sh
rm -rf .next node_modules functions/node_modules
pnpm install
cd functions && npm install && cd ..

# إعادة البناء الكامل
pnpm build
cd functions && npm run build && cd ..

# عرض Functions المنشورة
firebase functions:list

# عرض logs الإنتاج
firebase functions:log --limit 100

# تصدير Firestore
firebase firestore:export ./backup

# استيراد Firestore
firebase firestore:import ./backup
```

---

## ✨ نصائح للإنتاجية

### استخدم aliases

```bash
# أضف في ~/.zshrc أو ~/.bashrc
alias f0-start="cd /path/to/from-zero-starter && ./start-local.sh"
alias f0-stop="cd /path/to/from-zero-starter && ./stop-local.sh"
alias f0-test="cd /path/to/from-zero-starter && ./quick-test.sh"
alias f0-logs="cd /path/to/from-zero-starter && tail -f logs/*.log"
```

### استخدم VSCode Tasks

اضغط `Cmd+Shift+P` → "Tasks: Run Task" → اختر المهمة

---

**🎉 مبروك! أنت الآن جاهز لبناء تطبيقك من الصفر!**

**📅 آخر تحديث:** 2025-10-14
**📦 الإصدار:** 1.0.0
**✅ الحالة:** جاهز للإنتاج

---

## 🌟 روابط سريعة

- [Firebase Console](https://console.firebase.google.com)
- [Stripe Dashboard](https://dashboard.stripe.com)
- [Next.js Docs](https://nextjs.org/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [Stripe Docs](https://stripe.com/docs)

**صُنع بـ ❤️ من فريق From Zero**
