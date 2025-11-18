# Phase 57: Memory Feedback & Reinforcement Learning

**Status**: ✅ Implementation Complete
**Date**: 2025-11-06

## Overview

Phase 57 implements a complete feedback loop for the AI Memory System, allowing users to provide thumbs up/down or star ratings on memory clusters. This feedback is used to automatically weight clusters using **EMA (Exponential Moving Average)**, **Bayesian smoothing**, and **time decay**, improving context retrieval ranking over time.

## Architecture

### Data Flow

```
User Feedback → FeedbackEvent (immutable) → ClusterFeedbackStats (aggregate)
                                                    ↓
                                              Cluster Weight (EMA)
                                                    ↓
                                         Blended Ranking Score
                                         (similarity + weight + recency)
                                                    ↓
                                            Context Retrieval
```

### Key Components

1. **Feedback Recording** - Capture user feedback as immutable events
2. **Reward Computation** - Map thumbs/stars to reward values [-1, +1]
3. **Weight Updates** - Auto-weight clusters using EMA + Bayesian smoothing + time decay
4. **Ranking Integration** - Blend similarity, weight, and recency for retrieval
5. **API Endpoint** - REST API for feedback submission

## Files Created

### 1. Core Library Files

#### `src/lib/ai/feedback/feedbackSchema.ts` (~260 lines)
- Firestore schema and types
- Collections: `ops_memory_feedback`
- Types: `FeedbackEvent`, `ClusterFeedbackStats`, `WeightingParams`
- Default configuration and validation helpers

#### `src/lib/ai/feedback/computeRewards.ts` (~280 lines)
- Reward mapping functions
- Bayesian smoothing
- Time decay computation
- Recency scoring
- Aggregation utilities

#### `src/lib/ai/feedback/recordFeedback.ts` (~330 lines)
- Record feedback events (immutable)
- Update cluster aggregate statistics
- Query feedback history
- Batch operations
- Recomputation utilities

#### `src/lib/ai/feedback/updateClusterWeights.ts` (~340 lines)
- EMA-based weight updates
- Batch weight computation
- Preview and debugging utilities
- Query weighted clusters

#### `src/lib/ai/feedback/rankScore.ts` (~390 lines)
- Blended ranking formula: `score = α·similarity + β·weight + γ·recency`
- Ranking and sorting utilities
- Score decomposition and explanation
- A/B testing utilities
- Grid search optimization

#### `src/lib/ai/feedback/index.ts`
- Public API exports

### 2. API Route

#### `src/app/api/ops/memory/feedback/route.ts` (~230 lines)
- POST endpoint for feedback submission
- GET endpoint for feedback history (placeholder)
- Authentication via Firebase Auth
- Validation and error handling

### 3. Integration

#### `src/lib/ai/context/promptContextBuilder.ts` (modified)
- Integrated feedback-based ranking
- New params: `useFeedbackRanking`, `rankingParams`
- Automatic re-ranking with blended scores

## Firestore Schema

### Collection: `ops_memory_feedback`

**Document ID**: Auto-generated (`fb_<timestamp>_<random>`)

```typescript
{
  fb_id: string;              // "fb_1234567890_abc"
  user_id: string;            // User who gave feedback
  cluster_id: string;         // Target cluster
  turn_id?: string;           // Optional conversational turn
  stars?: number;             // 1..5 (if star rating)
  thumb?: "up" | "down";      // If thumbs feedback
  reward: number;             // Computed reward [-1, 1]
  confidence: number;         // Confidence [0, 1]
  created_at: Timestamp;      // Event timestamp
  metadata?: {
    session_id?: string;
    query?: string;
    context?: string;
  };
}
```

**Indexes Required**:
```json
{
  "collectionGroup": "ops_memory_feedback",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "user_id", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "ops_memory_feedback",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "cluster_id", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "DESCENDING" }
  ]
}
```

### Extended: `ops_memory_clusters` (existing collection)

**New Fields Added**:
```typescript
{
  // ... existing fields ...
  weight?: number;              // Computed weight [-1, 1]
  feedback?: {
    count: number;              // Total feedback events
    sumReward: number;          // Sum of rewards
    sumRewardSq: number;        // Sum of squared rewards
    meanReward: number;         // Mean reward
    stdReward: number;          // Standard deviation
    last_feedback_at: Timestamp;// Last feedback timestamp
  };
}
```

**Index Required** (for sorting by weight):
```json
{
  "collectionGroup": "ops_memory_clusters",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "user_id", "order": "ASCENDING" },
    { "fieldPath": "weight", "order": "DESCENDING" }
  ]
}
```

