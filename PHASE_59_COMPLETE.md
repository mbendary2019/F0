# Phase 59: Cognitive Memory Mesh - Complete Implementation

**Status:** ✅ Complete
**Date:** 2025-11-06
**Integration:** Phases 57.2 (Snippet Cache), 58 (Adaptive RAG)

---

## Overview

Phase 59 implements a **Cognitive Memory Mesh** - a graph-based memory system that creates semantic, temporal, and feedback-driven connections between memory snippets. This enables intelligent knowledge retrieval beyond simple semantic search.

### Key Features

- **Three Edge Types:**
  - **Semantic:** Embeddings-based similarity (cosine ≥ 0.85)
  - **Temporal:** Co-usage decay (half-life = 21 days)
  - **Feedback:** User signals aggregated into edge weights

- **Production Ready:**
  - Workspace isolation
  - TTL-enabled edges (90-day default)
  - Batch operations for large graphs
  - Incremental updates support

- **Performance:**
  - Cached embeddings via Phase 57.2
  - Configurable thresholds
  - Max neighbors cap (12 default)
  - Target P95 latency ≤ 500ms

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory Graph System                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │   Nodes     │   │    Edges     │   │   Feedback      │  │
│  │ (Snippets)  │───│  Semantic    │   │  (User Signals) │  │
│  │             │   │  Temporal    │───│                 │  │
│  │ embeddings  │   │  Feedback    │   │  turn_id        │  │
│  └─────────────┘   └──────────────┘   └─────────────────┘  │
│         │                   │                   │            │
│         └───────────────────┴───────────────────┘            │
│                             │                                │
│                    ┌────────▼────────┐                      │
│                    │  Graph Builder  │                      │
│                    │  (memoryGraph)  │                      │
│                    └────────┬────────┘                      │
│                             │                                │
│         ┌───────────────────┴───────────────────┐           │
│         │                                        │           │
│  ┌──────▼──────┐                        ┌───────▼──────┐   │
│  │ Link Builder│                        │  Query API   │   │
│  │ (High-Level)│                        │ /api/memory/ │   │
│  └─────────────┘                        └──────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Files

### Core Implementation (3 files)

#### 1. [src/lib/memory/types.ts](src/lib/memory/types.ts)
Type definitions for the memory graph system.

**Key Types:**
- `MemoryNode` - Graph nodes (snippets with embeddings)
- `MemoryEdge` - Graph edges (semantic/temporal/feedback)
- `RelatedNode` - Query results
- `BuildGraphOptions` - Configuration
- `GraphStats` - Analytics

```typescript
export interface MemoryNode {
  id: string;
  workspaceId: string;
  type: 'snippet' | 'tag' | 'concept';
  text: string;
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
  useCount?: number;
  lastUsedAt?: string;
}

export interface MemoryEdge {
  id: string; // ${from}_${to}_${relation}
  workspaceId: string;
  from: string;
  to: string;
  relation: 'semantic' | 'temporal' | 'feedback';
  weight: number; // [0..1]
  meta?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  expire_at?: Timestamp; // TTL
}
```

#### 2. [src/lib/memory/memoryGraph.ts](src/lib/memory/memoryGraph.ts)
Core graph engine with edge computation algorithms.

**Key Functions:**

```typescript
// Main orchestrator
async function rebuildGraphForWorkspace(
  workspaceId: string,
  opts?: Partial<BuildGraphOptions>
): Promise<GraphBuildResult>

// Semantic edges (cosine similarity)
async function computeSemanticEdges(
  workspaceId: string,
  nodes: MemoryNode[],
  config: { threshold: number; maxNeighbors: number },
  ttlDays?: number
): Promise<{ inserted: number }>

// Temporal edges (co-usage decay)
async function computeTemporalEdges(
  workspaceId: string,
  halfLifeDays: number,
  ttlDays?: number
): Promise<{ inserted: number }>

// Feedback edges (user signals)
async function computeFeedbackEdges(
  workspaceId: string,
  minWeight: number,
  ttlDays?: number
): Promise<{ inserted: number }>

// Query helpers
async function getRelatedNodes(
  workspaceId: string,
  baseNodeId: string,
  topK?: number
): Promise<RelatedNode[]>

async function getRelatedByQueryEmbedding(
  workspaceId: string,
  embedding: number[],
  threshold?: number,
  topK?: number
): Promise<RelatedNode[]>

// Statistics
async function getGraphStats(
  workspaceId: string
): Promise<GraphStats>

// Cleanup
async function deleteGraphForWorkspace(
  workspaceId: string
): Promise<{ deleted: number }>
```

