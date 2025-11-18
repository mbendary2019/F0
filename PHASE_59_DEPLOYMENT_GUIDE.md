# Phase 59: Cognitive Memory Mesh - Deployment Guide

**Status:** Production Ready
**Date:** 2025-11-06

---

## Pre-Deployment Checklist

- [x] Phase 57.2 deployed (snippet cache with embeddings)
- [x] Firebase project configured
- [x] Node.js 18+ installed
- [x] Firebase CLI installed (`npm i -g firebase-tools`)
- [x] Authenticated (`firebase login`)

---

## Deployment Steps

### Step 1: Build Next.js

```bash
cd /Users/abdo/Downloads/from-zero-starter

# Build Next.js
pnpm run build
```

**Expected Output:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
```

**Troubleshooting:**
- If build fails, check for TypeScript errors
- Ensure all imports are correct
- Verify `src/lib/firebase-admin.ts` exports `db`

---

### Step 2: Build Cloud Functions

```bash
cd functions

# Build functions
pnpm run build
```

**Expected Output:**
```
> build
> tsc

✓ Compiled successfully
```

**Troubleshooting:**
- Check `functions/src/memory/rebuildGraph.ts` imports
- Verify `tsconfig.json` includes `src/` directory paths
- Ensure Firebase Admin imports work

---

### Step 3: Deploy Firestore Indexes

```bash
cd .. # Back to project root

# Deploy indexes
firebase deploy --only firestore:indexes
```

**What This Does:**
- Creates composite indexes for `ops_memory_edges` queries
- Creates index for `ops_memory_snippet_feedback` queries
- Enables TTL field override for `expire_at`

**Expected Output:**
```
=== Deploying to 'from-zero-84253'...

i  firestore: reading indexes from firestore.indexes.phase59.json...
✔  firestore: deployed indexes in firestore.indexes.phase59.json successfully
```

**Verify:**
```bash
# Check index status
firebase firestore:indexes
```

All indexes should show status: `READY` (may take 5-10 minutes)

---

### Step 4: Deploy Firestore Rules

```bash
# Deploy rules
firebase deploy --only firestore:rules
```

**What This Does:**
- Applies workspace-based access control
- Protects `ops_memory_edges` collection
- Allows admin-only writes to stats/jobs

**Expected Output:**
```
=== Deploying to 'from-zero-84253'...

i  firestore: checking firestore.rules.phase59 for compilation errors...
✔  firestore: rules file firestore.rules.phase59 compiled successfully
✔  firestore: released rules firestore.rules.phase59 to cloud.firestore
```

---

### Step 5: Enable TTL Policy (Manual)

**⚠️ CRITICAL STEP - Must be done in Firebase Console**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: `from-zero-84253`
3. Navigate: **Firestore Database** → **Indexes** → **TTL Policies**
4. Click **"Create TTL Policy"**
5. Configure:
   - **Collection group:** `ops_memory_edges`
   - **TTL field:** `expire_at`
6. Click **"Create"**
7. Wait for status to change from "Building" → **"Serving"** (5-10 minutes)

**Why This is Required:**
- TTL policies auto-delete expired edges
- Without this, edges accumulate indefinitely
- Cannot be configured via CLI (must use Console)

**Verify:**
```bash
# After 10 minutes, check status in Console
# Status should show: ✅ Serving
```

---

### Step 6: Deploy Cloud Functions

```bash
# Deploy Phase 59 functions
firebase deploy --only functions:weeklyRebuildMemoryGraphs,functions:rebuildMemoryGraph,functions:getMemoryGraphStats,functions:deleteMemoryGraph
```

**What This Deploys:**
- `weeklyRebuildMemoryGraphs` - Scheduled (Sundays 03:00 UTC)
- `rebuildMemoryGraph` - Callable (manual rebuild, admin only)
- `getMemoryGraphStats` - Callable (fetch stats)
- `deleteMemoryGraph` - Callable (delete graph, admin only)

**Expected Output:**
```
=== Deploying to 'from-zero-84253'...

i  functions: preparing codebase for deployment...
✔  functions: functions folder uploaded successfully

The following functions will be deployed:
  weeklyRebuildMemoryGraphs (schedule)
  rebuildMemoryGraph (callable)
  getMemoryGraphStats (callable)
  deleteMemoryGraph (callable)

✔  functions[weeklyRebuildMemoryGraphs] Successful create operation.
✔  functions[rebuildMemoryGraph] Successful create operation.
✔  functions[getMemoryGraphStats] Successful create operation.
✔  functions[deleteMemoryGraph] Successful create operation.

✔  Deploy complete!
```

**Verify:**
```bash
# List functions
firebase functions:list

# Check logs
firebase functions:log --only weeklyRebuildMemoryGraphs --lines 5
```

---

### Step 7: Deploy Next.js Hosting

```bash
# Deploy hosting
firebase deploy --only hosting
```

**What This Deploys:**
- `/api/memory/query` - Query endpoint
- `/api/memory/stats` - Stats endpoint
- `/api/memory/rebuild` - Rebuild endpoint
- All Next.js pages

**Expected Output:**
```
=== Deploying to 'from-zero-84253'...

