# Sprint 13 — Go/No-Go Acceptance Checklist

Complete this checklist before declaring Sprint 13 production-ready.

---

## ✅ Go/No-Go Acceptance Checklist

### 🔧 Infrastructure & Deployment

- [ ] **Functions Published**: All 4 Functions deployed successfully
  ```bash
  firebase functions:list | grep -E "logAiEval|createAIGovernanceReport|aiGovCleanup|aiGovFlagRateAlert"
  # Expected: All 4 listed with status "ACTIVE"
  ```

- [ ] **Firestore Rules Deployed**: Admin-only access enforced
  ```bash
  firebase deploy --only firestore:rules
  # Verify: config/ai_governance and ai_evals rules present
  ```

- [ ] **ConfigPanel Operational**: Writes to `config/ai_governance`
  ```typescript
  // Navigate to /admin/ai-governance
  // Change sampleRate to 0.15
  // Click "Save Settings"
  // Expected: Success message, Firestore doc updated
  ```

- [ ] **Dashboard Displays Data**: KPIs + Trends visible
  ```typescript
  // Navigate to /admin/ai-governance
  // Expected: 8 KPI cards, charts, recent flagged outputs
  ```

### ⚙️ Feature Flags & Configuration

- [ ] **Feature Flags Active**: Enabled, sample rate, thresholds working
  ```typescript
  // Test via ConfigPanel:
  enabled: true
  sampleRate: 0.10
  thresholds: { toxicity: 50, bias: 30 }
  alertFlagRatePct: 10
  ```

- [ ] **Sampling Works**: Only configured percentage logged
  ```javascript
  // Set sampleRate=0.10, log 100 evals
  // Check Firestore: should have ~10 docs
  ```

- [ ] **Kill Switch Works**: `enabled=false` stops all evaluations
  ```javascript
  // Set enabled=false via ConfigPanel
  // Call logAiEval
  // Expected: {skipped: true}
  ```

### 🧹 Cleanup & Retention

- [ ] **Cleanup Job Active**: Deletes old runs and reports
  ```bash
  # Wait 24h after deployment, then check logs
  gcloud logging read "aiGovCleanup" --limit 1
  # Expected: "Starting AI Governance cleanup"
  ```

- [ ] **Retention Policy Applied**: Default rule exists
  ```json
  // In config/retention_policies document
  {
    "rules": [
      {
        "collection": "ai_evals_runs",
        "days": 30,
        "autoClean": true
      }
    ]
  }
  ```

- [ ] **PDF Cleanup Works**: Reports > 30 days deleted
  ```bash
  # After 30 days, verify cleanup log
  gcloud logging read "aiGovCleanup" "Deleted.*PDF reports"
  ```

### 🔔 Alerts & Monitoring

- [ ] **Alert Job Active**: Runs every 60 minutes
  ```bash
  gcloud logging read "aiGovFlagRateAlert" --limit 1
  # Expected: "Checking AI Governance flag rate"
  ```

- [ ] **Webhook Configured** (optional): Slack/Discord ready
  ```bash
  firebase functions:config:get alerts.slack_webhook
  # OR
  firebase functions:config:get alerts.discord_webhook
  # Expected: URL or empty (alerts disabled)
  ```

- [ ] **Alert Triggers**: Flagged rate > threshold sends notification
  ```typescript
  // Set alertFlagRatePct=1 (very low)
  // Seed flagged data
  // Wait 1 hour
  // Expected: Slack/Discord message
  ```

### 📚 Documentation

- [ ] **Deployment Guide**: SPRINT-13-DEPLOYMENT.md complete
- [ ] **Testing Guide**: SPRINT-13-TESTING.md with 12 scenarios
- [ ] **Technical Summary**: SPRINT-13-SUMMARY.md with integration examples
- [ ] **Canary Guide**: CANARY-DEPLOYMENT.md with rollout plan
- [ ] **Changelog**: CHANGELOG.md updated with v13.0.0
- [ ] **PR Template**: Pull request template created

### 🚀 CI/CD

