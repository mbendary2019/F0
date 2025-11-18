# Canary Deployment Guide - Sprint 13

Progressive rollout strategy for AI Governance system to minimize risk.

---

## 🎯 Canary Deployment Strategy

Deploy in phases with gradual traffic ramp-up, monitoring at each stage.

### Phase Timeline

| Time | Sample Rate | Duration | Success Criteria |
|------|------------|----------|------------------|
| **T0** | 10% | 30 min | Error rate < 1%, P95 < 500ms |
| **T0+30m** | 10% | 90 min | Flagged rate < 15%, dashboard working |
| **T0+2h** | 50% | 4 hours | Error rate < 0.5%, P95 < 250ms |
| **T0+6h** | 100% | 18 hours | Flagged rate < 10%, all SLOs met |
| **T0+24h** | 100% | Ongoing | Review & tune thresholds |

---

## 📋 Canary Ramp Recipe

### **T0: Initial Deployment (10% Sample)**

**Actions:**
```bash
# 1. Deploy all Functions
firebase deploy --only functions:logAiEval,functions:createAIGovernanceReport,functions:aiGovCleanup,functions:aiGovFlagRateAlert

# 2. Deploy Firestore rules
firebase deploy --only firestore:rules

# 3. Set initial config via ConfigPanel UI
enabled: true
sampleRate: 0.10  # 10% sampling
thresholds:
  toxicity: 50
  bias: 30
alertFlagRatePct: 10
```

**Monitor:**
- Cloud Logging: Filter for errors
- Dashboard: `/admin/ai-governance` - verify KPIs display
- Function logs: Check for `sampledOut` messages (~90% should be sampled out)

**Success Criteria:**
- Zero deployment errors
- Dashboard loads successfully
- First evaluations logged to Firestore
- No 500 errors in Cloud Logging

**Go/No-Go Decision:**
- ✅ **GO**: If all criteria met, proceed to T0+30m
- ❌ **NO-GO**: Rollback to `enabled=false`, investigate errors

---

### **T0+30m: Health Check (10% Sample)**

**Actions:**
```bash
# Verify metrics after 30 minutes of 10% sampling
```

**Monitor:**
```bash
# 1. Error rate
gcloud logging read "resource.type=cloud_function AND logAiEval AND severity>=ERROR" \
  --limit 50 --format json | jq 'length'
# Expected: < 1% of total invocations

# 2. P95 latency
# Check Cloud Console Metrics Explorer
# Metric: cloud.googleapis.com/functions/execution_times
# Filter: function_name=logAiEval
# Aggregation: 95th percentile
# Expected: < 500ms

# 3. Flagged rate
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://YOUR_DOMAIN/api/admin/ai-evals/summary | jq '.flagRate'
# Expected: < 15%
```

**Verify:**
- [ ] Dashboard displays recent evaluations
- [ ] Flagged outputs appear in "Recent Flagged" section
- [ ] PDF report generates successfully
- [ ] ConfigPanel loads and allows edits

**Success Criteria:**
- Error rate < 1%
- P95 latency < 500ms
- Flagged rate < 15%
- Dashboard functional

**Go/No-Go Decision:**
- ✅ **GO**: Proceed to T0+2h (50% ramp)
- ⚠️ **PAUSE**: If flagged rate 10-15%, review flagged outputs for false positives
- ❌ **NO-GO**: If error rate > 1%, reduce to `sampleRate=0.05` (5%) and investigate

---

### **T0+2h: Ramp to 50% Sample**

**Actions:**
```typescript
// Via ConfigPanel UI
sampleRate: 0.5  // Increase to 50%
```

**Monitor:**
```bash
# 1. Firestore write operations
gcloud firestore operations list --filter="ai_evals" --limit 10

# 2. Function invocation count
gcloud logging read "resource.type=cloud_function AND logAiEval" \
  --limit 1000 --format json | jq '[.[] | select(.jsonPayload.message | contains("sampledOut"))] | length'
# Expected: ~50% sampled out

# 3. Storage usage (PDF reports)
gsutil du -sh gs://YOUR_BUCKET/reports/
```

