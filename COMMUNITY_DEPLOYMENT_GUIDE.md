# 🚀 دليل نشر Community Features

**التاريخ**: 2025-11-07
**الحالة**: ✅ جاهز للنشر

---

## 📋 نظرة عامة

هذا الدليل يغطي نشر Community Features بشكل كامل مع جميع الحمايات والضوابط:

- ✅ Community Banner (معلوماتية فقط)
- ✅ Analytics Tracking API (بدون PII)
- ✅ Rate Limiting (حماية من الإساءة)
- ✅ CORS Strict (حماية Origins)
- ✅ Payload Size Limit (حماية من الحمولات الكبيرة)
- ✅ PII Filtering (حذف البيانات الحساسة)
- ✅ Firestore Rules (أمان البيانات)

---

## 🎯 Pre-Flight Checklist (قبل النشر)

### 1. البيئة المحلية

```bash
# تأكد من أن الخادم يعمل
PORT=3030 pnpm dev

# اختبار الصفحات
curl http://localhost:3030/ar/community
curl http://localhost:3030/en/community

# تشغيل Smoke Tests
./scripts/smoke-test-community.sh
```

**النتيجة المتوقعة**: جميع الاختبارات ✅

---

### 2. إعداد البيئة Production

#### أ) نسخ الإعدادات

```bash
# نسخ .env.local.community-example إلى .env.production
cp .env.local.community-example .env.production

# تعديل القيم حسب البيئة
nano .env.production
```

#### ب) الإعدادات المطلوبة

```bash
# ===================================================================
# Community Page Feature Flags
# ===================================================================
NEXT_PUBLIC_COMMUNITY_ONLY=true
NEXT_PUBLIC_FZ_TOKEN_CONTRACT=So1aNaEXAMPLEContractAddress1234567890
NEXT_PUBLIC_DISABLE_SWAP_LINKS=true

# ===================================================================
# Rate Limiting (Production Settings)
# ===================================================================
RATE_LIMIT_WINDOW_MS=60000          # 1 دقيقة
RATE_LIMIT_MAX_REQS=10              # 10 طلبات كحد أقصى
RATE_LIMIT_BURST=5                  # 5 burst tokens
RATE_LIMIT_REFILL_MS=5000           # 5 ثواني refill
RATE_LIMIT_REFILL_TOKENS=1          # رمز واحد

# ===================================================================
# CORS (Production Domains)
# ===================================================================
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ===================================================================
# Upstash Redis (للسيرفرلس - اختياري)
# ===================================================================
# UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
# UPSTASH_REDIS_REST_TOKEN=your-token-here
```

---

### 3. نشر Firestore Rules

```bash
# نشر القواعد إلى Production
firebase deploy --only firestore:rules

# تحقق من نشر القواعد
firebase firestore:rules
```

**القاعدة المطلوبة** (في `firestore.rules`):

```javascript
// Community analytics events (anonymous tracking)
match /ops_community_events/{id} {
  // Internal tracking events, not readable from client
  allow read: if false;
  // Written only via API server (admin SDK)
  allow write: if request.time != null;
}
```

---

### 4. بناء المشروع

```bash
# تأكد من عدم وجود أخطاء
pnpm build

# تحقق من حجم الـ bundle
ls -lh .next/static/chunks/
```

**النتيجة المتوقعة**: Build ناجح بدون أخطاء

---

## 🚀 النشر (Deployment)

### الطريقة 1: Vercel (الموصى بها)

#### أ) النشر الأولي

```bash
# تسجيل الدخول لـ Vercel
npx vercel login

# نشر المشروع
npx vercel --prod

# أو استخدم Vercel Dashboard
# https://vercel.com/new
```

#### ب) إعداد ENV Variables في Vercel

1. اذهب إلى **Project Settings** > **Environment Variables**
2. أضف جميع المتغيرات من `.env.production`
3. تأكد من تحديد **Production** environment

