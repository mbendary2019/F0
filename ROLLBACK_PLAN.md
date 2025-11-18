# 🧯 Emergency Rollback Plan

## 🚨 When to Rollback

Execute rollback if any of these conditions occur within first 24 hours:

- ❌ Error rate > 5% for 10+ minutes
- ❌ Critical function failures (billing, gate enforcement)
- ❌ Data corruption in Firestore
- ❌ Stripe billing discrepancies
- ❌ Security incident
- ❌ Unexpected costs > $5/day

---

## ⚡ Quick Rollback Actions (Priority Order)

### 1. Immediate Actions (< 2 minutes)

#### A) Disable Public API Access
**Option 1: Environment Variable (Recommended)**
```bash
# In Next.js .env.production or Vercel dashboard
API_PUBLIC_ENABLED=false
```

Then redeploy Next.js or restart server.

**Option 2: API Route Kill Switch**
Add to affected routes:
```typescript
// src/app/api/v1/[...]/route.ts
if (process.env.API_PUBLIC_ENABLED === 'false') {
  return Response.json(
    { error: 'service_disabled', message: 'API temporarily unavailable' },
    { status: 503 }
  );
}
```

#### B) Freeze User Requests (Rate Limit = 0)
```bash
# Firebase Console or via script
# Set all users' rate limits to 0

# Via Firestore batch update:
# users/{uid}/subscription/limits/ratePerMin = 0
```

Quick script:
```javascript
// Run in Firebase Console > Firestore > Cloud Firestore > Query
const usersRef = db.collection('users');
const snapshot = await usersRef.get();
const batch = db.batch();

snapshot.forEach(doc => {
  const subRef = doc.ref.collection('subscription').doc('current');
  batch.update(subRef, {
    'limits.ratePerMin': 0,
    'limits.monthlyQuota': 0,
    rollbackAt: new Date()
  });
});

await batch.commit();
console.log('All users rate-limited to 0');
```

#### C) Pause Webhooks
```bash
# Disable Stripe webhook endpoint temporarily
# Stripe Dashboard > Webhooks > [endpoint] > Disable
```

Or set active flag:
```bash
# Firestore: webhook_queue collection
# Add field: paused: true globally
```

---

### 2. Function-Level Rollback (2-5 minutes)

#### A) Disable Specific Function
```bash
# Delete problematic function
firebase functions:delete FUNCTION_NAME

# Example:
firebase functions:delete pushUsageToStripe
```

#### B) Rollback to Previous Version
```bash
# List recent deployments
gcloud functions list --project=cashout-swap

# Rollback specific function to previous version
gcloud functions deploy FUNCTION_NAME \
  --source=gs://PREVIOUS_BUILD_BUCKET \
  --project=cashout-swap
```

#### C) Deploy Safe Stub
Create temporary stub function:
```typescript
// functions/src/safe-stub.ts
export const pushUsageToStripe = onSchedule("every 60 minutes", async () => {
  console.log('DISABLED - Rollback mode');
  return;
});
```

Deploy:
```bash
firebase deploy --only functions:pushUsageToStripe
```

---

### 3. Full System Rollback (5-10 minutes)

#### A) Revert All Functions
```bash
# Get last known good commit
git log --oneline functions/

# Checkout previous version
git checkout PREVIOUS_COMMIT -- functions/

# Rebuild and deploy
cd functions
npm run build
cd ..

firebase deploy --only functions
```

#### B) Revert Next.js Frontend
**On Vercel:**
1. Go to: https://vercel.com/YOUR_TEAM/cashout-swap/deployments
2. Find last stable deployment
3. Click "..." → "Promote to Production"

**Manual:**
```bash
git checkout PREVIOUS_COMMIT -- src/

# Commit and push
git commit -m "Rollback to stable version"
git push
```

#### C) Restore Firestore Data (if corrupted)
```bash
# Only if you have backups enabled
gcloud firestore restore \
  --source-backup=BACKUP_ID \
  --destination-database=cashout-swap \
  --project=cashout-swap
```

---

## 📊 Rollback Verification Checklist

After rollback, verify:

- [ ] Error rate < 1%
- [ ] No critical function failures
- [ ] Smoke tests pass (run `./scripts/smoke-prod.sh`)
- [ ] User complaints stopped
- [ ] Costs stabilized
- [ ] Logs show no new errors

---

## 🔍 Post-Rollback Investigation

### 1. Collect Evidence
```bash
# Export function logs
firebase functions:log --limit 1000 > logs/rollback-$(date +%Y%m%d-%H%M).log

# Check error patterns
firebase functions:log | grep -i error | tail -100

# Review Firestore writes
# Firestore Console > Usage > Detailed usage
```

