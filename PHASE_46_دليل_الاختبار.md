# Phase 46 — دليل الاختبار والتكامل

**التاريخ:** 2025-10-12
**الحالة:** ✅ مكتمل ومنشور

---

## 🧪 Smoke Tests (CLI)

### 1. فحص الدوال المنشورة

```bash
# تشغيل سكريبت الفحص الشامل
./scripts/test-phase46-smoke.sh
```

**النتيجة المتوقعة:**
- ✅ جميع الدوال الثلاث منشورة
- ✅ قواعد Firestore موجودة
- ✅ Cloud Scheduler مجدول بشكل صحيح

---

### 2. اختبار recordUsage يدوياً

**من الـ Frontend/API:**

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

const recordUsage = httpsCallable(functions, 'recordUsage');

// اختبار 1: استخدام عادي
await recordUsage({
  tokens: 123,
  requests: 1,
  costUsd: 0.0009
});

// اختبار 2: استخدام أكبر
await recordUsage({
  tokens: 5000,
  requests: 10,
  costUsd: 0.05
});
```

**تابع التحديث في Firestore:**

افتح Firebase Console → Firestore Database:
- `ops_usage_daily/{uid}_2025-10-13` ← يجب أن يزيد `tokens` و `requests`
- `ops_usage_monthly/{uid}_2025-10` ← يجب أن يتحدث

---

### 3. اختبار listInvoices

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

const listInvoices = httpsCallable(functions, 'listInvoices');

const result = await listInvoices();
console.log('الفواتير:', result.data.invoices);
```

**النتيجة المتوقعة:**
- إذا لم يكن هناك فواتير من Stripe: `{ invoices: [] }`
- إذا كان webhook مفعّل: قائمة بالفواتير

---

### 4. اختبار تنبيه الاقتراب من الحصة (lowQuotaAlert)

#### أ. رفع الاستخدام إلى 90%

```typescript
// احسب 90% من حصتك اليومية
const dailyQuota = 10000; // من ops_user_plans
const target = dailyQuota * 0.9; // = 9000

// سجّل استخدام يوصّل للحد
await recordUsage({
  tokens: target,
  requests: 1
});
```

#### ب. تشغيل يدوي (لو تبي تختبر فوراً)

```bash
# شغّل الدالة يدوياً
gcloud functions call lowQuotaAlert \
  --region=us-central1 \
  --project=from-zero-84253
```

#### ج. راقب اللوجز

```bash
# شوف لوجز lowQuotaAlert
firebase functions:log --only lowQuotaAlert --lines 50

# أو من gcloud
gcloud functions logs read lowQuotaAlert \
  --region=us-central1 \
  --project=from-zero-84253 \
  --limit=50
```

**النتيجة المتوقعة في اللوجز:**
```
[usage] Starting low quota check
[usage] low-quota: { uid: 'user123', used: 9000, quota: 10000, percentage: 90 }
[usage] Low quota check complete: { totalUsers: 1, alertsTriggered: 1 }
```

---

## 🌱 Seed البيانات التجريبية

### تشغيل السكريبت

```bash
# ضع UID المستخدم (اختياري)
export DEMO_UID="your-user-uid-here"

# شغّل السكريبت
node scripts/seed-phase46-demo.js
```

**ما يسويه السكريبت:**
1. ينشئ سجل استخدام يومي (`ops_usage_daily`)
2. ينشئ سجل استخدام شهري (`ops_usage_monthly`)
3. ينشئ 3 فواتير تجريبية (`ops_invoices`)
4. ينشئ خطة مستخدم (`ops_user_plans`) إذا ما كانت موجودة

---

## 🎨 اختبار صفحات الـ Frontend

### 1. صفحة الاستخدام `/account/usage`

**البيانات المطلوبة:**
- `ops_user_plans/{uid}` ← الخطة والحصص
- `ops_usage_daily` ← آخر 30 يوم
- `ops_usage_monthly` ← الشهر الحالي

**مثال Query:**