**Verify:**
- [ ] Increased evaluation volume (~5x from 10%)
- [ ] No quota errors in Firestore
- [ ] P95 latency still < 250ms
- [ ] Error rate < 0.5%

**Success Criteria:**
- Error rate < 0.5%
- P95 latency < 250ms
- Flagged rate stable (< 12%)
- No Firestore quota warnings

**Go/No-Go Decision:**
- ✅ **GO**: Proceed to T0+6h (100% ramp)
- ⚠️ **PAUSE**: If latency > 250ms, review evaluator performance
- ❌ **NO-GO**: If quota errors, reduce to `sampleRate=0.25` and enable additional sampling

---

### **T0+6h: Full Rollout (100% Sample)**

**Actions:**
```typescript
// Via ConfigPanel UI
sampleRate: 1.0  // Full traffic
```

**Monitor for 18 hours:**
```bash
# 1. Comprehensive error check
gcloud logging read "resource.type=cloud_function AND \
  (logAiEval OR createAIGovernanceReport OR aiGovCleanup OR aiGovFlagRateAlert) AND \
  severity>=ERROR" --limit 100 --format json

# 2. Flagged rate trends
# Check dashboard every 2 hours for flagged rate
# Expected: Stable around 5-10%

# 3. Top flagged models
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://YOUR_DOMAIN/api/admin/ai-evals/summary | jq '.topModels'
```

**Verify:**
- [ ] All evaluations logged (no sampling)
- [ ] Cleanup job runs successfully (after 24h)
- [ ] Alert job runs successfully (every 60m)
- [ ] No Slack/Discord alerts triggered (flagged rate < 10%)

**Success Criteria:**
- Error rate < 0.5%
- P95 latency < 250ms
- Flagged rate < 10%
- All scheduled jobs executing

**Go/No-Go Decision:**
- ✅ **GO**: Declare success, proceed to T0+24h review
- ⚠️ **TUNE**: If flagged rate 10-15%, adjust thresholds (increase toxicity/bias)
- ❌ **ROLLBACK**: If error rate > 1%, reduce to `sampleRate=0.5` or disable

---

### **T0+24h: Review & Tune**

**Actions:**
```bash
# Generate comprehensive report
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://YOUR_DOMAIN/api/admin/ai-evals/summary > summary_24h.json

# Review flagged outputs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://YOUR_DOMAIN/api/admin/ai-evals/recent > flagged_24h.json
```

**Analysis:**
1. **Review flagged outputs** for false positives
   - Are bias detections accurate?
   - Are toxicity scores reasonable?
   - Any legitimate content being flagged?

2. **Tune thresholds** based on findings:
   ```typescript
   // Example adjustments via ConfigPanel
   thresholds: {
     toxicity: 60,  // If too many false positives
     bias: 35,      // If too sensitive
   }
   ```

3. **Monitor top models**:
   - Which models have highest quality?
   - Which models are flagged most often?
   - Any drift in performance?

4. **Check resource usage**:
   ```bash
   # Firestore writes/day
   gcloud firestore operations list --filter="ai_evals" | wc -l

   # Storage usage
   gsutil du -sh gs://YOUR_BUCKET/reports/
   ```

**Final Success Criteria:**
- [ ] Flagged rate stable at < 10%
- [ ] False positive rate < 5%
- [ ] All SLOs met for 24 hours
- [ ] No production incidents
- [ ] Team trained on dashboard usage

**Actions After Success:**
- [ ] Tag release: `git tag v13.0.0 -m "Sprint 13 - AI Governance"`
- [ ] Update CHANGELOG.md
- [ ] Announce to team
- [ ] Schedule weekly review of flagged outputs

---

## 🚨 Rollback Triggers

Trigger immediate rollback if any of these occur:

| Trigger | Severity | Action |
|---------|----------|--------|
| **Error rate > 5%** | Critical | Set `enabled=false` immediately |
| **P95 latency > 2s** | Critical | Reduce `sampleRate=0.1` |
| **Firestore quota exceeded** | Critical | Set `enabled=false`, contact Firebase support |
| **False positive rate > 20%** | High | Reduce `sampleRate=0.1`, review thresholds |
| **Alert spam (>10 alerts/hour)** | High | Increase `alertFlagRatePct` to 20% |
| **Storage quota exceeded** | High | Enable cleanup job, reduce retention |

