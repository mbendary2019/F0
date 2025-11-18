# دليل اختبار صفحة Analytics - Phase 72

## البداية السريعة

بما أن Functions لا تعمل حالياً، سنختبر Analytics مباشرة مع Firestore Emulator.

### الخطوة 1: تشغيل Firestore Emulator

افتح ترمينال جديد:

```bash
firebase emulators:start --only firestore
```

**المفروض تشوف:**
```
✔  firestore: Firestore Emulator logging to firestore-debug.log
┌─────────────┬────────────────┬─────────────────────────────────┐
│ Emulator    │ Host:Port      │ View in Emulator UI             │
├─────────────┼────────────────┼─────────────────────────────────┤
│ Firestore   │ localhost:8080 │ http://localhost:4000/firestore │
└─────────────┴────────────────┴─────────────────────────────────┘
```

### الخطوة 2: إضافة بيانات تجريبية

في ترمينال تاني:

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm tsx scripts/seed-analytics-data.ts
```

**هيطلع:**
```
🌱 Starting analytics data seed...

📊 Day 1/30: 2025-11-12 - 1234 events (25 errors)
📊 Day 2/30: 2025-11-11 - 1456 events (31 errors)
...
✅ Successfully seeded 30 days of analytics data!
```

### الخطوة 3: السيرفر شغال

السيرفر شغال على http://localhost:3030

### الخطوة 4: اختبار الصفحة

1. **افتح المتصفح**: http://localhost:3030/ar/ops/analytics

2. **سجل دخول** (لو مطلوب):
   - Email: `test@example.com`
   - Password: أي كلمة سر (Emulator بيقبل أي حاجة)

3. **تحقق من البيانات**:
   - ✅ بطاقات KPI تعرض الأرقام
   - ✅ الشارت يعرض الترندات
   - ✅ مافيش أخطاء

### الخطوة 5: جرب فترات مختلفة

استخدم منتقي الفترة:
- 7 أيام
- 30 يوم
- 90 يوم

## حل المشاكل

### مشكلة "User not authenticated"

**الحل**: سجل دخول من console المتصفح:

```javascript
firebase.auth().signInWithEmailAndPassword('test@example.com', 'password')
```

### مشكلة "Failed to fetch metrics"

**تحقق من:**
1. Firestore Emulator شغال على 8080
2. البيانات اتضافت بنجاح
3. Console المتصفح للتفاصيل

### الشارتات فاضية

**الحل**: أعد تشغيل السكريبت:

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm tsx scripts/seed-analytics-data.ts
```

## التحقق من البيانات

افتح Firestore UI: http://localhost:4000/firestore

اذهب لـ: `ops_metrics_daily`

المفروض تلاقي 30 وثيقة.

## اللي شغال ✅

✅ **API Analytics** (`/api/ops/metrics`)
  - يقرأ من Firestore
  - يحسب KPIs
  - يرجع بيانات الترندات

✅ **صفحة Analytics** (`/ar/ops/analytics`)
  - تجيب بيانات حقيقية
  - تعرض بطاقات KPI
  - تعرض شارتات الترندات
  - **مش** بتستخدم Mock Mode

✅ **Firebase Client**
  - متصل بـ Firestore Emulator
  - Auto-detect على localhost

## اللي مش شغال (بس عادي دلوقتي) ❌

❌ **Firebase Functions**
  - مشاكل في البناء
  - مش محتاجينها دلوقتي
  - هنصلحها لاحقاً

❌ **Functions المجدولة**
  - `aggregateDailyMetrics` - كان هيشتغل يومياً
  - `generateDailyReport` - كان هيعمل PDFs
  - `generateTrendInsights` - كان هيعمل ملخصات AI

**البديل**: نضيف البيانات مباشرة بالسكريبت

## الملفات المهمة

### السكريبت الجديد
```
scripts/seed-analytics-data.ts
```

### API Endpoint
```
src/app/api/ops/metrics/route.ts
```

### صفحة Analytics
```
src/app/[locale]/ops/analytics/page.tsx
src/features/ops/analytics/AnalyticsPage.tsx
```

## الإعدادات

**ملف .env.local**:
```env
NEXT_PUBLIC_F0_MOCK_MODE=1          # Mock للمشاريع
NEXT_PUBLIC_USE_EMULATORS=1         # استخدم Emulators
PORT=3030
```

**Emulators**:
- Firestore: `localhost:8080`
- Firestore UI: `localhost:4000`

**Dev Server**:
- Next.js: `http://localhost:3030`

## الخطوات التالية

1. ✅ اختبر Analytics بالبيانات التجريبية
2. ⏳ أصلح مشاكل Functions
3. ⏳ فعّل Reports و Insights

---

**الحالة**: ✅ Analytics جاهز للاختبار بدون Functions!
**التاريخ**: 2025-11-13
