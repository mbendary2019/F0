# 🧪 Phase 33.3 Manual Testing Guide

**Before deployment, perform these manual tests (~15 minutes)**

---

## ✅ Test 1: Cron Job Sanity (Manual Trigger)

### 1.1 Auto-Policy Tuner (24h cycle)

**Simulate manually:**

```bash
# Create test data in rl_outcomes
firebase firestore:add rl_outcomes \
  '{"ts":'$(date +%s000 -d "7 days ago")',"reward":0.5,"mttr_minutes":15}' \
  '{"ts":'$(date +%s000 -d "1 day ago")',"reward":0.7,"mttr_minutes":10}'

# Trigger function locally (if using emulators)
curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/autoPolicyTuner

# Or check logs after first 24h cycle
firebase functions:log --only autoPolicyTuner --limit 20
```

**Expected:**
- ✅ Function analyzes 7-day vs 1-day performance
- ✅ Calculates `rewardDelta` and `mttrDelta`
- ✅ Updates `rl_policy` with new `tuning.alpha` and `tuning.lr`
- ✅ Creates audit log entry: `policy_auto_tuned`

**Verify:**
```bash
# Check rl_policy updated
firebase firestore:get rl_policy/global

# Check audit log
firebase firestore:query admin_audit \
  --where action == policy_auto_tuned \
  --order ts desc \
  --limit 1
```

---

### 1.2 Guardrail Adapter (12h cycle)

**Test Case A: High Risk (>20%) → Tighten**

```bash
# Create high-risk decisions (25%)
for i in {1..4}; do
  firebase firestore:add rl_decisions \
    '{"ts":'$(date +%s000)',"decision":{"risk":"high"},"approval_status":"pending"}'
done

for i in {1..16}; do
  firebase firestore:add rl_decisions \
    '{"ts":'$(date +%s000)',"decision":{"risk":"low"},"approval_status":"auto_approved"}'
done

# Trigger function
# (Wait 12h or trigger manually if using emulators)

# Check result
firebase firestore:get ops_policies/protected_targets
```

**Expected:**
- ✅ High risk rate = 20%+ (4/20)
- ✅ `targets` array expanded with `production_critical`, etc.
- ✅ `reason` = `high_risk_rate`
- ✅ Audit log: `guardrail_adapted`

**Test Case B: Low Risk (<5%) → Relax**

```bash
# Create low-risk decisions (3%)
for i in {1..3}; do
  firebase firestore:add rl_decisions \
    '{"ts":'$(date +%s000)',"decision":{"risk":"high"},"approval_status":"pending"}'
done

for i in {1..97}; do
  firebase firestore:add rl_decisions \
    '{"ts":'$(date +%s000)',"decision":{"risk":"low"},"approval_status":"auto_approved"}'
done

# Trigger function
# Check result
firebase firestore:get ops_policies/protected_targets
```

**Expected:**
- ✅ High risk rate = 3% (3/100)
- ✅ `targets` array shrinks (removes extra protections)
- ✅ `reason` = `risk_low_stable`

---

### 1.3 Meta-Learner (72h cycle)

**Create test policy versions:**

```bash
# Version 1 (poor)
firebase firestore:add rl_policy_versions \
  '{
    "version":"v1.0",
    "tuning":{"alpha":0.8,"lr":0.03},
    "since":'$(date +%s000 -d "7 days ago")',
    "avgReward":0.4,
    "avgRisk":0.3,
    "decisions":100,
    "performance":{"successRate":0.6}
  }'

# Version 2 (best)
firebase firestore:add rl_policy_versions \
  '{
    "version":"v1.1",
    "tuning":{"alpha":0.5,"lr":0.05},
    "since":'$(date +%s000 -d "3 days ago")',
    "avgReward":0.75,
    "avgRisk":0.15,
    "decisions":200,
    "performance":{"successRate":0.85}
  }'

# Version 3 (good)
firebase firestore:add rl_policy_versions \
  '{
    "version":"v1.2",
    "tuning":{"alpha":0.6,"lr":0.04},
    "since":'$(date +%s000 -d "1 day ago")',
    "avgReward":0.65,
    "avgRisk":0.2,
    "decisions":150,
    "performance":{"successRate":0.75}
  }'

# Trigger function (wait 72h or manual)
# Check champion selection
firebase firestore:get rl_policy/global
```