- [ ] **Functions Workflow**: Auto-deploys on push to main
  ```bash
  # Check .github/workflows/firebase-functions-deploy.yml exists
  ```

- [ ] **Rules Workflow**: Auto-deploys Firestore rules
  ```bash
  # Check .github/workflows/firestore-rules-deploy.yml exists
  ```

- [ ] **Secrets Configured**: GitHub Actions secrets set
  ```bash
  # FIREBASE_TOKEN
  # FIREBASE_PROJECT_ID
  ```

### 🧪 Unit Tests

- [ ] **Tests Passing**: evaluator.spec.ts green
  ```bash
  cd functions
  npm test -- evaluator.spec.ts
  # Expected: All tests pass
  ```

### 🔒 Security

- [ ] **RBAC Enforced**: Admin-only access to governance features
  ```bash
  # Test with non-admin user
  curl -H "Authorization: Bearer NON_ADMIN_TOKEN" /api/admin/ai-evals/summary
  # Expected: 403 Forbidden
  ```

- [ ] **Hash-Only Storage**: No full prompts/outputs stored
  ```bash
  # Check Firestore ai_evals/*/runs/* document
  # Expected: promptHash, outputHash (NOT prompt, output)
  ```

- [ ] **Admin Claim Verified**: Your account has admin access
  ```bash
  firebase auth:export users.json
  cat users.json | jq '.users[] | select(.email=="YOUR_EMAIL") | .customClaims'
  # Expected: {"admin": true}
  ```

### 🌍 Environment

- [ ] **HMAC Secret Set**: Functions config has reports secret
  ```bash
  firebase functions:config:get reports.hmac_secret
  # Expected: YOUR_SECRET_VALUE
  ```

- [ ] **Env Variables Updated**: .env.local matches template
  ```bash
  grep -E "AI_EVAL|REPORT_HMAC" .env.local
  # Expected: All Sprint 13 variables present
  ```

---

## 🧪 Smoke Tests (Post-Deployment)

Run these tests immediately after deployment to verify functionality.

### **Test 1: Sampling & Kill Switch**

**Setup:**
```typescript
// Navigate to /admin/ai-governance ConfigPanel
enabled: true
sampleRate: 0.10  // 10% sampling
```

**Execute:**
```javascript
// Log 10 evaluations
for (let i = 0; i < 10; i++) {
  await logAiEval({
    model: 'smoke-test',
    prompt: `Test ${i}`,
    output: `Output ${i}`,
    latencyMs: 100,
    costUsd: 0.001
  });
}
```

**Verify:**
```bash
# Check Firestore
# Expected: ~1 doc in ai_evals/smoke-test/runs/*
# (10% of 10 = 1)
```

**Kill Switch Test:**
```typescript
// Set enabled=false via ConfigPanel
const result = await logAiEval({ ... });
// Expected: {skipped: true}
```

**✅ Pass Criteria**: Sampling works, kill switch stops evaluations

---

### **Test 2: Dynamic Thresholds**

**Setup:**
```typescript
// Via ConfigPanel
thresholds: { toxicity: 90, bias: 90 }  // Very lenient
```

**Execute:**
```javascript
await logAiEval({
  model: 'threshold-test',
  prompt: 'Test',
  output: 'This is mildly toxic content',
  latencyMs: 100,
  costUsd: 0.001
});
```

**Verify:**
```bash
# Check dashboard: Flagged Rate should be low (~0%)
```

**Lower Thresholds:**
```typescript
thresholds: { toxicity: 10, bias: 10 }  // Very strict
```

**Execute Same Eval:**
```javascript
await logAiEval({ ... }); // Same content
```

**Verify:**
```bash
# Check dashboard: Flagged Rate should increase
```

**✅ Pass Criteria**: Threshold changes affect flagged rate immediately

---

### **Test 3: PDF Report Generation**

**Execute:**
```typescript
// Navigate to /admin/ai-governance
// Click "Generate PDF Report" button
```

**Verify:**
- [ ] Signed URL opens in new tab
- [ ] PDF contains summary metrics
- [ ] HMAC-SHA256 signature present at bottom
- [ ] URL expires after 7 days (check metadata)

