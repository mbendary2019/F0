# Phase 37 — Quick Start Guide

Get Phase 37 running in **5 minutes**! ⚡

---

## Prerequisites

✅ Firebase project configured
✅ Firebase CLI installed (`npm i -g firebase-tools`)
✅ Logged in (`firebase login`)

---

## Step 1: Deploy (2 minutes)

```bash
# One-command deployment
./scripts/deploy-phase37.sh
```

That's it! The script deploys:
- ✅ Firestore rules & indexes
- ✅ 3 Cloud Functions (refreshConfidence, adaptiveRouter, selfTuningScheduler)
- ✅ API endpoints (confidence, decisions)
- ✅ UI components (ConfidenceCards, DecisionsTable)

---

## Step 2: Verify (1 minute)

```bash
# Check functions deployed
firebase functions:list | grep -E "(refreshConfidence|adaptiveRouter|selfTuningScheduler)"

# Expected output:
# refreshConfidence(us-central1)
# adaptiveRouter(us-central1)
# selfTuningScheduler(us-central1)
```

---

## Step 3: Seed Test Data (1 minute)

Open Firebase Console → Firestore → Create document:

**Collection:** `ops_stats`
**Document ID:** `router:24h`
**Data:**

```json
{
  "component": "router",
  "window": "24h",
  "n": 120,
  "avgReward": 0.72,
  "p95Latency": 450,
  "avgCostUsd": 0.0045,
  "successRate": 0.98,
  "rewards": [0.7, 0.72, 0.68, 0.75, 0.71],
  "latencies": [420, 450, 480, 440, 460],
  "costs": [0.004, 0.0045, 0.0048, 0.0043, 0.0044],
  "ts": 1697234567890
}
```

---

## Step 4: Watch It Work (1 minute)

```bash
# Watch logs in real-time
firebase functions:log --only refreshConfidence

# Expected (after ~10 min):
# [refreshConfidence] Processing 1 components across 3 windows
# [refreshConfidence] router:24h: score=0.85, reasons=ok
# [refreshConfidence] Completed successfully
```

**Or** check Firestore directly:

```bash
# In Firebase Console → Firestore:
# Navigate to: ops_confidence/router:24h
# You should see: { score: 0.85, reasons: ["ok"], ... }
```

---

## Step 5: View in UI (<1 minute)

1. Start your dev server: `npm run dev`
2. Navigate to:
   - **Confidence Scores:** [http://localhost:3000/ops/learning](http://localhost:3000/ops/learning)
   - **Decisions Ledger:** [http://localhost:3000/ops/policies](http://localhost:3000/ops/policies)

**Expected:**
- Green confidence cards showing high scores
- Empty decisions table (until adaptiveRouter runs)

---

## What Happens Next?

### Automatic Execution Schedule

| Function | Frequency | Action |
|----------|-----------|--------|
| `refreshConfidence` | Every 10 min | Computes confidence scores from `ops_stats` |
| `adaptiveRouter` | Every 30 min | Creates draft policy adaptations (if confidence ≥ 0.65) |
| `selfTuningScheduler` | Every 30 min | Adjusts agent cadence based on performance |

### After ~30 Minutes

Check for adaptive decisions:

```bash
# Via API
curl http://localhost:3000/api/ops/decisions

# Via UI
# Visit /ops/policies → scroll to "Adaptive Decisions Ledger"
```

**You should see:**
- A new draft policy in `ops_policies` (e.g., `router-core@1.0.1`)
- A decision record in `ops_decisions` with confidence, reasons, A/B bucket

---

## Monitoring Checklist

After deployment, monitor these for 24 hours:

- [ ] `ops_confidence` updates every 10 minutes
- [ ] Confidence scores in range [0, 1]
- [ ] `ops_decisions` logs adaptive actions
- [ ] Draft policies created (status = 'draft')
- [ ] No auto-activations (unless flag enabled)
- [ ] API endpoints respond < 500ms
- [ ] UI components load without errors

---

## Key Firestore Collections

| Collection | Purpose | Updated By |
|------------|---------|------------|
| `ops_stats` | Performance metrics (Phase 36) | Phase 36 functions |
| `ops_confidence` | Confidence scores | `refreshConfidence` |
| `ops_decisions` | Decision audit trail | `adaptiveRouter`, `selfTuningScheduler` |
| `ops_policies` | Policy versions | `adaptiveRouter` |
| `config/ops_cadence` | Scheduler settings | `selfTuningScheduler` |

---

## Feature Flags Reference

**Location:** [`functions/src/config/flags.ts`](functions/src/config/flags.ts)

```typescript
// Enable/disable adaptive features
adaptive.enabled = true;  // Master switch

// Require high confidence before acting
adaptive.minConfidenceToAct = 0.65;

// Require sufficient samples
adaptive.minSampleSize = 80;

// Limit change magnitude per decision
adaptive.maxChangeMagnitude = 0.10;

// Enable/disable self-tuning
scheduler.autoTune = true;

// IMPORTANT: Keep false until A/B testing confirms uplift
learning.autoActivatePolicies = false;
```

To change: Edit file → `firebase deploy --only functions`

---

## Troubleshooting

### No confidence data?

```bash
# 1. Check if ops_stats has data
firebase firestore:get ops_stats/router:24h

# 2. Check function logs
firebase functions:log --only refreshConfidence

# 3. Manually trigger
firebase functions:shell
> refreshConfidence()
```

### Functions not running?

```bash
# Check deployment
firebase functions:list

# Check for errors
firebase functions:log

# Verify schedule
# Functions use Cloud Scheduler (automatic, no setup needed)
```

### UI shows errors?

```bash
# Check API endpoints
curl http://localhost:3000/api/ops/confidence
curl http://localhost:3000/api/ops/decisions

# Check browser console
# Open DevTools → Console tab
```

---

## Next Steps

Once Phase 37 is running smoothly:

1. **Monitor A/B Performance:**
   - Compare `avgReward` across buckets (adaptive vs control)
   - Requires statistical significance over 7+ days

2. **Enable Auto-Activation (Optional):**
   ```typescript
   // In functions/src/config/flags.ts
   learning.autoActivatePolicies = true;
   ```
   ⚠️ Only after confirming +10% uplift in A/B test!

3. **Tune Thresholds:**
   - Adjust `minConfidenceToAct` based on your risk tolerance
   - Lower = more aggressive, higher = more conservative

4. **Phase 38 (Coming Soon):**
   - Knowledge Graph for Ops Intelligence
   - Natural-language queries
   - Root-cause analysis

---

## Resources

- **Full Docs:** [PHASE_37_README.md](PHASE_37_README.md)
- **Testing:** [PHASE_37_TESTING_GUIDE.md](PHASE_37_TESTING_GUIDE.md)
- **Implementation:** [PHASE_37_IMPLEMENTATION_SUMMARY.md](PHASE_37_IMPLEMENTATION_SUMMARY.md)

---

## Support

**Logs:** `firebase functions:log`
**Firestore Console:** https://console.firebase.google.com/project/YOUR_PROJECT/firestore
**Functions Console:** https://console.firebase.google.com/project/YOUR_PROJECT/functions

---

**You're all set!** 🎉

Phase 37 will now autonomously optimize your system with confidence-aware intelligence.

Just monitor the dashboards at `/ops/learning` and `/ops/policies` to watch it work! 🚀
