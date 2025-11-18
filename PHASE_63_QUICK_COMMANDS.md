# 🚀 Phase 63: أوامر التنفيذ السريعة

**آخر تحديث**: 2025-11-07
**المراحل المكتملة**: Days 1-4 (Metrics + Analytics + Reports + AI Insights)

---

## ⚙️ الإعدادات الأولية

### 1. التأكد من Node 20 LTS

```bash
# تثبيت Node 20
nvm install 20
nvm use 20

# التحقق
node -v
# يجب أن يكون: v20.x.x
```

### 2. تنظيف وإعادة التثبيت (إن لزم)

```bash
# إيقاف جميع العمليات
pkill -9 -f "node|next|firebase"

# تنظيف الكاشات
rm -rf .next .turbo node_modules functions/node_modules pnpm-lock.yaml
pnpm store prune

# إعادة التثبيت
pnpm install
cd functions && pnpm install && cd ..
```

---

## 🏃‍♂️ التشغيل المحلي

### الطريقة 1: Web فقط (للتطوير السريع)

```bash
# تشغيل الخادم
PORT=3030 pnpm dev

# فتح المتصفح
# http://localhost:3030/ar/ops/analytics
```

### الطريقة 2: مع Emulators (للاختبار الكامل)

```bash
# Terminal 1: تشغيل Emulators
firebase emulators:start --only functions,firestore,auth

# Terminal 2: تشغيل Web
PORT=3030 pnpm dev
```

---

## 📊 Phase 63 Day 1: Daily Metrics Aggregation

### تشغيل يدوي (للاختبار)

```bash
# عبر Firebase CLI
firebase functions:call aggregateDailyMetrics

# عبر الكود (في Console المتصفح)
import { getFunctions, httpsCallable } from "firebase/functions";
const functions = getFunctions();
const aggregate = httpsCallable(functions, "aggregateDailyMetrics");
await aggregate();
```

### Backfill لآخر يومين

```bash
# CLI
firebase functions:call aggregateDailyMetricsBackfill --data='{"days":2}'

# Code
const backfill = httpsCallable(functions, "aggregateDailyMetricsBackfill");
const result = await backfill({ days: 2 });
console.log(result.data);
```

### Backfill لآخر 7 أيام

```bash
# CLI (للمدراء فقط)
firebase functions:call aggregateDailyMetricsBackfill --data='{"days":7}'

# Code
await httpsCallable(functions, "aggregateDailyMetricsBackfill")({ days: 7 });
```

---

## 📈 Phase 63 Day 2: Analytics Dashboard

### الوصول إلى Dashboard

```bash
# عربي
http://localhost:3030/ar/ops/analytics

# إنجليزي
http://localhost:3030/en/ops/analytics
```

### اختبار API

```bash
# آخر 7 أيام
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3030/api/ops/analytics/metrics?days=7"

# آخر 30 يوم
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3030/api/ops/analytics/metrics?days=30"
```

---

## 📄 Phase 63 Day 3: Daily Reports (PDF/XLSX)

### توليد تقرير يدوي (للاختبار)

```bash
# CLI
firebase functions:call generateDailyReport

# Code
await httpsCallable(functions, "generateDailyReport")();
```

### Backfill لآخر يومين

```bash
# CLI
firebase functions:call generateDailyReportBackfill --data='{"days":2}'

# Code
const backfill = httpsCallable(functions, "generateDailyReportBackfill");
await backfill({ days: 2 });
```

### Backfill لآخر 14 يوم

```bash
# CLI (للمدراء فقط)
firebase functions:call generateDailyReportBackfill --data='{"days":14}'

# Code
await httpsCallable(functions, "generateDailyReportBackfill")({ days: 14 });
```

### تحميل التقارير

```bash
# API للحصول على قائمة التقارير
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3030/api/ops/reports

# من الواجهة
# انتقل إلى: /ar/ops/analytics
# اذهب لقسم "التقارير اليومية"
# اضغط "تحميل PDF" أو "تحميل XLSX"
```

---

## 🤖 Phase 63 Day 4: AI Trend Insights

### توليد ملخص ذكي يدوي

```bash
# CLI
firebase functions:call generateTrendInsights

# Code
await httpsCallable(functions, "generateTrendInsights")();
```

### Backfill لآخر يومين

```bash
# CLI
firebase functions:call generateTrendInsightsBackfill --data='{"days":2}'

# Code
const backfill = httpsCallable(functions, "generateTrendInsightsBackfill");
await backfill({ days: 2 });
```

