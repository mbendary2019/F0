# Phase 37 — Pre-Deployment Checklist

Use this checklist before deploying Phase 37 to production.

---

## Pre-Deployment

### Code Review
- [ ] Review all Phase 37 TypeScript code
- [ ] Verify types in [`functions/src/types/meta.ts`](functions/src/types/meta.ts)
- [ ] Check feature flags in [`functions/src/config/flags.ts`](functions/src/config/flags.ts)
- [ ] Confirm `autoActivatePolicies = false` (safety)
- [ ] Review confidence estimation logic in [`confidenceEstimator.ts`](functions/src/learning/confidenceEstimator.ts)
- [ ] Review adaptive router guardrails in [`uncertaintyRouter.ts`](functions/src/learning/uncertaintyRouter.ts)
- [ ] Review scheduler bounds in [`selfTuningScheduler.ts`](functions/src/learning/selfTuningScheduler.ts)

### Firestore Configuration
- [ ] Review new indexes in [`firestore.indexes.json`](firestore.indexes.json)
- [ ] Review new security rules in [`firestore.rules`](firestore.rules) (lines 283-295)
- [ ] Verify `isService()` helper function exists (line 248)
- [ ] Test rules in Firebase Emulator

### Functions Configuration
- [ ] Verify functions exported in [`functions/src/index.ts`](functions/src/index.ts)
- [ ] Check function runtime settings (Node.js version, memory, timeout)
- [ ] Review environment variables (if any)
- [ ] Confirm functions region (us-central1)

### API Endpoints
- [ ] Test `/api/ops/confidence` in staging
- [ ] Test `/api/ops/decisions` in staging
- [ ] Verify authentication middleware (if required)
- [ ] Check CORS configuration (if applicable)

### UI Components
- [ ] Test ConfidenceCards rendering
- [ ] Test DecisionsTable rendering
- [ ] Test decision modal functionality
- [ ] Verify auto-refresh works (60s interval)
- [ ] Check responsive design (mobile, tablet, desktop)

### Documentation
- [ ] Read [PHASE_37_README.md](PHASE_37_README.md)
- [ ] Read [PHASE_37_TESTING_GUIDE.md](PHASE_37_TESTING_GUIDE.md)
- [ ] Review [PHASE_37_QUICK_START.md](PHASE_37_QUICK_START.md)
- [ ] Bookmark [PHASE_37_IMPLEMENTATION_SUMMARY.md](PHASE_37_IMPLEMENTATION_SUMMARY.md)

---

## Deployment

### Pre-Flight
- [ ] Backup current Firestore rules: `cp firestore.rules firestore.rules.backup`
- [ ] Backup current functions: `firebase functions:list > functions-backup.txt`
- [ ] Set project: `firebase use YOUR_PROJECT_ID`
- [ ] Verify project: `firebase projects:list`

### Staging Deploy
- [ ] Run deployment script: `./scripts/deploy-phase37.sh`
- [ ] Monitor deployment logs for errors
- [ ] Verify functions deployed: `firebase functions:list`
- [ ] Check function logs: `firebase functions:log`

### Verification
- [ ] Verify Firestore indexes created (may take 5-10 min)
- [ ] Verify security rules updated
- [ ] Seed test data in `ops_stats`
- [ ] Wait 10 minutes for `refreshConfidence` to run
- [ ] Check `ops_confidence` collection has data
- [ ] Check function logs for errors
- [ ] Test API endpoints return valid JSON
- [ ] Test UI components load without errors

---

## Post-Deployment (First 24 Hours)

### Monitoring
- [ ] Monitor function execution count (should run on schedule)
- [ ] Monitor function errors (should be 0)
- [ ] Monitor function duration (< 30s for refreshConfidence)
- [ ] Monitor Firestore reads/writes (check quota)
- [ ] Monitor `ops_confidence` for score trends
- [ ] Monitor `ops_decisions` for decision rate

### Validation
- [ ] Confidence scores in range [0, 1]? ✅ / ❌
- [ ] Scores update every 10 minutes? ✅ / ❌
- [ ] Draft policies created (not activated)? ✅ / ❌
- [ ] Decisions logged with all fields? ✅ / ❌
- [ ] Guardrails prevent excessive changes? ✅ / ❌
- [ ] No auto-activations? ✅ / ❌
- [ ] API response times < 500ms? ✅ / ❌
- [ ] UI loads without errors? ✅ / ❌

### Performance Baseline
- [ ] Record average confidence scores per component
- [ ] Record decision frequency (decisions/day)
- [ ] Record average reward (24h window)
- [ ] Record p95 latency baseline
- [ ] Record cost baseline

---

## Week 1 Review

