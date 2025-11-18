# Phase 31 Deployment Checklist

## 📋 Pre-Deployment Verification

### ✅ Code Quality
- [x] TypeScript compilation: 0 errors
- [x] All tests passing
- [x] No ESLint errors
- [x] Code reviewed
- [x] Documentation complete

### ✅ Dependencies
- [x] `firebase-admin` installed in functions
- [x] `@slack/webhook` installed (optional)
- [x] All npm packages up to date

---

## 🚀 Deployment Steps

### Step 1: Install Dependencies

```bash
cd functions
npm install
cd ..
npm install
```

**Expected**: No errors, all dependencies resolved

---

### Step 2: Run Tests

```bash
npm run typecheck
npm test -- tests/anomaly-detection.test.ts
```

**Expected**: 
- ✅ 0 TypeScript errors
- ✅ All tests passing

---

### Step 3: Deploy Cloud Functions

```bash
# Deploy anomaly detection functions
firebase deploy --only functions:anomalyEngine,functions:cleanupAnomalyEvents

# Verify deployment
firebase functions:log --only anomalyEngine --limit 5
```

**Expected**:
- ✅ Functions deployed successfully
- ✅ No errors in logs
- ✅ Function executes every minute

---

### Step 4: Create Firestore Indexes

```bash
# Deploy indexes
firebase deploy --only firestore:indexes

# Or manually via Firebase Console:
# https://console.firebase.google.com/project/YOUR_PROJECT/firestore/indexes
```

**Required Indexes**:
1. `anomaly_events` on `ts` (DESC)
2. `anomaly_events` on `severity` (ASC), `ts` (DESC)
3. `anomaly_events` on `metric` (ASC), `ts` (DESC)
4. `anomaly_events` on `acknowledged` (ASC), `ts` (DESC)

**Expected**: Indexes build within 5-10 minutes

---

### Step 5: Initialize Tuning Configs

Run this script via Firebase Console or custom Cloud Function:

```javascript
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const metrics = ['errors', 'calls', 'latency_p95'];
const windows = ['1m', '5m', '15m'];

async function initTuning() {
  for (const metric of metrics) {
    for (const window of windows) {
      const docId = `${metric}_${window}`;
      await db.collection('anomaly_tuning').doc(docId).set({
        metric,
        window,
        sensitivity: 3,
        fusionWeights: [0.5, 0.5],
        minSupport: 8,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      console.log(`Created: ${docId}`);
    }
  }
  console.log('✅ All tuning configs initialized');
}

initTuning();
```

**Expected**: 9 documents created in `anomaly_tuning` collection

---

### Step 6: Configure Environment Variables (Optional)

If using Slack notifications:

```bash
# Set Slack webhook URL
firebase functions:config:set slack.webhook_url="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Deploy functions again to pick up config
firebase deploy --only functions:anomalyEngine
```

**Expected**: Slack notifications for high-severity anomalies

---

### Step 7: Deploy Next.js Frontend

```bash
npm run build
npm run deploy  # or vercel deploy --prod
```

**Expected**: 
- ✅ Build completes successfully
- ✅ Deployment succeeds

---

### Step 8: Verify UI

Visit the following pages and verify they load without errors:

1. **Insights Page**: `https://your-domain.com/admin/insights`
   - [x] Page loads
   - [x] Shows "No anomalies detected" or recent insights
   - [x] All components render
   
2. **Anomaly Table**: Scroll to "Anomaly Events History"
   - [x] Table loads
   - [x] Filters work
   - [x] Export CSV works

3. **Tuning Form**: Scroll to "Anomaly Detection Tuning"
   - [x] Shows all 9 configs (3 metrics × 3 windows)
   - [x] Sliders work
   - [x] Save button works

---

### Step 9: Test Detection Pipeline

#### Option A: Wait for Natural Detection
Wait 60 seconds for scheduled function to run, then check for events.

#### Option B: Trigger Manually
```bash
firebase functions:shell

# In the shell:
> anomalyEngine()

# Wait for execution to complete
```

#### Option C: Simulate Spike
```bash
# Create artificial spike in data
for i in {1..100}; do
  curl -X POST https://your-domain.com/api/test-endpoint
  sleep 0.3
done

# Wait 60 seconds
# Check /admin/insights for detection
```

**Expected**:
- ✅ Anomaly detected within 60 seconds
- ✅ Event appears in Firestore `anomaly_events`
- ✅ Insight shows on `/admin/insights`
- ✅ Slack notification sent (if configured + high severity)

---

### Step 10: Monitor Cloud Functions

Check Cloud Functions dashboard:
- `anomalyEngine` execution count (~1440/day)
- Average execution time (<500ms)
- Error rate (<1%)
- Memory usage (<200MB)