```typescript
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// احصل على الاستخدام اليومي
const usageQuery = query(
  collection(db, 'ops_usage_daily'),
  where('uid', '==', currentUser.uid),
  orderBy('date', 'desc'),
  limit(30)
);

onSnapshot(usageQuery, (snapshot) => {
  const dailyUsage = snapshot.docs.map(doc => doc.data());
  // ارسم الشارت
});

// احصل على الخطة
const planRef = doc(db, 'ops_user_plans', currentUser.uid);
onSnapshot(planRef, (snapshot) => {
  const plan = snapshot.data();
  // اعرض الحصة وال%
});
```

**مكونات UI:**
- عداد التوكنز اليوم
- عداد الحصة اليومية
- نسبة الاستخدام (%)
- رسم بياني لآخر 30 يوم (استخدم `recharts`)

---

### 2. صفحة الفواتير `/account/billing/history`

**البيانات المطلوبة:**
- `ops_invoices` ← الفواتير

**مثال Query:**

```typescript
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const invoicesQuery = query(
  collection(db, 'ops_invoices'),
  where('uid', '==', currentUser.uid),
  orderBy('created', 'desc')
);

onSnapshot(invoicesQuery, (snapshot) => {
  const invoices = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  // اعرض القائمة
});
```

**مكونات UI:**

```tsx
{invoices.map((invoice) => (
  <div key={invoice.id} className="invoice-card">
    <div className="invoice-info">
      <span className="invoice-number">#{invoice.number}</span>
      <span className="invoice-date">
        {new Date(invoice.created * 1000).toLocaleDateString('ar-SA')}
      </span>
    </div>
    <div className="invoice-amount">
      <span>{(invoice.total / 100).toFixed(2)} {invoice.currency.toUpperCase()}</span>
      <div className="invoice-links">
        <a href={invoice.hostedInvoiceUrl} target="_blank">عرض</a>
        {invoice.invoicePdf && (
          <a href={invoice.invoicePdf} target="_blank">PDF</a>
        )}
      </div>
    </div>
  </div>
))}
```

---

## 🔗 دمج التتبع في طبقة الـ API

### متى تستدعي recordUsage؟

**القاعدة الذهبية:** بعد كل استدعاء ناجح لنموذج أو ميزة تستهلك توكنز.

### مثال: API Route في Next.js

```typescript
// app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  const user = await getAuthUser(req);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // استدعِ النموذج (مثلاً OpenAI)
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: message }]
    });

    const tokensUsed = response.usage?.total_tokens || 0;
    const costUsd = tokensUsed * 0.00003; // مثلاً $0.03 لكل 1K توكن

    // سجّل الاستخدام (بعد النجاح فقط!)
    const recordUsage = httpsCallable(functions, 'recordUsage');
    await recordUsage({
      tokens: tokensUsed,
      requests: 1,
      costUsd
    });

    return NextResponse.json({
      message: response.choices[0].message.content,
      tokensUsed
    });

  } catch (error) {
    // لا تسجّل استخدام عند الفشل
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

### مثال: من الـ Client Side

```typescript
// lib/ai-client.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export async function callAI(prompt: string) {
  // استدعِ API الخاص
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: prompt })
  });

  const data = await response.json();

  // (الاستخدام مسجّل بالفعل من server side)
  return data;
}
```

### ⚠️ ملاحظة مهمة

**لا تسجّل استخدام قبل Phase 44/45 quota gate:**

```typescript
// ❌ خطأ: تسجيل قبل فحص الحصة
await recordUsage({ tokens: 1000 });
if (hasQuota()) {
  await callAI();
}

// ✅ صحيح: تسجيل بعد نجاح الاستدعاء
if (hasQuota()) {
  const result = await callAI();
  await recordUsage({ tokens: result.tokens });
}
```

---

## ✅ فحوصات صحة سريعة (QA Checklist)

### 1. المنطقة الزمنية

- [ ] `reconcileSubscriptions` مجدولة الساعة **03:00 Asia/Kuwait**
- [ ] `lowQuotaAlert` تعمل كل **30 دقيقة من 07:00 إلى 23:00 Asia/Kuwait**

**تحقق:**
```bash
gcloud scheduler jobs describe firebase-schedule-lowQuotaAlert-us-central1 \
  --location=us-central1 \
  --project=from-zero-84253 | grep -E "(schedule|timeZone)"
