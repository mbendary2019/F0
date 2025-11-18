# Phase 57 - Standard Operating Procedure (SOP)

**التاريخ**: 2025-11-06
**الحالة**: Production-Ready ✅

---

## 🎯 الهدف

تفعيل وتشغيل نظام ذاكرة AI (Phase 57) بكل مكوناته في الإنتاج.

---

## 📋 Pre-Deployment Checklist

قبل البدء، تأكد من:

- [ ] Firebase CLI مثبت ومحدث (`>= 13.0.0`)
- [ ] تسجيل الدخول: `firebase login`
- [ ] تحديد المشروع: `firebase use from-zero-84253`
- [ ] Node.js >= 18.0.0
- [ ] OPENAI_API_KEY مُعد في Functions Config

---

## 🔧 خطوات التفعيل

### الخطوة 1: نشر Firestore Indexes (5-15 دقيقة)

```bash
# مراجعة الفهارس
cat firestore.indexes.json

# النشر
firebase deploy --only firestore:indexes

# الانتظار حتى الاكتمال
# تحقق من: https://console.firebase.google.com/project/from-zero-84253/firestore/indexes
```

**الفهارس المنشورة**:
- `ops_memory_snippets`: `text_hash + created_at`, `last_used_at DESC`, `use_count DESC`
- `ops_memory_snippet_feedback`: `snip_id + created_at DESC`
- `ops_metrics_snippets_daily`: `day ASC/DESC`

**fieldOverrides** (تعطيل فهرسة الحقول الكبيرة):
- `ops_memory_snippets.embedding`: []
- `ops_memory_snippets.text`: []
- `ops_collab_embeddings.embedding`: []

**⚠️ ملاحظة**: عند سؤالك عن حذف الفهارس الزائدة، اختر **No** حتى تراجع استخدامها.

---

### الخطوة 2: نشر Firestore Security Rules

```bash
# مراجعة القواعد
grep -A 30 "PHASE 57" firestore.rules

# النشر
firebase deploy --only firestore:rules
```

**القواعد المضافة**:
- `ops_memory_snippets`: Admin read only, CF write only
- `ops_memory_snippet_feedback`: User read own, CF write only
- `ops_metrics_snippets_daily`: Admin read only, CF write only

---

### الخطوة 3: تفعيل TTL Policy (يدوي - ضروري!)

⚠️ **خطوة حاسمة**: يجب تفعيل TTL من Firebase Console

#### 3.1 افتح Firebase Console

https://console.firebase.google.com/project/from-zero-84253/firestore/settings

#### 3.2 انتقل إلى TTL Settings

**Firestore Database** → **Settings** → **Time-to-live (TTL)**

#### 3.3 أضف السياسات التالية

**السياسة الأولى**:
```
Collection:  ops_memory_snippets
Field:       expire_at
Type:        Timestamp
```

**السياسة الثانية**:
```
Collection:  ops_memory_snippet_feedback
Field:       expire_at
Type:        Timestamp
```

**السياسة الثالثة (اختياري)**:
```
Collection:  ops_metrics_snippets_daily
Field:       expire_at
Type:        Timestamp
```

#### 3.4 احفظ وانتظر

- الحذف التلقائي يبدأ خلال **24-72 ساعة**
- العملية **تدريجية** (batch processing)
- **لا يؤثر** على الوثائق الموجودة إلا إذا كان لديها `expire_at`

#### 3.5 التحقق من التفعيل

```bash
# في Firebase Console: Firestore → Settings → TTL
# يجب أن ترى 2-3 سياسات مفعّلة
```

---

### الخطوة 4: نشر Cloud Functions

```bash
# بناء Functions
cd functions
pnpm run build
cd ..

# نشر وظيفة الضغط الأسبوعي
firebase deploy --only functions:weeklyCompactSnippets

# أو نشر كل Functions
firebase deploy --only functions
```

**الوظيفة المنشورة**:
- **weeklyCompactSnippets**: كل إثنين 03:10 (Asia/Kuwait)
- Memory: 512 MiB
- Timeout: 9 دقائق
- Region: us-central1

#### 4.1 التحقق من النشر

