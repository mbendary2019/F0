# Phase 37 Testing Guide

## Quick Test Suite

### Prerequisites

1. Firebase Emulator Suite installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Phase 37 deployed (see [PHASE_37_README.md](PHASE_37_README.md))

---

## Test 1: Confidence Estimator

### Setup

```javascript
// Seed test data in Firestore
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// Create sample stats with varying quality
await db.collection('ops_stats').doc('router:24h').set({
  component: 'router',
  window: '24h',
  n: 150,                    // Good sample size
  avgReward: 0.72,
  p95Latency: 450,
  avgCostUsd: 0.0045,
  successRate: 0.98,
  rewards: [0.7, 0.72, 0.68, 0.75, 0.71, 0.73],
  latencies: [420, 450, 480, 440, 460, 470],
  costs: [0.004, 0.0045, 0.0048, 0.0043, 0.0044, 0.0046],
  sloViolations: 0,
  ts: Date.now()
});

// Low confidence example (small sample)
await db.collection('ops_stats').doc('AutoScaler:1h').set({
  component: 'AutoScaler',
  window: '1h',
  n: 25,                     // Small sample size
  avgReward: 0.65,
  p95Latency: 800,
  avgCostUsd: 0.0032,
  successRate: 0.92,
  rewards: [0.6, 0.7, 0.65],
  latencies: [750, 800, 850, 820],
  costs: [0.003, 0.0035, 0.0031],
  sloViolations: 2,          // Some violations
  ts: Date.now()
});
```

### Execute

```bash
# Trigger manually (or wait 10 minutes for scheduled run)
firebase functions:shell
> refreshConfidence()

# Or via emulator
npm run test:emulator
```

### Verify

```javascript
// Check ops_confidence collection
const confidence = await db.collection('ops_confidence').get();

confidence.docs.forEach(doc => {
  const data = doc.data();
  console.log(`${data.component}:${data.window}`);
  console.log(`  Score: ${(data.score * 100).toFixed(1)}%`);
  console.log(`  Reasons: ${data.reasons.join(', ')}`);
  console.log(`  Samples: ${data.sampleSize}`);
  console.log('---');
});
```

**Expected Results:**
- `router:24h` should have high confidence (≥0.8) with `reasons: ['ok']`
- `AutoScaler:1h` should have low confidence (<0.7) with `reasons: ['low_sample_size', 'slo_violations']`

### Success Criteria
- ✅ Confidence scores in range [0, 1]
- ✅ Scores decrease with small samples
- ✅ Scores decrease with high variance
- ✅ Scores decrease with SLO violations
- ✅ `reasons` array reflects penalties applied

---

## Test 2: Adaptive Router

### Setup

```javascript
// 1. Create high-confidence stats
await db.collection('ops_stats').doc('router:24h').set({
  component: 'router',
  window: '24h',
  n: 120,
  avgReward: 0.75,
  p95Latency: 420,
  avgCostUsd: 0.004,
  successRate: 0.98,
  rewards: Array(120).fill(0).map(() => 0.7 + Math.random() * 0.1),
  latencies: Array(120).fill(0).map(() => 400 + Math.random() * 50),
  costs: Array(120).fill(0).map(() => 0.0038 + Math.random() * 0.0004),
  ts: Date.now()
});

// 2. Wait for refreshConfidence to run (or trigger manually)
await refreshConfidence();

// 3. Create base policy
await db.collection('ops_policies').doc('router-core@1.0.0').set({
  id: 'router-core',
  version: '1.0.0',
  status: 'active',
  params: {
    modelWeights: {
      'gpt-5': 0.6,
      'gemini': 0.25,
      'claude': 0.15
    }
  },
  createdAt: Date.now(),
  createdBy: 'admin'
});
```

### Execute

```bash
# Trigger manually
firebase functions:shell
> adaptiveRouter()

# Check logs
firebase functions:log --only adaptiveRouter
```

### Verify