## Reward Model

### Thumbs Up/Down
- **Thumbs Up**: reward = +1.0, confidence = 1.0
- **Thumbs Down**: reward = -1.0, confidence = 1.0

### Star Ratings (1-5)
Linear mapping with graduated confidence:

| Stars | Reward | Confidence |
|-------|--------|------------|
| 1     | -1.0   | 1.0        |
| 2     | -0.5   | 0.5        |
| 3     | 0.0    | 0.0        |
| 4     | +0.5   | 0.5        |
| 5     | +1.0   | 1.0        |

**Formula**:
- Reward: `(stars - 3) / 2`
- Confidence: `|stars - 3| / 2`

## Weight Computation

### Algorithm: EMA + Bayesian Smoothing + Time Decay

```typescript
// 1. Apply Bayesian smoothing to mean reward
smoothedReward = (priorK × priorMean + count × meanReward) / (priorK + count)

// 2. Apply time decay
decayedReward = smoothedReward × 0.5^(ageDays / halfLifeDays)

// 3. Update weight using EMA
newWeight = (1 - α) × prevWeight + α × decayedReward

// 4. Clamp to [-1, 1]
weight = clamp(newWeight, -1, 1)
```

### Default Parameters

```typescript
{
  alpha: 0.1,                  // EMA learning rate
  priorMean: 0.0,              // Neutral prior
  priorK: 5.0,                 // Prior pseudo-count strength
  decayHalfLifeDays: 21,       // 3 weeks half-life
  blendSimilarity: 0.5,        // 50% similarity
  blendWeight: 0.3,            // 30% learned weight
  blendRecency: 0.2            // 20% recency
}
```

## Ranking Formula

### Blended Score

```typescript
score = α × similarity + β × weight + γ × recency
```

Where:
- **α + β + γ = 1** (blend coefficients must sum to 1)
- **similarity**: Cosine similarity to query [0, 1]
- **weight**: Normalized cluster weight from [-1, 1] to [0, 1]
- **recency**: Exponential decay based on `last_updated` timestamp

### Recency Score

```typescript
recency = 0.5^(ageDays / halfLifeDays)
```

## API Usage

### Submit Feedback (POST)

```typescript
// Thumbs up
const response = await fetch('/api/ops/memory/feedback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    clusterId: 'cl_abc123',
    feedback: { thumb: 'up' },
    autoUpdateWeight: true  // Update cluster weight immediately
  })
});

// Response:
{
  success: true,
  feedbackId: 'fb_1234567890_abc',
  reward: 1.0,
  confidence: 1.0,
  weightUpdated: true,
  newWeight: 0.15
}
```

```typescript
// Star rating
const response = await fetch('/api/ops/memory/feedback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    clusterId: 'cl_abc123',
    feedback: { stars: 4 },
    turnId: 'turn_456',
    metadata: {
      query: 'How do I deploy to production?',
      session_id: 'session_789'
    }
  })
});

// Response:
{
  success: true,
  feedbackId: 'fb_1234567890_xyz',
  reward: 0.5,
  confidence: 0.5
}
```

### Library Usage

```typescript
import { recordFeedback } from '@/lib/ai/feedback';

// Record feedback programmatically
const result = await recordFeedback({
  userId: 'user123',
  clusterId: 'cl_abc123',
  feedback: { thumb: 'up' }
});

console.log(`Recorded feedback: ${result.feedbackId}`);
```

```typescript
import { updateClusterWeight } from '@/lib/ai/feedback';

// Update cluster weight
const result = await updateClusterWeight('cl_abc123', {
  alpha: 0.15,  // Custom learning rate
  decayHalfLifeDays: 14  // Faster decay
});

console.log(`New weight: ${result.weight}`);
```

```typescript
import { buildPromptForTurn } from '@/lib/ai/context/promptContextBuilder';

// Context builder with feedback ranking (default: enabled)
const { messages, contextTokens } = await buildPromptForTurn({
  userId: 'user123',
  query: 'How do I deploy?',
  topK: 3,
  useFeedbackRanking: true,
  rankingParams: {
    blendSimilarity: 0.4,
    blendWeight: 0.4,
    blendRecency: 0.2
  }
});
```

## Batch Operations

### Update All Cluster Weights (Nightly Job)

```typescript
import { updateAllClusterWeights } from '@/lib/ai/feedback';

// Update weights for all clusters
const result = await updateAllClusterWeights({
  minFeedbackCount: 2,  // Only clusters with 2+ feedback events
  batchSize: 500        // Process in batches
}, {
  alpha: 0.1,
  decayHalfLifeDays: 21
});

console.log(`Updated ${result.updated} clusters`);
console.log(`Skipped ${result.skipped} clusters (insufficient feedback)`);
console.log(`Errors: ${result.errors.length}`);
```

