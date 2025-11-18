# F0 Phase 37 — Meta-Learning & Adaptive Policies

## Overview

Phase 37 extends Phase 36's self-learning system with **confidence-aware decision making**, **adaptive policy switching**, and **self-tuning schedulers**. The system now understands its own uncertainty and adapts automatically to maximize reward under constraints.

## What's New

### 1. Confidence Estimation (`refreshConfidence`)
- **Runs:** Every 10 minutes
- **Purpose:** Computes confidence scores (0–1) for each component based on:
  - Sample size (penalize < 50 samples)
  - Metric variance (reward, latency, cost)
  - SLO violations
- **Output:** `ops_confidence` collection with detailed metrics
- **Reasons tracked:** `low_sample_size`, `high_latency_variance`, `reward_instability`, `cost_spike`, `slo_violations`, `ok`

### 2. Uncertainty-Aware Router (`adaptiveRouter`)
- **Runs:** Every 30 minutes
- **Purpose:** Adapts model routing weights based on confidence scores
- **Guardrails:**
  - Requires confidence ≥ 0.65 (configurable)
  - Requires sample size ≥ 80
  - Limits weight changes to ±10% per decision
- **Behavior:** Creates DRAFT policies (manual activation required)
- **A/B Testing:** Splits traffic: adaptive=10%, control=10%, prod=80%

### 3. Self-Tuning Scheduler (`selfTuningScheduler`)
- **Runs:** Every 30 minutes
- **Purpose:** Dynamically adjusts agent execution cadence
- **Components tuned:**
  - `Watchdog`: 5–30 min based on reward/error rate
  - `FeedbackLoop`: 10–20 min based on reward
  - `AutoScaler`: 3–10 min based on latency p95
- **Bounds:** `minCadenceMins=5`, `maxCadenceMins=60`
- **Storage:** Writes to `config/ops_cadence` for agents to read

### 4. Decisions Ledger
- **Collection:** `ops_decisions`
- **Purpose:** Immutable audit trail of all adaptive decisions
- **Fields:**
  - `actor`: `adaptive-router` | `self-tuning-scheduler` | `admin`
  - `component`, `before`, `after`, `confidence`, `reasons`, `guardrail`
  - `abBucket` (A/B assignment)
  - `effect` (expected reward/latency delta)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase 37 Components                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐        ┌──────────────┐                  │
│  │  ops_stats   │───────▶│ Confidence   │                  │
│  │  (Phase 36)  │        │  Estimator   │                  │
│  └──────────────┘        └──────┬───────┘                  │
│                                  │                           │
│                                  ▼                           │
│                         ┌──────────────┐                    │
│                         │ops_confidence│                    │
│                         └──────┬───────┘                    │
│                                │                             │
│                  ┌─────────────┴─────────────┐              │
│                  ▼                           ▼              │
│         ┌─────────────────┐       ┌──────────────────┐     │
│         │ Adaptive Router │       │ Self-Tuning      │     │
│         │  (Policy Adapt) │       │  Scheduler       │     │
│         └────────┬─────────┘       └────────┬────────┘     │
│                  │                           │              │
│                  ▼                           ▼              │
│         ┌──────────────┐          ┌────────────────┐       │
│         │ops_policies  │          │config/         │       │
│         │  (drafts)    │          │ops_cadence     │       │
│         └──────────────┘          └────────────────┘       │
│                  │                           │              │
│                  └───────────┬───────────────┘              │
│                              │                              │
│                              ▼                              │
│                     ┌──────────────┐                        │
│                     │ops_decisions │                        │
│                     │   (ledger)   │                        │
│                     └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Firestore Schema

### `ops_confidence` Collection

```typescript
{
  component: "router" | "AutoScaler" | "Watchdog" | ...,
  window: "1h" | "24h" | "7d",
  score: 0.85,  // 0..1
  reasons: ["ok"],
  sampleSize: 150,
  metrics: {
    rewardAvg: 0.72,
    rewardStd: 0.15,
    latencyP95: 450,
    latencyStd: 120,
    costAvg: 0.0045,
    costStd: 0.0012,
    successRate: 0.98
  },
  ts: 1697234567890
}
```

