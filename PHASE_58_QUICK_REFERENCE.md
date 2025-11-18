# Phase 58 - Quick Reference Card

## 🚀 One-Line Deploy

```bash
firebase deploy --only firestore:indexes,firestore:rules && pnpm build && firebase deploy --only hosting
```

---

## 📞 API Usage

### Basic Query

```bash
POST /api/rag/query
{
  "q": "your query",
  "workspaceId": "ws_123",
  "topK": 8
}
```

### With Options

```bash
POST /api/rag/query
{
  "q": "your query",
  "workspaceId": "ws_123",
  "topK": 10,
  "strategy": "hybrid",
  "useMMR": true,
  "mmrLambda": 0.7
}
```

---

## 💻 Code Snippets

### Basic Recall

```typescript
import { recall } from '@/lib/rag/recallEngine';

const { items, diagnostics } = await recall(query, {
  workspaceId: 'ws_123',
  topK: 8,
});
```

### With Custom Strategy

```typescript
const result = await recall(query, {
  workspaceId: 'ws_123',
  strategy: 'hybrid', // or 'dense', 'sparse'
  useMMR: true,
  mmrLambda: 0.65,
});
```

### Batch Queries

```typescript
import { recallBatch } from '@/lib/rag/recallEngine';

const results = await recallBatch(
  ['query1', 'query2', 'query3'],
  { workspaceId: 'ws_123' },
  3 // concurrency
);
```

---

## 🎯 Strategy Selection

| Query Type | Auto Strategy | When to Override |
|-----------|--------------|------------------|
| `"exact phrase"` | sparse | Never |
| `code snippet` | hybrid | Use sparse for exact |
| `short query` | hybrid | Use dense for semantic |
| `long question` | dense | Never |

---

## 📊 Performance Targets

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| P95 Latency | ≤ 400ms | > 500ms |
| Cache Hit Rate | > 30% | < 20% |
| NDCG@10 | ≥ 0.85 | < 0.75 |

---

## 🔧 Common Tasks

### Check Recent Queries

```javascript
db.collection('ops_rag_queries')
  .where('workspaceId', '==', 'ws_123')
  .orderBy('timestamp', 'desc')
  .limit(10)
```

### Clear Cache

```javascript
db.collection('ops_rag_cache')
  .where('workspaceId', '==', 'ws_123')
  .get()
  .then(snap => {
    snap.forEach(doc => doc.ref.delete());
  });
```

### Calculate P95

```typescript
const perf = calculatePerformanceSummary(latencies);
console.log(`P95: ${perf.p95}ms`);
```

---

## 🐛 Quick Fixes

### High Latency

```typescript
// Reduce candidates
const result = await recall(query, {
  workspaceId,
  topK: 5, // instead of 8
  useMMR: false, // skip MMR
});
```

### No Results

```typescript
// Use fallback
import { recallWithFallback } from '@/lib/rag/recallEngine';
const result = await recallWithFallback(query, opts);
```

### Low Cache Hit

```typescript
// Increase TTL
await getOrSetQueryCache(
  workspaceId,
  query,
  strategy,
  data,
  1800 // 30 minutes instead of 15
);
```

---

## 📁 File Locations

| Component | Path |
|-----------|------|
| Main Engine | `src/lib/rag/recallEngine.ts` |
| API | `src/app/api/rag/query/route.ts` |
| Indexes | `firestore.indexes.phase58.json` |
| Rules | `firestore.rules.phase58` |
| Benchmark | `scripts/benchmark-rag.ts` |
| Tests | `__tests__/rag/` |

---

## 🔑 Key Functions

```typescript
// Core
recall(query, opts)           // Main retrieval function
recallBatch(queries, opts)    // Batch retrieval
recallWithFallback(query)     // Auto fallback

// Retrievers
denseRetrieve(query, wsId)    // Semantic search
sparseRetrieve(query, wsId)   // Keyword search
hybridRetrieve(query, wsId)   // RRF fusion

// Utilities
chooseStrategy(query)         // Auto strategy selection
applyMMR(items, lambda)       // Diversity re-ranking
rerank(items, options)        // Full re-ranking
```

---

## ⚡ Quick Tests

```bash
# Run benchmark
pnpm tsx scripts/benchmark-rag.ts

# Run unit tests
pnpm test __tests__/rag

# Test API locally
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"q":"test","workspaceId":"ws_test"}'
```

---

## 🎓 Best Practices

1. **Always use `auto` strategy** unless you have a specific reason
2. **Monitor P95 latency** weekly in production
3. **Cache aggressively** for repeated queries
4. **Use MMR** for diversity (default: enabled)
5. **Set reasonable topK** (8-12 is optimal)
6. **Profile slow queries** using diagnostics.components

---

## 📞 Emergency Commands

```bash
# Stop all queries
firebase firestore:delete ops_rag_cache --all-collections --yes

# Check system health
firebase firestore:indexes | grep ops_rag

# View recent errors
firebase functions:log --only api

# Rollback
git revert HEAD && firebase deploy
```

---

**Keep this handy for quick reference!** 📌