### Recompute All Statistics

```typescript
import { recomputeAllClusterStats } from '@/lib/ai/feedback';

// Full recount (use for data migrations)
const count = await recomputeAllClusterStats();
console.log(`Recomputed ${count} clusters`);
```

## Testing & Debugging

### Preview Weight Computation

```typescript
import { previewClusterWeight } from '@/lib/ai/feedback';

const preview = await previewClusterWeight('cl_abc123', {
  alpha: 0.1,
  decayHalfLifeDays: 21
});

console.log(preview);
// {
//   success: true,
//   clusterId: 'cl_abc123',
//   prevWeight: 0.05,
//   newWeight: 0.12,
//   stats: {
//     count: 10,
//     meanReward: 0.75,
//     smoothedReward: 0.58,
//     decayedReward: 0.51,
//     ageDays: 7
//   }
// }
```

### Explain Ranking

```typescript
import { explainRanking } from '@/lib/ai/feedback';

const explanation = explainRanking({
  cluster: myCluster,
  similarity: 0.85
}, {
  blendSimilarity: 0.5,
  blendWeight: 0.3,
  blendRecency: 0.2
});

console.log(explanation);
// Cluster: Deployment Guide
// Blended Score: 78.5%
//
// Components:
//   Similarity: 85.0% → 42.5%
//   Weight: 25.0% → 7.5%
//   Recency: 70.0% → 14.0%
```

### A/B Testing

```typescript
import { rankWithMultipleParams } from '@/lib/ai/feedback';

const results = rankWithMultipleParams(
  clustersWithScores,
  [
    { name: 'Control', params: { blendSimilarity: 1.0, blendWeight: 0.0, blendRecency: 0.0 } },
    { name: 'Balanced', params: { blendSimilarity: 0.5, blendWeight: 0.3, blendRecency: 0.2 } },
    { name: 'Weight-Heavy', params: { blendSimilarity: 0.3, blendWeight: 0.5, blendRecency: 0.2 } }
  ]
);

results.forEach(({ name, ranked }) => {
  console.log(`${name}:`);
  ranked.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.cluster.title} (${(r.blended_score * 100).toFixed(1)}%)`);
  });
});
```

## Security Rules

Add to `firestore.rules.phase57` (extends phase56):

```rules
// === Feedback Events (Phase 57) ===
match /ops_memory_feedback/{feedbackId} {
  // Read: user must own the feedback
  allow read: if isOwner(resource.data.user_id);

  // Create: user must be creating for themselves
  allow create: if isOwner(request.resource.data.user_id) &&
                  request.resource.data.fb_id is string &&
                  request.resource.data.cluster_id is string &&
                  request.resource.data.reward is number &&
                  request.resource.data.confidence is number &&
                  request.resource.data.reward >= -1 &&
                  request.resource.data.reward <= 1 &&
                  request.resource.data.confidence >= 0 &&
                  request.resource.data.confidence <= 1;

  // Update: not allowed (feedback events are immutable)
  allow update: if false;

  // Delete: user must own the feedback or be admin
  allow delete: if isOwner(resource.data.user_id) || isAdmin();
}

// Update cluster rules to allow weight/feedback fields
match /ops_memory_clusters/{clusterId} {
  allow update: if isOwner(resource.data.user_id) &&
                  isOwner(request.resource.data.user_id) &&
                  (request.resource.data.weight == null ||
                   (request.resource.data.weight >= -1 && request.resource.data.weight <= 1));
}
```

## Deployment

### 1. Deploy Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

### 2. Deploy Security Rules

```bash
firebase deploy --only firestore:rules
```

### 3. Deploy Application

```bash
pnpm run build
pnpm run deploy
```

### 4. Optional: Scheduled Weight Updates

Create Cloud Function for nightly weight updates:

```typescript
// functions/src/schedules/updateWeights.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { updateAllClusterWeights } from '../lib/feedback/updateClusterWeights';

