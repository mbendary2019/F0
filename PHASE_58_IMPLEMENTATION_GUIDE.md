# Phase 58 - Adaptive RAG & Semantic Routing

**التاريخ**: 2025-11-06
**الحالة**: 🚧 In Progress (25% Complete)

---

## 📋 نظرة عامة

Phase 58 تضيف نظام استرجاع ذكي (RAG) يدمج بين:
- **Dense Retrieval** (Semantic Search via embeddings)
- **Sparse Retrieval** (BM25 keyword matching)
- **Hybrid Retrieval** (RRF fusion)
- **Semantic Routing** (Auto strategy selection)
- **MMR Re-ranking** (Diversity)
- **Query Caching** (Performance)

---

## 🎯 الأهداف & مقاييس القبول

| المقياس | الهدف | الحالة |
|---------|-------|--------|
| **Latency (P95)** | ≤ 400ms | ⏳ Pending |
| **NDCG@10** | ≥ 0.85 | ⏳ Pending |
| **Cost** | +≤20% vs current | ⏳ Pending |
| **Quality** | +≥15% improvement | ⏳ Pending |

---

## 📁 هيكل الملفات

```
src/lib/rag/
├── types.ts                    ✅ Complete
├── policy.ts                   ✅ Complete
├── retrievers/
│   ├── dense.ts               ⏳ TODO
│   ├── sparse.ts              ⏳ TODO
│   └── hybrid.ts              ⏳ TODO
├── rerank.ts                   ⏳ TODO
├── cache.ts                    ⏳ TODO
├── metrics.ts                  ⏳ TODO
└── recallEngine.ts             ⏳ TODO

src/app/api/rag/
└── query/route.ts              ⏳ TODO

__tests__/rag/
├── policy.test.ts              ⏳ TODO
├── rerank.test.ts              ⏳ TODO
└── recallEngine.test.ts        ⏳ TODO

scripts/
└── build-rag-bench.ts          ⏳ TODO

firestore.indexes.phase58.json  ⏳ TODO
firestore.rules.phase58.snippet ⏳ TODO
```

---

## ✅ ما تم إنجازه

### 1. Types System (`src/lib/rag/types.ts`)

```typescript
export type Source = "memory" | "doc" | "ops";
export type Strategy = "auto" | "dense" | "sparse" | "hybrid";

export interface RecallItem {
  id: string;
  source: Source;
  text: string;
  score: number;
  meta?: Record<string, any>;
}

export interface RecallOpts {
  workspaceId: string;
  topK?: number;
  strategy?: Strategy;
  useMMR?: boolean;
  mmrLambda?: number;
  budgetTokens?: number;
  // ... more options
}

export interface RecallResult {
  items: RecallItem[];
  diagnostics: RecallDiagnostics;
}
```

**الميزات**:
- أنواع شاملة لجميع المكونات
- TypeScript strict mode compatible
- Extensible metadata system

### 2. Policy & Routing (`src/lib/rag/policy.ts`)

```typescript
export function chooseStrategy(
  query: string,
  opts: RecallOpts
): Strategy {
  // Smart rules:
  // - Quoted strings → sparse
  // - Code patterns → hybrid
  // - Short queries → hybrid
  // - Default → dense
}

export function getStrategyConfidence(
  query: string,
  strategy: Strategy
): number {
  // Returns 0-1 confidence score
}

export function explainStrategy(
  query: string,
  strategy: Strategy
): string {
  // Human-readable explanation
}
```

**الميزات**:
- قواعد ذكية لاختيار الاستراتيجية
- Confidence scoring
- Explainability للتشخيص

---

## 🔨 المكونات المتبقية

### 3. Dense Retriever (`src/lib/rag/retrievers/dense.ts`)

**الوظيفة**: Semantic search using embeddings from Phase 57 cache

