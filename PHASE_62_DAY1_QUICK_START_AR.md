# المرحلة 62 اليوم 1: دليل سريع ⚡

## نظرة عامة

اليوم 1 يُجهّز طبقة البيانات لـ Timeline UI:
- ✅ أنواع TypeScript للأحداث
- ✅ Normalizers لتحويل الأحداث
- ✅ ViewModel builders
- ✅ 2 نقاط API جديدة
- ✅ 30+ اختبار

## الملفات المنشأة (7 ملفات)

### النواة (3 ملفات)
```
src/orchestrator/ops/timeline/
├── types.ts           # التعريفات
├── normalizers.ts     # تحويل الأحداث
└── viewmodel.ts       # بناة ViewModel
```

### APIs (2 ملف)
```
src/app/api/ops/timeline/
├── route.ts                    # قائمة الأحداث
└── [sessionId]/route.ts        # تفاصيل الجلسة
```

### Tests (1 ملف)
```
__tests__/
└── timeline_normalizers.spec.ts
```

## نقاط الـ API الجديدة

### 1. GET `/api/ops/timeline` - قائمة الأحداث

**المعاملات**:
- `from` - بداية الوقت (unix ms)
- `to` - نهاية الوقت (unix ms)
- `sessionId` - تصفية بالجلسة
- `strategy` - تصفية بالاستراتيجية (critic, majority, default)
- `type` - تصفية بنوع الحدث
- `limit` - عدد العناصر (افتراضي: 200، أقصى: 500)
- `cursor` - معرّف المستند للترقيم

**أمثلة**:
```bash
# آخر 50 حدث
curl "http://localhost:3030/api/ops/timeline?limit=50"

# أحداث جلسة معينة
curl "http://localhost:3030/api/ops/timeline?sessionId=sess_abc123"

# أحداث في نطاق زمني
curl "http://localhost:3030/api/ops/timeline?from=1699123456789&to=1699209856789"

# validations من استراتيجية critic فقط
curl "http://localhost:3030/api/ops/timeline?strategy=critic&limit=100"

# ترقيم الصفحات
curl "http://localhost:3030/api/ops/timeline?limit=50&cursor=doc456"
```

**Response**:
```json
{
  "items": [
    {
      "id": "doc123",
      "sessionId": "sess_abc",
      "ts": 1699123456789,
      "label": "Validate (critic)",
      "type": "rag.validate",
      "meta": {
        "score": 0.68,
        "subscores": { "citation": 0.7, ... },
        "model": "v3d4e+linear",
        "strategy": "critic"
      },
      "severity": "info"
    }
  ],
  "nextCursor": "doc456",
  "count": 50
}
```

### 2. GET `/api/ops/timeline/[sessionId]` - تفاصيل الجلسة

**مثال**:
```bash
curl "http://localhost:3030/api/ops/timeline/sess_abc123"
```

**Response**:
```json
{
  "sessionId": "sess_abc123",
  "userId": "user123",
  "startedAt": 1699123456789,
  "endedAt": 1699123461789,
  "durationMs": 5000,
  "events": [
    {
      "id": "doc1",
      "label": "Mesh started",
      "type": "mesh.start",
      "meta": { "goal": "Explain ML" }
    },
    {
      "id": "doc2",
      "label": "RAG retrieve (k=5)",
      "type": "rag.retrieve"
    },
    {
      "id": "doc3",
      "label": "Validate (critic)",
      "type": "rag.validate",
      "meta": { "score": 0.68 }
    },
    {
      "id": "doc4",
      "label": "Mesh completed",
      "type": "mesh.final"
    }
  ],
  "stats": {
    "validations": {
      "count": 1,
      "avgScore": 0.68,
      "byModel": { "v3d4e+linear": 1 },
      "byStrategy": { "critic": 1 },
      "passed": 1,
      "failed": 0
    },
    "citations": { "total": 8, "average": 8.0 },
    "retrievals": { "count": 1, "avgMs": 120 }
  }
}
```

## أنواع الأحداث

### mesh.start
بداية جلسة Mesh

```json
{
  "type": "mesh.start",
  "goal": "Explain machine learning"
}
```
→ يتحول إلى: `"Mesh started"`

### rag.retrieve
استرجاع من قاعدة المعرفة

```json
{
  "type": "rag.retrieve",
  "k": 5,
  "ms": 120,
  "sources": ["kb", "cluster"]
}
```
→ يتحول إلى: `"RAG retrieve (k=5)"`

### rag.validate
تحقق من جودة الاستجابة