### A/B Analysis
- [ ] Sufficient sample size in each bucket (adaptive, control, prod)?
- [ ] Calculate `avgReward` for each bucket
- [ ] Compare adaptive vs control (expect +10-15% uplift)
- [ ] Check p95 latency for each bucket
- [ ] Statistical significance achieved (p < 0.05)?

### Adaptive Behavior
- [ ] How many draft policies created?
- [ ] How many manual activations performed?
- [ ] What's the average confidence of decisions?
- [ ] Any guardrail failures? (Should be 0)
- [ ] Scheduler adjustments reasonable? (within 5-60 min)

### Issues & Incidents
- [ ] Any unintended policy activations?
- [ ] Any excessive decision rate spikes?
- [ ] Any confidence score anomalies?
- [ ] Any API errors or timeouts?
- [ ] Any UI rendering issues?

### Documentation
- [ ] Update runbook with any new findings
- [ ] Document any configuration changes made
- [ ] Log any manual interventions required

---

## Go/No-Go Decision (End of Week 1)

### Go Criteria (Enable Auto-Activation)
- ✅ +10% uplift in adaptive bucket vs control (statistically significant)
- ✅ ≤8% latency increase under load
- ✅ Zero guardrail failures
- ✅ Zero unintended activations
- ✅ Confidence scores stable and reasonable
- ✅ No critical incidents

**If all criteria met:**
```typescript
// Edit functions/src/config/flags.ts
learning.autoActivatePolicies = true;

// Redeploy
firebase deploy --only functions
```

### No-Go Criteria (Rollback)
- ❌ No uplift or negative impact
- ❌ Excessive latency increase
- ❌ Guardrail failures detected
- ❌ Unintended activations
- ❌ Unstable confidence scores
- ❌ Critical incidents

**If any no-go criteria:**
```bash
# Disable adaptive features
# Edit functions/src/config/flags.ts:
adaptive.enabled = false;
scheduler.autoTune = false;

# Redeploy
firebase deploy --only functions
```

---

## Production Deploy (After Staging Success)

### Prerequisites
- [ ] All staging tests passed
- [ ] Week 1 review completed
- [ ] A/B uplift confirmed (if enabling auto-activation)
- [ ] Team signoff obtained
- [ ] Rollback plan reviewed

### Deploy Steps
- [ ] Set production project: `firebase use production`
- [ ] Run deployment script: `./scripts/deploy-phase37.sh`
- [ ] Monitor deployment closely
- [ ] Verify all checks from staging
- [ ] Announce to team in Slack/Discord

### Production Monitoring (First Week)
- [ ] Daily check of confidence scores
- [ ] Daily check of decision rate
- [ ] Daily check of A/B performance
- [ ] Weekly review of adaptive behavior
- [ ] Monthly review of system performance

---

## Rollback Procedures

### Quick Disable (No Uninstall)
```bash
# Edit functions/src/config/flags.ts
adaptive.enabled = false;
scheduler.autoTune = false;

# Redeploy
firebase deploy --only functions
```

**Impact:** Functions stop adapting, existing data preserved

### Full Rollback (Uninstall)
```bash
# Delete Phase 37 functions
firebase functions:delete refreshConfidence
firebase functions:delete adaptiveRouter
firebase functions:delete selfTuningScheduler

# Revert Firestore rules
git checkout HEAD~1 -- firestore.rules
firebase deploy --only firestore:rules
```

**Impact:** Phase 37 fully removed, data preserved for analysis

### Data Cleanup (Optional)
```javascript
// Only if needed, preserve for post-mortem
const db = admin.firestore();

// Archive confidence data
await db.collection('ops_confidence_archive')
  .doc('phase37')
  .set({ archived: Date.now() });

// Clear collections
const batch = db.batch();
const confidence = await db.collection('ops_confidence').get();
confidence.docs.forEach(doc => batch.delete(doc.ref));
await batch.commit();
```

---

## Support Contacts

**Deployment Issues:**
- Check: [PHASE_37_QUICK_START.md](PHASE_37_QUICK_START.md)
- Logs: `firebase functions:log`

**Testing Issues:**
- Check: [PHASE_37_TESTING_GUIDE.md](PHASE_37_TESTING_GUIDE.md)

**Architecture Questions:**
- Check: [PHASE_37_README.md](PHASE_37_README.md)

**Implementation Details:**
- Check: [PHASE_37_IMPLEMENTATION_SUMMARY.md](PHASE_37_IMPLEMENTATION_SUMMARY.md)

---

## Sign-Off

**Prepared by:** _________________
**Date:** _________________

**Reviewed by (Tech Lead):** _________________
**Date:** _________________

**Approved for Staging:** _________________
**Date:** _________________

**Approved for Production:** _________________
**Date:** _________________

---

**Good luck with your deployment!** 🚀
