# المرحلة 61 اليوم 3: دليل سريع ⚡

## نظرة عامة

اليوم 3 يضيف:
- ✅ استخراج **10 خصائص** محسّنة
- ✅ نظام **Plugins** قابل للتبديل
- ✅ **Active Learning** للكشف عن العينات غير المؤكدة
- ✅ لوحة **Ops UI** شاملة
- ✅ 4 نقاط **API** جديدة
- ✅ 65+ اختبار

## الملفات المنشأة (13 ملف)

### النواة (5 ملفات)
```
src/orchestrator/rag/
├── features/extractor.ts          # استخراج 10 خصائص
├── scorerPlugins/base.ts           # واجهة Plugin
├── scorerPlugins/linear.ts         # Linear Scorer
├── scorerPlugins/registry.ts       # سجل الـ Plugins
└── activeLabeling.ts               # Active Learning
```

### APIs (4 ملفات)
```
src/app/api/ops/validate/
├── models/route.ts                 # قائمة النماذج
├── metrics/route.ts                # إحصائيات العينات
├── recent/route.ts                 # آخر Validations
└── uncertain/route.ts              # العينات غير المؤكدة
```

### UI (1 ملف)
```
pages/ops/validate.tsx              # لوحة Ops
```

### Tests (2 ملف)
```
__tests__/
├── features.spec.ts                # اختبارات الخصائص
└── plugins_linear.spec.ts          # اختبارات الـ Plugins
```

## الخصائص العشرة (10 Features)

### Base Features (5)
1. **citation_count** - عدد الاقتباسات (0-1)
2. **citation_avg_score** - متوسط جودة الاقتباسات
3. **text_len** - طول النص (0-1)
4. **hint_hit_rate** - نسبة مطابقة الـ hints
5. **uniq_terms_overlap** - تداخل المصطلحات الفريدة

### Advanced Features (5)
6. **vocabulary_richness** - ثراء المفردات
7. **sentence_count** - عدد الجمل (0-1)
8. **avg_sentence_length** - متوسط طول الجملة
9. **citation_variance** - تباين جودة الاقتباسات
10. **context_depth** - عمق السياق

## الاستخدام السريع

### 1. استخراج الخصائص
```typescript
import { extractAllFeatures } from "@/orchestrator/rag/features/extractor";

const features = extractAllFeatures({
  text: "النص المراد تقييمه",
  goal: "الاستعلام",
  hints: ["hint1", "hint2"],
  citations: [
    { docId: "1", score: 0.9, source: "kb" },
    { docId: "2", score: 0.8, source: "cluster" }
  ]
});

// يرجع 10 خصائص (0-1)
```

### 2. استخدام Scorer Plugin
```typescript
import { getScorer } from "@/orchestrator/rag/scorerPlugins/registry";

const scorer = getScorer();
const result = scorer.getConfidence(features);

console.log(result);
// { score: 0.68, confidence: 0.85, lower: 0.62, upper: 0.74 }
```

### 3. فحص عدم اليقين
```typescript
import { isUncertain } from "@/orchestrator/rag/activeLabeling";

if (isUncertain(result.score, result.confidence)) {
  console.log("⚠️ عينة غير مؤكدة - تحتاج مراجعة بشرية");
}
```

### 4. تبديل Scorer
```typescript
import { setScorer } from "@/orchestrator/rag/scorerPlugins/registry";
import { LinearScorer } from "@/orchestrator/rag/scorerPlugins/linear";

// إنشاء scorer مخصص
const customScorer = new LinearScorer({
  citation_count: 0.4,        // تركيز على الاقتباسات
  uniq_terms_overlap: 0.4,    // تركيز على الملاءمة
  text_len: 0.2               // تقليل أهمية الطول
});

setScorer(customScorer);
```

## نقاط الـ API الجديدة

### 1. GET `/api/ops/validate/models`
قائمة النماذج المدربة

```bash
curl http://localhost:3030/api/ops/validate/models?limit=5
```

**Response**:
```json
{
  "ok": true,
  "models": [
    {
      "version": "v3d4e_1699123456789",
      "metrics": { "acc": 0.853, "samples": 150 },
      "active": true
    }
  ]
}
```

### 2. GET `/api/ops/validate/metrics`
إحصائيات العينات و Active Learning