**Expected**: Healthy metrics

---

## 🔍 Post-Deployment Verification

### Critical Tests

1. **Detection Works**
   ```bash
   # Check Firestore for anomaly_events
   # Should have at least 1 document if system is active
   ```
   ✅ Pass / ❌ Fail

2. **UI Loads**
   ```bash
   curl -I https://your-domain.com/admin/insights
   # Should return 200 OK (after auth)
   ```
   ✅ Pass / ❌ Fail

3. **API Endpoints**
   ```bash
   # Test insights API
   curl -H "Cookie: session=..." \
     https://your-domain.com/api/admin/anomaly/insights
   
   # Should return JSON with insights array
   ```
   ✅ Pass / ❌ Fail

4. **Tuning Saves**
   - Change a sensitivity value
   - Click "Save All"
   - Refresh page
   - Verify value persisted
   
   ✅ Pass / ❌ Fail

5. **CSV Export**
   - Click "Export CSV" on events table
   - Verify CSV downloads
   - Open in Excel/Numbers
   - Verify data format correct
   
   ✅ Pass / ❌ Fail

---

## 🚨 Rollback Plan

If critical issues arise:

### Option 1: Disable Detection
```bash
# Pause scheduled function
firebase functions:config:set anomaly.enabled=false
firebase deploy --only functions:anomalyEngine
```

### Option 2: Rollback Functions
```bash
# List previous deployments
firebase functions:list

# Rollback to previous version
firebase functions:delete anomalyEngine
firebase functions:delete cleanupAnomalyEvents

# Redeploy previous version from git
git checkout <previous-commit>
firebase deploy --only functions
```

### Option 3: Hide UI
```bash
# Temporarily disable insights page
# Comment out route in src/app/admin/insights/page.tsx
# Or add feature flag check
```

---

## 📊 Success Metrics

After 24 hours of deployment:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Detection latency | < 60s | ___ | ☐ |
| False positive rate | < 20% | ___ | ☐ |
| Function executions | ~1440 | ___ | ☐ |
| Function errors | < 1% | ___ | ☐ |
| UI load time | < 2s | ___ | ☐ |
| User feedback | Positive | ___ | ☐ |

---

## 🐛 Common Issues

### Issue: No anomalies detected

**Diagnosis**:
1. Check Cloud Functions logs for errors
2. Verify data is being collected
3. Check `/api/admin/anomaly/preview` for data points
4. Try lowering sensitivity in tuning

**Fix**: Adjust sensitivity or verify data sources

---

### Issue: Too many false positives

**Diagnosis**:
1. Check anomaly_events for severity distribution
2. Review threshold settings in detectors

**Fix**: 
- Increase sensitivity (3 → 4 or 5)
- Adjust fusion weights
- Increase minSupport

---

### Issue: Slack notifications not sent

**Diagnosis**:
1. Check `SLACK_WEBHOOK_URL` is set
2. Verify `@slack/webhook` is installed
3. Check function logs for errors
4. Verify severity is `high`

**Fix**:
```bash
firebase functions:config:get
firebase functions:config:set slack.webhook_url="..."
firebase deploy --only functions:anomalyEngine
```

---

### Issue: Firestore query errors

**Diagnosis**:
1. Check if indexes are built
2. Visit Firebase Console → Firestore → Indexes
3. Look for "Building" status

**Fix**: Wait for indexes to complete building (5-10 min)

---

## 📞 Support

### Resources
- [Technical Documentation](./docs/ADMIN_AI_INSIGHTS.md)
- [Implementation Summary](./PHASE_31_AI_INSIGHTS_SUMMARY.md)
- [Cloud Functions Logs](https://console.firebase.google.com/project/_/functions/logs)
- [Firestore Console](https://console.firebase.google.com/project/_/firestore)

### Monitoring URLs
- Insights UI: `https://your-domain.com/admin/insights`
- Firestore: `https://console.firebase.google.com/project/YOUR_PROJECT/firestore/data/anomaly_events`
- Functions: `https://console.firebase.google.com/project/YOUR_PROJECT/functions/list`

---

## ✅ Final Checklist

Before marking deployment complete:

- [ ] All 10 deployment steps completed
- [ ] All 5 critical tests passing
- [ ] No errors in Cloud Functions logs
- [ ] UI accessible and functional
- [ ] Indexes built successfully
- [ ] Tuning configs initialized
- [ ] Team notified of deployment
- [ ] Documentation updated
- [ ] Success metrics baseline recorded

---

**Deployment Date**: _____________  
**Deployed By**: _____________  
**Sign-off**: _____________

🎉 **Phase 31 Deployment Complete!**