i  hosting[from-zero-84253]: beginning deploy...
i  hosting[from-zero-84253]: found 152 files in .next
✔  hosting[from-zero-84253]: file upload complete

✔  hosting[from-zero-84253]: release complete

✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/from-zero-84253/overview
Hosting URL: https://from-zero-84253.web.app
```

---

## Post-Deployment Testing

### Test 1: API Health Check

```bash
# Test query endpoint (GET for docs)
curl https://from-zero-84253.web.app/api/memory/query
```

**Expected Response:**
```json
{
  "endpoint": "/api/memory/query",
  "method": "POST",
  "description": "Query memory graph for related nodes",
  "parameters": { ... }
}
```

### Test 2: Query API

```bash
# Test actual query
curl -X POST https://from-zero-84253.web.app/api/memory/query \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "test_workspace",
    "queryText": "how to deploy firebase functions",
    "topK": 5
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "results": [
    {
      "nodeId": "snippet_xyz",
      "score": 0.89,
      "reason": "semantic",
      "text": "Deploy functions using firebase deploy..."
    }
  ],
  "count": 5,
  "method": "embedding"
}
```

**Troubleshooting:**
- If error 500: Check function logs (`firebase functions:log`)
- If empty results: Workspace may not have data yet
- If timeout: Check function memory/timeout settings

### Test 3: Stats API

```bash
# Test stats endpoint
curl "https://from-zero-84253.web.app/api/memory/stats?workspaceId=test_workspace"
```

**Expected Response:**
```json
{
  "success": true,
  "workspaceId": "test_workspace",
  "stats": {
    "nodeCount": 0,
    "edgeCount": 0,
    "edgesByType": { "semantic": 0, "temporal": 0, "feedback": 0 },
    "avgDegree": 0,
    "timestamp": "2025-11-06T..."
  }
}
```

### Test 4: Manual Graph Rebuild

```bash
# Trigger rebuild for test workspace
firebase functions:call rebuildMemoryGraph --data='{
  "workspaceId": "test_workspace"
}'
```

**Expected Response:**
```json
{
  "success": true,
  "workspaceId": "test_workspace",
  "result": {
    "semantic": 150,
    "temporal": 45,
    "feedback": 12,
    "totalNodes": 50,
    "totalEdges": 207,
    "durationMs": 3420
  }
}
```

**Troubleshooting:**
- If "unauthenticated": Need admin token
- If timeout: Reduce workspace size or increase timeout
- If "permission-denied": User needs admin role

### Test 5: Get Stats Function

```bash
# Get stats via function
firebase functions:call getMemoryGraphStats --data='{
  "workspaceId": "test_workspace"
}'
```

### Test 6: Run Benchmark

```bash
# Set workspace ID
export TEST_WORKSPACE_ID=test_workspace

# Run benchmark
pnpm tsx scripts/benchmark-memory-graph.ts
```

**Expected Output:**
```
=== Phase 59: Memory Graph Benchmark ===

📊 Step 1: Building memory graph...
✅ Graph built in 3420ms
   Build result: { semantic: 150, temporal: 45, feedback: 12 }

📈 Step 2: Fetching graph statistics...
✅ Stats fetched

🔍 Step 3: Benchmarking queries...
   Query: "how to deploy functions to firebase"
   Latency: 245ms | Results: 10
   ...

📊 Performance Summary:
   Mean latency:   287ms
   P50 latency:    265ms
   P95 latency:    412ms
   P99 latency:    412ms

🎯 Target Validation:
   ✅ P95 latency (412ms) ≤ 500ms

=== Benchmark Complete ===
```

---

## Monitoring Setup

### Check Function Logs

```bash
# Live monitoring
firebase functions:log --follow

# Specific function
firebase functions:log --only weeklyRebuildMemoryGraphs

# Last 50 lines
firebase functions:log --lines 50
```

### Monitor Graph Jobs

```typescript
import { db } from '@/lib/firebase-admin';

// Check recent jobs
const jobs = await db
  .collection('ops_memory_graph_jobs')
  .orderBy('timestamp', 'desc')
  .limit(20)
  .get();

jobs.forEach(doc => {
  const data = doc.data();
  console.log(`${data.workspaceId}: ${data.status} | ${data.type} | ${data.durationMs}ms`);
});
```

### Monitor Edge Count

```bash
# Via stats API
curl "https://from-zero-84253.web.app/api/memory/stats?workspaceId=your_workspace"
```

---

## Rollback Procedure

### If Issues Occur

**Option 1: Rollback Functions**
```bash
# List previous versions
firebase functions:list