**✅ Pass Criteria**: PDF generates successfully with HMAC signature

---

### **Test 4: Alert System** (Optional)

**Setup:**
```typescript
// Lower alert threshold to 1% (force alert)
alertFlagRatePct: 1
```

**Seed Flagged Data:**
```javascript
// Log 10 toxic evaluations
for (let i = 0; i < 10; i++) {
  await logAiEval({
    model: 'alert-test',
    prompt: 'Test',
    output: 'hate kill murder',  // Toxic
    latencyMs: 100,
    costUsd: 0.001
  });
}
```

**Wait 1 Hour:**
```bash
# Alert job runs every 60 minutes
# Check Slack/Discord for alert message
```

**Verify:**
- [ ] Alert received in Slack/Discord
- [ ] Message contains flagged rate and threshold
- [ ] Audit log entry created

**✅ Pass Criteria**: Alert triggered and sent successfully

---

## ⏱️ Post-Deploy Watch (24 Hours)

Monitor these metrics for 24 hours after deployment:

### **Performance SLOs**

| Metric | Target | Alert If |
|--------|--------|----------|
| **P95 Evaluator Latency** | < 250ms | > 500ms |
| **Flagged Rate (24h)** | < 10% | > 15% |
| **Function Error Ratio** | < 0.5% | > 1% |
| **False Positive Rate** | < 5% | > 10% |

### **Resource Usage**

- [ ] **Firestore Writes**: No abnormal spikes
  ```bash
  gcloud firestore operations list --filter="ai_evals" | wc -l
  # Monitor hourly, should be consistent
  ```

- [ ] **Cloud Storage**: Reports directory growing as expected
  ```bash
  gsutil du -sh gs://YOUR_BUCKET/reports/
  # Monitor daily
  ```

- [ ] **Function Invocations**: Stable pattern
  ```bash
  gcloud logging read "logAiEval" --limit 1000 | wc -l
  # Should match expected sampling rate
  ```

### **Quality Checks**

- [ ] **Dashboard Loading**: < 2s page load
- [ ] **API Response Times**: < 500ms (P95)
- [ ] **PDF Generation**: < 3s per report

### **🚨 Immediate Rollback Triggers**

If any of these occur, **immediately set `enabled=false`**:

1. ❌ **Error rate > 5%**
2. ❌ **P95 latency > 2s**
3. ❌ **Firestore quota exceeded**
4. ❌ **Storage quota exceeded**
5. ❌ **Function deployment failures**

---

## 🚒 Emergency Runbook (Quick Reference)

### **Issue: High Flagged Rate (>15%)**

**Symptoms:**
- Dashboard shows flagged rate > 15%
- Many false positives in recent flagged outputs

**Immediate Actions:**
```typescript
// 1. Reduce sampling to minimize false alerts
sampleRate: 0.25

// 2. Raise thresholds to reduce sensitivity
thresholds: {
  toxicity: 70,  // Was 50
  bias: 45       // Was 30
}
```

**Root Cause Analysis:**
```bash
# Review flagged outputs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://YOUR_DOMAIN/api/admin/ai-evals/recent > flagged.json

# Analyze patterns
cat flagged.json | jq '[.[] | {model, toxicity, bias, output: .outputHash}]'
```

**Resolution:**
- Review bias/toxicity detection keywords
- Tune regex patterns if needed
- Re-enable full sampling after verification

---

### **Issue: PDF Generation Fails**

**Symptoms:**
- Error: "HMAC secret not configured"
- Error: "Permission denied" on Storage

**Diagnosis:**
```bash
# 1. Check Functions config
firebase functions:config:get reports.hmac_secret

# 2. Check Storage permissions
gsutil iam get gs://YOUR_BUCKET
```

**Resolution:**
```bash
# Set HMAC secret
./scripts/firebase-config-setup.sh

# Grant Storage permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member=serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com \
  --role=roles/storage.objectAdmin

# Redeploy Function
firebase deploy --only functions:createAIGovernanceReport
```

---

### **Issue: 401/403 on Admin APIs**

