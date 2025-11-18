# Phase 58 - Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup

Ensure you have the following environment variables:

```bash
# .env.local
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

### 2. Dependencies

All required dependencies should already be installed. Verify:

```bash
pnpm install
```

Key dependencies:
- `firebase-admin` (for server-side Firestore)
- `firebase` (for client-side Firestore)
- `openai` (for embeddings)

---

## Deployment Steps

### Step 1: Deploy Firestore Indexes

```bash
# Deploy the Phase 58 indexes
firebase deploy --only firestore:indexes

# This will create indexes for:
# - ops_rag_cache (workspaceId + created_at)
# - ops_rag_cache (workspaceId + expire_at)
# - ops_rag_queries (workspaceId + timestamp)
# - ops_rag_queries (workspaceId + strategy + timestamp)
```

**Wait time:** 5-15 minutes for indexes to build.

Monitor progress:
```bash
firebase firestore:indexes
```

### Step 2: Enable TTL Policy

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Navigate to **Firestore Database** → **Indexes** tab
3. Click **TTL Policies**
4. Click **Create TTL Policy**
5. Configure:
   - **Collection:** `ops_rag_cache`
   - **Timestamp field:** `expire_at`
6. Click **Create**

This automatically deletes expired cache entries.

### Step 3: Deploy Firestore Rules

Option A - Merge with existing rules:

```bash
# Copy the rules from firestore.rules.phase58
# Merge them into your firestore.rules file
# Then deploy:
firebase deploy --only firestore:rules
```

Option B - Deploy standalone (testing only):

```bash
# Use the phase 58 rules directly
cp firestore.rules.phase58 firestore.rules
firebase deploy --only firestore:rules
```

### Step 4: Deploy Application

```bash
# Build the application
pnpm build

# Deploy to your hosting platform
# For Firebase Hosting:
firebase deploy --only hosting

# For Vercel:
vercel --prod

# For other platforms, follow their deployment guides
```

### Step 5: Verify Deployment

```bash
# Test the API endpoint
curl -X POST https://your-domain.com/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "q": "test query",
    "workspaceId": "test_workspace",
    "topK": 5
  }'

# Expected response:
# {
#   "items": [...],
#   "diagnostics": {
#     "strategy": "dense",
#     "tookMs": 250,
#     "cacheHit": false,
#     ...
#   }
# }
```

---

## Post-Deployment

### 1. Run Benchmark

```bash
# Set your production workspace ID
export TEST_WORKSPACE_ID=your_prod_workspace_id

# Run benchmark
pnpm tsx scripts/benchmark-rag.ts

# Check results:
# - P95 should be ≤ 400ms
# - Cache hit rate should improve over time
```

### 2. Monitor Performance

Set up monitoring dashboard to track:

- **Latency metrics** (P50, P95, P99)
- **Strategy distribution** (dense/sparse/hybrid usage)
- **Cache hit rate**
- **Error rate**

Query examples:

```javascript
// Get recent performance metrics
const metrics = await db.collection('ops_rag_queries')
  .where('timestamp', '>', lastWeek)
  .orderBy('timestamp', 'desc')
  .get();

// Calculate P95
const latencies = metrics.docs.map(d => d.data().tookMs);
const sorted = latencies.sort((a, b) => a - b);
const p95Index = Math.ceil(sorted.length * 0.95) - 1;
const p95 = sorted[p95Index];
console.log(`P95 Latency: ${p95}ms`);
```

### 3. Set Up Alerts

Consider setting up alerts for:

- **High latency:** P95 > 500ms
- **Low cache hit rate:** < 20%
- **High error rate:** > 5%

Example Cloud Function for alerting:

```typescript
// functions/src/alerts/ragPerformance.ts
export const checkRAGPerformance = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const recentMetrics = await getRecentMetrics();
    const p95 = calculateP95(recentMetrics);

    if (p95 > 500) {
      await sendAlert({
        title: 'RAG P95 Latency High',
        message: `P95 latency is ${p95}ms (threshold: 500ms)`,
        severity: 'warning',
      });
    }
  });
```

---

## Troubleshooting

### Issue: Indexes not building

**Solution:**
1. Check Firebase Console for index status
2. Ensure no conflicting indexes exist
3. Try manual index creation from Console

### Issue: High latency (> 500ms)

**Possible causes:**
1. Cold start (first query after deployment)
2. Large embedding batch (>200 snippets)
3. Network latency to Firestore

**Solutions:**
1. Warm up the system with test queries
2. Reduce candidate pool size (adjust topK * 3 multiplier)
3. Enable Firestore caching
4. Consider adding a CDN

### Issue: No results returned

**Possible causes:**
1. Empty `ops_memory_snippets` collection
2. Workspace ID mismatch
3. Firestore rules blocking access

**Solutions:**
1. Verify data exists: `firebase firestore:get ops_memory_snippets --limit 1`
2. Check workspace ID in request matches data
3. Test with Firebase Auth token

### Issue: High costs

**Possible causes:**
1. Low cache hit rate (too many unique queries)
2. Frequent embedding generation
3. Large topK values

**Solutions:**
1. Increase cache TTL (default: 15 min)
2. Pre-compute embeddings for common queries
3. Reduce topK (default: 8)
4. Use sparse strategy more (no embeddings)

---

## Rollback Plan

If issues arise, rollback with:

```bash
# Rollback application
git revert <commit-hash>
pnpm build
firebase deploy --only hosting

# Rollback Firestore rules (if needed)
git checkout <previous-commit> firestore.rules
firebase deploy --only firestore:rules

# Note: Indexes cannot be rolled back easily
# They can be deleted manually from Console if needed
```

---

## Next Steps

1. **Integrate with your AI system:**
   - Update prompt builders to use `recall()`
   - Add context to LLM calls

2. **Monitor and optimize:**
   - Track P95 latency weekly
   - Adjust strategy weights based on usage
   - Fine-tune MMR lambda

3. **Extend functionality:**
   - Add document sources (PDFs, docs)
   - Add ops sources (logs, metrics)
   - Implement user-specific personalization

4. **Set up CI/CD:**
   - Run benchmarks on every deploy
   - Alert on performance regression
   - Auto-rollback on failures

---

## Support Contacts

- **Technical Issues:** Check [PHASE_58_COMPLETE.md](./PHASE_58_COMPLETE.md)
- **Performance Issues:** Run benchmark and check diagnostics
- **Integration Help:** See usage examples in documentation

**Deployment complete!** 🎉