**Expected:**
- ✅ Calculates scores:
  - v1.0: (0.4×0.6)+(0.6×0.3)-(0.3×0.1) = 0.39
  - v1.1: (0.75×0.6)+(0.85×0.3)-(0.15×0.1) = 0.69 ⭐
  - v1.2: (0.65×0.6)+(0.75×0.3)-(0.2×0.1) = 0.595
- ✅ Selects v1.1 as champion
- ✅ Updates `rl_policy/global` with v1.1 tuning
- ✅ Sets `championAt`, `fromVersion`, `championScore`
- ✅ Marks v1.1 as `isChampion: true` in versions collection
- ✅ Audit log: `policy_champion_selected`

---

### 1.4 Auto-Documentation (24h cycle)

**Trigger and verify:**

```bash
# Wait 24h or trigger manually
# Check auto-doc log
firebase firestore:get auto_docs/AUTO_POLICY_LOG
```

**Expected:**
- ✅ `log` field contains markdown entries
- ✅ Format: `## YYYY-MM-DD\n**Policy:**\n- Alpha: ...\n**Guardrails:**\n...`
- ✅ `entryCount` increments
- ✅ `lastUpdated` timestamp updated
- ✅ Audit log: `auto_doc_updated`

---

## ✅ Test 2: Guardrails Thresholds

### Scenario A: High Risk (25%) → Tighten

```bash
# Already tested above in 1.2
# Verify targets array expanded
```

### Scenario B: Low Risk (3%) → Relax

```bash
# Already tested above in 1.2
# Verify targets array shrunk
```

### Scenario C: Medium Risk (15%) → No Change

```bash
# Create medium-risk decisions
for i in {1..15}; do
  firebase firestore:add rl_decisions \
    '{"ts":'$(date +%s000)',"decision":{"risk":"high"},"approval_status":"pending"}'
done

for i in {1..85}; do
  firebase firestore:add rl_decisions \
    '{"ts":'$(date +%s000)',"decision":{"risk":"low"},"approval_status":"auto_approved"}'
done

# Trigger guardrailAdapt
# Check ops_policies/protected_targets
```

**Expected:**
- ✅ High risk rate = 15% (between 5% and 20%)
- ✅ No changes to `targets` array
- ✅ Audit log might still record "no change needed"

---

## ✅ Test 3: Rollback Path

### 3.1 Create Canary Version (Bad)

```bash
# Visit /admin/policies
# Manually tune: alpha=1.2, lr=0.15, reason="Testing canary"
# Or via API:
curl -X POST https://your-domain.com/api/admin/policies/tune \
  -H "Cookie: session=YOUR_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"alpha":1.2,"lr":0.15,"reason":"Testing canary"}'
```

**Expected:**
- ✅ Policy updated with canary values
- ✅ Audit log: `policy_tuned_manual`

---

### 3.2 Simulate Failure

```bash
# Create poor outcomes for canary
for i in {1..10}; do
  firebase firestore:add rl_outcomes \
    '{
      "ts":'$(date +%s000)',
      "reward":-0.5,
      "mttr_minutes":30,
      "decision_id":"test_canary_'$i'"
    }'
done

# Wait for autoPolicyTuner (24h) or check manually
```

**Expected:**
- ✅ Auto-tuner detects poor performance
- ✅ Adjusts hyperparameters (increases alpha, reduces lr)
- ✅ Audit log shows tuning correction

---

### 3.3 Manual Rollback