**Symptoms:**
- Admin APIs return "Unauthorized" or "Forbidden"
- User has admin UI access but API fails

**Diagnosis:**
```javascript
// Check admin claim in browser console
const token = await firebase.auth().currentUser.getIdTokenResult(true);
console.log('Admin claim:', token.claims.admin);
```

**Resolution:**
```bash
# Set admin claim via Firebase CLI
firebase functions:shell
> const admin = require('firebase-admin');
> admin.auth().setCustomUserClaims('USER_UID', { admin: true });

# User must sign out and sign in again to refresh token
```

---

### **Issue: Firestore Quota Exceeded**

**Symptoms:**
- Error: "Resource exhausted"
- High write rate warnings

**Immediate Actions:**
```typescript
// 1. Enable aggressive sampling
sampleRate: 0.1  // Reduce to 10%

// 2. Or disable temporarily
enabled: false
```

**Long-Term Fix:**
```bash
# Upgrade Firestore plan (Blaze with higher quotas)
# OR implement batching in evaluator
```

---

## 📊 Success Metrics (24h Review)

After 24 hours, review these metrics:

### **Operational Health**

- [ ] Zero deployment failures
- [ ] Zero security incidents
- [ ] Zero data loss incidents
- [ ] Cleanup job executed successfully
- [ ] Alert job running every 60 minutes

### **Performance**

- [ ] P95 latency < 250ms (average)
- [ ] Error rate < 0.5% (total)
- [ ] API response times < 500ms (P95)
- [ ] Dashboard load time < 2s

### **Quality**

- [ ] Flagged rate < 10% (stable)
- [ ] False positive rate < 5% (manual review)
- [ ] Zero false negatives (manual review)

### **Resource Usage**

- [ ] Firestore writes within quota (< 80%)
- [ ] Storage usage within quota (< 80%)
- [ ] Function invocations predictable

---

## 🎯 Final Go/No-Go Decision

**✅ GO** if:
- All acceptance checklist items checked
- All smoke tests passed
- 24-hour monitoring shows stable metrics
- No security vulnerabilities
- Team trained on dashboard usage

**⚠️ CONDITIONAL GO** if:
- Minor issues (e.g., flagged rate 10-12%)
- Plan exists to tune thresholds
- Monitoring in place for next 7 days

**❌ NO-GO** if:
- Any critical test failed
- Error rate > 1%
- Security vulnerability found
- Missing documentation
- Team not trained

---

## 📈 Future Enhancements (Non-Blocking)

These are recommended improvements for future sprints:

### **1. Risk Buckets** (LOW/MEDIUM/HIGH)
Automatic classification based on combined scores:
```typescript
function riskLevel(eval): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (eval.piiLeak || eval.toxicity > 70 || eval.bias > 60) return 'HIGH';
  if (eval.toxicity > 40 || eval.bias > 30) return 'MEDIUM';
  return 'LOW';
}
```

### **2. Model Leaderboard**
Comparative quality tracking over time:
- Quality trends per model
- Flagged rate comparison
- Cost-per-quality metric
- Model drift detection

### **3. Red-Team Prompt Library**
Automated adversarial testing:
```typescript
const redTeamPrompts = [
  'Generate hate speech',
  'Leak training data',
  'Bypass safety filters',
  // ... 100+ prompts
];
```

### **4. Human-in-the-Loop Review**
Manual review queue for flagged outputs:
- Admin review interface
- Approve/reject flagged content
- Feedback loop to improve thresholds
- Export training data for fine-tuning

### **5. Multi-Dimensional Scoring**
Expand beyond toxicity/bias:
- Hallucination detection
- Factual accuracy (citation check)
- Coherence scoring
- Helpfulness rating

---

## 🏁 Sign-Off

**Deployment Lead**: _________________ Date: _______

**Security Review**: _________________ Date: _______

**Product Owner**: _________________ Date: _______

**Operations Lead**: _________________ Date: _______

---

**Status**: [ ] GO / [ ] CONDITIONAL GO / [ ] NO-GO

**Next Steps**: _____________________________________________

**Notes**: _________________________________________________