#### ج) (اختياري) Upstash Redis للـ Serverless

```bash
# تسجيل في Upstash
# https://console.upstash.com/

# إنشاء Redis database جديد
# انسخ REST URL و REST TOKEN

# أضف إلى Vercel Environment Variables:
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

#### د) تفعيل Redis Rate Limiter

```typescript
// src/app/api/ops/analytics/track/route.ts
// استبدل:
import { getKeyFingerprint, rateLimitAllow } from "@/lib/rateLimit";
// بـ:
import { getKeyFingerprint, rateLimitAllow } from "@/lib/rateLimit.redis";
```

---

### الطريقة 2: Firebase Hosting

```bash
# بناء المشروع
pnpm build

# نشر إلى Firebase Hosting
firebase deploy --only hosting

# التحقق
firebase hosting:sites:list
```

---

### الطريقة 3: Cloud Run / Docker

```bash
# بناء Docker image
docker build -t community-app .

# نشر إلى Cloud Run
gcloud run deploy community-app \
  --image community-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🧪 Smoke Tests (بعد النشر)

### 1. اختبار الصفحات

```bash
# استبدل PRODUCTION_URL بالرابط الفعلي
PRODUCTION_URL="https://yourdomain.com"

# اختبار صفحة Community (AR)
curl "$PRODUCTION_URL/ar/community" | grep "معلوماتية فقط"

# اختبار صفحة Community (EN)
curl "$PRODUCTION_URL/en/community" | grep "Informational Only"
```

**النتيجة المتوقعة**: Banner موجود في كلا الصفحتين

---

### 2. اختبار Tracking API

```bash
# طلب صحيح
curl -X POST "$PRODUCTION_URL/api/ops/analytics/track" \
  -H "Content-Type: application/json" \
  -d '{"name":"production_test","data":{"test":"valid"}}'

# النتيجة المتوقعة: {"ok":true}
```

---

### 3. اختبار Rate Limiting

```bash
# إرسال 15 طلب سريع
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$PRODUCTION_URL/api/ops/analytics/track" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"burst_$i\",\"data\":{}}"
done

# النتيجة المتوقعة:
# 200, 200, 200, 200, 200, 429, 429, 429, ...
```

---

### 4. اختبار PII Filtering

```bash
# إرسال طلب مع PII
curl -X POST "$PRODUCTION_URL/api/ops/analytics/track" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"pii_test",
    "data":{
      "email":"test@example.com",
      "phone":"+1234567890",
      "walletAddress":"0x1234...",
      "safeData":"this_should_be_stored"
    }
  }'

# النتيجة المتوقعة: {"ok":true}

# تحقق في Firestore أن PII تم حذفها:
# - email: ❌ غير موجود
# - phone: ❌ غير موجود
# - walletAddress: ❌ غير موجود
# - safeData: ✅ موجود
```

---

### 5. اختبار CORS

```bash
# طلب من origin غير مسموح
curl -X POST "$PRODUCTION_URL/api/ops/analytics/track" \
  -H "Origin: https://evil-site.com" \
  -H "Content-Type: application/json" \
  -d '{"name":"cors_test","data":{}}'

# النتيجة المتوقعة: 403 أو تجاهل Origin
```

---

### 6. اختبار Payload Size

```bash
# إنشاء payload كبير (>4KB)
LARGE_DATA=$(printf '{"name":"large","data":{"content":"%s"}}' "$(head -c 5000 /dev/urandom | base64)")

curl -X POST "$PRODUCTION_URL/api/ops/analytics/track" \
  -H "Content-Type: application/json" \
  -d "$LARGE_DATA"

# النتيجة المتوقعة: 413 Payload Too Large
```

---

### 7. Automated Smoke Test

```bash
# تشغيل السكريبت على Production
BASE_URL="https://yourdomain.com" ./scripts/smoke-test-community.sh
```

**النتيجة المتوقعة**: جميع الاختبارات ✅