```json
{
  "type": "rag.validate",
  "score": 0.68,
  "subscores": { "citation": 0.7, "context": 0.8, ... },
  "model_version": "v3d4e+linear",
  "strategy": "critic"
}
```
→ يتحول إلى: `"Validate (critic)"` مع severity حسب الـ score

### mesh.consensus
إجماع بين الـ agents

```json
{
  "type": "mesh.consensus",
  "strategy": "majority",
  "votes": { "agent1": 0.8, "agent2": 0.7 }
}
```
→ يتحول إلى: `"Consensus (majority)"`

### mesh.final
إكمال الجلسة

```json
{
  "type": "mesh.final",
  "ms_total": 5000,
  "citations_count": 8
}
```
→ يتحول إلى: `"Mesh completed"`

## Severity Levels

يتم تحديد الـ severity حسب الـ score:

- **error** (حمراء): `score < 0.45`
- **warn** (صفراء): `score 0.45-0.55`
- **info** (خضراء): `score > 0.55`

## الإحصائيات المحسوبة

### Validation Stats
```typescript
{
  count: number;           // عدد الـ validations
  avgScore?: number;       // متوسط الـ score (0-1)
  byModel?: {...};         // عدد بواسطة النموذج
  byStrategy?: {...};      // عدد بواسطة الاستراتيجية
  passed?: number;         // عدد الناجح (>= 0.55)
  failed?: number;         // عدد الفاشل (< 0.55)
}
```

### Citation Stats
```typescript
{
  total?: number;          // مجموع الاقتباسات
  average?: number;        // متوسط الاقتباسات لكل validation
}
```

### Retrieval Stats
```typescript
{
  count: number;           // عدد عمليات الاسترجاع
  avgMs?: number;          // متوسط الوقت بالميللي ثانية
}
```

## الاستخدام في الكود

### 1. استرجاع Timeline حديث
```typescript
const response = await fetch("/api/ops/timeline?limit=50");
const { items, nextCursor, count } = await response.json();

console.log(`وُجد ${count} حدث`);
items.forEach(item => {
  console.log(`${new Date(item.ts).toISOString()} - ${item.label}`);
});
```

### 2. استرجاع تفاصيل جلسة
```typescript
const sessionId = "sess_abc123";
const response = await fetch(`/api/ops/timeline/${sessionId}`);
const summary = await response.json();

console.log(`الجلسة: ${summary.sessionId}`);
console.log(`المدة: ${summary.durationMs}ms`);
console.log(`Validations: ${summary.stats.validations.count}`);
console.log(`متوسط Score: ${summary.stats.validations.avgScore}`);

summary.events.forEach(event => {
  console.log(`  ${event.label} (${event.severity})`);
});
```

### 3. ترقيم الصفحات
```typescript
let cursor = null;
const allItems = [];

while (true) {
  const url = cursor
    ? `/api/ops/timeline?limit=50&cursor=${cursor}`
    : `/api/ops/timeline?limit=50`;

  const response = await fetch(url);
  const { items, nextCursor } = await response.json();

  allItems.push(...items);

  if (!nextCursor) break;
  cursor = nextCursor;
}

console.log(`المجموع: ${allItems.length}`);
```

### 4. تصفية بالاستراتيجية
```typescript
// جميع critic validations
const response = await fetch("/api/ops/timeline?strategy=critic&limit=100");
const { items } = await response.json();

const scores = items
  .filter(i => i.type === "rag.validate")
  .map(i => i.meta?.score);

const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
console.log(`متوسط critic: ${avgScore.toFixed(3)}`);
```

### 5. استخدام Normalizers مباشرةً
```typescript
import { toTimelineItem, summarizeSession } from "@/orchestrator/ops/timeline/normalizers";

// تحويل حدث واحد
const event = {
  ts: Date.now(),
  type: "rag.validate",
  sessionId: "sess1",
  score: 0.68,
  strategy: "critic"
};

const item = toTimelineItem("doc123", event);
console.log(item.label); // "Validate (critic)"
console.log(item.severity); // "info"

// تلخيص جلسة
const items = [item1, item2, item3];
const summary = summarizeSession(items);
console.log(summary.stats.validations.avgScore);
```

## فهارس Firestore المطلوبة

### Index 1: الاستعلام الافتراضي
```
Collection: ops_events
Fields:
  - ts (Descending)
```

### Index 2: مع تصفية sessionId
```
Collection: ops_events
Fields:
  - sessionId (Ascending)
  - ts (Descending)
```

### Index 3: مع تصفية strategy
```
Collection: ops_events
Fields:
  - strategy (Ascending)
  - ts (Descending)
```

