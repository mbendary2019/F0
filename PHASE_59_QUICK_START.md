# Phase 59: Cognitive Memory Mesh - Quick Start

**Status:** ✅ Ready
**Date:** 2025-11-06

---

## What is Phase 59?

A **graph-based memory system** that creates intelligent connections between memory snippets using:
- **Semantic edges** (similarity ≥ 0.85)
- **Temporal edges** (co-usage with decay)
- **Feedback edges** (user signals)

---

## Quick Deploy (5 Minutes)

### Step 1: Deploy Firestore

```bash
# Deploy indexes
firebase deploy --only firestore:indexes

# Deploy rules
firebase deploy --only firestore:rules
```

### Step 2: Enable TTL Policy

1. Go to [Firebase Console](https://console.firebase.google.com) → Firestore → Indexes → TTL Policies
2. Click "Create TTL Policy"
3. Set:
   - Collection group: `ops_memory_edges`
   - TTL field: `expire_at`
4. Click "Create" and wait for "Serving" status (~5 min)

### Step 3: Deploy Functions

```bash
cd functions && pnpm run build && cd ..

firebase deploy --only functions:weeklyRebuildMemoryGraphs,functions:rebuildMemoryGraph,functions:getMemoryGraphStats,functions:deleteMemoryGraph
```

### Step 4: Deploy Next.js

```bash
pnpm run build
firebase deploy --only hosting
```

---

## Quick Test

### Test API

```bash
curl -X POST https://your-domain.com/api/memory/query \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"test","queryText":"deployment","topK":10}'
```

### Test Function

```bash
firebase functions:call rebuildMemoryGraph --data='{"workspaceId":"test"}'
```

### Run Benchmark

```bash
export TEST_WORKSPACE_ID=test
pnpm tsx scripts/benchmark-memory-graph.ts
```

---

## Usage Examples

### Example 1: Build Graph

```typescript
import { buildEdgesForWorkspace } from '@/lib/memory/linkBuilder';

const result = await buildEdgesForWorkspace('workspace_123');
console.log(result); // { semantic: 2100, temporal: 850, feedback: 290 }
```

### Example 2: Query Related Nodes

```typescript
import { queryRelatedNodes } from '@/lib/memory/linkBuilder';

const results = await queryRelatedNodes({
  workspaceId: 'workspace_123',
  queryText: 'how to deploy',
  topK: 10
});

results.forEach(r => {
  console.log(`${r.nodeId}: ${r.score.toFixed(2)} (${r.reason})`);
});
```

### Example 3: Get Stats

```typescript
import { getWorkspaceGraphStats } from '@/lib/memory/linkBuilder';

const stats = await getWorkspaceGraphStats('workspace_123');
console.log(stats);
// {
//   nodeCount: 450,
//   edgeCount: 3240,
//   edgesByType: { semantic: 2100, temporal: 850, feedback: 290 },
//   avgDegree: 7.2
// }
```

---

## Files Created

### Core (3 files)
- `src/lib/memory/types.ts` - Type definitions
- `src/lib/memory/memoryGraph.ts` - Graph engine
- `src/lib/memory/linkBuilder.ts` - High-level API

### Functions (1 file)
- `functions/src/memory/rebuildGraph.ts` - 4 Cloud Functions

### API (3 files)
- `src/app/api/memory/query/route.ts` - Query endpoint
- `src/app/api/memory/stats/route.ts` - Stats endpoint
- `src/app/api/memory/rebuild/route.ts` - Rebuild endpoint

### Config (2 files)
- `firestore.indexes.phase59.json` - Indexes
- `firestore.rules.phase59` - Security rules

### Tests (2 files)
- `__tests__/memory/memoryGraph.test.ts` - Unit tests
- `scripts/benchmark-memory-graph.ts` - Benchmark

---

## Configuration

### Default Settings

```typescript
{
  semantic: { threshold: 0.85, maxNeighbors: 12 },
  temporal: { halfLifeDays: 21 },
  feedback: { minWeight: 0.2 },
  ttlDays: 90
}
```

### Tuning

**Stricter (Higher Precision):**
```typescript
{ semantic: { threshold: 0.90, maxNeighbors: 8 } }
```

**Looser (Higher Recall):**
```typescript
{ semantic: { threshold: 0.75, maxNeighbors: 20 } }
```

---

## Integration with Phase 58

```typescript
import { queryRelatedNodes } from '@/lib/memory/linkBuilder';
import { recall } from '@/lib/rag/recallEngine';

async function enhancedRecall(query: string, workspaceId: string) {
  // Standard RAG
  const ragResults = await recall(query, { workspaceId, topK: 8 });

  // Graph expansion
  const graphResults = await queryRelatedNodes({
    workspaceId,
    queryText: query,
    topK: 4
  });

  // Merge
  return [...ragResults.items, ...graphResults].slice(0, 12);
}
```

---

## Troubleshooting

### Too Many Edges
- Increase `semantic.threshold` to 0.90
- Decrease `maxNeighbors` to 8

### Slow Queries
- Check TTL policy is "Serving"
- Verify indexes are ready
- Reduce `topK` parameter

### TTL Not Working
- Wait 24 hours after enabling
- Check `expire_at` field exists
- Verify status is "Serving"

---

## Monitoring

```typescript
// Check recent jobs
const jobs = await db.collection('ops_memory_graph_jobs')
  .orderBy('timestamp', 'desc')
  .limit(10)
  .get();

jobs.forEach(d => {
  const data = d.data();
  console.log(`${data.workspaceId}: ${data.status} (${data.durationMs}ms)`);
});
```

---

## Next Steps

1. ✅ Deploy Firestore config
2. ✅ Enable TTL policy
3. ✅ Deploy functions
4. ✅ Test endpoints
5. ⬜ Run weekly rebuilds
6. ⬜ Integrate with Phase 58 RAG
7. ⬜ Monitor performance

---

## Resources

- [Complete Guide](./PHASE_59_COMPLETE.md)
- [API Reference](./PHASE_59_API_REFERENCE.md)
- [Deployment Guide](./PHASE_59_DEPLOYMENT_GUIDE.md)

---

**Ready to deploy!** 🚀