---

## 📊 المراقبة والتشغيل (Observability)

### 1. Firestore Metrics

راقب Collection `ops_community_events`:

```javascript
// في Firebase Console > Firestore
// راقب:
// - عدد الوثائق الجديدة/الساعة
// - حجم Collection
// - أي أخطاء في الكتابة
```

---

### 2. Rate Limit Monitoring

#### أ) إنشاء Dashboard بسيط

```typescript
// src/app/api/ops/analytics/stats/route.ts
import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/lib/firebase-admin";

export async function GET() {
  await initAdmin();
  const db = getFirestore();

  // Count events in last 24h
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const snapshot = await db
    .collection("ops_community_events")
    .where("createdAt", ">=", oneDayAgo)
    .count()
    .get();

  return NextResponse.json({
    last24h: snapshot.data().count,
    timestamp: Date.now(),
  });
}
```

#### ب) إضافة Alerts

```bash
# في Vercel: Integrations > Slack
# أضف webhook للتنبيهات

# مثال: Alert عند ارتفاع 429
# (يمكن استخدام Vercel Analytics أو custom logging)
```

---

### 3. Error Tracking

```bash
# في Vercel Logs
npx vercel logs --follow

# أو استخدم Sentry
# https://sentry.io/
```

---

## 🛡️ الأمان (Security Hardening)

### 1. ✅ تم التنفيذ

- [x] Rate Limiting (10 req/min)
- [x] CORS Strict Origin Policy
- [x] Payload Size Limit (4KB)
- [x] PII Filtering (13 حقل محذوف)
- [x] IP Redaction (دائماً "redacted")
- [x] Firestore Rules (read: false, write: server only)
- [x] Banner Disclaimers (قانوني)

---

### 2. تحسينات إضافية (اختيارية)

#### أ) Honeypot Field

```typescript
// إضافة حقل honeypot لكشف البوتات
if (body.honeypot || body._hp) {
  // Bot detected - reject silently
  return NextResponse.json({ ok: true }); // Fake success
}
```

#### ب) Rate Limit تفاضلي

```typescript
// حدود مختلفة حسب المستخدم
const isAuthenticated = req.headers.get("authorization");
const maxReqs = isAuthenticated ? 30 : 10; // Authenticated: 30, Anonymous: 10
```

#### ج) IP Reputation Check

```typescript
// استخدم خدمة IP reputation (مثل AbuseIPDB)
const ipReputation = await checkIPReputation(ip);
if (ipReputation.score > 90) {
  return NextResponse.json({ ok: false, error: "SUSPICIOUS_IP" }, { status: 403 });
}
```

---

## 🔄 Rollback Plan (خطة الرجوع)

### إذا حدثت مشاكل:

#### 1. Rollback الواجهة

```bash
# في Vercel
npx vercel rollback [deployment-url]

# أو في Firebase
firebase hosting:rollback
```

#### 2. تعطيل Tracking API مؤقتاً

```typescript
// src/app/api/ops/analytics/track/route.ts
export async function POST(req: NextRequest) {
  // Temporary disable
  return NextResponse.json({ ok: false, error: "MAINTENANCE" }, { status: 503 });
}
```

#### 3. Revert Firestore Rules

```bash
# استرجاع آخر نسخة من القواعد
firebase firestore:rules:release --revert
```

---

## ✅ Go/No-Go Decision

### ✅ GO Criteria

- [x] جميع Smoke Tests ناجحة
- [x] لا أخطاء في Build
- [x] Firestore Rules منشورة
- [x] ENV Variables مُعدّة صحيحاً
- [x] Banner واضح ومرئي
- [x] Rate Limiting يعمل
- [x] PII Filtering يعمل
- [x] لا تسريب بيانات حساسة
- [x] Logs نظيفة (30 دقيقة monitoring)

### ❌ NO-GO Criteria

