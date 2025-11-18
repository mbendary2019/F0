# Phase 57: Quick Start Guide

**Memory Feedback & Reinforcement Learning**

## Installation (Already Complete)

All code is implemented. No additional dependencies needed (uses existing `openai` and `firebase-admin`).

## Files Created

```
src/lib/ai/feedback/
├── feedbackSchema.ts          (~260 lines) - Types and constants
├── computeRewards.ts          (~280 lines) - Reward computation
├── recordFeedback.ts          (~330 lines) - Feedback recording
├── updateClusterWeights.ts    (~340 lines) - Weight updates with EMA
├── rankScore.ts               (~390 lines) - Blended ranking
└── index.ts                   - Public API exports

src/app/api/ops/memory/feedback/
└── route.ts                   (~230 lines) - REST API endpoint

src/lib/ai/context/
└── promptContextBuilder.ts    (modified) - Integrated ranking

firestore.indexes.phase57.json - Composite indexes
firestore.rules.phase57        - Security rules
PHASE_57_FEEDBACK_SYSTEM.md    - Complete documentation
```

## Deploy Indexes & Rules

```bash
# 1. Deploy Firestore indexes
firebase deploy --only firestore:indexes --project from-zero-84253

# 2. Deploy security rules
cp firestore.rules.phase57 firestore.rules
firebase deploy --only firestore:rules --project from-zero-84253
```

## Test the API

### 1. Submit Thumbs Up Feedback

```bash
# Get ID token first
ID_TOKEN="your-firebase-id-token"

curl -X POST http://localhost:3030/api/ops/memory/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{
    "clusterId": "cl_test123",
    "feedback": { "thumb": "up" },
    "autoUpdateWeight": true
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "feedbackId": "fb_1234567890_abc",
  "reward": 1.0,
  "confidence": 1.0,
  "weightUpdated": true,
  "newWeight": 0.1
}
```

### 2. Submit Star Rating

```bash
curl -X POST http://localhost:3030/api/ops/memory/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{
    "clusterId": "cl_test123",
    "feedback": { "stars": 4 },
    "metadata": { "query": "How do I deploy?" }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "feedbackId": "fb_1234567890_xyz",
  "reward": 0.5,
  "confidence": 0.5
}
```

## Use in Code

### Record Feedback Programmatically

```typescript
import { recordFeedback } from '@/lib/ai/feedback';

async function handleUserFeedback(userId: string, clusterId: string, liked: boolean) {
  const result = await recordFeedback({
    userId,
    clusterId,
    feedback: { thumb: liked ? 'up' : 'down' }
  });

  if (result.success) {
    console.log(`Feedback recorded: ${result.feedbackId}`);
    console.log(`Reward: ${result.reward}, Confidence: ${result.confidence}`);
  }
}
```

### Use Feedback-Enhanced Context Retrieval

```typescript
import { buildPromptForTurn } from '@/lib/ai/context/promptContextBuilder';

async function getContextForQuery(userId: string, query: string) {
  const { messages, contextTokens, includedBlocks } = await buildPromptForTurn({
    userId,
    query,
    topK: 3,
    useFeedbackRanking: true,  // Enable feedback ranking (default)
    rankingParams: {
      blendSimilarity: 0.5,  // 50% semantic similarity
      blendWeight: 0.3,      // 30% learned weight from feedback
      blendRecency: 0.2      // 20% recency
    }
  });

  console.log(`Using ${includedBlocks.length} context blocks (${contextTokens} tokens)`);
  return messages;
}
```

### Update Cluster Weights (Batch)

```typescript
import { updateAllClusterWeights } from '@/lib/ai/feedback';

async function runNightlyWeightUpdate() {
  const result = await updateAllClusterWeights({
    minFeedbackCount: 2,  // Only clusters with 2+ feedback
    batchSize: 500
  }, {
    alpha: 0.1,           // Conservative learning rate
    decayHalfLifeDays: 21 // 3 weeks half-life
  });

  console.log(`Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
}
```

## Verify in Firestore

```bash
# Check feedback events
firebase firestore:get ops_memory_feedback --project from-zero-84253

# Check cluster with weight
firebase firestore:get ops_memory_clusters/cl_test123 --project from-zero-84253
```

**Expected Cluster Document**:
```json
{
  "cluster_id": "cl_test123",
  "user_id": "user123",
  "title": "Deployment Guide",
  "summary": "How to deploy the application...",
  "tags": ["deployment", "production", "firebase"],
  "weight": 0.15,
  "feedback": {
    "count": 5,
    "sumReward": 3.5,
    "meanReward": 0.7,
    "stdReward": 0.3,
    "last_feedback_at": "2025-11-06T12:00:00Z"
  }
}
```

## Integration Checklist

- [x] Core library files created
- [x] API endpoint implemented
- [x] Context builder integrated
- [x] Firestore indexes defined
- [x] Security rules created
- [x] Documentation complete
- [ ] Deploy indexes to Firebase
- [ ] Deploy security rules to Firebase
- [ ] Test API with real Firebase Auth tokens
- [ ] Set up scheduled weight updates (optional)

## Next Steps

1. **Deploy to Firebase**:
   ```bash
   firebase deploy --only firestore:indexes,firestore:rules
   ```

2. **Test with Real Data**:
   - Create test clusters using Phase 56 clustering
   - Submit feedback via API
   - Verify weights update correctly

3. **Implement UI** (Phase 56 Day 7):
   - Add feedback buttons to cluster cards
   - Show weight badges
   - Display feedback statistics

4. **Set Up Monitoring**:
   - Track feedback volume
   - Monitor weight distribution
   - Measure ranking impact (NDCG, CTR)

5. **Optional: Scheduled Job**:
   - Deploy nightly Cloud Function for batch weight updates
   - See `PHASE_57_FEEDBACK_SYSTEM.md` for implementation

## Troubleshooting

### API returns 401 Unauthorized

**Solution**: Use a valid Firebase ID token in Authorization header
```typescript
const idToken = await auth.currentUser.getIdToken();
```

### Weights not updating

**Solution**: Check feedback stats in cluster document
```bash
firebase firestore:get ops_memory_clusters/YOUR_CLUSTER_ID
```

If `feedback` field is missing, feedback event may not have been recorded.

### Ranking not changing

**Solution**: Verify `useFeedbackRanking: true` and check cluster weights
```typescript
import { getWeightedClusters } from '@/lib/ai/feedback';

const clusters = await getWeightedClusters(userId, { orderBy: 'weight' });
console.log(clusters.map(c => ({ id: c.cluster_id, weight: c.weight })));
```

## Support

- Full Documentation: [PHASE_57_FEEDBACK_SYSTEM.md](./PHASE_57_FEEDBACK_SYSTEM.md)
- Code Examples: See inline JSDoc comments in all feedback files
- API Reference: [src/app/api/ops/memory/feedback/route.ts](./src/app/api/ops/memory/feedback/route.ts)
