# Phase 58 - Adaptive RAG & Semantic Routing ✅

> Production-ready RAG system with intelligent semantic routing, caching, and performance tracking.

---

## 🎯 Objectives & Acceptance Criteria

**Goals:**
- ✅ Intelligent context retrieval unifying Memory + Docs + Ops
- ✅ Automatic semantic routing (dense/sparse/hybrid)
- ✅ Query caching with TTL
- ✅ Performance metrics tracking

**Metrics:**
- **Latency (P95):** ≤ 400ms for retrieval before LLM
- **NDCG@10:** ≥ 0.85 (requires manual evaluation)
- **Cost:** +≤20% with ≥15% quality improvement

---

## 📁 Architecture

### Components

```
src/lib/rag/
├── types.ts              # Core types and interfaces
├── policy.ts             # Strategy selection logic
├── cache.ts              # Query cache with TTL
├── metrics.ts            # Performance tracking
├── rerank.ts             # MMR and blended scoring
├── recallEngine.ts       # Main orchestrator
└── retrievers/
    ├── dense.ts          # Semantic search (embeddings)
    ├── sparse.ts         # Keyword search (BM25)
    └── hybrid.ts         # RRF fusion

src/app/api/rag/
└── query/route.ts        # API endpoint
```

### Flow

```
1. User Query
   ↓
2. Strategy Selection (auto/dense/sparse/hybrid)
   ↓
3. Cache Check (15min TTL)
   ↓
4. Retrieval (based on strategy)
   │
   ├─ Dense → Embeddings + Cosine Similarity
   ├─ Sparse → BM25 Keyword Matching
   └─ Hybrid → RRF (Reciprocal Rank Fusion)
   ↓
5. Re-ranking (MMR for diversity)
   ↓
6. Cache & Metrics
   ↓
7. Return Results
```

---

## 🚀 Quick Start

### 1. Deploy Firestore Indexes

```bash
# Merge indexes with existing configuration
firebase deploy --only firestore:indexes

# Enable TTL policy for ops_rag_cache.expire_at
# Go to Firebase Console → Firestore → Indexes → TTL Policies
# Add policy: Collection: ops_rag_cache, Field: expire_at
```

### 2. Update Firestore Rules

```bash
# Merge rules from firestore.rules.phase58
# Or apply directly:
firebase deploy --only firestore:rules
```

### 3. Test the API

```bash
# Local testing
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "q": "how to deploy to production",
    "workspaceId": "your_workspace_id",
    "topK": 8,
    "strategy": "auto"
  }'
```

### 4. Run Benchmarks

```bash
# Run benchmark suite
TEST_WORKSPACE_ID=your_workspace_id pnpm tsx scripts/benchmark-rag.ts

# Run tests
pnpm test __tests__/rag
```

---

## 📚 Usage Examples

### Basic Usage

```typescript
import { recall } from '@/lib/rag/recallEngine';

const result = await recall('how to deploy', {
  workspaceId: 'ws_123',
  topK: 8,
  strategy: 'auto', // or 'dense', 'sparse', 'hybrid'
  useMMR: true,
  mmrLambda: 0.65,
});

console.log(`Found ${result.items.length} items`);
console.log(`Strategy: ${result.diagnostics.strategy}`);
console.log(`Latency: ${result.diagnostics.tookMs}ms`);
console.log(`Cache hit: ${result.diagnostics.cacheHit}`);
```

### Strategy-Specific Retrieval

```typescript
// Semantic search (best for natural language)
const denseResult = await recall('explain authentication flow', {
  workspaceId: 'ws_123',
  strategy: 'dense',
});

// Keyword search (best for exact matches)
const sparseResult = await recall('"firebase deploy" command', {
  workspaceId: 'ws_123',
  strategy: 'sparse',
});

// Hybrid (best for code or ambiguous queries)
const hybridResult = await recall('async function getData()', {
  workspaceId: 'ws_123',
  strategy: 'hybrid',
});
```

### With Context Awareness

```typescript
import { rerankWithContext } from '@/lib/rag/rerank';

const initialResults = await recall(query, opts);

// Boost results relevant to conversation context
const contextAwareResults = rerankWithContext(
  initialResults.items,
  ['deployment', 'production', 'CI/CD'], // context keywords
  {
    contextBoost: 1.3,
    useMMR: true,
    topK: 8,
  }
);
```

### Batch Queries

```typescript
import { recallBatch } from '@/lib/rag/recallEngine';

const queries = [
  'how to deploy',
  'authentication setup',
  'error handling',
];

const results = await recallBatch(queries, {
  workspaceId: 'ws_123',
  topK: 5,
}, 3); // concurrency limit

results.forEach((result, i) => {
  console.log(`Query ${i + 1}: ${result.items.length} items`);
});
```

---

## 🔧 Configuration

### Strategy Selection Rules

The policy automatically selects strategies based on query characteristics:

| Query Type | Strategy | Why |
|-----------|----------|-----|
| Quoted strings | `sparse` | Exact match needed |
| Code blocks | `hybrid` | Balance semantics + exact |
| Short (≤4 words) | `hybrid` | Ambiguous intent |
| Long natural language | `dense` | Semantic understanding |
| Default | `dense` | Best for most cases |

### Performance Tuning

```typescript
// Adjust MMR lambda (relevance vs diversity)
const result = await recall(query, {
  workspaceId,
  useMMR: true,
  mmrLambda: 0.7, // Higher = more relevance, less diversity
});

// Adjust cache TTL
import { getOrSetQueryCache } from '@/lib/rag/cache';
await getOrSetQueryCache(workspaceId, query, strategy, data, 1800); // 30 min

// Adjust scoring weights
import { rerank, DEFAULT_WEIGHTS } from '@/lib/rag/rerank';
const customWeights = {
  ...DEFAULT_WEIGHTS,
  alpha: 0.6, // More weight on similarity
  beta: 0.2,  // Less weight on feedback
};
```