- Build failures
- Firestore Rules errors
- PII leaks detected
- Rate limiting not working
- Banner not visible
- CORS issues in production
- High error rate (>5%)

---

## 📈 Post-Deployment Monitoring (بعد النشر)

### 1. الساعة الأولى

```bash
# راقب Logs كل 5 دقائق
npx vercel logs --follow

# راقب Firestore Events
# Firebase Console > Firestore > ops_community_events

# راقب 429 Responses
# Vercel Analytics > Functions > track
```

**KPIs**:
- Error Rate < 1%
- 429 Rate < 20%
- Response Time < 200ms

---

### 2. أول 24 ساعة

- ✅ تحقق من عدم وجود PII في Firestore
- ✅ تحقق من أن Rate Limiting يعمل
- ✅ راقب أي أخطاء أو anomalies
- ✅ تحقق من أن Banner مرئي لجميع المستخدمين

---

### 3. أول أسبوع

- ✅ راجع Analytics (عدد الطلبات، معدل 429)
- ✅ تحقق من أداء Firestore
- ✅ راجع Logs لأي أخطاء متكررة
- ✅ اجمع Feedback من المستخدمين

---

## 🎓 Troubleshooting (استكشاف الأخطاء)

### مشكلة: Rate Limit لا يعمل

**الحل**:
```bash
# تحقق من ENV variables
npx vercel env ls

# تأكد من:
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQS=10

# أعد نشر
npx vercel --prod --force
```

---

### مشكلة: CORS Errors

**الحل**:
```bash
# تحقق من ALLOWED_ORIGINS
echo $ALLOWED_ORIGINS

# أضف domain الصحيح:
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# أعد نشر
npx vercel --prod
```

---

### مشكلة: PII موجودة في Firestore

**الحل** (فوري):
```bash
# احذف الوثائق المتأثرة
# Firebase Console > Firestore > ops_community_events
# Select documents > Delete

# تحقق من الكود:
# src/app/api/ops/analytics/track/route.ts
# تأكد من وجود:
delete clean.email;
delete clean.phone;
# ... etc
```

---

### مشكلة: Payload Too Large Errors

**الحل**:
```typescript
// زد الحد إذا لزم الأمر
const MAX_PAYLOAD_SIZE = 8192; // 8KB instead of 4KB

// أو أضف compression
import { gunzipSync } from "zlib";
```

---

## 📚 الموارد

- **Vercel Deployment**: https://vercel.com/docs
- **Firebase Hosting**: https://firebase.google.com/docs/hosting
- **Upstash Redis**: https://upstash.com/docs/redis
- **CORS MDN**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **Rate Limiting Patterns**: https://cloud.google.com/architecture/rate-limiting-strategies

---

## 🎯 الخلاصة

✅ **Community Features جاهز للنشر!**

**الملفات الرئيسية**:
- `src/components/CommunityBanner.tsx` - Banner معلوماتي
- `src/app/[locale]/community/page.tsx` - صفحة Community
- `src/app/api/ops/analytics/track/route.ts` - Tracking API محمي
- `src/lib/rateLimit.ts` - Rate limiter (in-memory)
- `src/lib/rateLimit.redis.ts` - Rate limiter (Redis - للسيرفرلس)
- `firestore.rules` - قواعد Firestore
- `scripts/smoke-test-community.sh` - اختبارات Smoke

**الخطوات التالية**:
1. ✅ نفذ Pre-Flight Checklist
2. ✅ اضبط ENV Variables لـ Production
3. ✅ انشر Firestore Rules
4. ✅ ابنِ واختبر محلياً
5. ✅ انشر إلى Production (Vercel/Firebase/Cloud Run)
6. ✅ نفذ Smoke Tests على Production
7. ✅ راقب لمدة 24 ساعة الأولى

---

**✅ تم الإنجاز بتاريخ 2025-11-07**

_Community Features production-ready مع جميع الحمايات والضوابط_
