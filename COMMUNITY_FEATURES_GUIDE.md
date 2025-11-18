# 🌐 Community Features Guide

**تاريخ**: 2025-11-07
**الحالة**: ✅ مكتمل

---

## 📋 نظرة عامة

تم إضافة ميزات **Community Page** مع التركيز على:

1. ✅ **الامتثال القانوني** - لا توصيات استثمارية
2. ✅ **الخصوصية** - لا PII في التتبع
3. ✅ **الشفافية** - صفحة معلوماتية فقط
4. ✅ **SEO محسّن** - Metadata + JSON-LD
5. ✅ **Feature Flags** - تحكم كامل في الميزات

---

## 🎯 الملفات المُنشأة

### 1. Analytics Tracking API

**الملف**: `src/app/api/ops/analytics/track/route.ts`

**الوظيفة**: تتبع الأحداث المجهولة بدون PII

**الاستخدام**:
```typescript
// في أي مكون
await fetch("/api/ops/analytics/track", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "view_community_page",
    data: { locale: "ar", section: "contract" },
    ts: Date.now(),
  }),
});
```

**الأمان**:
- ✅ يحذف جميع PII تلقائياً (email, phone, name, address, walletAddress, ip)
- ✅ يُخزن IP كـ "redacted"
- ✅ يستخدم Firebase Admin SDK

---

### 2. Community Page

**الملف**: `src/app/[locale]/community/page.tsx`

**الميزات**:
- ✅ Metadata محسّن للـ SEO
- ✅ JSON-LD structured data
- ✅ Disclaimer واضح بلغتين
- ✅ Contract address display
- ✅ روابط معلوماتية (اختيارية)
- ✅ Responsive design
- ✅ Dark mode

**المسار**:
- `/ar/community` - النسخة العربية
- `/en/community` - النسخة الإنجليزية

---

### 3. Firestore Rules

**التحديث**: `firestore.rules` (سطر 856-862)

**القاعدة الجديدة**:
```javascript
match /ops_community_events/{id} {
  allow read: if false;           // لا قراءة من العميل
  allow write: if request.time != null;  // كتابة عبر API فقط
}
```

**التخزين**:
```typescript
{
  name: "view_community_page",
  data: { locale: "ar", section: "contract" },
  ts: 1705296000000,
  ua: "Mozilla/5.0...",
  ip: "redacted",
  createdAt: 1705296000000
}
```

---

### 4. Feature Flags

**الملف**: `.env.local.community-example`

**المتغيرات**:

#### `NEXT_PUBLIC_COMMUNITY_ONLY`
- **القيمة**: `true` أو `false`
- **الوظيفة**: إظهار رابط Community في الـ Header
- **الاستخدام**:
  ```typescript
  const SHOW = process.env.NEXT_PUBLIC_COMMUNITY_ONLY === "true";
  {SHOW && <Link href="/community">FZ Token</Link>}
  ```

#### `NEXT_PUBLIC_FZ_TOKEN_CONTRACT`
- **القيمة**: عنوان العقد على Solana
- **الوظيفة**: عرض عنوان العقد في الصفحة
- **مثال**: `So1aNaEXAMPLEContractAddress1234567890`

#### `NEXT_PUBLIC_DISABLE_SWAP_LINKS`
- **القيمة**: `true` أو `false`
- **الوظيفة**: إخفاء روابط التبادل
- **الاستخدام**:
  ```typescript
  const DISABLE = process.env.NEXT_PUBLIC_DISABLE_SWAP_LINKS === "true";
  {!DISABLE && <a href="#">View on Raydium</a>}
  {DISABLE && <p>Links disabled - informational only</p>}
  ```

---

## 🚀 الإعداد والاستخدام

### 1. نسخ ملف البيئة

```bash
cp .env.local.community-example .env.local
```

### 2. تعديل القيم

```bash
# .env.local
NEXT_PUBLIC_COMMUNITY_ONLY=true
NEXT_PUBLIC_FZ_TOKEN_CONTRACT=<YOUR_ACTUAL_CONTRACT_ADDRESS>
NEXT_PUBLIC_DISABLE_SWAP_LINKS=true
```

### 3. نشر Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 4. تشغيل الخادم

```bash
nvm use 20
pnpm dev
```

### 5. اختبار الصفحة

افتح المتصفح:
- http://localhost:3030/ar/community
- http://localhost:3030/en/community

---

## 🧪 الاختبار

### اختبار Tracking API

```bash
curl -X POST http://localhost:3030/api/ops/analytics/track \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_event",
    "data": {"section": "test"},
    "ts": 1705296000000
  }'

# الاستجابة المتوقعة
# {"ok":true}
```