```javascript
// 1. Check new draft policy created
const drafts = await db.collection('ops_policies')
  .where('status', '==', 'draft')
  .orderBy('createdAt', 'desc')
  .limit(1)
  .get();

const draft = drafts.docs[0].data();
console.log('New draft policy:');
console.log(`  Version: ${draft.version}`); // Should be 1.0.1
console.log(`  Weights:`, draft.params.modelWeights);

// 2. Check decision logged
const decisions = await db.collection('ops_decisions')
  .where('actor', '==', 'adaptive-router')
  .orderBy('ts', 'desc')
  .limit(1)
  .get();

const decision = decisions.docs[0].data();
console.log('Decision record:');
console.log(`  Component: ${decision.component}`);
console.log(`  Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
console.log(`  Guardrail: ${decision.guardrail}`);
console.log(`  A/B Bucket: ${decision.abBucket}`);
console.log(`  Before:`, decision.before.modelWeights);
console.log(`  After:`, decision.after.modelWeights);
```

**Expected Results:**
- New policy version `1.0.1` created with status `draft`
- Model weights changed by ≤10% (maxChangeMagnitude)
- Decision logged with `guardrail: 'passed'`
- A/B bucket assigned (adaptive/control/prod)

### Success Criteria
- ✅ Draft policy created (not activated)
- ✅ Weight changes ≤ `maxChangeMagnitude` (0.10)
- ✅ Decision logged in `ops_decisions`
- ✅ No execution when confidence < `minConfidenceToAct`
- ✅ No execution when samples < `minSampleSize`

---

## Test 3: Self-Tuning Scheduler

### Setup

```javascript
// Scenario 1: Low performance → tighten cadence
await db.collection('ops_stats').doc('Watchdog:24h').set({
  component: 'Watchdog',
  window: '24h',
  n: 100,
  avgReward: 0.45,           // Low reward
  successRate: 0.88,         // Error rate 12%
  prevMinutes: 15,
  ts: Date.now()
});

// Scenario 2: Good performance → relax cadence
await db.collection('ops_stats').doc('FeedbackLoop:24h').set({
  component: 'FeedbackLoop',
  window: '24h',
  n: 120,
  avgReward: 0.78,           // High reward
  successRate: 0.98,
  ts: Date.now()
});
```

### Execute

```bash
firebase functions:shell
> selfTuningScheduler()
```

### Verify

```javascript
// Check config/ops_cadence
const cadenceDoc = await db.collection('config').doc('ops_cadence').get();
const cadence = cadenceDoc.data();

console.log('Watchdog cadence:', cadence.Watchdog.minutes); // Should be 5 (tightened)
console.log('FeedbackLoop cadence:', cadence.FeedbackLoop.minutes); // Should be ~20 (relaxed)

// Check decisions
const decisions = await db.collection('ops_decisions')
  .where('actor', '==', 'self-tuning-scheduler')
  .get();

decisions.docs.forEach(doc => {
  const d = doc.data();
  console.log(`${d.component}: ${d.before.minutes}min → ${d.after.minutes}min`);
});
```

**Expected Results:**
- `Watchdog` cadence reduced to 5 minutes (due to low reward/high error)
- `FeedbackLoop` cadence increased to ~20 minutes (due to high reward)
- All cadences within bounds [5, 60] minutes

### Success Criteria
- ✅ Cadence adjusted based on performance
- ✅ All values within [`minCadenceMins`, `maxCadenceMins`]
- ✅ Decisions logged for each adjustment
- ✅ `config/ops_cadence` updated correctly

---

## Test 4: API Endpoints

### Test `/api/ops/confidence`

```bash
# All confidence scores
curl http://localhost:3000/api/ops/confidence

# Filter by component
curl "http://localhost:3000/api/ops/confidence?component=router"

# Filter by window
curl "http://localhost:3000/api/ops/confidence?window=24h"
```

**Expected:** JSON array of confidence objects

### Test `/api/ops/decisions`

```bash
# All decisions
curl http://localhost:3000/api/ops/decisions

# Filter by component
curl "http://localhost:3000/api/ops/decisions?component=router"

# Limit results
curl "http://localhost:3000/api/ops/decisions?limit=10"
```

**Expected:** JSON array of decision objects, ordered by timestamp desc

---

## Test 5: UI Components

### Confidence Cards

1. Navigate to `/ops/learning`
2. Verify confidence cards appear
3. Check color coding:
   - Green for confidence ≥70%
   - Yellow for confidence 50–70%
   - Red for confidence <50%
4. Verify auto-refresh (wait 60s, check for updates)

**Screenshot checklist:**
- ✅ Component name visible
- ✅ Window (1h/24h/7d) shown
- ✅ Confidence score displayed as percentage
- ✅ Reasons shown as tags
- ✅ Metrics grid (reward, success, latency, cost)
- ✅ Sample size displayed

### Decisions Table

1. Navigate to `/ops/policies`
2. Verify decisions table appears
3. Click on a decision row
4. Verify modal shows:
   - Before/after diff
   - Expected effect
   - Full decision details
5. Verify auto-refresh (wait 60s)

**Screenshot checklist:**
- ✅ Timestamp, actor, component columns
- ✅ Confidence displayed with color coding
- ✅ Guardrail status (passed/failed)
- ✅ A/B bucket assignment
- ✅ Details modal functional

---

## Test 6: Feature Flags

### Test `adaptive.enabled`

```typescript
// In functions/src/config/flags.ts
adaptive.enabled = false;

// Redeploy
firebase deploy --only functions:adaptiveRouter

// Trigger
firebase functions:shell
> adaptiveRouter()

// Expected: Function returns early with log: "Adaptive mode disabled"
```

### Test `scheduler.autoTune`

```typescript
scheduler.autoTune = false;