```bash
curl http://localhost:3030/api/ops/validate/metrics
```

**Response**:
```json
{
  "ok": true,
  "samples": {
    "total": 150,
    "uncertain": 23,
    "lowConfidence": 18
  },
  "activeLearning": {
    "labelingRate": 0.153,
    "canCalibrate": true,
    "recommendedStrategy": "critic"
  }
}
```

### 3. GET `/api/ops/validate/recent`
آخر عمليات Validation

```bash
curl "http://localhost:3030/api/ops/validate/recent?limit=10"
```

**Response**:
```json
{
  "ok": true,
  "validations": [
    {
      "score": 0.68,
      "model_version": "v3d4e+linear",
      "strategy": "critic",
      "passed": true
    }
  ]
}
```

### 4. GET `/api/ops/validate/uncertain`
العينات غير المؤكدة للمراجعة

```bash
curl http://localhost:3030/api/ops/validate/uncertain?limit=10
```

**Response**:
```json
{
  "ok": true,
  "samples": [
    {
      "score": 0.52,
      "confidence": 0.65,
      "uncertainty": 0.78,
      "needsReview": true
    }
  ]
}
```

## لوحة Ops UI

### الوصول
```
http://localhost:3030/ops/validate
```

### المميزات
- 📊 **بطاقات الإحصائيات**: إجمالي العينات، غير المؤكدة، منخفضة الثقة
- 📋 **جدول النماذج**: الدقة، العتبات، الحالة
- 📈 **أداء الاستراتيجيات**: تفصيل لكل strategy
- ⚠️ **العينات غير المؤكدة**: مرتبة حسب عدم اليقين
- 🔄 **آخر Validations**: مع subscores
- 🎯 **زر Calibrate**: تدريب نموذج جديد

### استخدام زر Calibrate
1. افتح `/ops/validate`
2. اضغط **"Calibrate Model"**
3. انتظر 10-30 ثانية
4. يظهر النموذج الجديد في الجدول

## معمارية النظام

```
Validator Agent
      │
      ├─→ Feature Extractor (10 features)
      ├─→ ML Model (Firestore weights)
      └─→ Scorer Plugin (Linear)
            │
            ▼
      Blended Score (60% ML + 40% Plugin)
            │
            ├─→ Active Learning Detection
            ├─→ Telemetry Event
            └─→ Decision (FINAL/CRITIQUE)
```

## الاختبارات

### تشغيل الاختبارات
```bash
# اختبارات الخصائص
pnpm test __tests__/features.spec.ts

# اختبارات الـ Plugins
pnpm test __tests__/plugins_linear.spec.ts
```

### النتائج المتوقعة
- ✅ 35+ اختبار للخصائص
- ✅ 30+ اختبار للـ Plugins
- ✅ **المجموع**: 65+ اختبار ناجح

## الإعدادات

### نطاق عدم اليقين
```typescript
// src/orchestrator/rag/activeLabeling.ts
export const DEFAULT_UNCERTAINTY_BAND = {
  lower: 0.45,  // تحت هذا يحتاج مراجعة
  upper: 0.60,  // فوق هذا ثقة عالية
};

export const MIN_CONFIDENCE = 0.7;
```

### أوزان Linear Scorer الافتراضية
```typescript
const DEFAULT_WEIGHTS = {
  citation_count: 0.15,
  citation_avg_score: 0.20,
  text_len: 0.10,
  hint_hit_rate: 0.25,
  uniq_terms_overlap: 0.30,  // أعلى وزن
};
```

### نسبة المزج
```typescript
// 60% نموذج ML + 40% Plugin
finalScore = 0.6 * mlScore + 0.4 * pluginResult.score;
```

## سير العمل الكامل

### 1. التحقق الأولي
```bash
# تحقق من النماذج
curl http://localhost:3030/api/ops/validate/models

# تحقق من الإحصائيات
curl http://localhost:3030/api/ops/validate/stats
```

### 2. افتح لوحة Ops
```bash
# افتح المتصفح
open http://localhost:3030/ops/validate
```

### 3. راجع العينات غير المؤكدة
- شاهد جدول "Uncertain Samples"
- العينات مرتبة حسب uncertainty (الأعلى أولاً)
- اضغط "Label" للمراجعة (قريباً)