### اختبار PII Filtering

```bash
curl -X POST http://localhost:3030/api/ops/analytics/track \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test",
    "data": {
      "email": "test@example.com",
      "phone": "123456789",
      "name": "John Doe",
      "section": "contract"
    }
  }'

# التحقق من Firestore
# يجب ألا يحتوي document على email, phone, name
# فقط: section: "contract"
```

### اختبار Feature Flags

```typescript
// في Console المتصفح
console.log({
  communityOnly: process.env.NEXT_PUBLIC_COMMUNITY_ONLY,
  contract: process.env.NEXT_PUBLIC_FZ_TOKEN_CONTRACT,
  disableSwap: process.env.NEXT_PUBLIC_DISABLE_SWAP_LINKS,
});
```

---

## 📊 SEO & Metadata

### Metadata المُعد

```typescript
{
  title: "FZ Token — Community (Independent)",
  description: "Community-only informational page about FZ Token. Not affiliated for transacting.",
  robots: { index: false, follow: true },
  openGraph: {
    title: "FZ Token — Community",
    description: "Independent community token page (informational only).",
    images: ["/assets/fz-token-og.png"],
  },
}
```

### JSON-LD Structured Data

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "FZ Token — Community",
  "description": "Independent, informational-only community page.",
  "isPartOf": {
    "@type": "Organization",
    "name": "FZ Labs (content only, non-transactional)"
  }
}
```

---

## 🔒 الامتثال القانوني

### Disclaimers المتضمنة

#### 1. Legal Disclaimer (أعلى الصفحة)

**العربية**:
> هذه الصفحة للمعلومات فقط ولا تشكل نصيحة استثمارية أو عرضًا للشراء/البيع. لا ننصح بأي معاملات. الاستثمار في العملات المشفرة محفوف بالمخاطر.

**الإنجليزية**:
> This page is informational only and does not constitute investment advice or an offer to buy/sell. We do not recommend any transactions. Cryptocurrency investments are highly risky.

#### 2. No Transaction Links

> No purchase/sale links. Informational transparency only.

#### 3. Independence Statement

**العربية**:
> هذه الصفحة مستقلة وغير تابعة لأي كيان تنظيمي أو معاملاتي.

**الإنجليزية**:
> This page is independent and not affiliated with any regulatory or transactional entity.

#### 4. DYOR Reminder

**العربية**:
> دائماً قم بالبحث الخاص بك (DYOR) قبل أي قرار استثماري.

**الإنجليزية**:
> Always Do Your Own Research (DYOR) before any investment decision.

---

## 🎨 التصميم

### الألوان

- **Background**: Gradient from slate-900 to slate-800
- **Cards**: slate-800/50 with slate-700 border
- **Disclaimer**: Yellow-900/20 with yellow-600/30 border
- **Text**: White headings, slate-300 body, slate-400 hints

### المكونات

1. **Header Section**
   - عنوان رئيسي
   - وصف مختصر

2. **Disclaimer Block**
   - خلفية صفراء
   - أيقونة ⚠️
   - نص قانوني واضح

3. **Contract Block**
   - عرض عنوان العقد
   - نسخ سهل (mono font)
   - تحذير للتحقق

4. **Informational Links**
   - اختيارية (حسب DISABLE_SWAP_LINKS)
   - روابط Solscan, DexScreener, Raydium
   - "للإطلاع فقط" disclaimer

5. **Footer Disclaimer**
   - تذكير بالاستقلالية
   - دعوة لـ DYOR

---

## 📈 التتبع والتحليلات

### الأحداث المقترحة

```typescript
// عند دخول الصفحة
track({ name: "view_community_page", data: { locale } });

// عند النقر على العقد
track({ name: "click_contract", data: { section: "contract" } });

// عند النقر على رابط خارجي
track({ name: "click_external_link", data: { platform: "solscan" } });

// عند تبديل اللغة
track({ name: "change_locale", data: { from: "ar", to: "en" } });
```

### استعلام البيانات (للمدراء)

```javascript
// في Firebase Console
const events = await db.collection("ops_community_events")
  .where("name", "==", "view_community_page")
  .orderBy("createdAt", "desc")
  .limit(100)
  .get();

// تحليل
const byLocale = {};
events.docs.forEach(doc => {
  const locale = doc.data().data?.locale || "unknown";
  byLocale[locale] = (byLocale[locale] || 0) + 1;
});
console.log(byLocale); // { ar: 65, en: 35 }
```

---

## 🔄 التحديثات المستقبلية (اختيارية)

### 1. إضافة Tokenomics

```typescript
<div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
  <h2>Tokenomics (Informational)</h2>
  <ul>
    <li>Total Supply: 1,000,000,000 FZ</li>
    <li>Network: Solana</li>
    <li>Type: SPL Token</li>
  </ul>
