# 🛡️ Rate Limiting Guide

**التاريخ**: 2025-11-07
**الحالة**: ✅ مكتمل ويعمل

---

## 📋 نظرة عامة

تم إضافة نظام **Rate Limiting** متقدم لحماية API من الإساءة والاستخدام المفرط. النظام يجمع بين:

1. ✅ **Sliding Window** - نافذة زمنية منزلقة لتتبع الطلبات
2. ✅ **Token Bucket** - دلو الرموز للسماح بطلبات دفعة (burst)
3. ✅ **In-Memory Store** - تخزين محلي في الذاكرة (سريع وبسيط)
4. ✅ **Configurable Limits** - حدود قابلة للتخصيص عبر ENV
5. ✅ **Proper HTTP 429** - استجابات صحيحة مع Retry-After headers

---

## 🎯 الملفات المُنشأة

### 1. Rate Limiting Utility

**الملف**: `src/lib/rateLimit.ts` (4.2 KB)

**الوظائف**:

#### `getKeyFingerprint(opts)`
ينشئ مفتاح فريد للتعرف على المستخدم بناءً على:
- IP Address
- User-Agent
- API Path

```typescript
const key = getKeyFingerprint({
  ip: "192.168.1.1",
  ua: "Mozilla/5.0...",
  path: "/api/ops/analytics/track"
});
// Returns: "/api/ops/analytics/track::192.168.1.1::Mozilla/5.0..."
```

#### `rateLimitAllow(key)`
يتحقق من السماح بالطلب ويعيد:
```typescript
{
  allowed: boolean,      // true = السماح، false = رفض
  retryAfterMs: number   // الوقت بالميلي ثانية حتى المحاولة التالية
}
```

**الخوارزمية**:
1. **Token Bucket Refill** - إعادة ملء الرموز بمرور الوقت
2. **Sliding Window Cleanup** - حذف الطلبات القديمة
3. **Check Limits** - التحقق من الحدود
4. **Consume Token** - استهلاك رمز إذا كان مسموحاً

#### `cleanupOldEntries()`
ينظف المدخلات القديمة من الذاكرة (يعمل تلقائياً كل 5 دقائق)

---

### 2. Updated Tracking API

**الملف**: `src/app/api/ops/analytics/track/route.ts`

**التعديلات**:
```typescript
import { getKeyFingerprint, rateLimitAllow } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  await initAdmin();

  // 1. Extract fingerprint data
  const ip = req.headers.get("x-forwarded-for") ||
             req.headers.get("x-real-ip") ||
             "unknown";
  const ua = req.headers.get("user-agent") || "";
  const key = getKeyFingerprint({ ip, ua, path: "/api/ops/analytics/track" });

  // 2. Check rate limit
  const { allowed, retryAfterMs } = rateLimitAllow(key);

  // 3. Return 429 if exceeded
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    const res = NextResponse.json(
      { ok: false, error: "RATE_LIMIT_EXCEEDED" },
      { status: 429 }
    );
    res.headers.set("Retry-After", retryAfterSec.toString());
    res.headers.set("X-RateLimit-Limit", process.env.RATE_LIMIT_MAX_REQS || "10");
    res.headers.set("X-RateLimit-Reset", (Date.now() + retryAfterMs).toString());
    return res;
  }

  // 4. Process request normally...
}
```

---

## ⚙️ الإعداد والتكوين

### 1. متغيرات البيئة

أضف إلى `.env.local`:

```bash
# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=60000          # نافذة 1 دقيقة
RATE_LIMIT_MAX_REQS=10              # 10 طلبات كحد أقصى
RATE_LIMIT_BURST=5                  # 5 رموز burst
RATE_LIMIT_REFILL_MS=5000           # إعادة ملء كل 5 ثواني
RATE_LIMIT_REFILL_TOKENS=1          # رمز واحد لكل إعادة ملء
```

### 2. الإعدادات الموصى بها

#### للتطوير (Development)
```bash
RATE_LIMIT_WINDOW_MS=60000          # 1 دقيقة
RATE_LIMIT_MAX_REQS=20              # 20 طلب (مرن)
RATE_LIMIT_BURST=10                 # 10 burst
RATE_LIMIT_REFILL_MS=3000           # 3 ثواني
RATE_LIMIT_REFILL_TOKENS=2          # رمزين
```