```bash
# Get previous version ID from /admin/policies
# Or query:
firebase firestore:query rl_policy_versions \
  --where isChampion == true \
  --limit 1

# Rollback via UI or API:
curl -X PATCH https://your-domain.com/api/admin/policies/tune \
  -H "Cookie: session=YOUR_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"versionId":"VERSION_ID_HERE"}'
```

**Expected:**
- ✅ Policy reverted to previous version
- ✅ `tuning` matches old version
- ✅ `rolledBackAt` timestamp set
- ✅ Audit log: `policy_rolled_back` with `versionId`, `reason`

**Verify metrics:**
```bash
# Check pre-rollback state
firebase firestore:get rl_policy/global

# After rollback
firebase firestore:get rl_policy/global

# Verify:
# - tuning.alpha reverted
# - tuning.lr reverted
# - fromVersion updated
# - rolledBackAt set
```

---

## ✅ Test 4: RBAC (Viewer Restrictions)

### 4.1 Create Test Viewer User

```bash
# In Firebase Console → Authentication
# Create user: viewer@test.com

# In Firestore: admins collection
firebase firestore:set admins/VIEWER_UID \
  '{"role":"viewer","createdAt":'$(date +%s000)',"email":"viewer@test.com"}'
```

### 4.2 Test Viewer Restrictions

**Attempt to tune policy (should FAIL):**

```bash
# Login as viewer user (get session cookie)
# Then attempt:
curl -X POST https://your-domain.com/api/admin/policies/tune \
  -H "Cookie: session=VIEWER_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"alpha":0.7,"lr":0.06}'
```

**Expected:**
- ❌ 403 Forbidden (if assertAdminReq checks role)
- ✅ Error: "Admin access required" or similar
- ✅ No policy changes
- ✅ Audit log might record attempted unauthorized access

**Attempt to rollback (should FAIL):**

```bash
curl -X PATCH https://your-domain.com/api/admin/policies/tune \
  -H "Cookie: session=VIEWER_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"versionId":"some_version"}'
```

**Expected:**
- ❌ 403 Forbidden
- ✅ No rollback performed

**Read-only access (should SUCCEED):**

```bash
curl https://your-domain.com/api/admin/policies/history \
  -H "Cookie: session=VIEWER_SESSION"
```

**Expected:**
- ✅ 200 OK
- ✅ Returns policy history
- ✅ Viewer can view but not modify

---

### 4.3 Test Admin User

**Create admin user:**

```bash
firebase firestore:set admins/ADMIN_UID \
  '{"role":"admin","createdAt":'$(date +%s000)',"email":"admin@test.com"}'
```

**Attempt to tune policy (should SUCCEED):**

```bash
curl -X POST https://your-domain.com/api/admin/policies/tune \
  -H "Cookie: session=ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"alpha":0.6,"lr":0.05,"reason":"Admin test"}'
```

**Expected:**
- ✅ 200 OK
- ✅ Policy updated
- ✅ Audit log: `policy_tuned_manual` with admin UID

---

## ✅ Test 5: Docs Presence & Dashboard Integration

### 5.1 Check Documentation Files

```bash
# Verify all 4 docs exist
ls -lh docs/PHASE_33_3_SELF_EVOLVING_OPS.md
ls -lh PHASE_33_3_COMPLETE_SUMMARY.md
ls -lh AUTONOMOUS_OPS_COMPLETE_GUIDE.md
ls -lh PHASE_33_3_READY.txt
```

**Expected:**
- ✅ All 4 files exist
- ✅ Each ≥5KB (non-empty)
- ✅ Contains relevant content

---

### 5.2 Dashboard Integration

**Visit /admin/policies:**

```bash
open https://your-domain.com/admin/policies
# or locally:
open http://localhost:3000/admin/policies
```

**Check UI sections:**

