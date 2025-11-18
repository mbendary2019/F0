# ⚡ النشر السريع - 3 أوامر فقط

**الوقت**: 3-5 دقائق
**التاريخ**: 2025-11-07

---

## 🚀 الأوامر الثلاثة

### 1️⃣ نشر Firestore Rules

```bash
firebase deploy --only firestore:rules
```

**النتيجة**: ✅ قواعد Firestore محدّثة

---

### 2️⃣ بناء المشروع

```bash
pnpm build
```

**النتيجة**: ✅ Build ناجح بدون أخطاء

---

### 3️⃣ النشر إلى Production

**للـ Vercel**:
```bash
npx vercel --prod
```

**أو للـ Firebase Hosting**:
```bash
firebase deploy --only hosting
```

**النتيجة**: ✅ تم النشر إلى Production

---

## 🎯 البديل: سكريبت واحد

```bash
# نشر تلقائي كامل
./DEPLOY_NOW_COMMUNITY.sh
```

هذا السكريبت يقوم بكل شيء:
- ✅ Pre-flight checks
- ✅ Smoke tests
- ✅ Firestore rules deployment
- ✅ Build
- ✅ Deploy (Vercel أو Firebase)
- ✅ Post-deployment verification

---

## ✅ التحقق بعد النشر

### اختبار سريع (1 دقيقة)

```bash
# استبدل بالـ URL الفعلي
PROD_URL="https://yourdomain.com"

# اختبار الصفحات
curl "$PROD_URL/ar/community" | grep "معلوماتية فقط"
curl "$PROD_URL/en/community" | grep "Informational Only"

# اختبار API
curl -X POST "$PROD_URL/api/ops/analytics/track" \
  -H "Content-Type: application/json" \
  -d '{"name":"production_test","data":{}}'
```

**النتيجة المتوقعة**: ✅ جميع الاختبارات ناجحة

---

### Smoke Tests الكاملة (2 دقيقة)

```bash
BASE_URL="https://yourdomain.com" ./scripts/smoke-test-community.sh
```

**النتيجة المتوقعة**: ✅ 8/8 tests passed

---

## 📋 Pre-Flight Checklist

قبل تشغيل الأوامر، تأكد من:

- [ ] `.env.production` موجود ومُعد بالقيم الصحيحة
- [ ] `NEXT_PUBLIC_FZ_TOKEN_CONTRACT` صحيح
- [ ] `ALLOWED_ORIGINS` يحتوي domains الإنتاج
- [ ] Dev server يعمل (للاختبار المحلي)
- [ ] Smoke tests ناجحة محلياً

---

## 🛡️ الإعدادات المطلوبة

### `.env.production`

```bash
# Community Features
NEXT_PUBLIC_COMMUNITY_ONLY=true
NEXT_PUBLIC_FZ_TOKEN_CONTRACT=So1aNa...your-contract-here
NEXT_PUBLIC_DISABLE_SWAP_LINKS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQS=10
RATE_LIMIT_BURST=5
RATE_LIMIT_REFILL_MS=5000
RATE_LIMIT_REFILL_TOKENS=1

# CORS (مهم!)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Upstash Redis (اختياري للسيرفرلس)
# UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
# UPSTASH_REDIS_REST_TOKEN=your-token-here
```

---

## 🎯 بعد النشر (أول 30 دقيقة)

### 1. راقب Logs

**Vercel**:
```bash
npx vercel logs --follow
```

**Firebase**:
```bash
firebase functions:log
```

---

### 2. راقب Firestore

1. اذهب إلى Firebase Console
2. Firestore Database
3. Collection: `ops_community_events`
4. تحقق من:
   - ✅ لا يوجد PII (email, phone, walletAddress)
   - ✅ IP دائماً "redacted"
   - ✅ البيانات تُخزن بشكل صحيح

---

### 3. اختبار Rate Limiting

```bash
# إرسال 15 طلب سريع
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "https://yourdomain.com/api/ops/analytics/track" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"test_$i\",\"data\":{}}"
done

# النتيجة المتوقعة:
# 200, 200, 200, 200, 200, 429, 429, 429, ...
```

---

## 🚦 Go/No-Go Decision

### ✅ GO Criteria

كل النقاط التالية يجب أن تكون ✅:

- [x] Build ناجح
- [x] Firestore rules منشورة
- [x] Smoke tests ناجحة (محلي)
- [x] ENV variables مُعدّة
- [x] No critical errors

### ⏸️ NO-GO Criteria

إذا كان أي من النقاط التالية ❌:

- Build failures
- Firestore rules errors
- Smoke tests failing
- Missing ENV variables
- Security vulnerabilities

**الإجراء**: أصلح المشاكل ثم أعد المحاولة

---

## 📞 دعم سريع

### إذا واجهت مشاكل:

**Build Errors**:
```bash
# نظف وأعد البناء
rm -rf .next
pnpm build
```

**Firestore Rules Errors**:
```bash
# تحقق من الـ syntax
firebase firestore:rules --test

# استرجع آخر نسخة
firebase firestore:rules:release --revert
```

**Vercel Deployment Issues**:
```bash
# أعد المحاولة مع force
npx vercel --prod --force
```

**Firebase Hosting Issues**:
```bash
# أعد المحاولة
firebase deploy --only hosting --force
```

---

## 📚 الوثائق الكاملة

للتفاصيل الكاملة، راجع:

- **[COMMUNITY_PRODUCTION_READY.md](COMMUNITY_PRODUCTION_READY.md)** - ملخص شامل
- **[COMMUNITY_DEPLOYMENT_GUIDE.md](COMMUNITY_DEPLOYMENT_GUIDE.md)** - دليل النشر الكامل (22 KB)
- **[RATE_LIMITING_GUIDE.md](RATE_LIMITING_GUIDE.md)** - دليل Rate Limiting (17 KB)
- **[COMMUNITY_FEATURES_GUIDE.md](COMMUNITY_FEATURES_GUIDE.md)** - دليل الميزات (16 KB)

---

## ⚡ TL;DR (الملخص المختصر جداً)

```bash
# 1. نشر القواعد
firebase deploy --only firestore:rules

# 2. بناء
pnpm build

# 3. نشر
npx vercel --prod

# 4. اختبار
BASE_URL="https://yourdomain.com" ./scripts/smoke-test-community.sh
```

**الوقت الكلي**: 3-5 دقائق
**النتيجة**: ✅ Community Features live في Production!

---

**✅ جاهز للنشر الآن!**

_3 أوامر فقط • 3 دقائق • Zero Risk_
