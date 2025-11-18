# Phase 33.3 — Self-Evolving Ops & Auto-Policy Tuning

**Version:** v33.3.0  
**Status:** ✅ Production Ready  
**Date:** 2025-10-11

---

## 📋 Overview

Phase 33.3 introduces autonomous system evolution capabilities that allow the RL policy and operational guardrails to **adapt and improve themselves** without human intervention.

### Key Features

1. **Auto-Policy Tuning** - Automatic adjustment of hyperparameters (alpha, learning rate)
2. **Dynamic Guardrails** - Risk-based adaptation of protected targets
3. **Meta-Learning** - Champion policy selection from multiple versions
4. **Auto-Documentation** - Automatic change tracking and documentation

---

## 🎯 Functional Scope

### 1. Auto-Policy Tuner

**Frequency:** Every 24 hours

**What it does:**
- Analyzes performance over the last 7 days vs. last 24 hours
- Calculates reward delta, MTTR delta, and success rate delta
- Adjusts `alpha` (exploration) and `lr` (learning rate) based on performance
- Records tuning decisions in audit log

**Tuning Logic:**

```typescript
if (performance degraded) {
  alpha ↑  // Increase exploration
  lr ↓     // Slow down learning
}

if (performance improved significantly) {
  alpha ↓  // Reduce exploration
  lr ↑     // Speed up learning
}

if (stable and good) {
  alpha ↓  // Fine-tune exploration
}
```

---

### 2. Guardrail Adapter

**Frequency:** Every 12 hours

**What it does:**
- Analyzes high-risk decision rate
- Dynamically adds/removes protected targets
- Tightens guardrails when risk increases
- Relaxes guardrails when risk is consistently low

**Adaptation Logic:**

```typescript
if (highRiskRate > 20%) {
  // Add critical targets to protection
  targets += ['production_critical', 'user_data_api', ...]
}

if (highRiskRate < 5% && rejectionRate < 10%) {
  // Remove extra protection
  targets -= ['production_critical', ...]
}
```

---

### 3. Meta-Learner

**Frequency:** Every 72 hours (3 days)

**What it does:**
- Evaluates multiple policy versions
- Calculates multi-objective score:
  - 60% avg reward
  - 30% success rate
  - 10% risk penalty
- Selects champion policy
- Promotes champion to global policy

---

### 4. Auto-Documentation

**Frequency:** Every 24 hours

**What it does:**
- Captures current policy state
- Records guardrail configuration
- Calculates 24h performance metrics
- Generates markdown documentation
- Maintains change log in Firestore

---

## 🏗️ Architecture

### Cloud Functions

```
functions/src/auto/
├── types.ts           - TypeScript definitions
├── tuner.ts           - Auto-policy tuning logic
├── guardrailAdapt.ts  - Dynamic guardrail adaptation
├── metaLearner.ts     - Champion policy selection
├── autoDoc.ts         - Auto-documentation generator
└── index.ts           - Module exports
```

### API Endpoints

```
/api/admin/policies/history  (GET)
  - Returns current policy, guardrails, versions, events, log

/api/admin/policies/tune  (POST)
  - Manual tuning override
  - Input: { alpha?, lr?, weights?, reason? }

/api/admin/policies/tune  (PATCH)
  - Rollback to previous version
  - Input: { versionId }
```

### UI Dashboard

```
/admin/policies
  - Current tuning controls
  - Guardrail status
  - Policy version history
  - Recent auto-tuning events
  - Auto-documentation log
```

---

## 📊 Firestore Collections

### `rl_policy` (updated)

```typescript
{
  tuning: {
    alpha: number,
    lr: number,
    weights: Record<string, number>,
    updatedAt: number,
    updatedBy: 'system' | uid,
    reason: string
  },
  fromVersion: string,      // NEW: source version
  championAt: number,        // NEW: when became champion
  championScore: number,     // NEW: champion score
  rolledBackAt: number       // NEW: rollback timestamp
}
```

### `rl_policy_versions` (new)

```typescript
{
  version: string,           // e.g., 'v1.0', 'v1.1'
  tuning: Tuning,
  since: number,             // Start timestamp
  until: number,             // End timestamp (optional)
  avgReward: number,
  avgRisk: number,
  decisions: number,
  performance: WindowStats,
  isChampion: boolean
}
```

### `ops_policies` (new)

```typescript
{
  // Document ID: 'protected_targets'
  targets: string[],         // Protected service names
  lastAdapt: number,
  reason: string,
  highRiskRate: number,
  rejectionRate: number,
  adaptationCount: number,
  changes: string[]
}
```

### `auto_docs` (new)