**Document ID:** `{component}:{window}` (e.g., `router:24h`)

### `ops_decisions` Collection

```typescript
{
  id: "uuid-v4",
  ts: 1697234567890,
  actor: "adaptive-router",
  component: "router",
  before: { modelWeights: { "gpt-5": 0.6, "gemini": 0.25, "claude": 0.15 } },
  after: { modelWeights: { "gpt-5": 0.65, "gemini": 0.25, "claude": 0.10 } },
  confidence: 0.78,
  reasons: ["ok"],
  guardrail: "passed",
  abBucket: "adaptive",
  effect: { expectedRewardDelta: 0.02 }
}
```

## Feature Flags

**Location:** [`functions/src/config/flags.ts`](functions/src/config/flags.ts)

```typescript
{
  adaptive: {
    enabled: true,              // Master kill switch
    minConfidenceToAct: 0.65,   // Require 65% confidence to adapt
    minSampleSize: 80,          // Require 80+ samples
    maxChangeMagnitude: 0.10,   // Max 10% weight delta per decision
    ab: {
      adaptive: 0.1,            // 10% to adaptive bucket
      control: 0.1,             // 10% to control bucket
      prod: 0.8                 // 80% to prod bucket
    }
  },
  scheduler: {
    autoTune: true,             // Enable self-tuning
    minCadenceMins: 5,          // Minimum cadence
    maxCadenceMins: 60          // Maximum cadence
  },
  learning: {
    enabled: true,
    autoActivatePolicies: false // IMPORTANT: Keep false until A/B confirms uplift
  }
}
```

## Deployment

### Quick Deploy

```bash
./scripts/deploy-phase37.sh
```

### Manual Steps

```bash
# 1. Deploy Firestore rules & indexes
firebase deploy --only firestore:rules,firestore:indexes

# 2. Build functions
cd functions
npm run build

# 3. Deploy Phase 37 functions
firebase deploy --only \
  functions:refreshConfidence,\
  functions:adaptiveRouter,\
  functions:selfTuningScheduler
```

## Verification

### 1. Check Functions Deployment

```bash
firebase functions:list
```

Expected output:
```
refreshConfidence(us-central1)
adaptiveRouter(us-central1)
selfTuningScheduler(us-central1)
```

### 2. Monitor Logs

```bash
# Confidence Estimator
firebase functions:log --only refreshConfidence

# Adaptive Router
firebase functions:log --only adaptiveRouter

# Self-Tuning Scheduler
firebase functions:log --only selfTuningScheduler
```

### 3. Seed Test Data

```javascript
// In Firebase Console or via script
const db = admin.firestore();

// Create sample stats
await db.collection('ops_stats').doc('router:24h').set({
  component: 'router',
  window: '24h',
  n: 120,
  avgReward: 0.68,
  p95Latency: 520,
  avgCostUsd: 0.0042,
  successRate: 0.96,
  rewards: [0.7, 0.65, 0.72, 0.68, 0.69],
  latencies: [480, 510, 520, 530, 495],
  costs: [0.004, 0.0045, 0.0041, 0.0043, 0.0042],
  ts: Date.now()
});
```

### 4. Wait for Execution

- **refreshConfidence:** Runs every 10 minutes
- **adaptiveRouter:** Runs every 30 minutes (after confidence data available)
- **selfTuningScheduler:** Runs every 30 minutes

### 5. Verify Collections

```javascript
// Check confidence scores
const confidence = await db.collection('ops_confidence').get();
console.log(confidence.docs.map(d => d.data()));

// Check decisions ledger
const decisions = await db.collection('ops_decisions')
  .orderBy('ts', 'desc')
  .limit(10)
  .get();
console.log(decisions.docs.map(d => d.data()));
```

## UI Components

### Confidence Cards

**Location:** `/ops/learning`