#### للإنتاج (Production)
```bash
RATE_LIMIT_WINDOW_MS=60000          # 1 دقيقة
RATE_LIMIT_MAX_REQS=10              # 10 طلبات (محدود)
RATE_LIMIT_BURST=5                  # 5 burst
RATE_LIMIT_REFILL_MS=5000           # 5 ثواني
RATE_LIMIT_REFILL_TOKENS=1          # رمز واحد
```

#### للحماية القصوى (Strict)
```bash
RATE_LIMIT_WINDOW_MS=60000          # 1 دقيقة
RATE_LIMIT_MAX_REQS=5               # 5 طلبات فقط
RATE_LIMIT_BURST=2                  # 2 burst
RATE_LIMIT_REFILL_MS=10000          # 10 ثواني
RATE_LIMIT_REFILL_TOKENS=1          # رمز واحد
```

---

## 🧪 الاختبار

### اختبار الطلبات العادية

```bash
# طلبات عادية ضمن الحدود
for i in {1..3}; do
  curl -X POST http://localhost:3030/api/ops/analytics/track \
    -H "Content-Type: application/json" \
    -d '{"name":"test_normal","data":{}}' \
    && echo ""
done
```

**النتيجة المتوقعة**: كل الطلبات تعيد `{"ok":true}` مع HTTP 200

---

### اختبار تجاوز الحدود

```bash
# 15 طلب سريع لتجاوز الحدود
for i in {1..15}; do
  result=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:3030/api/ops/analytics/track \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"burst_$i\",\"data\":{}}")
  echo "Request $i: HTTP $result"
done
```

**النتيجة المتوقعة**:
```
Request 1: HTTP 200
Request 2: HTTP 200
Request 3: HTTP 200
Request 4: HTTP 200
Request 5: HTTP 200
Request 6: HTTP 429  ← Rate limit triggered
Request 7: HTTP 429
...
Request 15: HTTP 429
```

---

### اختبار استجابة 429

```bash
# تجاوز الحدود أولاً
for i in {1..6}; do
  curl -s -o /dev/null -X POST http://localhost:3030/api/ops/analytics/track \
    -H "Content-Type: application/json" -d '{"name":"test"}'
done

# ثم اختبار الاستجابة
curl -i -X POST http://localhost:3030/api/ops/analytics/track \
  -H "Content-Type: application/json" \
  -d '{"name":"final"}'
```

**النتيجة المتوقعة**:
```http
HTTP/1.1 429 Too Many Requests
retry-after: 60
x-ratelimit-limit: 10
x-ratelimit-reset: 1762554274115

{"ok":false,"error":"RATE_LIMIT_EXCEEDED"}
```

---

### اختبار إعادة المحاولة

```bash
# تجاوز الحدود
for i in {1..6}; do
  curl -s -o /dev/null -X POST http://localhost:3030/api/ops/analytics/track \
    -H "Content-Type: application/json" -d '{"name":"test"}'
done

# محاولة فورية (فشل)
curl -w "\nHTTP: %{http_code}\n" -X POST http://localhost:3030/api/ops/analytics/track \
  -H "Content-Type: application/json" -d '{"name":"immediate"}'

# انتظر 10 ثواني
echo "Waiting 10 seconds for token refill..."
sleep 10

# محاولة مرة أخرى (نجاح محتمل)
curl -w "\nHTTP: %{http_code}\n" -X POST http://localhost:3030/api/ops/analytics/track \
  -H "Content-Type: application/json" -d '{"name":"after_wait"}'
```

---

## 📊 فهم الخوارزمية

### Sliding Window (نافذة منزلقة)

```
الوقت:  |------ 60 ثانية (WINDOW_MS) ------|
الطلبات: [req1, req2, req3, ..., req10]
         ↑                            ↑
         أقدم طلب                  أحدث طلب

إذا كان عدد الطلبات ≥ MAX_REQS (10):
  → رفض الطلب
```

### Token Bucket (دلو الرموز)