```bash
# عرض القائمة
firebase functions:list | grep weeklyCompact

# عرض Logs
firebase functions:log --only weeklyCompactSnippets --limit 10

# تشغيل يدوي للاختبار
gcloud scheduler jobs run weeklyCompactSnippets --project=from-zero-84253
```

---

### الخطوة 5: نشر Next.js Application

```bash
# بناء التطبيق
pnpm run build

# نشر Hosting
firebase deploy --only hosting

# أو نشر كل شيء معاً
firebase deploy
```

---

### الخطوة 6: Post-Deployment Verification

#### 6.1 اختبار Outcome API

```bash
TOKEN=$(firebase auth:print-access-token)

curl -X POST https://from-zero-84253.web.app/api/ops/memory/feedback/outcome \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clusterId": "cl_deploy_guide",
    "outcome": "success",
    "taskId": "prod_verification_001"
  }'
```

**النتيجة المتوقعة**:
```json
{
  "success": true,
  "feedbackId": "fb_...",
  "reward": 0.9,
  "confidence": 0.9
}
```

#### 6.2 اختبار Snippet Feedback API

```bash
curl -X POST https://from-zero-84253.web.app/api/ops/memory/snippet/feedback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "snipId": "snp_test_prod",
    "thumb": "up",
    "clusterId": "cl_deploy_guide"
  }'
```

#### 6.3 التحقق من Analytics Dashboard

1. افتح: https://from-zero-84253.web.app/ops/analytics
2. سجل دخول كـ Admin
3. تمرر إلى "Snippet Cache Performance"
4. تحقق من البطاقات الأربع:
   - ✅ Embedding Requests (يجب أن يظهر رقم)
   - ✅ Cache Hit Rate (الهدف: ≥ 80%)
   - ✅ Tokens Saved
   - ✅ Cost Saved

#### 6.4 التحقق من Scheduled Function

```bash
# عرض الجداول الزمنية
gcloud scheduler jobs list --project=from-zero-84253

# يجب أن ترى:
# weeklyCompactSnippets - every monday 03:10 (Asia/Kuwait)
```

---

## 📊 المراقبة اليومية (Daily Monitoring)

### 1. Cache Performance (يومياً)

**الوصول**: `/ops/analytics` → "Snippet Cache Performance"

**المقاييس المستهدفة**:
- **Hit Rate**: ≥ 80% (ممتاز)
- **Latency**: ≤ 300ms (متوسط)
- **Cost Saved**: متزايد تدريجياً

**إجراءات عند الانحراف**:
- Hit Rate < 50%: راجع TTL settings، قد تحتاج زيادة من 180 إلى 270 يوم
- Latency > 500ms: راجع Firestore queries، تحقق من الفهارس

### 2. Function Logs (يومياً)

```bash
# عرض آخر 50 سطر
firebase functions:log --only weeklyCompactSnippets --limit 50

# عرض آخر ساعة
firebase functions:log --only weeklyCompactSnippets --since 1h
```

**ما نبحث عنه**:
- ✅ No errors
- ✅ Execution time < 9 minutes
- ✅ `duplicatesFound` و `snippetsMerged` يظهران أرقام معقولة

### 3. Storage Growth (يومياً)

```bash
# في Console: Firestore → Usage
# راقب حجم Collection: ops_memory_snippets
```

**المتوقع**:
- نمو تدريجي في أول أسبوع
- استقرار بعد تفعيل TTL وأول Compaction
- انخفاض طفيف بعد كل Compaction

---

## 🔄 الصيانة الأسبوعية (Weekly Maintenance)

### كل إثنين (بعد Compaction)

#### 1. مراجعة Compaction Logs

```bash
# عرض logs آخر ساعتين (بعد 03:10)
firebase functions:log --only weeklyCompactSnippets --since 2h
```

**النتائج المتوقعة**:
```json
{
  "totalSnippets": 5000,
  "duplicatesFound": 1200,
  "snippetsMerged": 1200,
  "feedbackMigrated": 350,
  "errors": 0,
  "duration_ms": 45000
}
```

#### 2. تحقق من Collection Stats