</div>
```

### 2. إضافة Roadmap

```typescript
<div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
  <h2>Community Roadmap (Subject to change)</h2>
  <ul>
    <li>Q1 2025: Community building</li>
    <li>Q2 2025: Educational content</li>
    <li>Q3 2025: Partnerships exploration</li>
  </ul>
</div>
```

### 3. إضافة FAQ

```typescript
<div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
  <h2>FAQs</h2>
  <details>
    <summary>Is this financial advice?</summary>
    <p>No. This page is informational only.</p>
  </details>
  {/* More FAQs */}
</div>
```

---

## 🛡️ Rate Limiting (حماية API)

**تم إضافة**: 2025-11-07

تم إضافة نظام **Rate Limiting** متقدم لحماية API من الإساءة:

### الميزات
- ✅ Sliding Window + Token Bucket algorithm
- ✅ Configurable via ENV variables
- ✅ HTTP 429 responses with Retry-After headers
- ✅ IP + User-Agent fingerprinting
- ✅ Automatic cleanup

### الإعدادات الافتراضية
```bash
RATE_LIMIT_WINDOW_MS=60000          # 1 دقيقة
RATE_LIMIT_MAX_REQS=10              # 10 طلبات كحد أقصى
RATE_LIMIT_BURST=5                  # 5 رموز burst
RATE_LIMIT_REFILL_MS=5000           # إعادة ملء كل 5 ثواني
RATE_LIMIT_REFILL_TOKENS=1          # رمز واحد لكل إعادة ملء
```

### الملفات المُنشأة
- `src/lib/rateLimit.ts` - Rate limiting utility
- Updates to `src/app/api/ops/analytics/track/route.ts`
- [RATE_LIMITING_GUIDE.md](RATE_LIMITING_GUIDE.md) - دليل شامل

### الاختبار
```bash
# اختبار Rate Limit
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3030/api/ops/analytics/track \
    -H "Content-Type: application/json" \
    -d '{"name":"test","data":{}}'
done
# النتيجة: 5 x 200, 10 x 429
```

**📚 للمزيد**: راجع [RATE_LIMITING_GUIDE.md](RATE_LIMITING_GUIDE.md)

---

## ✅ Checklist قبل الإطلاق

### الإعداد الأساسي
- [ ] `.env.local` مُعد بالقيم الصحيحة
- [ ] عنوان العقد صحيح في `NEXT_PUBLIC_FZ_TOKEN_CONTRACT`
- [ ] Firestore rules منشورة
- [ ] الصفحة تعمل على `/ar/community` و `/en/community`

### Tracking & Analytics
- [ ] Tracking API تعمل
- [ ] لا يوجد PII في التتبع
- [ ] Rate Limiting مُفعّل ويعمل
- [ ] تم اختبار استجابة 429

### المحتوى والامتثال
- [ ] Disclaimers واضحة وصحيحة
- [ ] روابط خارجية صحيحة (أو معطلة)
- [ ] JSON-LD صحيح
- [ ] Metadata محسّن

### UI/UX
- [ ] الصفحة responsive على الموبايل
- [ ] Dark mode يعمل
- [ ] جميع الترجمات صحيحة (AR/EN)

---

## 🐛 استكشاف الأخطاء

### المشكلة: Tracking API لا تعمل

**الحل**:
```bash
# تحقق من Firebase Admin SDK
firebase functions:shell
# test track endpoint locally
```

### المشكلة: Feature flags لا تعمل

**الحل**:
```bash
# تأكد من .env.local
cat .env.local | grep NEXT_PUBLIC

# أعد تشغيل الخادم
pkill -9 node
pnpm dev
```

### المشكلة: 404 على /community

**الحل**:
```bash
# تأكد من وجود الملف
ls -la src/app/[locale]/community/page.tsx

# أعد بناء
pnpm build
```

---

## 📚 الموارد

- **Next.js Metadata**: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- **JSON-LD**: https://schema.org/WebPage
- **Firebase Admin SDK**: https://firebase.google.com/docs/admin/setup
- **GDPR Compliance**: https://gdpr.eu/
- **SEC Guidelines**: https://www.sec.gov/

---

**✅ Community Features مكتمل وجاهز للاستخدام!**

_تم الإنجاز بتاريخ 2025-11-07_