```
الدلو: [🪙🪙🪙🪙🪙] ← BURST = 5 رموز

كل طلب يستهلك رمز واحد: 🪙
كل 5 ثواني (REFILL_MS) يُضاف رمز: 🪙

إذا كان الدلو فارغاً []:
  → رفض الطلب (حتى إعادة الملء)
```

### المثال العملي

**الإعدادات**:
- `WINDOW_MS = 60000` (1 دقيقة)
- `MAX_REQS = 10`
- `BURST = 5`
- `REFILL_MS = 5000` (5 ثواني)
- `REFILL_TOKENS = 1`

**السيناريو**:
```
الوقت 0s: User sends 5 requests (burst)
  → ✅ All allowed (uses 5 tokens from bucket)
  → Tokens: [🪙🪙🪙🪙🪙] → []
  → Window: 5 requests

الوقت 1s: User sends 1 request
  → ❌ Denied (no tokens, only 1s passed)
  → Tokens: []

الوقت 5s: Refill occurs (+1 token)
  → Tokens: [] → [🪙]

الوقت 5s: User sends 1 request
  → ✅ Allowed (1 token available)
  → Tokens: [🪙] → []
  → Window: 6 requests

الوقت 10s: Refill occurs (+1 token)
  → Tokens: [] → [🪙]

... (continued until 10 requests in window)

الوقت 30s: User sends 1 request (11th in window)
  → ❌ Denied (window limit reached: 10 requests)
  → Must wait until oldest request expires (60s from request 1)
```

---

## 🔒 الأمان

### 1. IP Fingerprinting

```typescript
// في Production: x-forwarded-for من Load Balancer
const ip = req.headers.get("x-forwarded-for") ||
           req.headers.get("x-real-ip") ||
           "unknown";
```

**تحذير**: في Vercel/Cloudflare، استخدم العنوان الصحيح من البيئة:
- Vercel: `x-forwarded-for`
- Cloudflare: `cf-connecting-ip`

### 2. User-Agent Fingerprinting

```typescript
const ua = req.headers.get("user-agent") || "";
```

**الفائدة**: يمنع المستخدمين من تجاوز الحدود بتغيير IP فقط (VPN).

### 3. Path-Specific Limits

```typescript
const key = getKeyFingerprint({
  ip,
  ua,
  path: "/api/ops/analytics/track"
});
```

**الفائدة**: كل API له حدود منفصلة.

---

## 🚀 التحسينات (Production)

### للبيئات Serverless (Vercel/Cloudflare)

**المشكلة**: In-memory store لا يعمل عبر Lambda instances المتعددة.

**الحل**: استخدم Redis أو Upstash

#### مثال: Upstash Redis

```bash
# Install
pnpm add @upstash/redis
```

```typescript
// src/lib/rateLimit.ts
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function rateLimitAllow(key: string) {
  const now = Date.now();

  // Use Redis sorted set for sliding window
  const windowKey = `ratelimit:${key}`;

  // Remove old entries
  await redis.zremrangebyscore(windowKey, 0, now - WINDOW_MS);

  // Count current requests
  const count = await redis.zcard(windowKey);

  if (count >= MAX_REQS) {
    const oldest = await redis.zrange(windowKey, 0, 0, { withScores: true });
    const retryAfterMs = oldest[0] ? (oldest[0].score + WINDOW_MS) - now : WINDOW_MS;
    return { allowed: false, retryAfterMs };
  }

  // Add current request
  await redis.zadd(windowKey, { score: now, member: `${now}-${Math.random()}` });
  await redis.expire(windowKey, Math.ceil(WINDOW_MS / 1000) * 2);

  return { allowed: true, retryAfterMs: 0 };
}
```

---

### إضافة Rate Limiting لـ APIs أخرى

#### مثال: حماية API الأخرى

```typescript
// src/app/api/some-endpoint/route.ts
import { getKeyFingerprint, rateLimitAllow } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // Rate limit check
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const ua = req.headers.get("user-agent") || "";
  const key = getKeyFingerprint({ ip, ua, path: "/api/some-endpoint" });

  const { allowed, retryAfterMs } = rateLimitAllow(key);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(retryAfterMs / 1000).toString(),
        }
      }
    );
  }

  // Normal processing...
}
```

---