1. **Current Tuning**
   - ✅ Displays current alpha
   - ✅ Displays current lr
   - ✅ Shows last updated time
   - ✅ Shows updatedBy (system or UID)
   - ✅ Auto-tuned badge if system updated
   - ✅ Manual tuning controls work
   - ✅ Save button functional
   - ✅ Reason input field

2. **Dynamic Guardrails**
   - ✅ Lists protected targets
   - ✅ Shows last adaptation timestamp
   - ✅ Shows adaptation reason
   - ✅ Shows high risk rate %

3. **Policy Versions**
   - ✅ Table with version history
   - ✅ Champion badge (👑) on current champion
   - ✅ Rollback button on each version
   - ✅ Avg reward displayed
   - ✅ Decision count displayed

4. **Recent Auto-Tuning Events**
   - ✅ Lists recent audit events
   - ✅ Shows timestamps
   - ✅ Shows action types
   - ✅ Expandable metadata

5. **Auto-Documentation Log**
   - ✅ Markdown content displayed
   - ✅ Entry count shown
   - ✅ Scrollable area
   - ✅ Latest entries at top

---

### 5.3 API Integration Test

**Test history API:**

```bash
curl https://your-domain.com/api/admin/policies/history \
  -H "Cookie: session=ADMIN_SESSION"
```

**Expected response:**
```json
{
  "policy": {
    "tuning": {
      "alpha": 0.5,
      "lr": 0.05,
      "updatedAt": 1697040000000,
      "updatedBy": "system"
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
  "versions": [...],
  "recentEvents": [...]
}
```

**Test tune API:**

```bash
curl -X POST https://your-domain.com/api/admin/policies/tune \
  -H "Cookie: session=ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"alpha":0.55,"lr":0.06,"reason":"Test"}'
```

**Expected response:**
```json
{
  "ok": true,
  "tuning": {
    "alpha": 0.55,
    "lr": 0.06,
    "updatedAt": 1697040000000,
    "updatedBy": "ADMIN_UID",
    "reason": "Test"
  }
}
```

---

## ✅ Test 6: End-to-End Scenario

**Complete workflow test:**

1. **Deploy** → `./PHASE_33_3_DEPLOYMENT.sh`
2. **Wait 24h** → First auto-tuning cycle
3. **Check dashboard** → Verify tuning updated
4. **Wait 12h** → First guardrail adaptation
5. **Check guardrails** → Verify targets adjusted
6. **Wait 72h** → First champion selection
7. **Check versions** → Verify champion badge
8. **Manual override** → Set alpha=0.8
9. **Check audit log** → Verify manual entry
10. **Rollback** → Revert to previous version
11. **Verify** → Policy restored

**Expected timeline:**
```
Day 0: Deploy ✅
Day 1: Auto-tuning #1 ✅
       Guardrail adapt #1 ✅
       Auto-doc #1 ✅
Day 2: Auto-tuning #2 ✅
       Guardrail adapt #2, #3 ✅
       Auto-doc #2 ✅
Day 3: Champion selection #1 ✅
       Auto-tuning #3 ✅
       Guardrail adapt #4, #5 ✅
       Auto-doc #3 ✅
```

---

## 📊 Success Criteria

All tests should pass with:

- ✅ 4 functions deployed and scheduled correctly
- ✅ Guardrails tighten at >20% high-risk
- ✅ Guardrails relax at <5% high-risk
- ✅ Champion selection works (best score wins)
- ✅ Auto-documentation generates markdown logs
- ✅ Manual tuning works via UI
- ✅ Rollback restores previous version
- ✅ RBAC blocks viewer from write operations
- ✅ RBAC allows admin full access
- ✅ All 4 documentation files present
- ✅ Dashboard displays all 5 sections correctly
- ✅ Complete audit trail for all changes

---

**If all tests pass: ✅ READY FOR PRODUCTION!** 🚀

**If any test fails: Fix issues and re-test.** 🔧

---

**Test Duration:** ~15 minutes  
**Author:** medo bendary  
**Date:** 2025-10-11  
**Version:** v33.3.0