في Firestore Console:
- افتح `ops_compaction_logs`
- راجع آخر وثيقة
- تأكد من:
  - `errors: 0`
  - `dryRun: false`
  - `snippetsMerged` > 0 (إذا كانت هناك duplicates)

#### 3. قرار الـ Cleanup (اختياري)

بعد أسبوعين من Compaction ناجح:

```bash
# تشغيل Cleanup (حذف merged snippets)
tsx scripts/compactSnippets.ts --cleanup --no-dry-run
```

⚠️ **تحذير**: لا تشغل cleanup إلا بعد التأكد من:
- Compaction يعمل بنجاح لمدة أسبوعين
- لا توجد مشاكل في الـ feedback migration
- عمل backup للـ Firestore

---

## 🗓️ الصيانة الشهرية (Monthly Maintenance)

### 1. تحليل Performance Trends

```bash
# جمع بيانات آخر 30 يوم
# في Analytics Dashboard أو Firestore Query:
```

**الاستعلام**:
```javascript
db.collection('ops_metrics_snippets_daily')
  .orderBy('day', 'desc')
  .limit(30)
  .get()
```

**احسب**:
- متوسط Hit Rate
- متوسط Latency
- إجمالي Cost Saved

**الأهداف**:
- Hit Rate ≥ 75%
- Latency ≤ 350ms
- Cost Saved متزايد

### 2. مراجعة TTL Policy

**الأسئلة**:
- هل الـ snippets الشائعة (use_count > 100) تُحذف مبكراً؟
- هل نمو Storage معقول؟
- هل Hit Rate مستقر أم متناقص؟

**إجراءات**:
- إذا كانت الـ popular snippets تُحذف: زيادة TTL أو تحسين الـ adaptive policy
- إذا كان Storage ينمو بسرعة: تقليل TTL أو زيادة تكرار Compaction

### 3. Storage & Cost Review

```bash
# في Console: Billing → Cost breakdown
# قارن شهر بشهر
```

**المتوقع**:
- انخفاض في Firestore reads (بسبب Cache)
- انخفاض في OpenAI costs (بسبب Cache hits)
- استقرار في Firestore storage (بسبب TTL)

---

## 🚨 Troubleshooting Guide

### مشكلة 1: Cache Hit Rate منخفض (< 50%)

**الأعراض**:
- Hit Rate < 50% في Analytics Dashboard
- تكاليف OpenAI مرتفعة
- Latency قريب من 800ms

**التشخيص**:
```bash
# تحقق من Cache Stats
# في /ops/analytics → Snippet Cache Performance
```

**الحلول**:

**أ) زيادة TTL**:
```typescript
// في src/lib/ai/util/ttl.ts
export const DEFAULT_TTL_DAYS = {
  snippet: 270, // زيادة من 180
};
```

**ب) مراجعة Normalization**:
```typescript
// في src/lib/ai/memory/snippetCache.ts
// تحقق من normalizeText() - قد يكون التطبيع قاسياً جداً
```

**ج) تشغيل Compaction يدوياً**:
```bash
tsx scripts/compactSnippets.ts --no-dry-run
```

---

### مشكلة 2: نمو Storage سريع

**الأعراض**:
- حجم `ops_memory_snippets` ينمو بسرعة
- TTL لا يحذف كما متوقع

**التشخيص**:
```bash
# تحقق من TTL Policy Status
# Firebase Console → Firestore → Settings → TTL
```

**الحلول**:

**أ) التحقق من TTL مفعّل**:
- راجع Console
- تأكد من السياسات موجودة
- انتظر 24-72 ساعة للتفعيل

**ب) زيادة تكرار Compaction**:
```typescript
// في functions/src/schedules/compactSnippets.ts
schedule: '10 3 * * 1,5' // الإثنين والجمعة بدلاً من الإثنين فقط
```

**ج) تقليل TTL للـ low-use snippets**:
```typescript
// في src/lib/ai/util/ttl.ts - getAdaptiveTTL()
if (useCount < 5) return 90; // 3 أشهر للـ snippets قليلة الاستخدام
```

---

### مشكلة 3: Scheduled Function لا تعمل