### Backfill لآخر 7 أيام

```bash
# CLI (للمدراء فقط)
firebase functions:call generateTrendInsightsBackfill --data='{"days":7}'

# Code
await httpsCallable(functions, "generateTrendInsightsBackfill")({ days: 7 });
```

### الحصول على آخر ملخص

```bash
# API
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3030/api/ops/reports/insights

# API لتاريخ معين
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3030/api/ops/reports/insights?date=2025-01-15"
```

### عرض في الواجهة

```bash
# انتقل إلى صفحة Analytics
http://localhost:3030/ar/ops/analytics

# ستجد لوحة "ملخص ذكي (AI)" 🤖
# تعرض التحليل التلقائي لآخر يوم
```

---

## 🚀 اختبار سريع شامل (Backfill ليومين)

### السيناريو الكامل

```javascript
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();

// 1. تجميع المقاييس
console.log("1️⃣ تجميع المقاييس ليومين...");
const metrics = httpsCallable(functions, "aggregateDailyMetricsBackfill");
const metricsResult = await metrics({ days: 2 });
console.log("✅ المقاييس:", metricsResult.data);

// 2. توليد التقارير
console.log("2️⃣ توليد التقارير PDF/XLSX...");
const reports = httpsCallable(functions, "generateDailyReportBackfill");
const reportsResult = await reports({ days: 2 });
console.log("✅ التقارير:", reportsResult.data);

// 3. توليد الملخصات الذكية
console.log("3️⃣ توليد الملخصات الذكية...");
const insights = httpsCallable(functions, "generateTrendInsightsBackfill");
const insightsResult = await insights({ days: 2 });
console.log("✅ الملخصات:", insightsResult.data);

console.log("🎉 اكتمل الاختبار! افتح /ar/ops/analytics");
```

### نسخة CLI (للتنفيذ المباشر)

```bash
#!/bin/bash
echo "🚀 اختبار Phase 63 الشامل..."

echo "1️⃣ تجميع المقاييس..."
firebase functions:call aggregateDailyMetricsBackfill --data='{"days":2}'

echo "2️⃣ توليد التقارير..."
firebase functions:call generateDailyReportBackfill --data='{"days":2}'

echo "3️⃣ توليد الملخصات الذكية..."
firebase functions:call generateTrendInsightsBackfill --data='{"days":2}'

echo "✅ اكتمل الاختبار!"
echo "افتح: http://localhost:3030/ar/ops/analytics"
```

---

## 📦 بناء ونشر Functions

### بناء محلي (للتحقق من الأخطاء)

```bash
# الانتقال لمجلد functions
cd functions

# بناء
pnpm build

# العودة للمجلد الرئيسي
cd ..
```

### نشر جميع Functions الجديدة

```bash
# بناء أولاً
cd functions && pnpm build && cd ..

# نشر جميع الدوال
firebase deploy --only functions
```

### نشر دوال محددة فقط

```bash
# Phase 63 Day 1
firebase deploy --only functions:aggregateDailyMetrics,functions:aggregateDailyMetricsBackfill

# Phase 63 Day 3
firebase deploy --only functions:generateDailyReport,functions:generateDailyReportBackfill

# Phase 63 Day 4
firebase deploy --only functions:generateTrendInsights,functions:generateTrendInsightsBackfill

# جميع دوال Phase 63
firebase deploy --only \
  functions:aggregateDailyMetrics,\
  functions:aggregateDailyMetricsBackfill,\
  functions:generateDailyReport,\
  functions:generateDailyReportBackfill,\
  functions:generateTrendInsights,\
  functions:generateTrendInsightsBackfill
```

---

## 🔐 نشر Firestore Rules & Indexes

### نشر Rules فقط

```bash
firebase deploy --only firestore:rules
```

### نشر Indexes فقط

```bash
firebase deploy --only firestore:indexes
```

### نشر كليهما

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

---

## 🧪 اختبارات Unit Tests

### تشغيل جميع الاختبارات

```bash
pnpm test
```

### تشغيل اختبارات Phase 63

```bash
# Day 2 Analytics
pnpm test analytics

# Day 4 Insights
pnpm test insights_day4
```

### تشغيل اختبار محدد

```bash
pnpm test KpiCards
pnpm test MetricsTrend
pnpm test InsightsPanel
```

---

## 📊 مراقبة الجدولة (Production)

### التحقق من جداول Functions

```bash
# قائمة جميع المهام المجدولة
gcloud scheduler jobs list --project=YOUR_PROJECT_ID

# عرض تفاصيل مهمة معينة
gcloud scheduler jobs describe aggregateDailyMetrics \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID
```

