# المرحلة 58 - RAG التكيفي والتوجيه الدلالي 🚀

> نظام RAG جاهز للإنتاج مع توجيه دلالي ذكي، تخزين مؤقت، وتتبع الأداء.

---

## ⚡ البدء السريع

### 1. نشر الفهارس

```bash
firebase deploy --only firestore:indexes

# تفعيل سياسة TTL من Console
# Firestore → Indexes → TTL Policies
# Collection: ops_rag_cache
# Field: expire_at
```

### 2. تطبيق القواعد

```bash
firebase deploy --only firestore:rules
```

### 3. اختبار API

```bash
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "q": "كيف أنشر للإنتاج",
    "workspaceId": "ws_123",
    "topK": 8
  }'
```

---

## 📖 الاستخدام

### استخدام أساسي

```typescript
import { recall } from '@/lib/rag/recallEngine';

const نتيجة = await recall('كيف أنشر التطبيق', {
  workspaceId: 'ws_123',
  topK: 8,
  strategy: 'auto', // اختيار تلقائي
});

console.log(`عدد النتائج: ${نتيجة.items.length}`);
console.log(`الاستراتيجية: ${نتيجة.diagnostics.strategy}`);
console.log(`الوقت: ${نتيجة.diagnostics.tookMs}ms`);
```

### استراتيجيات مختلفة

```typescript
// بحث دلالي (للأسئلة الطبيعية)
const كثيف = await recall('اشرح آلية المصادقة', {
  workspaceId: 'ws_123',
  strategy: 'dense',
});

// بحث بالكلمات المفتاحية (للبحث الدقيق)
const متفرق = await recall('"firebase deploy" أمر', {
  workspaceId: 'ws_123',
  strategy: 'sparse',
});

// هجين (للكود أو الاستعلامات الغامضة)
const هجين = await recall('async function getData()', {
  workspaceId: 'ws_123',
  strategy: 'hybrid',
});
```

---

## 🎯 الاستراتيجيات

| نوع الاستعلام | الاستراتيجية | السبب |
|---------------|--------------|-------|
| نص مقتبس | `sparse` | مطابقة دقيقة |
| كود | `hybrid` | توازن بين الدلالي والدقيق |
| قصير (≤4 كلمات) | `hybrid` | غامض |
| طويل طبيعي | `dense` | فهم دلالي |

---

## 📊 المراقبة

### عرض المقاييس

```typescript
import { calculatePerformanceSummary } from '@/lib/rag/metrics';

const أداء = calculatePerformanceSummary(latencies);
console.log(`P95: ${أداء.p95}ms`);
console.log(`المتوسط: ${أداء.mean}ms`);
```

### استعلامات Firestore

```javascript
// الاستعلامات الأخيرة
db.collection('ops_rag_queries')
  .where('workspaceId', '==', 'ws_123')
  .orderBy('timestamp', 'desc')
  .limit(100)

// الاستعلامات البطيئة
db.collection('ops_rag_queries')
  .where('tookMs', '>', 500)
  .orderBy('tookMs', 'desc')
```

---

## 🧪 الاختبار

### تشغيل المعايير

```bash
TEST_WORKSPACE_ID=ws_123 pnpm tsx scripts/benchmark-rag.ts
```

النتيجة المتوقعة:
```
📊 النتائج:

الزمن:
  P50: 180ms
  P95: 350ms
  P99: 420ms

استخدام الاستراتيجيات:
  dense: 8 (53.3%)
  sparse: 3 (20.0%)
  hybrid: 4 (26.7%)

✅ معايير القبول:
  P95 ≤ 400ms: ✓ نجح (350ms)
```

---

## 🔧 التكامل

### مع منشئ السياق

```typescript
import { recall } from '@/lib/rag/recallEngine';

async function بناءالسياق(استعلام: string, مساحةالعمل: string) {
  const { items } = await recall(استعلام, {
    workspaceId: مساحةالعمل,
    topK: 8,
    strategy: 'auto',
  });

  return items.map(item => ({
    role: 'system',
    content: `السياق: ${item.text}`,
  }));
}
```

### مع واجهة الدردشة

```typescript
const إرسال = async (رسالة: string) => {
  // الحصول على السياق
  const سياق = await fetch('/api/rag/query', {
    method: 'POST',
    body: JSON.stringify({
      q: رسالة,
      workspaceId: workspaceId,
      topK: 5,
    }),
  }).then(r => r.json());

  // إرسال للـ LLM مع السياق
  const رد = await sendToLLM({
    message: رسالة,
    context: سياق.items,
  });
};
```

---

## 💡 نصائح الأداء

1. **استخدم التخزين المؤقت بفعالية:**
   - مدة التخزين: 15 دقيقة افتراضيًا
   - يُعاد بناء المفتاح من: `مساحةالعمل|الاستراتيجية|الاستعلام`

2. **اختر الاستراتيجية بحكمة:**
   - `auto` للحالات العامة
   - `sparse` للبحث الدقيق
   - `dense` للأسئلة الدلالية

3. **راقب المقاييس:**
   - تحقق من P95 أسبوعيًا
   - قارن أداء الاستراتيجيات
   - راقب معدل إصابة الذاكرة المؤقتة

---

## 🐛 حل المشاكل

### بطء عالي

```typescript
// تحقق من مكونات التوقيت
const نتيجة = await recall(استعلام, opts);
console.log('التوقيتات:', نتيجة.diagnostics.components);
```

### لا توجد نتائج

```typescript
import { recallWithFallback } from '@/lib/rag/recallEngine';

// يحاول استراتيجية بديلة تلقائيًا
const نتيجة = await recallWithFallback(استعلام, opts);
```

---

## ✅ قائمة التحقق

- [x] محرك الاستدعاء مع 3 استراتيجيات
- [x] إعادة ترتيب MMR
- [x] تخزين مؤقت للاستعلامات
- [x] فهارس Firestore
- [x] API endpoint
- [x] سكربت المعايير
- [x] الوثائق

**جاهز للنشر!** 🎉