**Algorithms:**

**Semantic Edge Computation:**
```typescript
1. Ensure all nodes have embeddings (via Phase 57.2 cache)
2. For each node:
   a. Calculate cosine similarity with all other nodes
   b. Filter edges where similarity ≥ threshold (0.85)
   c. Keep top maxNeighbors (12) by similarity
   d. Create bidirectional edges (A→B and B→A)
3. Batch insert to Firestore (500 per batch)
```

**Temporal Edge Computation:**
```typescript
1. Group feedback by turn_id (co-usage proxy)
2. For each turn:
   a. Extract all snippet IDs used in that turn
   b. Create pairwise edges between snippets
   c. Calculate decay: weight = 0.5^(ageDays / halfLifeDays)
   d. Filter edges where decay ≥ 0.05
3. Batch insert edges
```

**Feedback Edge Computation:**
```typescript
1. Aggregate feedback signals per snippet-cluster pair
2. For each pair:
   a. Sum rewards: Σ(reward)
   b. Calculate weight: max(0, min(1, 0.5 + sumReward/10))
   c. Filter edges where weight ≥ minWeight (0.2)
3. Batch insert edges
```

#### 3. [src/lib/memory/linkBuilder.ts](src/lib/memory/linkBuilder.ts)
High-level API for consumers (Phase 58 RAG, etc.)

**Key Functions:**

```typescript
// Query related nodes by text or embedding
async function queryRelatedNodes(params: {
  workspaceId: string;
  queryText?: string;
  queryEmbedding?: number[];
  threshold?: number;
  topK?: number;
}): Promise<RelatedNode[]>

// Query from specific node
async function queryRelatedNodesFromNode(
  workspaceId: string,
  nodeId: string,
  topK?: number
): Promise<RelatedNode[]>

// Full rebuild
async function buildEdgesForWorkspace(
  workspaceId: string,
  options?: BuildGraphOptions
): Promise<GraphBuildResult>

// Incremental update for new snippets
async function buildEdgesForNewSnippets(
  workspaceId: string,
  snippetIds: string[],
  options?: { semanticThreshold?: number; maxNeighbors?: number; ttlDays?: number }
): Promise<{ inserted: number }>

// Manual edge management
async function ensureManualEdge(params: {
  workspaceId: string;
  from: string;
  to: string;
  relation: 'semantic' | 'temporal' | 'feedback';
  weight?: number;
  meta?: Record<string, any>;
}): Promise<{ id: string }>

async function deleteEdge(edgeId: string): Promise<void>
async function updateEdgeWeight(edgeId: string, newWeight: number, meta?: Record<string, any>): Promise<void>

// Analytics
async function getWorkspaceGraphStats(workspaceId: string): Promise<GraphStats>
async function getEdgeCountByType(workspaceId: string): Promise<{ semantic: number; temporal: number; feedback: number }>

// Path finding
async function findShortestPath(
  workspaceId: string,
  fromNodeId: string,
  toNodeId: string,
  maxDepth?: number
): Promise<{ path: string[]; length: number } | null>
```

---

### Cloud Functions (4 functions)

**File:** [functions/src/memory/rebuildGraph.ts](functions/src/memory/rebuildGraph.ts)

#### 1. `weeklyRebuildMemoryGraphs` (Scheduled)
- **Schedule:** Every Sunday 03:00 UTC
- **Purpose:** Rebuild graphs for all active workspaces
- **Memory:** 1GiB
- **Timeout:** 9 minutes