---

## 📊 Monitoring

### View Metrics

```typescript
import { calculatePerformanceSummary, calculateStrategyPerformance } from '@/lib/rag/metrics';

// Get latency stats
const perf = calculatePerformanceSummary(latencies);
console.log(`P95: ${perf.p95}ms`);
console.log(`Mean: ${perf.mean}ms`);

// Compare strategies
const strategyPerf = calculateStrategyPerformance(metrics);
strategyPerf.forEach(s => {
  console.log(`${s.strategy}: ${s.avgLatency}ms (${s.cacheHitRate * 100}% cache hit)`);
});
```

### Firestore Queries

```javascript
// Recent queries
db.collection('ops_rag_queries')
  .where('workspaceId', '==', 'ws_123')
  .orderBy('timestamp', 'desc')
  .limit(100)

// Slow queries
db.collection('ops_rag_queries')
  .where('tookMs', '>', 500)
  .orderBy('tookMs', 'desc')

// Cache entries
db.collection('ops_rag_cache')
  .where('workspaceId', '==', 'ws_123')
  .where('expire_at', '>', new Date())
```

---

## 🧪 Testing

### Run Unit Tests

```bash
pnpm test __tests__/rag/policy.test.ts
```

### Run Benchmark

```bash
TEST_WORKSPACE_ID=your_workspace pnpm tsx scripts/benchmark-rag.ts
```

Expected output:
```
📊 Results:

Latency:
  P50: 180ms
  P95: 350ms
  P99: 420ms

Strategy Usage:
  dense: 8 (53.3%)
  sparse: 3 (20.0%)
  hybrid: 4 (26.7%)

✅ Acceptance Criteria:
  P95 ≤ 400ms: ✓ PASS (350ms)
```

---

## 🔄 Integration Points

### 1. AI Prompt Context Builder

```typescript
// In your prompt builder
import { recall } from '@/lib/rag/recallEngine';

async function buildContext(userQuery: string, workspaceId: string) {
  const { items } = await recall(userQuery, {
    workspaceId,
    topK: 8,
    strategy: 'auto',
    useMMR: true,
  });

  return items.map(item => ({
    role: 'system',
    content: `Context: ${item.text}`,
  }));
}
```

### 2. Chat Interface

```typescript
// In chat component
const handleSubmit = async (message: string) => {
  // Get relevant context
  const context = await fetch('/api/rag/query', {
    method: 'POST',
    body: JSON.stringify({
      q: message,
      workspaceId: currentWorkspace.id,
      topK: 5,
    }),
  }).then(r => r.json());

  // Send to LLM with context
  const response = await sendToLLM({
    message,
    context: context.items,
  });
};
```

### 3. Search UI

```typescript
// In search component
const [results, setResults] = useState([]);

const handleSearch = async (query: string) => {
  const response = await fetch(`/api/rag/query?q=${encodeURIComponent(query)}&workspaceId=${workspaceId}`);
  const data = await response.json();

  setResults(data.items);
  console.log(`Strategy: ${data.diagnostics.strategy}`);
  console.log(`Took: ${data.diagnostics.tookMs}ms`);
};
```

---

## 🎯 Performance Tips

1. **Use caching effectively:**
   - Cache is keyed by `workspaceId|strategy|query`
   - TTL is 15 minutes by default
   - Invalidate on major data changes

2. **Choose strategy wisely:**
   - Let `auto` handle most cases
   - Force `sparse` for exact searches
   - Force `dense` for semantic questions

3. **Optimize MMR:**
   - Higher lambda (0.8) for relevance-first
   - Lower lambda (0.5) for diversity-first
   - Disable MMR for speed: `useMMR: false`

4. **Monitor metrics:**
   - Check P95 latency weekly
   - Compare strategy performance
   - Watch cache hit rates

---

## 🐛 Troubleshooting

### High Latency

```typescript
// Check component timings
const result = await recall(query, opts);
console.log('Component timings:', result.diagnostics.components);

// Common causes:
// - Large embedding batch (>200 items)
// - Cold start (first query)
// - Network latency to Firestore
```

### Low Cache Hit Rate

```bash
# Check cache TTL
# Increase if appropriate
await getOrSetQueryCache(..., 1800); // 30 min

# Check cache entries
firebase firestore:get ops_rag_cache --limit 10
```

### No Results

```typescript
// Use fallback strategy
import { recallWithFallback } from '@/lib/rag/recallEngine';

const result = await recallWithFallback(query, opts);
// Automatically tries hybrid if dense/sparse returns empty
```

---

## ✅ Done-Done Checklist

- [x] `recallEngine` with 3 strategies (dense/sparse/hybrid)
- [x] MMR re-ranking after fusion
- [x] Query cache with TTL
- [x] Firestore indexes for `ops_rag_cache` and `ops_rag_queries`
- [x] API `/api/rag/query` with auth placeholder
- [x] Benchmark script with P95 tracking
- [x] Integration examples
- [x] Documentation

---

## 🚀 Next Steps

### Phase 59 - Learning & Adaptation (Future)
- Train strategy selector on real queries
- A/B test different re-ranking weights
- Personalized retrieval per user

### Extensions
- Add document sources (PDFs, Markdown)
- Add ops sources (logs, metrics)
- Cross-workspace search
- Multi-modal retrieval (images, code)

---

## 📞 Support

- **Issues:** Check logs in `/api/rag/query`
- **Monitoring:** View `ops_rag_queries` in Firestore
- **Performance:** Run benchmark regularly

**Ready to deploy!** 🎉