### سجلات Functions

```bash
# عرض سجلات آخر ساعة
firebase functions:log --only aggregateDailyMetrics

# متابعة السجلات مباشرة
firebase functions:log --only generateDailyReport --lines 50

# سجلات جميع دوال Phase 63
firebase functions:log | grep -E "aggregate|generate"
```

---

## 🔍 استكشاف الأخطاء

### المشكلة: Functions لا تعمل في الـ Emulator

```bash
# تأكد من تشغيل Emulator
firebase emulators:start --only functions,firestore

# تحقق من المنافذ
lsof -i :5001  # Functions
lsof -i :8080  # Firestore
```

### المشكلة: "No metrics for {date}"

```bash
# تحقق من وجود البيانات
firebase firestore:get ops_metrics_daily/2025-01-15

# أعد تجميع المقاييس
firebase functions:call aggregateDailyMetrics
```

### المشكلة: "Permission denied" في Backfill

```bash
# أضف custom claim للمستخدم
firebase auth:update YOUR_USER_UID \
  --custom-claims '{"admin":true}'

# تحقق من Claims
firebase auth:get YOUR_USER_UID
```

### المشكلة: Build يفشل في Functions

```bash
# تأكد من Node 20
nvm use 20

# نظف وأعد التثبيت
cd functions
rm -rf node_modules
pnpm install
pnpm build
```

---

## 📈 مراقبة الأداء

### إحصائيات Firestore

```bash
# عدد المقاييس اليومية
firebase firestore:count ops_metrics_daily

# عدد التقارير
firebase firestore:count ops_reports
```

### حجم Storage

```bash
# حجم التقارير في Cloud Storage
gsutil du -sh gs://YOUR_BUCKET/reports/
```

---

## 🎯 سيناريوهات شائعة

### السيناريو 1: اختبار محلي كامل

```bash
# Terminal 1
firebase emulators:start --only functions,firestore,auth

# Terminal 2
PORT=3030 pnpm dev

# Terminal 3 (أو Console المتصفح)
# قم بتنفيذ backfill للاختبار
await httpsCallable(functions, "aggregateDailyMetricsBackfill")({ days: 2 });
await httpsCallable(functions, "generateDailyReportBackfill")({ days: 2 });
await httpsCallable(functions, "generateTrendInsightsBackfill")({ days: 2 });

# افتح: http://localhost:3030/ar/ops/analytics
```

### السيناريو 2: نشر للإنتاج

```bash
# 1. بناء
cd functions && pnpm build && cd ..

# 2. نشر Functions
firebase deploy --only functions

# 3. نشر Rules & Indexes
firebase deploy --only firestore:rules,firestore:indexes

# 4. Backfill لآخر 7 أيام (production)
firebase functions:call aggregateDailyMetricsBackfill --data='{"days":7}'
firebase functions:call generateDailyReportBackfill --data='{"days":7}'
firebase functions:call generateTrendInsightsBackfill --data='{"days":7}'
```

### السيناريو 3: تحديث سريع (بدون إعادة نشر كل شيء)

```bash
# نشر دالة واحدة فقط
cd functions && pnpm build && cd ..
firebase deploy --only functions:generateTrendInsights
```

---

## 📚 روابط مفيدة

- **Dashboard**: http://localhost:3030/ar/ops/analytics
- **API Docs**: [PHASE_63_DAY2_COMPLETE.md](PHASE_63_DAY2_COMPLETE.md)
- **Reports Guide**: [PHASE_63_DAY3_COMPLETE.md](PHASE_63_DAY3_COMPLETE.md)
- **AI Insights Guide**: [PHASE_63_DAY4_COMPLETE.md](PHASE_63_DAY4_COMPLETE.md)
- **Quick Start**: [PHASE_63_QUICK_START.md](PHASE_63_QUICK_START.md)

---

## ⚡ نصائح للأداء

1. **استخدم Emulator محلياً**: أسرع وأرخص للتطوير
2. **Backfill بحذر**: ابدأ بيومين، ثم زد تدريجياً
3. **راقب السجلات**: استخدم `firebase functions:log` للمتابعة
4. **Node 20 LTS**: التزم به لتجنب مشاكل التوافق
5. **Cache Locally**: صفحة Analytics تستخدم cache لتحسين الأداء

---

**🎉 Phase 63 مكتمل! جاهز للاستخدام! 🚀**

_آخر تحديث: 2025-11-07_