**الخوارزمية**:
1. Fetch recent snippets from Firestore (limit 200)
2. Get embeddings via `getManyOrEmbed()` (Phase 57.2 cache)
3. Compute cosine similarity with query
4. Return top-K most similar

**التكامل**:
- يستخدم `snippetCache.getManyOrEmbed()` من Phase 57.2
- يتعامل مع `ops_memory_snippets` collection
- يدعم multiple sources (memory/docs/ops)

**الكود المقترح**:
```typescript
import { getManyOrEmbed } from '@/lib/ai/memory/snippetCache';

export async function denseRetrieve(
  queryText: string,
  workspaceId: string,
  topK = 12
): Promise<RecallItem[]> {
  // 1. Fetch candidates
  const candidates = await fetchCandidates(workspaceId, 200);

  // 2. Embed with cache
  const texts = candidates.map(c => c.text);
  const result = await getManyOrEmbed(texts);

  // 3. Compute similarity
  const queryResult = await getManyOrEmbed([queryText]);
  const scores = computeCosineSimilarity(queryResult.vectors[0], result.vectors);

  // 4. Return top-K
  return selectTopK(candidates, scores, topK);
}
```

---

### 4. Sparse Retriever (`src/lib/rag/retrievers/sparse.ts`)

**الوظيفة**: BM25 keyword matching (in-memory, no external server)

**الخوارزمية**:
1. Fetch recent snippets (limit 400 for larger corpus)
2. Tokenize query and documents
3. Compute BM25 scores
4. Return top-K by score

**المعادلات**:
```
IDF(t) = log((N - df(t) + 0.5) / (df(t) + 0.5) + 1)
BM25 = Σ IDF(t) * (f(t) * (k1 + 1)) / (f(t) + k1 * (1 - b + b * (dl / avgdl)))
```

**Parameters**:
- k1 = 1.2 (term frequency saturation)
- b = 0.75 (length normalization)

---

### 5. Hybrid Retriever (`src/lib/rag/retrievers/hybrid.ts`)

**الوظيفة**: Combine dense + sparse using RRF (Reciprocal Rank Fusion)

**الخوارزمية**:
```typescript
RRF_score(item) = Σ 1 / (K + rank_in_list_i)
// K = 60 (constant)
```

**الخطوات**:
1. Run dense and sparse in parallel
2. For each item, compute RRF score from both rankings
3. Sort by RRF score
4. Return top-K

**الميزة**: يجمع بين القوة الدلالية والكلمات المفتاحية

---

### 6. Re-ranking (`src/lib/rag/rerank.ts`)

**الوظيفة**: MMR for diversity + blended scoring

**MMR Formula**:
```
MMR = λ * Sim(query, item) - (1-λ) * max(Sim(item, selected))
```

**Blended Score**:
```typescript
score = α*similarity + β*weight + γ*recency + δ*novelty
// Default: α=0.5, β=0.3, γ=0.15, δ=0.05
```

---

### 7. Query Cache (`src/lib/rag/cache.ts`)

**الوظيفة**: Cache query results in Firestore with TTL

**Schema**:
```typescript
ops_rag_cache/{hash}:
  workspaceId: string
  queryHash: string
  query: string
  value: RecallItem[]
  expire_at: Timestamp  // TTL
  created_at: Timestamp
  hit_count: number
```

**TTL**: 20 minutes default (1200 seconds)

---

### 8. Metrics (`src/lib/rag/metrics.ts`)

**الوظيفة**: Track query performance

**Schema**:
```typescript
ops_rag_queries/{id}:
  workspaceId: string
  strategy: Strategy
  tookMs: number
  cacheHit: boolean
  topK: number
  timestamp: Timestamp
```

---

### 9. Recall Engine (`src/lib/rag/recallEngine.ts`)

**الوظيفة**: Orchestrator that ties everything together

**Flow**:
```
1. Choose strategy (policy.chooseStrategy)
2. Check cache (cache.getOrSetQueryCache)
3. If miss:
   a. Retrieve (dense/sparse/hybrid)
   b. Apply MMR (rerank.applyMMR)
   c. Cache results
4. Record metrics
5. Return items + diagnostics
```