**Features:**
- Real-time confidence scores
- Color-coded by confidence level (green ≥70%, yellow ≥50%, red <50%)
- Detailed metrics (reward, latency, cost, success rate)
- Confidence factors display
- Auto-refresh every 60 seconds

**Usage:**
```tsx
import ConfidenceCards from './components/ConfidenceCards';

// In your page component
<ConfidenceCards />
```

### Decisions Table

**Location:** `/ops/policies`

**Features:**
- Searchable, sortable ledger of all adaptive decisions
- Filter by component, actor, or time range
- Click to view full before/after diff
- Expected effect display
- A/B bucket assignment
- Auto-refresh every 60 seconds

**Usage:**
```tsx
import DecisionsTable from './components/DecisionsTable';

// In your page component
<DecisionsTable />
```

## API Endpoints

### GET `/api/ops/confidence`

**Query Params:**
- `component` (optional): Filter by component name
- `window` (optional): Filter by time window (1h, 24h, 7d)

**Response:**
```json
[
  {
    "component": "router",
    "window": "24h",
    "score": 0.85,
    "reasons": ["ok"],
    "sampleSize": 150,
    "metrics": { ... },
    "ts": 1697234567890
  }
]
```

### GET `/api/ops/decisions`

**Query Params:**
- `component` (optional): Filter by component name
- `limit` (optional): Max results (default: 200)

**Response:**
```json
[
  {
    "id": "...",
    "ts": 1697234567890,
    "actor": "adaptive-router",
    "component": "router",
    "before": { ... },
    "after": { ... },
    "confidence": 0.78,
    "reasons": ["ok"],
    "guardrail": "passed",
    "abBucket": "adaptive"
  }
]
```

## Testing Checklist

### Unit Tests

- ✅ Confidence score clamps to [0, 1]
- ✅ Confidence decays with high variance
- ✅ Confidence decays with low sample size
- ✅ Router never exceeds `maxChangeMagnitude`
- ✅ Scheduler never exceeds cadence bounds

### Integration Tests (Emulator)

1. **Confidence Estimator:**
   ```bash
   # Seed ops_stats with mixed performance
   # Trigger refreshConfidence
   # Verify ops_confidence has entries with score & reasons
   ```

2. **Adaptive Router:**
   ```bash
   # Seed ops_confidence with high score (≥0.65)
   # Trigger adaptiveRouter
   # Verify new draft policy created
   # Verify decision logged in ops_decisions
   ```

3. **Self-Tuning Scheduler:**
   ```bash
   # Seed ops_stats with low reward
   # Trigger selfTuningScheduler
   # Verify config/ops_cadence updated
   # Verify decision logged
   ```

### End-to-End

1. Deploy to staging
2. Monitor for 24 hours
3. Verify:
   - Confidence scores update every 10 min
   - Adaptive decisions create draft policies
   - No auto-activations (until flag enabled)
   - Decisions ledger populated
   - UI shows live data

## Success Criteria

- ✅ **+10–15% uplift** in `avgReward (24h)` for **adaptive** bucket vs **control**
- ✅ **≤8% reduction** in p95 latency under burst
- ✅ **Zero auto-activations** without corresponding `ops_decisions` record
- ✅ **100% guardrail pass rate** (no failed decisions)

## Rollback Plan

### Quick Rollback

```bash
# Disable adaptive features
# Edit functions/src/config/flags.ts:
adaptive.enabled = false
scheduler.autoTune = false

# Redeploy
firebase deploy --only functions
```

### Full Rollback

```bash
# Undeploy Phase 37 functions
firebase functions:delete refreshConfidence
firebase functions:delete adaptiveRouter
firebase functions:delete selfTuningScheduler

# Revert Firestore rules (optional)
git checkout HEAD~1 -- firestore.rules
firebase deploy --only firestore:rules
```

### Data Preservation

- `ops_confidence` and `ops_decisions` are **read-only** for analysis
- Draft policies in `ops_policies` can be deleted safely
- Keep for post-mortem if issues occur

## Guardrails & Safety

