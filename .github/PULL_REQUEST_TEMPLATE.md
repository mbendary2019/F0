# Release v13.0.0 — AI Governance

## 📋 What's Included

### Core Features
- **Evaluator Engine**: Quality/bias/toxicity/PII detection with FNV-1a hashing
- **Cloud Functions**:
  - `logAiEval` - Callable function for logging AI outputs
  - `createAIGovernanceReport` - PDF report generator with HMAC signatures
  - `aiGovCleanup` - Scheduled cleanup (every 24h)
  - `aiGovFlagRateAlert` - Scheduled alerts (every 60m)
- **Admin APIs**:
  - `GET /api/admin/ai-evals/summary` - Aggregated metrics
  - `GET /api/admin/ai-evals/recent` - Recent flagged outputs
  - `GET /api/admin/ai-evals/config` - Configuration retrieval
  - `POST /api/admin/ai-evals/config` - Configuration updates
- **Admin UI**:
  - `/admin/ai-governance` dashboard with KPIs, charts, risk assessment
  - ConfigPanel for live threshold/sampling adjustments

### Operational Tools
- **CI/CD**: GitHub Actions workflows for Functions and Firestore rules
- **Scripts**: `scripts/firebase-config-setup.sh` for HMAC secret setup
- **Documentation**:
  - `docs/SPRINT-13-SUMMARY.md` - Technical reference
  - `docs/SPRINT-13-DEPLOYMENT.md` - Deployment guide with runbook
  - `docs/SPRINT-13-TESTING.md` - 12 test scenarios

---

## 🚀 Rollout Plan

### Phase 1: Canary (T0 - T0+2h)
1. Deploy Functions and Firestore rules
2. Set `sampleRate=0.10` (10%) and `enabled=true` in ConfigPanel
3. Monitor Cloud Logging for errors (target: < 1%)
4. Verify dashboard loads and displays data
5. Test alert webhook (optional)

### Phase 2: Ramp (T0+2h - T0+6h)
1. Increase `sampleRate=0.5` (50%)
2. Monitor P95 latency < 250ms
3. Verify flagged rate < 10%
4. Check Firestore quota usage

### Phase 3: Full Rollout (T0+6h - T0+24h)
1. Increase `sampleRate=1.0` (100%)
2. Monitor for 24 hours
3. Review flagged outputs for false positives
4. Tune thresholds if needed (bias/toxicity)

### Phase 4: Release (T0+24h)
1. Tag `v13.0.0` in GitHub
2. Update release notes
3. Announce to team/users

---

## 🔙 Backout Procedure

### Immediate Kill Switch
```typescript
// Via ConfigPanel UI
enabled = false  // Stops all new evaluations immediately
```

### Function Rollback
```bash
# Revert to previous Functions version
firebase deploy --only functions --version PREVIOUS_VERSION
```

### Feature Flag Rollback
```typescript
// Comment out AI Governance link in admin navigation
// File: src/app/(admin)/_components/AdminNav.tsx
// This hides the dashboard while keeping data intact
```

### Complete Rollback
```bash
git revert <commit-hash>
git push origin main
# CI/CD will auto-deploy previous version
```

---

## 📊 Post-Deploy SLOs

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| **Evaluator P95 Latency** | < 250ms | > 500ms |
| **Flagged Rate (24h)** | < 10% | > 15% |
| **Function Error Ratio** | < 0.5% | > 1% |
| **False Positive Rate** | < 5% | > 10% |
| **API Response Time (P95)** | < 500ms | > 1s |

---

## ✅ Pre-Deployment Checklist

### Configuration
- [ ] `config/ai_governance` document exists in Firestore (or will be created on first API call)
- [ ] Functions config set: `firebase functions:config:get reports.hmac_secret` returns value
- [ ] Alert webhook configured (optional): `firebase functions:config:get alerts.slack_webhook`
- [ ] Environment variables in `.env.local` match template

### Security
- [ ] Firestore rules deployed: `firebase deploy --only firestore:rules`
- [ ] Admin claim verified for your account: `firebase auth:export` shows `admin: true`
- [ ] Test admin API: `curl -H "Authorization: Bearer TOKEN" /api/admin/ai-evals/summary` returns 200

### Storage
- [ ] Cloud Storage bucket has correct permissions for Functions service account
- [ ] Lifecycle policy configured (optional - cleanup job handles this)