---

### 10. API Endpoint (`src/app/api/rag/query/route.ts`)

**Endpoint**: `POST /api/rag/query`

**Request**:
```json
{
  "q": "how to deploy to production",
  "workspaceId": "ws_abc123",
  "topK": 8,
  "strategy": "auto",
  "useMMR": true,
  "mmrLambda": 0.65
}
```

**Response**:
```json
{
  "items": [
    {
      "id": "snp_xyz",
      "source": "memory",
      "text": "Deploy using firebase deploy...",
      "score": 0.87
    }
  ],
  "diagnostics": {
    "strategy": "dense",
    "tookMs": 245,
    "cacheHit": false,
    "components": [...]
  }
}
```

---

## 🗄️ Firestore Configuration

### Indexes (`firestore.indexes.phase58.json`)

```json
{
  "indexes": [
    {
      "collectionGroup": "ops_rag_cache",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ops_rag_queries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": [
    {
      "collectionGroup": "ops_rag_cache",
      "fieldPath": "value",
      "indexes": []
    }
  ]
}
```

### Security Rules

```javascript
match /ops_rag_cache/{id} {
  allow read: if isSignedIn() &&
    resource.data.workspaceId in request.auth.token.workspaces;
  allow write: if false; // Server-side only
}

match /ops_rag_queries/{id} {
  allow read: if isAdmin();
  allow write: if false; // Server-side only
}
```

### TTL Policy

From Firebase Console → Firestore → TTL:
- Collection: `ops_rag_cache`
- Field: `expire_at`
- Type: Timestamp

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// __tests__/rag/policy.test.ts
describe('chooseStrategy', () => {
  it('should choose sparse for quoted queries', () => {
    expect(chooseStrategy('"exact match"', opts)).toBe('sparse');
  });

  it('should choose hybrid for code queries', () => {
    expect(chooseStrategy('function deploy() {}', opts)).toBe('hybrid');
  });

  it('should choose dense for natural language', () => {
    expect(chooseStrategy('how do I deploy my app', opts)).toBe('dense');
  });
});
```

### Integration Tests

```typescript
// __tests__/rag/recallEngine.test.ts
describe('recall', () => {
  it('should retrieve relevant items', async () => {
    const result = await recall('deploy to production', {
      workspaceId: 'test_ws',
      topK: 5
    });

    expect(result.items).toHaveLength(5);
    expect(result.diagnostics.tookMs).toBeLessThan(400);
  });
});
```

### Benchmark Script

```typescript
// scripts/build-rag-bench.ts
async function benchmark() {
  const queries = loadTestQueries(); // 50-100 queries
  const results = [];

  for (const q of queries) {
    const t0 = performance.now();
    const result = await recall(q.text, opts);
    const tookMs = performance.now() - t0;

    results.push({
      query: q.text,
      latency: tookMs,
      ndcg: computeNDCG(result.items, q.relevance),
      strategy: result.diagnostics.strategy
    });
  }

  printStats(results);
}
```

**Metrics to Report**:
- P50, P95, P99 latency
- NDCG@5, NDCG@10
- Recall@5, Recall@10
- Cache hit rate
- Strategy distribution

---

## 📊 الأداء المتوقع

| المقياس | الهدف | التوقع |
|---------|-------|--------|
| **P95 Latency** | ≤ 400ms | ~250-350ms |
| **Cache Hit Rate** | ≥ 40% | ~50-60% |
| **NDCG@10** | ≥ 0.85 | ~0.87-0.92 |
| **Cost/Query** | +≤20% | ~+10-15% |

**التحسينات**:
- Phase 57 cache يقلل latency بـ 60%
- Query cache يقلل latency بـ 90% (عند hit)
- Hybrid يحسن جودة النتائج بـ 15-20%

---

## 🚀 خطة التنفيذ

### المرحلة 1: Core Retrievers (2-3 ساعات)
- [ ] Dense retriever + تكامل مع Phase 57 cache
- [ ] Sparse retriever (BM25)
- [ ] Hybrid retriever (RRF)

### المرحلة 2: Re-ranking & Cache (1-2 ساعات)
- [ ] MMR implementation
- [ ] Blended scoring
- [ ] Query cache layer

### المرحلة 3: Engine & API (1 ساعة)
- [ ] Recall engine orchestrator
- [ ] API endpoint
- [ ] Metrics tracking

### المرحلة 4: Config & Tests (1 ساعة)
- [ ] Firestore indexes
- [ ] Security rules
- [ ] Unit tests
- [ ] Benchmark script

### المرحلة 5: Integration & Docs (1 ساعة)
- [ ] Integrate with promptContextBuilder
- [ ] Documentation
- [ ] Deployment guide

**المدة الإجمالية**: 6-8 ساعات عمل فعلي

---

## 🔗 التكامل مع Phase 57

Phase 58 يبني على Phase 57 بشكل كامل:

### من Phase 57.2 (Snippet Cache)
```typescript
import { getManyOrEmbed } from '@/lib/ai/memory/snippetCache';