```typescript
// Exported in functions/src/index.ts
export { weeklyRebuildMemoryGraphs } from './memory/rebuildGraph';
```

#### 2. `rebuildMemoryGraph` (Callable, Admin Only)
- **Purpose:** Manual rebuild for specific workspace
- **Auth:** Admin token required
- **Timeout:** 5 minutes

```bash
firebase functions:call rebuildMemoryGraph --data='{"workspaceId":"ws_123"}'
```

#### 3. `getMemoryGraphStats` (Callable)
- **Purpose:** Fetch graph statistics
- **Auth:** User authenticated
- **Timeout:** 60 seconds

```bash
firebase functions:call getMemoryGraphStats --data='{"workspaceId":"ws_123"}'
```

#### 4. `deleteMemoryGraph` (Callable, Admin Only)
- **Purpose:** Delete all edges for workspace
- **Auth:** Admin token required
- **Timeout:** 3 minutes

```bash
firebase functions:call deleteMemoryGraph --data='{"workspaceId":"ws_123"}'
```

---

### API Endpoints (3 routes)

#### 1. POST `/api/memory/query`
Query related nodes by text, embedding, or node ID.

**Request:**
```json
{
  "workspaceId": "ws_123",
  "queryText": "how to deploy functions",
  "threshold": 0.75,
  "topK": 12
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "nodeId": "snippet_abc",
      "score": 0.89,
      "reason": "semantic",
      "text": "Deploy functions using firebase deploy..."
    }
  ],
  "count": 12,
  "method": "embedding"
}
```

#### 2. GET `/api/memory/stats?workspaceId=ws_123`
Get graph statistics.

**Response:**
```json
{
  "success": true,
  "workspaceId": "ws_123",
  "stats": {
    "nodeCount": 450,
    "edgeCount": 3240,
    "edgesByType": {
      "semantic": 2100,
      "temporal": 850,
      "feedback": 290
    },
    "avgDegree": 7.2,
    "timestamp": "2025-11-06T..."
  },
  "edgeCounts": {
    "semantic": 2100,
    "temporal": 850,
    "feedback": 290
  }
}
```

#### 3. POST `/api/memory/rebuild`
Trigger graph rebuild (admin only).

**Request:**
```json
{
  "workspaceId": "ws_123",
  "options": {
    "semantic": { "threshold": 0.85, "maxNeighbors": 12 },
    "temporal": { "halfLifeDays": 21 },
    "ttlDays": 90
  }
}
```

---

### Firestore Configuration

#### Indexes ([firestore.indexes.phase59.json](firestore.indexes.phase59.json))

```json
{
  "indexes": [
    {
      "collectionGroup": "ops_memory_edges",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "from", "order": "ASCENDING" },
        { "fieldPath": "weight", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ops_memory_edges",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "relation", "order": "ASCENDING" },
        { "fieldPath": "weight", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": [
    {
      "collectionGroup": "ops_memory_edges",
      "fieldPath": "expire_at",
      "ttl": true
    }
  ]
}
```

#### Security Rules ([firestore.rules.phase59](firestore.rules.phase59))

