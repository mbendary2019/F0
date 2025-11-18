# 🚀 Phase 32 Quick Start

**Predictive AI & Self-Healing Ops**

---

## ⚡ 5-Minute Deployment

### Step 1: Deploy Functions (2 min)
```bash
cd functions
npm install

firebase deploy --only \
  functions:forecastEngine,\
  functions:cleanupPredictions,\
  functions:selfHealEngine,\
  functions:revertSelfHeal,\
  functions:rootCause,\
  functions:rootCauseEndpoints
```

### Step 2: Deploy Indexes (1 min)
```bash
firebase deploy --only firestore:indexes
```

### Step 3: Test Deployment (2 min)
```bash
# Wait 15 minutes for first forecast
firebase functions:log --only forecastEngine --limit 5

# Visit Ops Copilot
open https://your-domain.com/admin/ops-copilot
```

✅ **Done!** System is predicting and self-healing!

---

## 🎯 Key Features

### 1. Predictive Forecasting
- Forecasts 90 minutes ahead
- Updates every 15 minutes
- 95% confidence intervals

### 2. Self-Healing
- Automatic remediation
- Cooldown & auto-revert
- Full audit trail

### 3. Ops Copilot
- AI-powered Q&A
- Context-aware responses
- Quick actions

### 4. Root Cause Analysis
- Correlation detection
- Trend analysis
- Automated insights

---

## 📋 Quick Commands

### Create Remediation Rule
```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{
    "metric": "errors",
    "comparator": ">=",
    "threshold": 100,
    "action": "disable_endpoint",
    "target": "/api/slow-endpoint",
    "enabled": true
  }' \
  https://your-domain.com/api/admin/remediation
```

### List Rules
```bash
curl -H "Cookie: session=YOUR_SESSION" \
  https://your-domain.com/api/admin/remediation?enabled=true
```

### Check Forecasts
```bash
# View in Firestore Console
# Collection: predictions_daily
# Should have documents after 15 minutes
```

### Ask Ops Copilot
Visit `/admin/ops-copilot` and ask:
- "Why did latency spike?"
- "Predict traffic for next hour"
- "Show me recent anomalies"
- "Which endpoints are slow?"

---

## 🔍 Verification

### After 15 Minutes
- [x] Check `predictions_daily` collection (should have ~3 docs)
- [x] Verify forecast values reasonable
- [x] Check function logs for errors

### After 60 Minutes  
- [x] Check `root_cause_graph` collection (should have 1-2 docs)
- [x] Verify correlations calculated
- [x] Review generated insights

### After Creating Rule
- [x] Rule appears in `remediation_rules` collection
- [x] If threshold met, check `admin_audit` for action
- [x] Verify feature flags or rate limits updated

---

## 📊 Expected Behavior

### Forecasting
```
Every 15 minutes:
  ✓ Analyze last 24 hours of data
  ✓ Generate 6-step forecast (90 min)
  ✓ Store with confidence intervals
  ✓ Cleanup predictions > 7 days old
```

### Self-Healing
```
Every 5 minutes:
  ✓ Check all enabled rules
  ✓ Compare forecasts to thresholds
  ✓ Apply remediation if exceeded
  ✓ Log to audit trail
  ✓ Schedule auto-revert (1 hour)
```

### Root Cause
```
Every 60 minutes:
  ✓ Calculate metric correlations
  ✓ Identify strong relationships
  ✓ Analyze trends
  ✓ Generate insights
```

---

## 🐛 Troubleshooting

### No forecasts?
```bash
# Check function executed
firebase functions:log --only forecastEngine

# Verify data exists
# Firestore: api_metrics_daily should have docs
```

### Self-healing not working?
```bash
# Check rule enabled
GET /api/admin/remediation?enabled=true

# Verify forecast meets threshold
# Check predictions_daily collection
```

### Ops Copilot not responding?
```bash
# Check browser console for errors
# Verify API connectivity
curl https://your-domain.com/api/admin/metrics/summary
```

---

## 📚 Documentation

- **Complete Guide**: [docs/ADMIN_PREDICTIVE_AI.md](./docs/ADMIN_PREDICTIVE_AI.md)
- **Implementation Summary**: [PHASE_32_PREDICTIVE_AI_SUMMARY.md](./PHASE_32_PREDICTIVE_AI_SUMMARY.md)
- **Deployment Script**: `./DEPLOY_PHASE_32.sh`

---

## 🎉 Success!

You now have:
✅ Predictive forecasting  
✅ Automated self-healing  
✅ Root cause analysis  
✅ AI-powered ops copilot  

**Monitor your system intelligently!** 🚀