---

## 📊 Monitoring Dashboard

### Key Metrics to Watch

Create a custom dashboard in Cloud Console with these metrics:

**Function Performance:**
```
cloud.googleapis.com/functions/execution_times (95th percentile)
cloud.googleapis.com/functions/execution_count
cloud.googleapis.com/functions/user_memory_bytes
```

**Firestore Usage:**
```
firestore.googleapis.com/document/write_count (filter: ai_evals)
firestore.googleapis.com/api/request_count
```

**Error Tracking:**
```
logging.googleapis.com/user/error_rate
logging.googleapis.com/log_entry_count (filter: severity>=ERROR)
```

### Alert Policies

Set up Cloud Monitoring alerts:

1. **High Error Rate**:
   - Condition: Error rate > 1% for 5 minutes
   - Notification: Email + Slack

2. **High Latency**:
   - Condition: P95 > 500ms for 10 minutes
   - Notification: Email

3. **Firestore Quota**:
   - Condition: Write operations > 90% of quota
   - Notification: Email + Slack (urgent)

---

## 🧪 Canary Test Scenarios

Run these tests at each phase:

### **Phase 1 Tests (10% - T0 to T0+2h)**

1. **Basic Logging**:
   ```javascript
   await logAiEval({
     model: 'canary-test',
     prompt: 'Test prompt',
     output: 'Test output',
     latencyMs: 100,
     costUsd: 0.001
   });
   // Expected: Success, quality=100, flagged=false
   ```

2. **Toxic Content**:
   ```javascript
   await logAiEval({
     model: 'canary-test',
     prompt: 'Test',
     output: 'hate kill murder',
     latencyMs: 100,
     costUsd: 0.001
   });
   // Expected: Success, flagged=true, toxicity>50
   ```

### **Phase 2 Tests (50% - T0+2h to T0+6h)**

3. **Load Test**:
   ```javascript
   // Send 100 evaluations rapidly
   for (let i = 0; i < 100; i++) {
     logAiEval({ ... });
   }
   // Expected: All succeed, P95 < 250ms
   ```

### **Phase 3 Tests (100% - T0+6h to T0+24h)**

4. **Cleanup Verification**:
   ```bash
   # After 24h, verify cleanup job ran
   gcloud logging read "aiGovCleanup" --limit 10
   # Expected: Log entry showing cleanup completed
   ```

---

## 📝 Canary Checklist

Use this checklist during rollout:

### Pre-Canary
- [ ] All Functions deployed successfully
- [ ] Firestore rules deployed
- [ ] HMAC secret configured
- [ ] Admin claim verified
- [ ] Pre-flight checklist complete (SPRINT-13-DEPLOYMENT.md)

### T0 (10%)
- [ ] Config set: `enabled=true, sampleRate=0.10`
- [ ] Dashboard loads
- [ ] First evaluations logged
- [ ] Zero deployment errors

### T0+30m (10% Health Check)
- [ ] Error rate < 1%
- [ ] P95 latency < 500ms
- [ ] Flagged rate < 15%
- [ ] Dashboard functional

### T0+2h (50% Ramp)
- [ ] Config updated: `sampleRate=0.5`
- [ ] Increased volume observed
- [ ] No quota errors
- [ ] Error rate < 0.5%

### T0+6h (100% Rollout)
- [ ] Config updated: `sampleRate=1.0`
- [ ] All evaluations logged
- [ ] P95 latency < 250ms
- [ ] Flagged rate < 10%

### T0+24h (Review)
- [ ] Cleanup job ran successfully
- [ ] Alert job running hourly
- [ ] False positive rate < 5%
- [ ] All SLOs met
- [ ] Release tagged: `v13.0.0`

---

## 🔗 Related Documentation

- [SPRINT-13-DEPLOYMENT.md](./SPRINT-13-DEPLOYMENT.md) - Deployment guide
- [SPRINT-13-TESTING.md](./SPRINT-13-TESTING.md) - Test scenarios
- [CHANGELOG.md](../CHANGELOG.md) - Release notes

---

**Status Tracking:** Update this document with actual metrics during rollout for post-mortem analysis.