**الأعراض**:
- لا توجد logs جديدة كل إثنين
- `ops_compaction_logs` لا يتحدث

**التشخيص**:
```bash
# تحقق من Scheduler
gcloud scheduler jobs list --project=from-zero-84253

# تحقق من Function
firebase functions:list | grep weeklyCompact
```

**الحلول**:

**أ) تشغيل يدوي للاختبار**:
```bash
gcloud scheduler jobs run weeklyCompactSnippets --project=from-zero-84253
```

**ب) مراجعة Logs للأخطاء**:
```bash
firebase functions:log --only weeklyCompactSnippets --limit 100
```

**ج) التحقق من IAM Permissions**:
```bash
# تأكد من Service Account لديه:
# - Cloud Scheduler Job Runner
# - Cloud Functions Invoker
```

---

### مشكلة 4: فشل Compaction مع أخطاء

**الأعراض**:
- `errors > 0` في logs
- Compaction غير مكتمل

**التشخيص**:
```bash
# راجع error messages
firebase functions:log --only weeklyCompactSnippets --limit 100 | grep -i error
```

**الحلول**:

**أ) تحقق من Indexes**:
```bash
firebase firestore:indexes
# تأكد من index على text_hash موجود وجاهز
```

**ب) زيادة Timeout**:
```typescript
// في functions/src/schedules/compactSnippets.ts
timeoutSeconds: 900, // 15 دقيقة بدلاً من 9
```

**ج) تقليل Batch Size**:
```typescript
await compactSnippets({ dryRun: false, batchSize: 50 });
```

---

## ✅ Done-Done Checklist

قبل اعتبار Phase 57 مُكتمل تماماً:

### Infrastructure
- [ ] `firestore.indexes.json` updated and deployed
- [ ] Firestore indexes completed (5-15 min wait)
- [ ] `firestore.rules` deployed
- [ ] TTL Policy enabled for `ops_memory_snippets`
- [ ] TTL Policy enabled for `ops_memory_snippet_feedback`

### Functions & Application
- [ ] `weeklyCompactSnippets` function deployed
- [ ] Next.js application built and deployed
- [ ] Analytics dashboard accessible at `/ops/analytics`

### Testing & Verification
- [ ] Outcome API tested (returns 200)
- [ ] Snippet Feedback API tested (returns 200)
- [ ] Analytics cards display correctly (4 KPIs)
- [ ] Scheduled function verified in gcloud scheduler
- [ ] First dry-run compaction executed successfully

### Monitoring Setup
- [ ] Daily monitoring calendar reminder set
- [ ] Weekly compaction review reminder (Mondays)
- [ ] Monthly analytics review reminder
- [ ] Alerting configured for errors (optional)

### Documentation
- [ ] Team briefed on new features
- [ ] SOP document shared with ops team
- [ ] Rollback plan documented and tested
- [ ] Incident response playbook updated

---

## 📞 Support & Escalation

### للحصول على المساعدة

**المستوى 1 - الوثائق**:
- [PHASE_57_DEPLOYMENT_GUIDE.md](PHASE_57_DEPLOYMENT_GUIDE.md)
- [PHASE_57_QUICK_START_AR.md](PHASE_57_QUICK_START_AR.md)
- [PHASE_57_COMPLETE.md](PHASE_57_COMPLETE.md)

**المستوى 2 - Logs & Console**:
```bash
firebase functions:log
gcloud scheduler jobs list
```

**المستوى 3 - الاستشارة الفنية**:
- راجع Issues في GitHub
- Firebase Support Console
- OpenAI Support (للمسائل المتعلقة بالـ API)

---

## 📝 Change Log

### 2025-11-06 - Initial SOP
- Created comprehensive SOP for Phase 57
- Added daily/weekly/monthly monitoring procedures
- Documented troubleshooting steps
- Established done-done checklist

---

**🎯 الهدف النهائي**: نظام ذاكرة AI يعمل بكفاءة عالية مع:
- 90% توفير في التكاليف
- 60% تحسين في الأداء
- 40% تقليل في التخزين
- مراقبة مستمرة وآلية

**✅ Phase 57 جاهز للإنتاج!**