### Index 4: مع تصفية type
```
Collection: ops_events
Fields:
  - type (Ascending)
  - ts (Descending)
```

**ملاحظة**: ستطلب Firestore إنشاء هذه الفهارس تلقائياً عند أول استعلام.

## الاختبارات

### تشغيل الاختبارات
```bash
pnpm test __tests__/timeline_normalizers.spec.ts
```

### النتائج المتوقعة
- ✅ 30+ اختبار ناجح
- ✅ جميع الـ normalizers تم اختبارها
- ✅ جميع الـ ViewModel builders تم اختبارها

### اختبار الـ APIs يدوياً
```bash
# شغّل الخادم
pnpm dev

# اختبر قائمة timeline
curl "http://localhost:3030/api/ops/timeline?limit=10"

# اختبر تفاصيل جلسة
curl "http://localhost:3030/api/ops/timeline/sess_abc123"

# اختبر التصفية
curl "http://localhost:3030/api/ops/timeline?strategy=critic"
curl "http://localhost:3030/api/ops/timeline?type=rag.validate"
```

## حل المشاكل

### API يرجع []
**السبب**: لا توجد أحداث في `ops_events`
**الحل**: شغّل نظام RAG لإنشاء أحداث

### Session details يرجع 404
**السبب**: معرّف جلسة غير صحيح
**الحل**: تحقق من وجود الجلسة في قاعدة البيانات

### Firestore permission denied
**السبب**: قواعد الأمان تمنع القراءة
**الحل**: حدّث قواعد Firestore أو أضف auth للـ API

### استعلام بطيء
**السبب**: فهارس Firestore مفقودة
**الحل**: أنشئ الفهارس المركبة كما هو مذكور أعلاه

## المعمارية

```
Firestore ops_events
         ↓
    API Endpoints
    /api/ops/timeline
    /api/ops/timeline/[id]
         ↓
   ViewModel Builders
   buildTimelineVM()
   buildSessionSummaryVM()
         ↓
     Normalizers
   toTimelineItem()
   summarizeSession()
         ↓
   Timeline Items
   { id, sessionId, ts,
     label, type, meta,
     severity }
         ↓
    UI (Day 2)
   /ops/timeline
```

## الخطوات القادمة (Day 2)

### تنفيذ الـ UI
- [ ] إنشاء صفحة `/ops/timeline`
- [ ] مكوّن Timeline مع infinite scroll
- [ ] Modal لتفاصيل الجلسة
- [ ] واجهة التصفية (date range, strategy, type)
- [ ] بحث بمعرّف الجلسة
- [ ] وظيفة التصدير

### تحسينات
- [ ] تحديثات real-time مع Firestore listeners
- [ ] تخزين مؤقت للإحصائيات
- [ ] بحث نصي كامل
- [ ] تصفية متقدمة
- [ ] رسوم بيانية وتصورات

## مرجع سريع

### الملفات الأساسية
- **الأنواع**: `src/orchestrator/ops/timeline/types.ts`
- **Normalizers**: `src/orchestrator/ops/timeline/normalizers.ts`
- **ViewModel**: `src/orchestrator/ops/timeline/viewmodel.ts`
- **List API**: `src/app/api/ops/timeline/route.ts`
- **Details API**: `src/app/api/ops/timeline/[sessionId]/route.ts`
- **Tests**: `__tests__/timeline_normalizers.spec.ts`

### أوامر سريعة
```bash
# الخادم
pnpm dev

# الاختبارات
pnpm test __tests__/timeline_normalizers.spec.ts

# اختبار الـ APIs
curl "http://localhost:3030/api/ops/timeline?limit=50"
curl "http://localhost:3030/api/ops/timeline/sess_abc123"
```

### مستويات الـ Severity
- `error`: score < 0.45 (أحمر في الـ UI)
- `warn`: score 0.45-0.55 (أصفر في الـ UI)
- `info`: score > 0.55 (أخضر في الـ UI)

---

## الحالة

✅ **المرحلة 62 اليوم 1 مكتمل!**

طبقة البيانات جاهزة لـ Timeline UI:
- ✅ نظام الأنواع معرّف
- ✅ Normalizers منفّذة
- ✅ ViewModel builders منشأة
- ✅ 2 نقاط API تعمل
- ✅ 30+ اختبار ناجح
- ✅ التوثيق مكتمل

**جاهز لـ**: Day 2 تنفيذ الـ UI في `/ops/timeline` 🚀

**تم التنفيذ**: 2025-11-07
**الملفات**: 7 منشأ
**الأسطر**: 1,300+
**الاختبارات**: 30+
