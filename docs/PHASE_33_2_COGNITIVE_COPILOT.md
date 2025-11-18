# Phase 33.2 — Cognitive Ops Copilot

**Version:** v33.2.0  
**Date:** 2025-10-11  
**Owner:** medo bendary

---

## 🎯 Overview

Phase 33.2 introduces **Autonomous Decision Making** with **Reinforcement Learning** (RL). The system learns from outcomes and continuously improves its operational decisions.

### Key Capabilities

1. **Policy Learning (RL)** - LinUCB algorithm learns which actions work best
2. **Outcome Scoring** - Automatic reward calculation based on metric improvements
3. **Safe Governor** - Strict guardrails prevent high-risk actions
4. **Continuous Tuning** - Policy updates automatically from production data
5. **Explainable Decisions** - Every decision includes reasoning and contributing factors

---

## 🧠 How It Works

### Decision Flow

```
┌─────────────────┐
│ System Metrics  │
│  Anomalies      │──┐
│  Forecasts      │  │
└─────────────────┘  │
                     ▼
            ┌────────────────┐
            │ Build Context  │
            │  (12 features) │
            └────────┬───────┘
                     │
                     ▼
            ┌────────────────┐
            │  RL Policy     │
            │  (LinUCB)      │
            │  Select Action │
            └────────┬───────┘
                     │
                     ▼
            ┌────────────────┐
            │ Risk Assessment│
            │  • low          │
            │  • medium       │
            │  • high         │
            └────────┬───────┘
                     │
                     ▼
            ┌────────────────┐
            │  Guardrails    │
            │  • Denylist     │
            │  • Cooldowns    │
            │  • Limits       │
            └────────┬───────┘
                     │
        ┌────────────┴────────────┐
        │                         │
     Allow                  Require Approval
        │                         │
        ▼                         ▼
  ┌──────────┐          ┌──────────────┐
  │ Execute  │          │ Human Review │
  └────┬─────┘          └──────┬───────┘
       │                       │
       └──────────┬────────────┘
                  │
                  ▼
          ┌────────────────┐
          │ Capture Metrics│
          │  (pre/post)    │
          └────────┬───────┘
                   │
                   ▼
          ┌────────────────┐
          │ Calculate      │
          │ Reward         │
          └────────┬───────┘
                   │
                   ▼
          ┌────────────────┐
          │ Update Policy  │
          │ (Learn)        │
          └────────────────┘
```

---

## 📦 Components

### Functions (6)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `cognitiveOrchestrator` | Every 3 min | Select and execute decisions |
| `outcomeTracker` | Every 10 min | Evaluate outcomes, update policy |

### Modules (5)

1. **`policy.ts`** - LinUCB implementation
2. **`governor.ts`** - Guardrails & risk assessment  
3. **`orchestrator.ts`** - Decision coordination
4. **`outcomeTracker.ts`** - Reward calculation & learning
5. **`types.ts`** - TypeScript definitions

### API Endpoints (2)

- `GET/POST /api/admin/rl/decisions` - List/approve decisions
- `GET/PATCH /api/admin/rl/policy` - View/update policy

### UI (1)

- `/admin/cognitive` - Dashboard for monitoring & approval

### Firestore Collections (5)

- `rl_policy` - Policy parameters (weights, confidence)
- `rl_decisions` - Decision history
- `rl_outcomes` - Outcome evaluations
- `rl_guardrails` - Safety rules
- `admin_audit` - Audit trail

---

## 🚀 Deployment

### Prerequisites

- Phase 33 deployed
- Phase 33.1 deployed (optional but recommended)
- Observability system running
- Admin RBAC configured

### Deploy Functions

```bash
cd functions
npm run build

firebase deploy --only functions:cognitiveOrchestrator,functions:outcomeTracker
```

### Deploy Frontend

```bash
npm run build
firebase deploy --only hosting
```

### Initialize Guardrails (Optional)

Default guardrails are created automatically. To customize:

```bash
# Create custom guardrail
curl -X POST https://your-domain.com/api/admin/rl/guardrails \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Protect production",
    "protected_targets": ["production", "main_api"],
    "risk_level": "high",
    "policy": "deny",
    "enabled": true,
    "priority": 100
  }'
```

---

## 🧪 Actions

The system can autonomously select from these actions:

| Action | Description | Typical Risk |
|--------|-------------|--------------|
| `do_nothing` | No action needed | Low |
| `restart_fn` | Restart a function/service | Medium |
| `reduce_rate` | Apply rate limiting | Medium |
| `disable_endpoint` | Temporarily disable endpoint | High |
| `reroute` | Redirect traffic | High |
| `scale_up` | Increase resources | Medium |
| `clear_cache` | Clear cache | Low |

---

## 🎯 Context Features

The RL policy uses **12 features** to make decisions:

| Feature | Description | Range |
|---------|-------------|-------|
| `error_rate` | Current error rate | 0-1 |
| `error_spike` | Z-score of error spike | 0-3 |
| `p95_normalized` | p95 latency / 1000 | 0-2 |
| `latency_spike` | Z-score of latency spike | 0-3 |
| `traffic_normalized` | Calls / 100k | 0-1 |
| `traffic_spike` | Z-score of traffic spike | 0-3 |
| `anomaly_severity` | Current anomaly severity | 0-1 |
| `anomaly_count` | Recent anomaly count | 0-10 |
| `hour_of_day` | Hour (normalized) | 0-1 |
| `day_of_week` | Day (normalized) | 0-1 |
| `forecast_trend` | Predicted trend | -1 to 1 |
| `bias` | Bias term | 1.0 |

---

## 💰 Reward Function

Rewards are calculated after a **15-minute observation window**:

```python
# Error improvement reward
if error_improvement >= 20%:  reward += 1.0
elif error_improvement >= 10%: reward += 0.5
elif error_improvement < -20%: reward -= 1.0
elif error_improvement < -10%: reward -= 0.5

# Latency improvement reward
if latency_improvement >= 15%: reward += 0.5
elif latency_improvement >= 5%: reward += 0.25
elif latency_improvement < -15%: reward -= 0.5

# Side effect penalty
if throughput_drop >= 20%: reward -= 0.5
elif throughput_drop >= 10%: reward -= 0.25

# Risk penalty
if risk == 'high' and total_reward < 1.0: reward -= 0.3
elif risk == 'medium' and total_reward < 0.5: reward -= 0.1

total_reward = sum(all_components)
```

---

## 🛡️ Guardrails

### Default Rules

1. **Deny high-risk on protected targets**
   - Priority: 100
   - Blocks any high-risk action on production/main_api/auth/payment

2. **Require approval for disable_endpoint**
   - Priority: 90
   - Human approval required before disabling endpoints

3. **Require approval for reroute**
   - Priority: 90
   - Human approval required for traffic rerouting

4. **Cooldown for restart_fn**
   - Priority: 50
   - 5-minute cooldown between restarts

5. **Limit reduce_rate impact**
   - Priority: 50
   - Max 30% rate reduction
   - 10-minute cooldown

6. **Allow low-risk actions**
   - Priority: 10
   - Auto-approve low-risk actions

### Approval Flow

```
Low Risk → Auto-execute
Medium Risk → Execute with monitoring
High Risk → Require human approval (30 min expiry)
Denied → Logged, not executed
```

---

## 📊 Monitoring

### Key Metrics

Visit `/admin/cognitive` to monitor:

- **Policy Version** - Current policy iteration
- **Trained Samples** - Number of learning updates
- **Avg Reward** - Average reward across decisions
- **Positive Rate** - % of decisions with positive outcomes
- **Error Reduction** - Average error rate improvement
- **Latency Reduction** - Average latency improvement

### Decision States

- **Pending** - Awaiting approval
- **Auto Approved** - Executed automatically (low risk)
- **Approved** - Manually approved and executed
- **Rejected** - Denied by guardrails or human

---

## 🧪 Testing

### Test Decision Flow

```bash
# 1. Trigger anomaly (simulate high errors)
# System will detect and create a decision

# 2. Check decisions
curl https://your-domain.com/api/admin/rl/decisions \
  -H "Cookie: session=..."

# 3. If pending approval, approve it
curl -X POST https://your-domain.com/api/admin/rl/decisions \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{
    "decision_id": "abc123",
    "approved": true,
    "reason": "Test approval"
  }'

# 4. Wait 15 minutes for outcome evaluation

# 5. Check policy stats
curl https://your-domain.com/api/admin/rl/policy \
  -H "Cookie: session=..."
```

### Check Logs

```bash
firebase functions:log --only cognitiveOrchestrator --limit 20
firebase functions:log --only outcomeTracker --limit 20
```

---

## 🔧 Configuration

### Hyperparameters

You can tune the RL algorithm via API:

```bash
curl -X PATCH https://your-domain.com/api/admin/rl/policy \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{
    "learning_rate": 0.05,
    "exploration_alpha": 0.5
  }'
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `learning_rate` | 0.05 | How fast policy adapts |
| `exploration_alpha` | 0.5 | Exploration vs exploitation balance |

### Reset Policy

To start learning from scratch:

```bash
curl -X PATCH https://your-domain.com/api/admin/rl/policy \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{"reset": true}'
```

⚠️ **Warning:** This erases all learned weights!

---

## 🐛 Troubleshooting

### Issue: No Decisions Created

**Symptoms:**
- `rl_decisions` collection empty
- No activity in logs

**Solutions:**
1. Check if orchestrator is running:
   ```bash
   firebase functions:log --only cognitiveOrchestrator
   ```
2. Verify metrics are being collected:
   ```bash
   # Check observability_cache/totals exists
   ```
3. Ensure anomalies are detected (Phase 31)

---

### Issue: All Decisions Rejected

**Symptoms:**
- Every decision shows "approval_status: rejected"

**Solutions:**
1. Check guardrails are not too strict
2. Review logs for rejection reasons
3. Adjust guardrail priorities

---

### Issue: Policy Not Learning

**Symptoms:**
- `trained_samples` stays at 0
- Avg reward doesn't change

**Solutions:**
1. Check if decisions are being executed
2. Verify 15-minute observation window has passed
3. Check outcomeTracker logs:
   ```bash
   firebase functions:log --only outcomeTracker
   ```
4. Ensure metrics are available for reward calculation

---

## ✅ Success Criteria

Technical:
- ✅ 0 TypeScript errors
- ✅ Functions deployed successfully
- ✅ Policy initialized
- ✅ Guardrails active

Functional:
- ✅ Decisions created every 3 minutes
- ✅ Outcomes evaluated within 20 minutes
- ✅ Policy learning (trained_samples > 0)
- ✅ Guardrails blocking high-risk actions

Business:
- ⬇️ MTTR reduced by ≥25% (2 weeks)
- ✅ Positive decisions ≥70% (1 week)
- ⬇️ Human intervention <30% for low/medium risk
- ✅ 0 guardrail violations

---

## 🎊 Next Steps

1. **Week 1:** Monitor decisions, tune guardrails
2. **Week 2:** Collect outcomes, verify learning
3. **Week 3:** A/B test different hyperparameters
4. **Week 4:** Expand action types, add more features

---

**Status:** ✅ Ready to Deploy  
**Complexity:** Advanced (RL + Autonomous Ops)  
**Estimated Deploy Time:** 20 minutes

**Last Updated:** 2025-10-11  
**Maintainer:** medo bendary