export const updateWeightsDaily = onSchedule({
  schedule: 'every day 02:00',
  timeZone: 'UTC'
}, async () => {
  const result = await updateAllClusterWeights({
    minFeedbackCount: 2,
    batchSize: 500
  });

  console.log(`[updateWeightsDaily] Updated ${result.updated} clusters`);
  return result;
});
```

## Performance Considerations

### Weight Update Strategies

**Option 1: On-Demand (Recommended for MVP)**
- Update weight immediately when feedback is submitted
- Set `autoUpdateWeight: true` in API request
- Pros: Always up-to-date, simple
- Cons: Extra latency per feedback submission (~50-100ms)

**Option 2: Batch (Recommended for Scale)**
- Schedule nightly Cloud Function to update all weights
- Faster feedback submission (no weight computation)
- Pros: Lower latency, better for high volume
- Cons: Weights lag by up to 24 hours

**Option 3: Hybrid**
- Update weight on-demand for high-value clusters (e.g., >10 feedback events)
- Batch update for low-activity clusters
- Best balance of freshness and performance

### Caching

Consider caching weighted clusters for 15-60 minutes:

```typescript
// In-memory cache
const weightedClustersCache = new Map<string, {
  clusters: RankedCluster[],
  timestamp: number
}>();

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function getCachedWeightedClusters(userId: string) {
  const cached = weightedClustersCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.clusters;
  }

  // Fetch fresh clusters...
  const clusters = await getWeightedClusters(userId);
  weightedClustersCache.set(userId, { clusters, timestamp: Date.now() });
  return clusters;
}
```

## Monitoring & Analytics

### Key Metrics to Track

1. **Feedback Volume**
   - Total feedback events per day
   - Thumbs up vs down ratio
   - Star rating distribution

2. **Weight Distribution**
   - Histogram of cluster weights
   - % of clusters with positive/negative weights
   - Average weight by user

3. **Ranking Impact**
   - NDCG (Normalized Discounted Cumulative Gain)
   - Click-through rate on top-ranked clusters
   - User satisfaction (follow-up feedback)

4. **System Health**
   - Weight update latency
   - Batch job duration
   - Error rate in feedback API

### Example Analytics Query

```typescript
import { getFeedbackForUser } from '@/lib/ai/feedback';

async function analyzeUserFeedback(userId: string) {
  const events = await getFeedbackForUser(userId, { limit: 1000 });

  const thumbsUp = events.filter(e => e.thumb === 'up').length;
  const thumbsDown = events.filter(e => e.thumb === 'down').length;
  const avgStars = events
    .filter(e => e.stars)
    .reduce((sum, e) => sum + e.stars!, 0) / events.length;

  return {
    totalFeedback: events.length,
    thumbsUp,
    thumbsDown,
    thumbsRatio: thumbsUp / (thumbsUp + thumbsDown),
    avgStars,
    avgReward: events.reduce((sum, e) => sum + e.reward, 0) / events.length
  };
}
```

## Future Enhancements

### Phase 57.1: Advanced Feedback Types
- **Contextual Feedback**: "This helped with my task"
- **Qualitative Feedback**: Free-text comments
- **Implicit Feedback**: Time spent on context, copy actions

### Phase 57.2: Multi-Armed Bandit
- Thompson Sampling for exploration/exploitation
- Dynamic blend coefficient optimization
- Personalized ranking per user

### Phase 57.3: Collaborative Filtering
- Learn from similar users' feedback
- Cold start problem mitigation
- Cross-user weight propagation

### Phase 57.4: Negative Feedback Actions
- Cluster splitting on persistent negative feedback
- Automatic pruning of low-value clusters
- User-specific cluster blacklisting

## Troubleshooting

### Issue: Weights Not Updating

**Check**:
1. Verify feedback events are being created: `firebase firestore:get ops_memory_feedback`
2. Check cluster has feedback stats: `firebase firestore:get ops_memory_clusters/{clusterId}`
3. Manually trigger weight update: `updateClusterWeight(clusterId)`

### Issue: Ranking Doesn't Change

**Check**:
1. Verify `useFeedbackRanking: true` in `buildPromptForTurn`
2. Check cluster weights are non-zero
3. Increase `blendWeight` coefficient (default: 0.3)
4. Verify blend coefficients sum to 1

### Issue: Performance Degradation

**Check**:
1. Number of feedback events (consider pagination)
2. Batch size for weight updates (reduce to 100-200)
3. Add caching layer for weighted clusters
4. Consider moving weight updates to scheduled job

## Summary

Phase 57 completes the AI Memory System feedback loop with:
- ✅ Feedback capture (thumbs/stars)
- ✅ Reward computation with confidence weighting
- ✅ Auto-weighting with EMA + Bayesian smoothing + time decay
- ✅ Blended ranking (similarity + weight + recency)
- ✅ REST API for feedback submission
- ✅ Integration with context builder
- ✅ Comprehensive utilities for testing and debugging

**Next Steps**: Implement Phase 56 Day 7 (Ops UI) to visualize feedback and weights in the admin dashboard.