// في dense.ts
const { vectors, stats } = await getManyOrEmbed(texts);
// استخدام نفس الـ cache → 90% cost reduction
```

### من Phase 57.1 (MMR)
```typescript
import { mmr } from '@/lib/ai/memory/mmr';

// في rerank.ts
export function applyMMR(items: RecallItem[], lambda: number, k: number) {
  // نفس الخوارزمية، interface مختلف
}
```

### من Phase 57.3 (TTL)
```typescript
import { createTTLField } from '@/lib/ai/util/ttl';

// في cache.ts
await setDoc(ref, {
  ...data,
  ...createTTLField('ragCache', { customDays: 20 / 24 }) // 20 دقيقة
});
```

---

## 📝 الخطوات التالية

### الخيار A: التنفيذ الكامل (موصى به)
1. إكمال الـ 9 ملفات المتبقية
2. الاختبار المحلي
3. النشر مع Phase 57

### الخيار B: MVP سريع
1. Dense retriever فقط (بدون sparse/hybrid)
2. بدون cache في البداية
3. API بسيط
4. نشر وتحسين تدريجياً

### الخيار C: التأجيل
1. نشر Phase 57 أولاً
2. مراقبة الأداء أسبوع
3. البدء في Phase 58 بناءً على البيانات الفعلية

---

## 📚 المراجع

**Phase 57 (Dependencies)**:
- [PHASE_57_COMPLETE.md](PHASE_57_COMPLETE.md)
- [PHASE_57_2_SNIPPET_CACHING_FEEDBACK.md](PHASE_57_2_SNIPPET_CACHING_FEEDBACK.md)

**External Resources**:
- BM25 Algorithm: [Wikipedia](https://en.wikipedia.org/wiki/Okapi_BM25)
- RRF Fusion: [Paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- NDCG Metric: [Explanation](https://en.wikipedia.org/wiki/Discounted_cumulative_gain)

---

## 🎉 الخلاصة

**Phase 58** يضيف RAG ذكي متقدم مع:
- ✅ Types system (complete)
- ✅ Routing policy (complete)
- ⏳ 9 components remaining (~6-8 hours work)

**التأثير المتوقع**:
- 15-20% تحسين في جودة النتائج
- P95 latency ≤ 400ms
- تكامل سلس مع Phase 57

---

**الحالة**: جاهز للتنفيذ الكامل أو MVP حسب الأولويات.

هل تريد المتابعة مع:
1. **التنفيذ الكامل** (6-8 ساعات)
2. **MVP سريع** (2-3 ساعات)
3. **التركيز على Phase 57** (نشر أولاً)