**Key Rules:**
- Read: Admins or workspace owners
- Write: Admins or workspace owners (can't change workspaceId)
- Delete: Admins or workspace owners
- Stats collections: Admins write, users read

---

### Testing

#### Unit Tests ([__tests__/memory/memoryGraph.test.ts](__tests__/memory/memoryGraph.test.ts))

**Test Suites:**
1. Cosine Similarity
2. Node Operations
3. Edge Operations
4. Edge ID Generation
5. Temporal Decay
6. Feedback Weight Calculation
7. Semantic Threshold Filtering
8. Max Neighbors Constraint

**Run Tests:**
```bash
npm test __tests__/memory/
```

#### Benchmark Script ([scripts/benchmark-memory-graph.ts](scripts/benchmark-memory-graph.ts))

**What it tests:**
1. Graph build performance
2. Query latencies (P50/P95/P99)
3. Stats fetching
4. Target validation (P95 ≤ 500ms)

**Run Benchmark:**
```bash
export TEST_WORKSPACE_ID=your_workspace_id
pnpm tsx scripts/benchmark-memory-graph.ts
```

---

## Configuration

### Default Settings

```typescript
export const DEFAULT_GRAPH_OPTS: BuildGraphOptions = {
  semantic: {
    threshold: 0.85,      // Only keep edges with cosine ≥ 0.85
    maxNeighbors: 12      // Cap neighbors per node
  },
  temporal: {
    halfLifeDays: 21      // Decay to 0.5 after 21 days
  },
  feedback: {
    minWeight: 0.2        // Only keep edges with weight ≥ 0.2
  },
  ttlDays: 90            // Auto-delete edges after 90 days
};
```

### Tuning Guidelines

**High Precision (Strict):**
```typescript
{
  semantic: { threshold: 0.90, maxNeighbors: 8 },
  temporal: { halfLifeDays: 14 },
  feedback: { minWeight: 0.3 }
}
```

**High Recall (Loose):**
```typescript
{
  semantic: { threshold: 0.75, maxNeighbors: 20 },
  temporal: { halfLifeDays: 30 },
  feedback: { minWeight: 0.1 }
}
```

---

## Usage Examples

### Example 1: Build Graph for Workspace

```typescript
import { buildEdgesForWorkspace } from '@/lib/memory/linkBuilder';

const result = await buildEdgesForWorkspace('workspace_123', {
  semantic: { threshold: 0.85, maxNeighbors: 12 },
  temporal: { halfLifeDays: 21 },
  feedback: { minWeight: 0.2 },
  ttlDays: 90
});

console.log(result);
// {
//   semantic: 2100,
//   temporal: 850,
//   feedback: 290,
//   totalNodes: 450,
//   totalEdges: 3240,
//   durationMs: 12450
// }
```

### Example 2: Query Related Nodes

```typescript
import { queryRelatedNodes } from '@/lib/memory/linkBuilder';

const results = await queryRelatedNodes({
  workspaceId: 'workspace_123',
  queryText: 'how to deploy firebase functions',
  threshold: 0.75,
  topK: 10
});

console.log(results);
// [
//   { nodeId: 'snippet_1', score: 0.92, reason: 'semantic', text: '...' },
//   { nodeId: 'snippet_2', score: 0.88, reason: 'semantic', text: '...' },
//   ...
// ]
```

### Example 3: Incremental Update

```typescript
import { buildEdgesForNewSnippets } from '@/lib/memory/linkBuilder';

// After adding new snippets
const newSnippetIds = ['snippet_100', 'snippet_101', 'snippet_102'];

const result = await buildEdgesForNewSnippets(
  'workspace_123',
  newSnippetIds,
  { semanticThreshold: 0.85, maxNeighbors: 12, ttlDays: 90 }
);

console.log(`Inserted ${result.inserted} edges`);
```

### Example 4: Find Shortest Path

```typescript
import { findShortestPath } from '@/lib/memory/linkBuilder';

const path = await findShortestPath(
  'workspace_123',
  'snippet_A',
  'snippet_B',
  5 // maxDepth
);

if (path) {
  console.log(`Path: ${path.path.join(' → ')}`);
  console.log(`Length: ${path.length} hops`);
} else {
  console.log('No path found');
}
```

### Example 5: Integration with Phase 58 RAG

```typescript
import { queryRelatedNodes } from '@/lib/memory/linkBuilder';
import { recall } from '@/lib/rag/recallEngine';

// Augment RAG with graph-aware retrieval
async function enhancedRecall(query: string, workspaceId: string) {
  // Step 1: Standard RAG retrieval
  const ragResults = await recall(query, { workspaceId, topK: 8 });

  // Step 2: Graph-based expansion
  const graphResults = await queryRelatedNodes({
    workspaceId,
    queryText: query,
    threshold: 0.70,
    topK: 4
  });

  // Step 3: Merge and deduplicate
  const merged = [...ragResults.items];
  for (const graphItem of graphResults) {
    if (!merged.find(r => r.id === graphItem.nodeId)) {
      merged.push({
        id: graphItem.nodeId,
        source: 'memory',
        text: graphItem.text || '',
        score: graphItem.score,
        meta: { reason: graphItem.reason }
      });
    }
  }

  return merged.slice(0, 12);
}
```

---

## Performance

### Target Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Graph Build | < 30s per 1000 nodes | Full rebuild |
| Query P95 Latency | ≤ 500ms | Including embedding generation |
| Query P99 Latency | ≤ 1000ms | Cold start included |
| Edge Creation Rate | > 100 edges/sec | Batch operations |
| Memory Usage | < 1GiB | For 5000 nodes |

### Optimization Tips

1. **Use Incremental Updates:**
   - Full rebuild only weekly
   - Incremental for new snippets daily

2. **Tune Thresholds:**
   - Higher threshold → fewer edges → faster queries
   - Lower threshold → more recall → slower queries

3. **Cache Query Results:**
   - Cache frequently queried patterns
   - Use Phase 57.2 embedding cache

4. **Batch Operations:**
   - Firestore batch limit: 500 operations
   - Code already handles batching

5. **Monitor Edge Count:**
   - Target: 5-10 edges per node average
   - If too high, increase thresholds

---

## Collections

### `ops_memory_edges`
Graph edges collection.

**Schema:**
```typescript
{
  id: string,                    // ${from}_${to}_${relation}
  workspaceId: string,           // Isolation key
  from: string,                  // Source node ID
  to: string,                    // Target node ID
  relation: 'semantic' | 'temporal' | 'feedback',
  weight: number,                // [0..1]
  meta: {                        // Optional metadata
    similarity?: number,         // For semantic
    ageDays?: number,            // For temporal
    sumReward?: number           // For feedback
  },
  createdAt: string,             // ISO timestamp
  updatedAt: string,             // ISO timestamp
  expire_at?: Timestamp          // TTL field
}
```

### `ops_memory_graph_jobs`
Job tracking for rebuilds.

**Schema:**
```typescript
{
  workspaceId: string,
  type: 'weekly_rebuild' | 'manual_rebuild',
  status: 'success' | 'error',
  result?: GraphBuildResult,
  error?: string,
  timestamp: Timestamp,
  durationMs?: number,
  requestedBy?: string           // uid for manual rebuilds
}
```

### `ops_memory_graph_stats`
Cached statistics.

**Schema:**
```typescript
{
  workspaceId: string,
  nodeCount: number,
  edgeCount: number,
  edgesByType: {
    semantic: number,
    temporal: number,
    feedback: number
  },
  avgDegree: number,
  timestamp: string
}
```

---

## Deployment

### Step 1: Deploy Firestore Config

```bash
# Deploy indexes
firebase deploy --only firestore:indexes

# Deploy rules
firebase deploy --only firestore:rules
```

### Step 2: Enable TTL Policy

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Firestore → Indexes → TTL Policies
3. Create TTL Policy:
   - Collection group: `ops_memory_edges`
   - TTL field: `expire_at`
4. Wait for status "Serving"

### Step 3: Deploy Functions

```bash
# Build functions
cd functions && pnpm run build && cd ..

# Deploy new functions
firebase deploy --only functions:weeklyRebuildMemoryGraphs,functions:rebuildMemoryGraph,functions:getMemoryGraphStats,functions:deleteMemoryGraph
```

### Step 4: Deploy Next.js

```bash
# Build Next.js
pnpm run build

# Deploy hosting
firebase deploy --only hosting
```

---

## Testing After Deployment

### 1. Test API Endpoint

```bash
curl -X POST https://your-domain.com/api/memory/query \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "test_ws",
    "queryText": "firebase deployment",
    "topK": 10
  }'
```

### 2. Test Cloud Function

```bash
# Manual rebuild
firebase functions:call rebuildMemoryGraph --data='{"workspaceId":"test_ws"}'

# Get stats
firebase functions:call getMemoryGraphStats --data='{"workspaceId":"test_ws"}'
```

### 3. Run Benchmark

```bash
export TEST_WORKSPACE_ID=test_ws
pnpm tsx scripts/benchmark-memory-graph.ts
```

---

## Integration with Other Phases

### Phase 57.2: Snippet Cache
- Reuses `getManyOrEmbed()` for embedding generation
- Avoids redundant OpenAI API calls
- Leverages existing cache collection

### Phase 58: Adaptive RAG
- Graph-aware retrieval augments RAG results
- Semantic routing can use graph structure
- Hybrid queries combine RAG + graph traversal

### Phase 53: Collaborative Editing
- Temporal edges track co-editing patterns
- Session-based co-usage detection
- Real-time graph updates

---

## Troubleshooting

### Issue: Graph Build Timeout

**Symptoms:** Function timeout during rebuild
**Solution:**
- Increase timeout in function config
- Process workspaces in smaller batches
- Run incrementally instead of full rebuild

### Issue: Too Many Edges

**Symptoms:** Edge count > 10x node count
**Solution:**
- Increase `semantic.threshold` (try 0.90)
- Decrease `semantic.maxNeighbors` (try 8)
- Increase `feedback.minWeight` (try 0.3)

### Issue: Query Latency High

**Symptoms:** P95 > 1000ms
**Solution:**
- Check if embeddings are cached
- Reduce `topK` parameter
- Add composite indexes
- Use cached query results

### Issue: TTL Not Working

**Symptoms:** Old edges not being deleted
**Solution:**
- Verify TTL policy status is "Serving"
- Check `expire_at` field exists and is Timestamp type
- Wait 24 hours for TTL cleanup to run

---

## Monitoring

### Key Metrics to Track

1. **Graph Size:**
   - Node count per workspace
   - Edge count per workspace
   - Average degree

2. **Performance:**
   - Graph build duration
   - Query P50/P95/P99 latencies
   - API error rates

3. **Quality:**
   - Edge weight distribution
   - Temporal decay curve
   - Feedback signal coverage

### Recommended Dashboards

```typescript
// Firestore query for monitoring
const recentJobs = await db
  .collection('ops_memory_graph_jobs')
  .where('timestamp', '>', last24Hours)
  .orderBy('timestamp', 'desc')
  .limit(100)
  .get();

// Check for errors
const errors = recentJobs.docs.filter(d => d.get('status') === 'error');
console.log(`Error rate: ${(errors.length / recentJobs.size * 100).toFixed(1)}%`);

// Average build time
const successJobs = recentJobs.docs.filter(d => d.get('status') === 'success');
const avgDuration = successJobs.reduce((sum, d) => sum + (d.get('durationMs') || 0), 0) / successJobs.length;
console.log(`Avg build time: ${(avgDuration / 1000).toFixed(1)}s`);
```

---

## Future Enhancements

### Phase 59.1: Advanced Graph Algorithms
- PageRank for node importance
- Community detection
- Centrality metrics

### Phase 59.2: Multi-Hop Reasoning
- Path-based retrieval
- Subgraph extraction
- Contextual expansion

### Phase 59.3: Graph Visualization
- Interactive graph explorer
- Edge weight heatmaps
- Temporal animation

---

## Summary

Phase 59 implements a production-ready Cognitive Memory Mesh with:

- ✅ 3 TypeScript modules (types, memoryGraph, linkBuilder)
- ✅ 4 Cloud Functions (scheduled + manual + stats + delete)
- ✅ 3 API endpoints (query + stats + rebuild)
- ✅ Firestore indexes + security rules with TTL
- ✅ Unit tests + benchmark suite
- ✅ Complete documentation

**Status:** Ready for deployment and integration with Phase 58 RAG.

**Next Steps:**
1. Deploy Firestore config
2. Enable TTL policy
3. Deploy functions
4. Test endpoints
5. Run benchmarks
6. Integrate with Phase 58

---

**Documentation Version:** 1.0
**Last Updated:** 2025-11-06