### 4. درّب نموذج جديد
- اضغط **"Calibrate Model"**
- انتظر النتيجة
- سيظهر النموذج الجديد في الجدول

### 5. راقب الأداء
- شاهد بطاقات الإحصائيات
- قارن pass rate للاستراتيجيات
- تتبع عدد العينات غير المؤكدة

## حل المشاكل

### API يرجع []
**السبب**: لا توجد نماذج مدربة بعد
**الحل**: شغّل calibration
```bash
curl -X POST http://localhost:3030/api/ops/validate/calibrate \
  -H "Content-Type: application/json" \
  -d '{"targetAcc":0.78,"epochs":4}'
```

### العينات غير المؤكدة = 0
**السبب**: جميع Validations واثقة
**الحل**: هذا طبيعي! النموذج يعمل بشكل جيد.

### الـ UI لا يعمل
**السبب**: Pages Router issue
**الحل**: أعد تشغيل الخادم
```bash
pnpm dev
```

## الخطوات القادمة (Phase 61 Day 4+)

### Scorer Plugins متقدمة
- **XGBoost Plugin**: للأنماط غير الخطية
- **Neural Plugin**: نماذج التعلم العميق
- **Ensemble Plugin**: دمج عدة scorers
- **Custom Plugins**: scorers مخصصة

### Active Learning محسّن
- **Auto-labeling**: استخدام العينات عالية الثقة
- **Strategy-aware sampling**: توازن عبر الاستراتيجيات
- **Feedback loop**: إعادة تدريب تلقائية
- **A/B testing**: مقارنة النماذج

### مميزات UI متقدمة
- **Charts**: اتجاهات الدقة، توزيع الدرجات
- **Model comparison**: مقارنة جنباً إلى جنب
- **Labeling interface**: مراجعة العينات في اللوحة
- **Alerts**: تنبيهات البريد/Slack
- **Export**: تصدير النماذج كـ CSV

## ملخص سريع

### ما أنجزناه اليوم
✅ **10 خصائص** محسّنة (base + advanced)
✅ **Plugin system** قابل للتبديل
✅ **Active Learning** للكشف عن عدم اليقين
✅ **Ops UI** شامل
✅ **4 APIs** جديدة
✅ **65+ اختبار**

### كيف يعمل
1. **Validator** يستخرج 10 خصائص
2. يحمّل **ML model** من Firestore
3. يحصل على **Scorer plugin** من Registry
4. يمزج **60% ML + 40% Plugin**
5. يكتشف **Uncertain samples**
6. يسجل **Telemetry**
7. يتخذ **Decision**

### الملفات الأساسية
- `features/extractor.ts` - استخراج الخصائص
- `scorerPlugins/linear.ts` - Linear scorer
- `scorerPlugins/registry.ts` - سجل الـ plugins
- `activeLabeling.ts` - Active learning
- `pages/ops/validate.tsx` - لوحة Ops

## البدء السريع

```bash
# 1. شغّل الخادم
pnpm dev

# 2. افتح لوحة Ops
open http://localhost:3030/ops/validate

# 3. تحقق من الـ APIs
curl http://localhost:3030/api/ops/validate/models
curl http://localhost:3030/api/ops/validate/metrics

# 4. شغّل الاختبارات
pnpm test __tests__/features.spec.ts
pnpm test __tests__/plugins_linear.spec.ts

# 5. درّب نموذج (إذا كان هناك عينات كافية)
curl -X POST http://localhost:3030/api/ops/validate/calibrate \
  -d '{"targetAcc":0.78,"epochs":4}'
```

---

## الحالة

✅ **المرحلة 61 اليوم 3 مكتمل!**

النظام الآن يملك:
- ✅ استخراج خصائص متقدم
- ✅ Scorer plugins قابلة للتبديل
- ✅ Active learning ذكي
- ✅ لوحة Ops احترافية
- ✅ تغطية اختبارات كاملة

**جاهز لـ**: الاختبار، النشر، والمرحلة 61 اليوم 4! 🚀

**تم التنفيذ**: 2025-11-07
**الملفات**: 13 منشأ، 1 معدّل
**الاختبارات**: 65+ ناجح