# Rollback to previous version
firebase functions:rollback weeklyRebuildMemoryGraphs
firebase functions:rollback rebuildMemoryGraph
```

**Option 2: Rollback Firestore Rules**
```bash
# Deploy previous rules file
firebase deploy --only firestore:rules --config firestore.rules.phase58
```

**Option 3: Disable Scheduled Function**
```bash
# Temporarily disable weekly rebuild
firebase functions:config:set scheduler.enabled=false
firebase deploy --only functions:weeklyRebuildMemoryGraphs
```

**Option 4: Delete All Edges**
```bash
# Clear graph data for workspace
firebase functions:call deleteMemoryGraph --data='{"workspaceId":"problem_workspace"}'
```

---

## Performance Tuning

### If Graph Build is Slow

**Increase Function Resources:**
```typescript
// In functions/src/memory/rebuildGraph.ts
export const weeklyRebuildMemoryGraphs = onSchedule({
  memory: '2GiB',        // Increase from 1GiB
  timeoutSeconds: 900,   // Increase from 540
  ...
});
```

### If Queries are Slow

**Optimize Query Parameters:**
```typescript
// Stricter thresholds = fewer edges = faster queries
const results = await queryRelatedNodes({
  workspaceId,
  queryText,
  threshold: 0.85,  // Increase from 0.75
  topK: 8           // Decrease from 12
});
```

**Add More Indexes:**
```json
// In firestore.indexes.phase59.json
{
  "collectionGroup": "ops_memory_edges",
  "fields": [
    { "fieldPath": "workspaceId", "order": "ASCENDING" },
    { "fieldPath": "to", "order": "ASCENDING" },
    { "fieldPath": "weight", "order": "DESCENDING" }
  ]
}
```

### If Too Many Edges

**Tune Graph Config:**
```typescript
await buildEdgesForWorkspace(workspaceId, {
  semantic: {
    threshold: 0.90,      // Increase from 0.85
    maxNeighbors: 8       // Decrease from 12
  },
  temporal: {
    halfLifeDays: 14      // Decrease from 21
  },
  feedback: {
    minWeight: 0.3        // Increase from 0.2
  }
});
```

---

## Security Hardening

### Enable App Check (Recommended)

```typescript
// In src/app/api/memory/query/route.ts
import { verifyAppCheck } from '@/lib/appCheck';

export async function POST(req: NextRequest) {
  // Verify App Check token
  const appCheckToken = req.headers.get('X-Firebase-AppCheck');
  if (!appCheckToken || !(await verifyAppCheck(appCheckToken))) {
    return NextResponse.json({ error: 'Invalid App Check token' }, { status: 401 });
  }

  // Continue with request...
}
```

### Add Rate Limiting

```typescript
// In src/app/api/memory/query/route.ts
import { rateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  // Rate limit: 100 requests per minute per IP
  if (!(await rateLimit(req, 100, 60))) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Continue with request...
}
```

---

## Maintenance

### Weekly Tasks

1. ✅ Check scheduled rebuild logs
2. ✅ Monitor error rates
3. ✅ Review edge count growth
4. ✅ Check TTL cleanup is working

### Monthly Tasks

1. ✅ Review performance metrics
2. ✅ Tune graph config if needed
3. ✅ Update documentation
4. ✅ Check for new Firebase features

### Quarterly Tasks

1. ✅ Audit security rules
2. ✅ Review index usage
3. ✅ Optimize function costs
4. ✅ Update dependencies

---

## Cost Optimization

### Firestore Reads
- Graph queries cost 1 read per edge checked
- Use caching to reduce repeated queries
- Target: < 1M reads/day per workspace

### Cloud Functions
- Weekly rebuild: ~30s per 1000 nodes
- Daily cost estimate: $0.10 per workspace
- Use incremental updates to reduce costs

### Storage
- Each edge: ~500 bytes
- 1M edges ≈ 500 MB
- TTL automatically cleans up old data

---

## Success Criteria

### Deployment Success
- [x] All functions deployed
- [x] All indexes created and READY
- [x] TTL policy enabled and SERVING
- [x] API endpoints responding
- [x] No errors in logs

### Performance Success
- [ ] P95 query latency ≤ 500ms
- [ ] Graph build < 30s per 1000 nodes
- [ ] Error rate < 1%
- [ ] Weekly rebuild completes successfully

### Quality Success
- [ ] Average degree: 5-10 edges per node
- [ ] Edge weight distribution: 70% semantic, 20% temporal, 10% feedback
- [ ] No orphaned nodes
- [ ] TTL cleanup running daily

---

## Next Steps

1. ✅ Deploy to production
2. ⬜ Monitor for 7 days
3. ⬜ Tune configuration based on metrics
4. ⬜ Integrate with Phase 58 RAG
5. ⬜ Roll out to all workspaces
6. ⬜ Document best practices
7. ⬜ Train team on usage

---

## Support

### Documentation
- [Complete Guide](./PHASE_59_COMPLETE.md)
- [Quick Start](./PHASE_59_QUICK_START.md)
- [API Reference](./PHASE_59_API_REFERENCE.md)

### Troubleshooting
- Check function logs: `firebase functions:log`
- Check Firestore indexes: `firebase firestore:indexes`
- Check TTL status: Firebase Console → Firestore → Indexes → TTL Policies

### Contact
- GitHub Issues: https://github.com/your-repo/issues
- Slack: #phase-59-support

---

**Deployment Complete!** 🚀

Review checklist above and proceed to monitoring phase.