```

---

### 2. قواعد Firestore

- [ ] لا كتابة مباشرة على `ops_usage_daily` (Cloud Functions فقط)
- [ ] لا كتابة مباشرة على `ops_usage_monthly` (Cloud Functions فقط)
- [ ] لا كتابة مباشرة على `ops_user_plans` (Cloud Functions فقط)
- [ ] المستخدم يقدر يقرأ بياناته فقط

**اختبار من Console:**
```javascript
// في Firestore Console، حاول كتابة يدوية:
// النتيجة: Permission denied ✅
```

---

### 3. الفواتير من Stripe

- [ ] Stripe webhook يملأ `ops_invoices` عند الأحداث
- [ ] الفواتير تحتوي `hostedInvoiceUrl` و `invoicePdf`
- [ ] الحقول: `number`, `created`, `total`, `currency`, `status`

**تحقق:**
```bash
# شوف آخر webhook events
stripe events list --limit 5

# ارسل test event
stripe trigger invoice.payment_succeeded
```

---

### 4. الفهارس (Composite Indexes)

**مطلوب في Firestore:**

```json
{
  "indexes": [
    {
      "collectionGroup": "ops_usage_daily",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ops_usage_monthly",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "month", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**تحقق:**
```bash
firebase firestore:indexes
```

---

## 🐛 أشهر العثرات وحلولها

### 1. ما في تحديث على الاستخدام؟

**الأسباب:**
- ✗ `recordUsage` ما انستدعى
- ✗ المستخدم مو authenticated
- ✗ قيمة `tokens` سالبة

**الحل:**
```typescript
// تأكد من Auth
const user = getAuth().currentUser;
if (!user) throw new Error('Not authenticated');

// تأكد من قيم صحيحة
if (tokens < 0 || requests < 0) {
  throw new Error('Invalid values');
}

// استدعِ recordUsage
await recordUsage({ tokens, requests });
```

---

### 2. خطأ DAILY_QUOTA_EXCEEDED

**السبب:**
الحصة اليومية من Phase 44/45 فعّالة وتم الوصول للحد.

**الحل:**
```typescript
try {
  await recordUsage({ tokens: 10000 });
} catch (error) {
  if (error.code === 'functions/resource-exhausted') {
    // عرض رسالة للمستخدم
    showUpgradeModal('حصتك اليومية انتهت، ترقية الخطة؟');
  }
}
```

**أو:**
- ارفع `dailyQuota` في `ops_user_plans`
- غيّر الخطة إلى Pro

---

### 3. listInvoices يرجع فاضي

**السبب:**
ما في فواتير من Stripe بعد.

**الحلول:**
1. **إرسال test event:**
```bash
stripe trigger invoice.payment_succeeded
```

2. **إنشاء فاتورة تجريبية:**
```bash
# شغّل السكريبت
node scripts/seed-phase46-demo.js
```

3. **انتظار أول فاتورة حقيقية** من Stripe

---

### 4. lowQuotaAlert ما تشتغل

**تحقق من:**

1. **الـ scheduler مفعّل:**
```bash
gcloud scheduler jobs describe firebase-schedule-lowQuotaAlert-us-central1 \
  --location=us-central1 \
  --project=from-zero-84253
```

2. **الاستخدام فوق الـ threshold:**
```typescript
// الـ threshold الافتراضي 90%
// تأكد إن استخدامك >= 90% من dailyQuota
```

3. **الوقت صحيح:**
- تشتغل من 07:00 إلى 23:00 بتوقيت الكويت
- لو قبل أو بعد، لازم تنتظر

---

### 5. Frontend ما يعرض البيانات

**تحقق من:**

1. **Auth:**
```typescript
const user = getAuth().currentUser;
if (!user) {
  // redirect to login
}
```

2. **Query:**
```typescript
// تأكد من الـ where clause
where('uid', '==', currentUser.uid)  // ✅
where('uid', '=', currentUser.uid)   // ❌ wrong operator
```

3. **Real-time listener:**
```typescript
// استخدم onSnapshot للتحديثات الفورية
onSnapshot(query, (snapshot) => {
  // update state
});
```

---

## 🎯 تحسينات اختيارية

### 1. Badge/Toast عند اقتراب الحصة

```tsx
// components/UsageWarning.tsx
export function UsageWarning({ used, quota }: { used: number; quota: number }) {
  const percentage = (used / quota) * 100;

  if (percentage >= 80 && percentage < 90) {
    return (
      <div className="warning-banner bg-yellow-100">
        ⚠️ استخدمت {percentage.toFixed(0)}% من حصتك اليومية
      </div>
    );
  }

  if (percentage >= 90) {
    return (
      <div className="danger-banner bg-red-100">
        🚨 اقتربت من نهاية حصتك! ({percentage.toFixed(0)}%)
        <button onClick={upgradeNow}>ترقية الآن</button>
      </div>
    );
  }

  return null;
}
```

---

### 2. CSV Export للاستخدام

```typescript
// utils/exportUsage.ts
export function exportUsageToCSV(usage: DailyUsage[]) {
  const csv = [
    ['التاريخ', 'التوكنز', 'الطلبات', 'التكلفة'],
    ...usage.map(u => [
      u.date,
      u.tokens,
      u.requests,
      u.costUsd.toFixed(6)
    ])
  ].map(row => row.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `usage-${new Date().toISOString()}.csv`;
  a.click();
}
```

---

### 3. Cost per 1K tokens

```typescript
// constants/pricing.ts
export const PRICING = {
  'gpt-4': 0.03,           // $0.03 per 1K tokens
  'gpt-3.5-turbo': 0.002,  // $0.002 per 1K tokens
  'claude-2': 0.008,       // $0.008 per 1K tokens
} as const;

// في الاستخدام:
const cost = (tokens / 1000) * PRICING['gpt-4'];
```

---

### 4. بطاقات تنبيه للفواتير غير المدفوعة

```tsx
// components/UnpaidInvoices.tsx
export function UnpaidInvoices({ invoices }: { invoices: Invoice[] }) {
  const unpaid = invoices.filter(inv => inv.status !== 'paid');

  if (unpaid.length === 0) return null;

  return (
    <div className="alert-danger">
      <h3>⚠️ لديك {unpaid.length} فاتورة غير مدفوعة</h3>
      {unpaid.map(inv => (
        <div key={inv.id}>
          فاتورة #{inv.number} - {(inv.total / 100).toFixed(2)} {inv.currency.toUpperCase()}
          <a href={inv.hostedInvoiceUrl}>ادفع الآن</a>
        </div>
      ))}
    </div>
  );
}
```

---

## 📊 مراقبة الأداء

### 1. Firebase Console

```
Firebase Console → Functions → recordUsage
- شوف عدد الاستدعاءات
- متوسط وقت التنفيذ
- نسبة الأخطاء
```

### 2. Cloud Logging

```bash
# شوف جميع لوجز Phase 46
gcloud logging read "resource.type=cloud_function AND (
  resource.labels.function_name=recordUsage OR
  resource.labels.function_name=lowQuotaAlert OR
  resource.labels.function_name=listInvoices
)" \
  --limit 100 \
  --format json \
  --project=from-zero-84253
```

### 3. Cost Analysis

```bash
# احسب تكلفة الاستدعاءات
# recordUsage: 2 transactions × عدد الاستدعاءات
# lowQuotaAlert: عدد المستخدمين × 32 مرة/يوم
```

---

## 🎓 الخلاصة

✅ **Phase 46 كامل ومنشور**
- ✅ recordUsage - تتبع الاستخدام مع تحديثات atomic
- ✅ lowQuotaAlert - تنبيهات كل 30 دقيقة بتوقيت الكويت
- ✅ listInvoices - قائمة الفواتير من Stripe

📝 **خطوات التالي:**
1. Seed بيانات تجريبية
2. دمج recordUsage في الـ API
3. بناء صفحات Frontend
4. اختبار end-to-end

🔗 **روابط مفيدة:**
- [PHASE_46_COMPLETE.md](PHASE_46_COMPLETE.md) - التوثيق الكامل بالإنجليزية
- [scripts/deploy-phase46.sh](scripts/deploy-phase46.sh) - سكريبت النشر
- [scripts/seed-phase46-demo.js](scripts/seed-phase46-demo.js) - بيانات تجريبية
- [scripts/test-phase46-smoke.sh](scripts/test-phase46-smoke.sh) - Smoke tests

---

**🎉 بالتوفيق في التطوير!**
