# ⚡ From Zero - ورقة الغش السريعة

> مرجع سريع لجميع الأوامر المهمة

## 🎯 الأوامر الأكثر استخدامًا

```bash
./start-local.sh              # ابدأ التطوير المحلي
./stop-local.sh               # أوقف كل شيء
./quick-test.sh               # اختبارات سريعة
./deploy-production.sh all    # انشر على الإنتاج
```

---

## 📦 إدارة التبعيات

```bash
# التثبيت
pnpm install                  # تثبيت التبعيات الرئيسية
cd functions && npm install   # تثبيت تبعيات Functions

# التحديث
pnpm update                   # تحديث جميع الحزم
pnpm outdated                 # عرض الحزم القديمة

# إضافة حزمة جديدة
pnpm add package-name         # للتطبيق الرئيسي
cd functions && npm install package-name  # للـ Functions
```

---

## 🚀 التطوير المحلي

### بدء التطوير

```bash
# الطريقة السريعة (موصى بها)
./start-local.sh

# أو يدويًا
firebase emulators:start --only functions,firestore,auth
pnpm dev
cd orchestrator && pnpm dev
```

### الإيقاف

```bash
./stop-local.sh

# أو يدويًا
killall node
pkill -f firebase
```

### إعادة التشغيل

```bash
./stop-local.sh && ./start-local.sh
```

---

## 🔥 Firebase Emulators

```bash
# تشغيل كل شيء
firebase emulators:start

# تشغيل خدمات محددة
firebase emulators:start --only functions,firestore,auth

# مع UI
# عدّل firebase.json: "enabled": true
firebase emulators:start

# تصدير البيانات من Emulator
firebase emulators:export ./emulator-data

# استيراد بيانات للـ Emulator
firebase emulators:start --import=./emulator-data
```

---

## 🌱 بذر البيانات

```bash
# السكريبت الشامل (موصى به)
FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed-all.js

# للإنتاج
FIREBASE_SERVICE_ACCOUNT_FILE=~/.secrets/firebase.json node scripts/seed-all.js

# سكريبتات محددة
node scripts/seed-phase45.js              # خطط الفوترة
node scripts/seed-marketplace-paid.js     # متجر مدفوع
node scripts/seed-phase47-demo.js         # بيانات تجريبية
```

---

## 🏗️ البناء والتجميع

```bash
# بناء Next.js
pnpm build

# بناء Functions
cd functions
npm run build
cd ..

# بناء كل شيء
pnpm build && cd functions && npm run build && cd ..

# بناء Desktop App
pnpm build:desktop

# بناء Mobile (Flutter)
pnpm build:mobile:android
```

---

## 🧪 الاختبارات

```bash
# اختبارات دخان سريعة
./quick-test.sh

# اختبارات Extensions
pnpm ext:test
pnpm ext:doctor
pnpm ext:validate

# Smoke tests
pnpm smoke-tests

# TypeScript type checking
pnpm typecheck

# Linting
pnpm lint
```

---

## 🚢 النشر

### النشر الكامل

```bash
./deploy-production.sh all
# أو
firebase deploy
```

### النشر الانتقائي

```bash
./deploy-production.sh functions   # Functions فقط
./deploy-production.sh hosting     # Hosting فقط
./deploy-production.sh firestore   # Rules + Indexes

# أو يدويًا
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### نشر Functions محددة

```bash
firebase deploy --only functions:handleStripeWebhook
firebase deploy --only functions:createCheckoutSession,functions:syncStripeCustomer
```

---

## 📊 المراقبة والـ Logs

### عرض Logs

```bash
# Logs محلية
tail -f logs/nextjs.log
tail -f logs/emulators.log
tail -f logs/orchestrator.log

# Logs الإنتاج
firebase functions:log
firebase functions:log --only handleStripeWebhook
firebase functions:log --since 1h
firebase functions:log --limit 100

# gcloud logs
gcloud logging read "resource.type=cloud_function" --limit 50
gcloud logging read "resource.type=cloud_function AND severity>=ERROR"
```

### عرض Functions

```bash
firebase functions:list
firebase functions:list --format=json

# gcloud
gcloud functions list
```

---

## 🗄️ Firestore

### إدارة البيانات

```bash
# قراءة مستند
firebase firestore:get ops_billing_plans/pro

# كتابة مستند
firebase firestore:set users/user123 '{"name":"Ahmed","age":25}'

# حذف مستند
firebase firestore:delete users/user123

# حذف collection (حذر!)
firebase firestore:delete --all-collections --recursive
```

### النسخ الاحتياطي

```bash
# تصدير
firebase firestore:export ./backups/$(date +%Y%m%d_%H%M%S)

# استيراد
firebase firestore:import ./backups/20250114_120000

# عبر gcloud (أكثر قوة)
gcloud firestore export gs://your-bucket/backup
gcloud firestore import gs://your-bucket/backup
```

---

## 👤 إدارة المستخدمين

```bash
# عرض المستخدمين
firebase auth:export users.json

# استيراد مستخدمين
firebase auth:import users.json

# إضافة مسؤول (إذا كان السكريبت موجود)
FIREBASE_SERVICE_ACCOUNT_FILE=~/.secrets/firebase.json \
  node scripts/set-admin.js "email@example.com"