## 📈 المراقبة والتحليل

### 1. تتبع عدد الطلبات المرفوضة

```typescript
// src/lib/rateLimit.ts

let deniedCount = 0;

export function rateLimitAllow(key: string) {
  // ... existing logic ...

  if (!allowed) {
    deniedCount++;
    console.warn(`Rate limit exceeded for ${key} (total denied: ${deniedCount})`);
  }

  return { allowed, retryAfterMs };
}

export function getStats() {
  return {
    deniedCount,
    storeSize: store.size,
  };
}
```

### 2. Dashboard للمراقبة

```typescript
// src/app/api/ops/rate-limit/stats/route.ts
import { getStats } from "@/lib/rateLimit";

export async function GET() {
  const stats = getStats();
  return NextResponse.json(stats);
}
```

### 3. تنبيهات

```typescript
if (deniedCount > 100) {
  // أرسل تنبيه للمدراء
  console.error("🚨 High rate limit denials detected!");
  // Optional: Send to monitoring service
}
```

---

## 🐛 استكشاف الأخطاء

### المشكلة 1: Rate Limit لا يعمل

**الأعراض**: كل الطلبات مسموحة حتى بعد التجاوز

**الحل**:
```bash
# تحقق من استيراد الدالة
grep "rateLimitAllow" src/app/api/ops/analytics/track/route.ts

# تحقق من ENV variables
echo $RATE_LIMIT_MAX_REQS

# أعد تشغيل الخادم
pkill -9 node && pnpm dev
```

---

### المشكلة 2: Rate Limit صارم جداً

**الأعراض**: المستخدمون الشرعيون يُحظرون بسرعة

**الحل**: زد الحدود في `.env.local`:
```bash
RATE_LIMIT_MAX_REQS=20
RATE_LIMIT_BURST=10
RATE_LIMIT_REFILL_TOKENS=2
```

---

### المشكلة 3: Rate Limit فضفاض جداً

**الأعراض**: المستخدمون المسيئون يمكنهم إرسال طلبات كثيرة

**الحل**: قلل الحدود:
```bash
RATE_LIMIT_MAX_REQS=5
RATE_LIMIT_BURST=2
RATE_LIMIT_REFILL_MS=10000
```

---

### المشكلة 4: Headers مفقودة

**الأعراض**: `Retry-After` لا يظهر في الاستجابة

**الحل**: تحقق من كود API:
```typescript
res.headers.set("Retry-After", retryAfterSec.toString());
```

---

## ✅ Checklist الإنتاج

- [ ] ENV variables مُعدة صحيحاً
- [ ] تم اختبار Rate Limit محلياً
- [ ] تم اختبار استجابة 429 وheaders
- [ ] (Optional) تم التحول إلى Redis/Upstash للـ Serverless
- [ ] تم إضافة Rate Limiting لجميع APIs الحساسة
- [ ] تم إعداد المراقبة والتنبيهات
- [ ] تم توثيق الحدود للمطورين
- [ ] تم اختبار السلوك في Production

---

## 📚 الموارد

- **Upstash Redis**: https://upstash.com/
- **Rate Limiting Algorithms**: https://en.wikipedia.org/wiki/Token_bucket
- **HTTP 429 Specification**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
- **Vercel Edge Config**: https://vercel.com/docs/storage/edge-config
- **Cloudflare Workers KV**: https://developers.cloudflare.com/kv/

---

## 🎯 الخلاصة

✅ **Rate Limiting مكتمل ويعمل!**

**الميزات المُنفذة**:
- ✅ Sliding Window + Token Bucket
- ✅ Configurable via ENV
- ✅ Proper HTTP 429 responses
- ✅ Retry-After headers
- ✅ IP + UA fingerprinting
- ✅ Automatic cleanup
- ✅ Production-ready (with Redis upgrade path)

**التالي (اختياري)**:
- Upgrade to Redis/Upstash for Serverless
- Add rate limiting to other APIs
- Implement monitoring dashboard
- Add per-user rate limits (authenticated users)

---

**✅ تم الإنجاز بتاريخ 2025-11-07**

_Rate Limiting جاهز للإنتاج مع مسار ترقية واضح للبيئات Serverless_