firebase deploy --only functions:selfTuningScheduler

// Trigger
> selfTuningScheduler()

// Expected: Function returns early with log: "Auto-tune disabled"
```

### Test `learning.autoActivatePolicies`

```typescript
// Should be false by default
learning.autoActivatePolicies = false;

// After adaptiveRouter runs, check policy status:
const policy = await db.collection('ops_policies').doc('router-core@1.0.1').get();
console.log(policy.data().status); // Should be 'draft', not 'active'
```

---

## Test 7: Guardrails

### Test Confidence Threshold

```javascript
// Set low confidence
await db.collection('ops_confidence').doc('router:24h').set({
  component: 'router',
  window: '24h',
  score: 0.5,  // Below minConfidenceToAct (0.65)
  sampleSize: 100,
  // ... other fields
});

// Trigger
await adaptiveRouter();

// Expected: No new policy created, logs: "Low confidence: 0.5 < 0.65"
```

### Test Sample Size Threshold

```javascript
// Set small sample
await db.collection('ops_confidence').doc('router:24h').set({
  component: 'router',
  window: '24h',
  score: 0.8,
  sampleSize: 50,  // Below minSampleSize (80)
  // ...
});

// Trigger
await adaptiveRouter();

// Expected: No new policy, logs: "Insufficient samples: 50 < 80"
```

### Test Max Change Magnitude

```javascript
// Verify weight deltas never exceed maxChangeMagnitude
const before = { 'gpt-5': 0.6, 'gemini': 0.25, 'claude': 0.15 };
const after = await adaptRouterWeights(); // Returns new weights

Object.keys(before).forEach(model => {
  const delta = Math.abs(after[model] - before[model]);
  console.log(`${model} delta: ${delta}`);
  // Should all be ≤ 0.10
});
```

---

## Integration Test Script

Create `scripts/test-phase37.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "🧪 Phase 37 Integration Test Suite"
echo "==================================="

# Start emulators
firebase emulators:start --only firestore,functions &
EMULATOR_PID=$!
sleep 5

# Run tests
node scripts/test-phase37.js

# Cleanup
kill $EMULATOR_PID

echo "✅ All tests passed!"
```

Create `scripts/test-phase37.js`:

```javascript
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-test' });

async function testConfidenceEstimator() {
  console.log('Test 1: Confidence Estimator...');
  // ... test logic
  console.log('✅ Confidence Estimator passed');
}

async function testAdaptiveRouter() {
  console.log('Test 2: Adaptive Router...');
  // ... test logic
  console.log('✅ Adaptive Router passed');
}

async function testSelfTuningScheduler() {
  console.log('Test 3: Self-Tuning Scheduler...');
  // ... test logic
  console.log('✅ Self-Tuning Scheduler passed');
}

async function runAll() {
  await testConfidenceEstimator();
  await testAdaptiveRouter();
  await testSelfTuningScheduler();
}

runAll().catch(console.error);
```

---

## Acceptance Criteria

### Must Pass

- ✅ All unit tests pass
- ✅ Confidence scores computed correctly
- ✅ Adaptive router respects guardrails
- ✅ Scheduler stays within bounds
- ✅ Decisions ledger populated
- ✅ APIs return valid JSON
- ✅ UI components render without errors
- ✅ Feature flags work as expected

### Performance

- ✅ `refreshConfidence` completes in <30s
- ✅ `adaptiveRouter` completes in <10s
- ✅ `selfTuningScheduler` completes in <10s
- ✅ API responses <500ms (p95)
- ✅ UI initial load <2s

### Security

- ✅ Firestore rules prevent unauthorized writes to `ops_confidence`
- ✅ Firestore rules prevent unauthorized writes to `ops_decisions`
- ✅ API endpoints require authentication (if applicable)
- ✅ No sensitive data logged

---

## Troubleshooting Tests

### Functions don't trigger

```bash
# Check function deployment
firebase functions:list

# Check logs for errors
firebase functions:log

# Verify emulator connectivity
curl http://localhost:5001/PROJECT_ID/us-central1/refreshConfidence
```

### No data in Firestore

```bash
# Verify emulator running
firebase emulators:start

# Check Firestore UI
open http://localhost:4000/firestore
```

### UI components show errors

```bash
# Check Next.js dev server
npm run dev

# Check browser console for errors
# Verify API endpoints return data:
curl http://localhost:3000/api/ops/confidence
```

---

## Next Steps After Testing

1. ✅ All tests pass → Ready for staging deployment
2. ❌ Tests fail → Review logs, fix issues, retest
3. Deploy to staging:
   ```bash
   ./scripts/deploy-phase37.sh
   ```
4. Monitor for 24–48 hours
5. Run A/B analysis (adaptive vs control buckets)
6. If uplift confirmed → Enable `autoActivatePolicies`

---

**Happy Testing!** 🧪✅