```

---

## 💳 Stripe

```bash
# تثبيت Stripe CLI
brew install stripe/stripe-cli/stripe

# تسجيل الدخول
stripe login

# الاستماع للـ webhooks محليًا
stripe listen --forward-to localhost:9090/webhook/stripe

# محاكاة أحداث
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded

# عرض events
stripe events list --limit 10

# عرض customers
stripe customers list

# عرض subscriptions
stripe subscriptions list
```

---

## 🔧 استكشاف الأخطاء

### تحرير البورتات

```bash
# تحرير بورت محدد
lsof -ti:3000 | xargs kill -9
lsof -ti:5001 | xargs kill -9
lsof -ti:8080 | xargs kill -9
lsof -ti:9090 | xargs kill -9

# تحرير جميع البورتات
./stop-local.sh
```

### تنظيف شامل

```bash
# حذف التبعيات
rm -rf node_modules functions/node_modules orchestrator/node_modules

# حذف البناء
rm -rf .next functions/lib

# إعادة التثبيت
pnpm install
cd functions && npm install && cd ..

# إعادة البناء
pnpm build
cd functions && npm run build && cd ..
```

### إعادة تعيين Firestore Emulator

```bash
# إيقاف Emulator
pkill -f firebase

# حذف البيانات
rm -rf .firebase/emulator-data

# إعادة التشغيل
firebase emulators:start --only functions,firestore,auth

# إعادة البذر
FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed-all.js
```

---

## 🔑 Firebase Authentication

```bash
# تسجيل الدخول
firebase login

# تسجيل الخروج
firebase logout

# عرض الحساب الحالي
firebase login:list

# استخدام حساب محدد
firebase use --add

# عرض المشاريع
firebase projects:list

# تعيين المشروع الافتراضي
firebase use your-project-id
```

---

## 🌐 Hosting

```bash
# عرض المواقع
firebase hosting:sites:list

# عرض الإصدارات
firebase hosting:versions:list

# عرض Channels
firebase hosting:channel:list

# نشر على Preview Channel
firebase hosting:channel:deploy preview

# حذف Channel
firebase hosting:channel:delete preview
```

---

## 📦 إدارة المشروع

```bash
# عرض معلومات المشروع
firebase projects:list

# إنشاء مشروع جديد
firebase projects:create

# ربط مجلد بمشروع
firebase use --add

# عرض المشروع الحالي
firebase use
```

---

## 🎨 تخصيص Git

```bash
# Git config محلي
git config user.name "Your Name"
git config user.email "your@email.com"

# عرض الحالة
git status

# إضافة ملفات
git add .

# Commit
git commit -m "your message"

# Push
git push origin main
```

---

## 🔍 أوامر مفيدة إضافية

```bash
# عرض حجم المشروع
du -sh .

# عد أسطر الكود
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l

# البحث في الكود
grep -r "searchTerm" src/

# استبدال في الملفات
find . -name "*.ts" -exec sed -i '' 's/oldText/newText/g' {} +

# عرض العمليات النشطة
ps aux | grep node
ps aux | grep firebase

# عرض استخدام البورتات
lsof -i -P | grep LISTEN
```

---

## 📱 Flutter Mobile (إذا كان موجود)

```bash
# تشغيل
cd apps/mobile
flutter run

# بناء Android
flutter build apk --debug
flutter build apk --release

# بناء iOS
flutter build ios

# تنظيف
flutter clean
```

---

## 🖥️ Electron Desktop (إذا كان موجود)

```bash
# تطوير
pnpm dev:desktop

# بناء
pnpm build:desktop

# تعبئة
cd desktop
pnpm package
```

---

## 🎼 Orchestrator

```bash
# تطوير
cd orchestrator
pnpm dev

# بناء
pnpm build

# اختبار
curl http://localhost:9090/readyz
curl http://localhost:9090/api/health
```

---

## 💡 نصائح الإنتاجية

### Aliases مفيدة

أضف في `~/.zshrc` أو `~/.bashrc`:

```bash
alias f0="cd /path/to/from-zero-starter"
alias f0-start="f0 && ./start-local.sh"
alias f0-stop="f0 && ./stop-local.sh"
alias f0-test="f0 && ./quick-test.sh"
alias f0-logs="f0 && tail -f logs/*.log"
alias f0-deploy="f0 && ./deploy-production.sh all"

alias fb="firebase"
alias fbe="firebase emulators:start"
alias fbd="firebase deploy"
alias fbl="firebase functions:log"
```

### Watch Logs بألوان

```bash
# تثبيت grc (اختياري)
brew install grc

# استخدام
grc tail -f logs/nextjs.log
```

---

## 📚 روابط مرجعية سريعة

- Firebase Console: https://console.firebase.google.com
- Stripe Dashboard: https://dashboard.stripe.com
- Next.js Docs: https://nextjs.org/docs
- Firebase Docs: https://firebase.google.com/docs
- Stripe API: https://stripe.com/docs/api

---

## 🆘 الحصول على مساعدة

```bash
# Next.js
pnpm next --help

# Firebase
firebase --help
firebase deploy --help

# pnpm
pnpm --help

# Stripe CLI
stripe --help
```

---

**💡 نصيحة:** احفظ هذا الملف في مكان سهل الوصول أو اطبعه!

**آخر تحديث:** 2025-10-14