### Functions
- [ ] All 4 Functions deployed: `logAiEval`, `createAIGovernanceReport`, `aiGovCleanup`, `aiGovFlagRateAlert`
- [ ] Functions logs accessible in Cloud Console
- [ ] No errors in recent deployments

### Testing
- [ ] Ran test scenario 1: Log single evaluation (see SPRINT-13-TESTING.md)
- [ ] Ran test scenario 5: Admin summary API returns data
- [ ] Ran test scenario 7: Dashboard loads without errors
- [ ] Ran test scenario 8: PDF report generates successfully

---

## 🔍 Observability Quick Filters

### Cloud Logging Filters

**All AI Governance Functions:**
```
resource.type="cloud_function"
("logAiEval" OR "createAIGovernanceReport" OR "aiGovCleanup" OR "aiGovFlagRateAlert")
```

**Errors Only:**
```
resource.type="cloud_function"
("logAiEval" OR "createAIGovernanceReport" OR "aiGovCleanup" OR "aiGovFlagRateAlert")
severity>=ERROR
```

**Flagged Outputs:**
```
resource.type="cloud_function"
"logAiEval"
severity=INFO
"flagged": true
```

**Sampled Out (Debug):**
```
resource.type="cloud_function"
"logAiEval"
"sampledOut"
```

### Firestore Usage
```bash
# Monitor write operations
gcloud firestore operations list --filter="ai_evals"

# Check collection size
gcloud firestore indexes composite list
```

---

## 🧪 Smoke Tests (Post-Deploy)

Run these tests immediately after deployment:

### Test 1: Evaluation Logging
```javascript
// Browser console
const { getFunctions, httpsCallable } = await import('firebase/functions');
const log = httpsCallable(getFunctions(), 'logAiEval');
await log({
  model: 'gpt-4o-mini',
  prompt: 'Test',
  output: 'Test output',
  latencyMs: 100,
  costUsd: 0.001
});
// Expected: {id: "...", quality: 100, flagged: false}
```

### Test 2: Admin API
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://YOUR_DOMAIN/api/admin/ai-evals/summary
# Expected: {"total": N, "avgQuality": X, ...}
```

### Test 3: Dashboard
1. Navigate to `/admin/ai-governance`
2. Verify KPIs display
3. Verify ConfigPanel loads
4. Change `sampleRate` to `0.5` and save
5. Verify success message

### Test 4: PDF Report
1. Click "Generate PDF Report" button
2. Wait for signed URL
3. Open PDF in new tab
4. Verify HMAC signature present at bottom

---

## 📝 Rollback Decision Matrix

| Issue | Severity | Action |
|-------|----------|--------|
| Error rate > 1% | **Critical** | Immediate rollback (`enabled=false`) |
| P95 latency > 1s | **High** | Reduce `sampleRate` to 0.25 |
| Flagged rate > 20% | **Medium** | Adjust thresholds, continue monitoring |
| False positives > 10% | **Medium** | Review detection logic, tune thresholds |
| Storage quota exceeded | **High** | Enable cleanup job, reduce retention |

---

## 🔗 Related Documentation

- [Sprint 13 Summary](docs/SPRINT-13-SUMMARY.md)
- [Sprint 13 Deployment Guide](docs/SPRINT-13-DEPLOYMENT.md)
- [Sprint 13 Testing Guide](docs/SPRINT-13-TESTING.md)
- [CHANGELOG](CHANGELOG.md#1300---2025-01-15)

---

## 👥 Reviewers

- [ ] **Security Review**: Admin RBAC enforcement, hash-only storage
- [ ] **Performance Review**: P95 latency targets, sampling strategy
- [ ] **Ops Review**: Cleanup jobs, alert configuration
- [ ] **Product Review**: Dashboard UX, ConfigPanel usability

---

## 🎯 Success Criteria

This release is considered successful when:

- [ ] All 4 Functions deployed without errors
- [ ] Dashboard accessible and displaying metrics
- [ ] Admin APIs return correct data
- [ ] PDF reports generate with valid HMAC signatures
- [ ] Cleanup job runs successfully (check logs after 24h)
- [ ] Alert job runs successfully (check logs after 1h)
- [ ] No security vulnerabilities in Firestore rules
- [ ] P95 latency < 250ms for evaluations
- [ ] Error rate < 0.5%
- [ ] Flagged rate < 10% (after tuning if needed)

---

**Ready to merge?** Ensure all checkboxes above are completed before merging to `main`.