```typescript
{
  // Document ID: 'AUTO_POLICY_LOG'
  log: string,               // Markdown log (prepended)
  lastUpdated: number,
  entryCount: number
}
```

---

## 🚀 Deployment

### Prerequisites

- Phase 33.2 (Cognitive Ops Copilot) must be deployed
- Collections `rl_policy`, `rl_decisions`, `rl_outcomes` must exist
- Admin RBAC must be configured

### Step 1: Deploy Functions

```bash
cd functions
npm run build

firebase deploy --only \
  functions:autoPolicyTuner,\
  functions:guardrailAdapt,\
  functions:metaLearner,\
  functions:autoDoc
```

**Expected output:**
```
✔ functions[autoPolicyTuner]: Successful update operation.
✔ functions[guardrailAdapt]: Successful update operation.
✔ functions[metaLearner]: Successful update operation.
✔ functions[autoDoc]: Successful update operation.
```

### Step 2: Deploy Frontend

```bash
cd ..
npm run build
firebase deploy --only hosting
```

### Step 3: Verify

```bash
# Check functions
firebase functions:list | grep -E "(autoPolicyTuner|guardrailAdapt|metaLearner|autoDoc)"

# Visit dashboard
open https://your-domain.com/admin/policies

# Check Firestore
# Verify collections: ops_policies, rl_policy_versions, auto_docs
```

---

## ✅ Testing

### Smoke Test 1: Manual Tuning

```bash
# Visit /admin/policies
# Change alpha to 0.7
# Change lr to 0.08
# Add reason: "Testing manual override"
# Click "Apply Manual Tuning"

# Verify:
# - Policy updated in Firestore
# - Audit log created
# - UI reflects new values
```

### Smoke Test 2: Auto-Documentation

```bash
# Wait for first autoDoc run (or trigger manually)
firebase functions:log --only autoDoc --limit 10

# Visit /admin/policies
# Check "Auto-Documentation Log" section
# Should see markdown entry with current state
```

### Smoke Test 3: Guardrail Adaptation

```bash
# Simulate high-risk decisions
# (Create decisions with risk='high' in rl_decisions)

# Wait 12 hours or trigger manually
# Check ops_policies/protected_targets
# Should see additional targets added
```

### Smoke Test 4: Policy Rollback

```bash
# Visit /admin/policies
# Go to "Policy Versions" section
# Click "Rollback" on a previous version
# Verify policy reverted
# Check audit log for rollback event
```

---

## 📈 Success Metrics

### After 1 Week

- [ ] At least 7 auto-tuning cycles completed
- [ ] At least 14 guardrail adaptations
- [ ] 7 auto-doc entries generated
- [ ] Policy stable (no thrashing)

### After 2 Weeks

- [ ] MTTR reduced by ≥40% vs Phase 33.2 baseline
- [ ] Average reward increased by ≥15%
- [ ] Policy stability ≥90% (few reversions)
- [ ] Human intervention reduced to <20%

### After 1 Month

- [ ] Champion policy selected at least 3 times
- [ ] Guardrails adapted to production patterns
- [ ] Complete auto-doc log available
- [ ] Zero manual tuning interventions needed

---

## 🔧 Configuration

### Hyperparameter Bounds

```typescript
Alpha (Exploration):
  Min: 0.1
  Max: 1.5
  Default: 0.5

Learning Rate:
  Min: 0.005
  Max: 0.2
  Default: 0.05
```

### Tuning Thresholds

```typescript
Performance Degraded:
  - rewardDelta < -0.05
  - OR mttrDelta > 5 minutes
  - OR successRateDelta < -0.1

Performance Improved:
  - rewardDelta > 0.05
  - AND mttrDelta < -5 minutes
  - AND successRateDelta > 0.05

Stable:
  - abs(rewardDelta) < 0.02
  - AND successRate > 0.7
```

### Guardrail Thresholds

```typescript
Tighten:
  - highRiskRate > 20%

Relax:
  - highRiskRate < 5%
  - AND rejectionRate < 10%
```

---

## 🛡️ Security

### RBAC Protection

All API endpoints use `assertAdminReq()`:
- Only admin users can view policy history
- Only admin users can manually tune
- Only admin users can rollback

### Audit Trail

All changes logged in `admin_audit`:
- `policy_auto_tuned`
- `guardrail_adapted`
- `policy_champion_selected`
- `auto_doc_updated`
- `policy_tuned_manual`
- `policy_rolled_back`

### Guardrails

Auto-tuning respects bounds:
- Alpha clamped to [0.1, 1.5]
- Learning rate clamped to [0.005, 0.2]
- No auto-tuning during rollback periods

---

## 🔍 Monitoring

### Key Metrics

Monitor in `/admin/policies`:

1. **Tuning Frequency**
   - Auto-tuned count per week
   - Manual overrides per week

2. **Guardrail Adaptations**
   - Tighten events
   - Relax events
   - Protected target count over time

3. **Champion Selection**
   - Champion changes per month
   - Champion score trend

4. **Policy Stability**
   - Rollback count
   - Thrashing indicator (rapid reversions)

### Alerts

Set up alerts for:
- ❌ Auto-tuner failures
- ❌ Guardrail adapter errors
- ❌ Meta-learner failures
- ❌ Excessive rollbacks (>3 per week)
- ⚠️ High thrashing (alpha changes >0.2 in 24h)

---

## 🐛 Troubleshooting

### Issue: No auto-tuning happening

**Symptoms:**
- `tuning.updatedBy` always null or old
- No `policy_auto_tuned` audit events

**Debug:**
```bash
firebase functions:log --only autoPolicyTuner --limit 20

# Check for errors
# Verify rl_outcomes collection has data
```

**Solution:**
- Ensure Phase 33.2 is deployed and running
- Verify `rl_outcomes` has entries in last 7 days
- Check function execution permissions

---

### Issue: Guardrails not adapting

**Symptoms:**
- `ops_policies/protected_targets` never changes

**Debug:**
```bash
firebase functions:log --only guardrailAdapt --limit 20

# Check decision analysis
```

**Solution:**
- Verify `rl_decisions` has risk field
- Check if highRiskRate is within thresholds
- Ensure function has write permissions

---

### Issue: No policy versions

**Symptoms:**
- `rl_policy_versions` collection empty
- Meta-learner creates baseline only

**Debug:**
```bash
firebase functions:log --only metaLearner --limit 20
```

**Solution:**
- Policy versions are created by admins or tuner
- Create initial versions manually
- Wait for tuning cycles to generate versions

---

### Issue: Auto-doc log not updating

**Symptoms:**
- `auto_docs/AUTO_POLICY_LOG` missing or stale

**Debug:**
```bash
firebase functions:log --only autoDoc --limit 20

# Check for collection write errors
```

**Solution:**
- Verify autoDoc function permissions
- Check Firestore security rules
- Ensure function is scheduled correctly

---

## 📚 API Reference

### GET /api/admin/policies/history

**Response:**
```json
{
  "policy": {
    "tuning": {
      "alpha": 0.5,
      "lr": 0.05,
      "updatedAt": 1697040000000,
      "updatedBy": "system",
      "reason": "Performance improved"
    },
    "championScore": 0.85
  },
  "guardrails": {
    "targets": ["production", "main_api"],
    "lastAdapt": 1697040000000,
    "reason": "risk_low_stable"
  },
  "log": "## 2025-10-11\n...",
  "entryCount": 7,
  "versions": [
    {
      "version": "v1.1",
      "isChampion": true,
      "avgReward": 0.75
    }
  ],
  "recentEvents": [
    {
      "action": "policy_auto_tuned",
      "ts": 1697040000000
    }
  ]
}
```

### POST /api/admin/policies/tune

**Request:**
```json
{
  "alpha": 0.7,
  "lr": 0.08,
  "reason": "Manual override for testing"
}
```

**Response:**
```json
{
  "ok": true,
  "tuning": {
    "alpha": 0.7,
    "lr": 0.08,
    "updatedAt": 1697040000000,
    "updatedBy": "uid123",
    "reason": "Manual override for testing"
  }
}
```

### PATCH /api/admin/policies/tune

**Request:**
```json
{
  "versionId": "abc123"
}
```

**Response:**
```json
{
  "ok": true
}
```

---

## 🎯 Future Enhancements (Phase 33.4)

1. **Multi-Region Meta-Learning**
   - Federated learning across regions
   - Global champion selection

2. **A/B Testing Automation**
   - Automatic policy variant testing
   - Statistical significance checks

3. **Self-Tuning Bounds**
   - Hyperparameter bounds adapt too
   - Meta-meta-learning

4. **Anomaly Detection for Tuning**
   - Detect policy drift
   - Auto-revert on anomalies

5. **Natural Language Policy**
   - LLM-generated policy explanations
   - Human-readable tuning reasons

---

## 📝 Change Log

### v33.3.0 (2025-10-11)

- ✅ Auto-policy tuner
- ✅ Dynamic guardrails
- ✅ Meta-learning champion selection
- ✅ Auto-documentation
- ✅ Manual tuning API
- ✅ Policy rollback
- ✅ UI dashboard
- ✅ Complete audit trail

---

**Status:** ✅ Production Ready  
**Maintainer:** medo bendary  
**License:** Internal Use  

**Last Updated:** 2025-10-11

🧬 **Self-evolution activated!** 🚀