### 2. Analyze Root Cause
Check for:
- Unexpected data formats
- Rate limit miscalculations
- Stripe API changes
- Firestore query limits exceeded
- Memory/timeout issues
- Scheduler conflicts

### 3. Test Fix in Staging
```bash
# Create fix branch
git checkout -b hotfix/issue-description

# Apply fix
# ... code changes ...

# Test locally
npm run dev
firebase emulators:start

# Run smoke tests
./scripts/smoke-prod.sh http://localhost:3000
```

---

## 🛡️ Prevention for Next Deployment

### Before Next Deploy:
1. **Canary Deployment** - Deploy to 10% traffic first
2. **Smoke Tests** - Run full test suite
3. **Load Testing** - Simulate 2x expected traffic
4. **Budget Alerts** - Set to $1/day during first week
5. **Monitoring Dashboards** - Set up real-time alerts

### Safer Deployment Process:
```bash
# 1. Deploy only non-critical functions first
firebase deploy --only \
  functions:getSubscription,\
  functions:getUsageMonth

# Wait 1 hour, monitor

# 2. Deploy schedulers with longer intervals
firebase deploy --only \
  functions:rollupDailyToMonthly

# Wait 24 hours, monitor

# 3. Deploy critical billing functions last
firebase deploy --only \
  functions:pushUsageToStripe,\
  functions:closeBillingPeriod
```

---

## 📞 Escalation Contacts

**During Rollback:**
- Firebase Support: https://firebase.google.com/support
- Stripe Support: https://support.stripe.com
- Project Owner: [YOUR EMAIL]

**Incident Severity Levels:**
- **P0 (Critical)**: Billing failures, data loss - Rollback immediately
- **P1 (High)**: Error rate > 5% - Rollback within 10 minutes
- **P2 (Medium)**: Performance degradation - Monitor, rollback if worsens
- **P3 (Low)**: Minor bugs - Document, fix in next release

---

## 🔧 Recovery Procedures

### If Rollback Fails:

1. **Contact Firebase Support**
   ```bash
   # Open support ticket with:
   # - Project ID: cashout-swap
   # - Error logs
   # - Deployment timestamp
   # - Impact description
   ```

2. **Manual Data Cleanup**
   ```javascript
   // If bad data was written, clean up via script
   const batch = db.batch();
   const badDocs = await db.collection('usage_logs')
     .where('corrupted', '==', true)
     .get();

   badDocs.forEach(doc => batch.delete(doc.ref));
   await batch.commit();
   ```

3. **Emergency Maintenance Mode**
   ```typescript
   // Add to all API routes
   return Response.json({
     error: 'maintenance',
     message: 'System under maintenance. Back in 30 minutes.',
     retryAfter: new Date(Date.now() + 30*60*1000)
   }, { status: 503 });
   ```

---

## 📝 Rollback Log Template

```markdown
# Rollback Incident Report

**Date:** 2025-10-08
**Time:** 14:30 UTC
**Triggered By:** [Name]
**Severity:** P1

## Timeline
- 14:15 - Error rate spike detected (8%)
- 14:20 - Investigation started
- 14:25 - Decision to rollback
- 14:30 - Rollback initiated
- 14:35 - Functions reverted to previous version
- 14:40 - Smoke tests passed
- 14:45 - Monitoring resumed

## Root Cause
[Description of what went wrong]

## Impact
- Users affected: ~50
- Duration: 30 minutes
- Data loss: None
- Revenue impact: $0

## Actions Taken
1. Disabled pushUsageToStripe function
2. Reverted to commit abc123
3. Re-ran smoke tests
4. Notified stakeholders

## Prevention
- Add integration test for Stripe usage records
- Implement gradual rollout
- Add circuit breaker for Stripe API calls

## Follow-up
- [ ] Root cause analysis complete
- [ ] Fix deployed to staging
- [ ] Fix tested in staging
- [ ] Ready for production retry
```

---

## ✅ Rollback Success Criteria

Rollback is complete when:
1. ✅ Error rate < 1% for 15 minutes
2. ✅ All smoke tests pass
3. ✅ No user complaints for 30 minutes
4. ✅ Monitoring dashboards green
5. ✅ Costs within expected range
6. ✅ Incident report documented

---

## 🎯 Resume Normal Operations

After successful rollback and fix:

1. **Staging Validation** (1-2 days)
   - Deploy fix to staging environment
   - Run full test suite
   - Monitor for 24 hours

2. **Gradual Re-deployment**
   - Deploy non-critical functions first
   - Wait 4 hours between deployments
   - Monitor each deployment for issues

3. **Communication**
   - Update status page
   - Email affected users
   - Post-mortem meeting
   - Update documentation

---

**Remember**: Better to rollback quickly and investigate than to let issues compound. When in doubt, rollback.
