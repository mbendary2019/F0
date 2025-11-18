# 🚀 Deploy Phase 32 NOW!

Quick deployment commands for immediate execution.

---

## ⚡ Super Fast Deployment (3 Commands)

### 1️⃣ Deploy Functions (2 min)
```bash
firebase deploy --only \
  functions:forecastEngine,\
  functions:cleanupPredictions,\
  functions:selfHealEngine,\
  functions:revertSelfHeal,\
  functions:rootCause,\
  functions:rootCauseEndpoints
```

### 2️⃣ Deploy Indexes (1 min)
```bash
firebase deploy --only firestore:indexes
```

### 3️⃣ Verify (after 15 min)
```bash
firebase functions:log --only forecastEngine --limit 10
```

✅ **Done!** Your system is now self-healing.

---

## 🎯 What You Get

### Immediate (after deployment)
- ✅ 6 Cloud Functions deployed
- ✅ 4 Firestore indexes created
- ✅ Remediation API available
- ✅ Ops Copilot UI ready

### After 15 Minutes
- ✅ First forecasts generated
- ✅ Predictions stored in Firestore
- ✅ Self-healing checks active

### After 60 Minutes
- ✅ Root cause analysis complete
- ✅ Correlations calculated
- ✅ Insights generated

---

## 📋 Verification Checklist

### Check Functions Deployed
```bash
firebase functions:list | grep -E "(forecast|selfHeal|rootCause)"
```
**Expected**: 6 functions listed

---

### Check First Forecast (after 15 min)
```bash
firebase functions:log --only forecastEngine --limit 5
```
**Expected**: 
```
[forecastEngine] Starting forecast generation
[forecastEngine] Generated forecast for calls: XX.XX (next 15min)
[forecastEngine] Generated forecast for errors: XX.XX (next 15min)
[forecastEngine] Generated forecast for latency_p95: XX.XX (next 15min)
[forecastEngine] Completed: 3/3 forecasts generated
```

---

### Check Firestore Collections

Visit Firebase Console → Firestore:

1. **predictions_daily**
   - Should have 3+ documents
   - Each with: metric, t, forecast[], upper[], lower[]

2. **remediation_rules**
   - Empty initially (create via API)

3. **root_cause_graph** (after 60 min)
   - Should have 1-2 documents
   - Global correlations and endpoint analysis

---

### Test Ops Copilot

```bash
# Visit in browser
open https://your-domain.com/admin/ops-copilot

# Or test API
curl -H "Cookie: session=YOUR_SESSION" \
  https://your-domain.com/api/admin/metrics/summary
```

**Expected**: AI assistant interface loads, context summary shows

---

### Create First Remediation Rule

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{
    "metric": "errors",
    "comparator": ">=",
    "threshold": 100,
    "action": "disable_endpoint",
    "target": "/api/test-endpoint",
    "enabled": true
  }' \
  https://your-domain.com/api/admin/remediation
```

**Expected**: `{"ok": true, "id": "RULE_ID"}`

---

### List Remediation Rules

```bash
curl -H "Cookie: session=YOUR_SESSION" \
  https://your-domain.com/api/admin/remediation
```

**Expected**: `{"rules": [...]}`

---

## 🔍 Monitoring

### Function Execution Counts (after 1 hour)

```bash
firebase functions:log --only forecastEngine | grep "Completed" | wc -l
```
**Expected**: 4 (runs every 15 min)

```bash
firebase functions:log --only selfHealEngine | grep "Starting" | wc -l
```
**Expected**: 12 (runs every 5 min)

```bash
firebase functions:log --only rootCause | grep "Analysis complete" | wc -l
```
**Expected**: 1 (runs every 60 min)

---

### Check for Errors

```bash
firebase functions:log --only forecastEngine,selfHealEngine,rootCause | grep -i error
```
**Expected**: No errors (or only expected warnings)

---

## 🐛 Quick Troubleshooting

### No forecasts after 15 minutes

```bash
# Check function logs
firebase functions:log --only forecastEngine --limit 20

# Common issues:
# - Insufficient data (< 6 points)
# - Function timeout
# - Firestore permissions
```

**Fix**: 
1. Verify `api_metrics_daily` has data
2. Check function execution completed
3. Increase function timeout if needed

---

### Self-healing not triggering

```bash
# Check rules exist and enabled
curl -H "Cookie: session=..." \
  https://your-domain.com/api/admin/remediation?enabled=true

# Check forecasts exist
# Firestore → predictions_daily → verify values
```

**Fix**:
1. Create a rule with low threshold for testing
2. Manually add high forecast to test
3. Wait 5 minutes and check admin_audit

---

### Ops Copilot not responding

```bash
# Check API connectivity
curl https://your-domain.com/api/admin/metrics/summary

# Check browser console for errors
```

**Fix**:
1. Verify session cookie valid
2. Check NEXT_PUBLIC_BASE_URL set correctly
3. Rebuild frontend if needed

---

## 📊 Performance Expectations

### After 1 Hour

| Metric | Expected |
|--------|----------|
| forecastEngine executions | 4 |
| selfHealEngine executions | 12 |
| rootCause executions | 1 |
| predictions_daily docs | ~12 |
| Errors | 0 |

### After 24 Hours

| Metric | Expected |
|--------|----------|
| forecastEngine executions | 96 |
| selfHealEngine executions | 288 |
| rootCause executions | 24 |
| predictions_daily docs | ~288 (with cleanup) |
| Auto-heal actions | 0-10 (depends on rules) |

---

## 🎉 Success Indicators

After deployment and 15 minutes wait:

- [x] Functions deployed: 6/6
- [x] Indexes created: 4/4
- [x] TypeScript errors: 0
- [x] Forecasts generated: 3/3
- [x] Firestore collections created
- [x] Ops Copilot accessible
- [x] API endpoints working

---

## 📚 Next Steps

1. **Monitor for 1 hour** - Verify all functions running
2. **Create remediation rules** - Start with safe thresholds
3. **Test Ops Copilot** - Ask questions about your system
4. **Review correlations** - Check root_cause_graph after 60 min
5. **Adjust sensitivity** - Fine-tune based on your traffic patterns

---

## 🆘 Need Help?

**Documentation**:
- Complete Guide: `docs/ADMIN_PREDICTIVE_AI.md`
- Implementation: `PHASE_32_PREDICTIVE_AI_SUMMARY.md`
- Quick Start: `PHASE_32_QUICK_START.md`

**Quick Commands**:
```bash
# All function logs
firebase functions:log --limit 50

# Specific function
firebase functions:log --only forecastEngine --limit 20

# Error logs only
firebase functions:log --only forecastEngine | grep -i error

# Check Firestore data
# Visit: console.firebase.google.com/project/YOUR_PROJECT/firestore
```

---

**Status**: ✅ Ready to Deploy  
**Time Required**: 3 minutes  
**Verification**: 15 minutes  

🚀 **Deploy now with the commands above!** 🚀