### Adaptive Router
- ✅ Only acts when confidence ≥ `minConfidenceToAct` (0.65)
- ✅ Only acts when sample size ≥ `minSampleSize` (80)
- ✅ Limits weight changes to ±`maxChangeMagnitude` (0.10)
- ✅ Creates DRAFT policies (no auto-activation)
- ✅ Logs all decisions to immutable ledger

### Self-Tuning Scheduler
- ✅ Cadence bounded by [`minCadenceMins`, `maxCadenceMins`]
- ✅ Only adjusts cadence, not policy logic
- ✅ Logs all adjustments to immutable ledger
- ✅ Agents read from `config/ops_cadence` (no direct schedule modification)

### Feature Flags
- ✅ `autoActivatePolicies=false` by default (manual approval required)
- ✅ `adaptive.enabled` master kill switch
- ✅ `scheduler.autoTune` master kill switch

## Monitoring & Alerts

### Key Metrics to Watch

1. **Confidence Scores:**
   - Alert if any component drops below 0.5 for >1 hour
   - Monitor reasons distribution

2. **Decision Rate:**
   - Alert if >10 decisions/hour (unusual activity)
   - Alert if 0 decisions for >24 hours (stuck?)

3. **Guardrail Failures:**
   - Alert on ANY guardrail="failed" decision
   - Investigate immediately

4. **A/B Performance:**
   - Compare `avgReward` across buckets weekly
   - Require statistical significance before enabling auto-activation

### Firebase Console

- **Functions → Logs:** Real-time execution logs
- **Firestore → ops_confidence:** Live confidence scores
- **Firestore → ops_decisions:** Decision audit trail

### Custom Alerts (Example)

```javascript
// Alert on low confidence
const lowConfidence = await db.collection('ops_confidence')
  .where('score', '<', 0.5)
  .get();

if (lowConfidence.size > 0) {
  // Send alert to ops team
}

// Alert on guardrail failures
const failures = await db.collection('ops_decisions')
  .where('guardrail', '==', 'failed')
  .get();

if (failures.size > 0) {
  // Send critical alert
}
```

## What's Next: Phase 38 Preview

**Knowledge Graph for Ops Intelligence**

- Per-entity graph linking:
  - Components ↔ Policies ↔ Incidents ↔ Commits
- Natural-language queries:
  - "Which policy caused the latency spike on Oct 10?"
  - "Show me all decisions affecting the router component"
- Visual graph explorer
- Root-cause suggestions driven by graph patterns

## Troubleshooting

### No confidence data appearing

1. Check if `ops_stats` collection has data:
   ```javascript
   const stats = await db.collection('ops_stats').get();
   console.log(stats.size); // Should be > 0
   ```

2. Check `refreshConfidence` logs:
   ```bash
   firebase functions:log --only refreshConfidence
   ```

3. Verify Firestore rules allow service account writes:
   ```rules
   match /ops_confidence/{id} {
     allow write: if isService();
   }
   ```

### Adaptive router not creating policies

1. Check confidence meets thresholds:
   ```javascript
   const conf = await db.collection('ops_confidence').doc('router:24h').get();
   console.log(conf.data().score); // Should be ≥ 0.65
   console.log(conf.data().sampleSize); // Should be ≥ 80
   ```

2. Check feature flag:
   ```typescript
   // functions/src/config/flags.ts
   adaptive.enabled // Should be true
   ```

3. Check `adaptiveRouter` logs for errors

### Scheduler not adjusting cadence

1. Check if `config/ops_cadence` exists:
   ```javascript
   const cadence = await db.collection('config').doc('ops_cadence').get();
   console.log(cadence.data());
   ```

2. Check feature flag:
   ```typescript
   scheduler.autoTune // Should be true
   ```

3. Verify agents are reading from `config/ops_cadence`

## Support

- **Documentation:** This file
- **Code:** See implementation pack in prompt
- **Issues:** File in project issue tracker
- **Logs:** `firebase functions:log`

---

**Phase 37 Implementation Complete** ✅

Built with confidence-aware intelligence for F0 🚀
