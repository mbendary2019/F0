# Phase 35 – Quick Deploy Guide 🚀

## Prerequisites ✅

- [x] Firebase project configured
- [x] Node.js 20+ installed
- [x] Firebase CLI installed
- [x] Admin credentials set up

---

## 3-Step Deployment

### Step 1: Deploy Functions (2 minutes)

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Deploy ops functions
firebase deploy --only functions:autoScaler,functions:watchdog,functions:feedbackLoop,functions:canaryManager
```

**Expected Output:**
```
✔  functions[autoScaler] Successful create operation.
✔  functions[watchdog] Successful create operation.
✔  functions[feedbackLoop] Successful create operation.
✔  functions[canaryManager] Successful create operation.
```

### Step 2: Deploy Dashboard (3 minutes)

```bash
# Build Next.js application
npm run build

# Deploy hosting
firebase deploy --only hosting
```

**Dashboard will be available at:**
`https://your-project.web.app/dashboard/ops`

### Step 3: Instrument API Layer (5 minutes)

Add metrics collection to your API routes:

```typescript
// Example: src/app/api/your-route/route.ts
import { db } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(req: Request) {
  const startTime = Date.now();

  try {
    // Your API logic
    const result = await yourFunction();

    // ✅ Record success
    await db.doc('ops_stats/current').set({
      rps: FieldValue.increment(1/300),
      p95ms: Date.now() - startTime,
      timestamp: FieldValue.serverTimestamp()
    }, { merge: true });

    return Response.json(result);
  } catch (error) {
    // ❌ Record error
    await db.doc('ops_stats/current').set({
      errorRate: FieldValue.increment(0.01),
      timestamp: FieldValue.serverTimestamp()
    }, { merge: true });

    throw error;
  }
}
```

---

## Verify Deployment

### 1. Check Functions

```bash
# View logs
firebase functions:log --only autoScaler

# Expected: Function executing every 5 minutes
```

### 2. Check Dashboard

Visit: `https://your-project.web.app/dashboard/ops`

**Should show:**
- Real-time metrics (RPS, p95, error rate)
- Canary rollout status
- Runtime configuration
- AI recommendations

### 3. Test Canary Control

```bash
# Set canary to 50%
node scripts/set-canary.js 50

# Check dashboard - rollout should update
```

---

## Quick Commands Reference

### Canary Management

```bash
# View current status
firebase firestore:get config/canary

# Set rollout percentage
node scripts/set-canary.js <0-100>

# Force rollback
node scripts/set-canary.js 0 --rollback

# Full promotion
node scripts/set-canary.js 100 --promote

# Pause progression
node scripts/set-canary.js 25 --pause

# Resume progression
node scripts/set-canary.js 25 --resume
```

### Monitoring

```bash
# View latest cognitive report
firebase firestore:get ops/reports/latest

# View runtime config
firebase firestore:get config/runtime

# View ops stats
firebase firestore:get ops_stats/current

# Follow function logs
firebase functions:log --follow
```

### Troubleshooting

```bash
# Check all functions are deployed
firebase functions:list | grep ops

# View errors
firebase functions:log | grep ERROR

# Redeploy specific function
firebase deploy --only functions:autoScaler
```

---

## CI/CD Setup (Optional)

### 1. Add GitHub Secrets

In repository settings → Secrets and variables → Actions:

```
FIREBASE_SERVICE_ACCOUNT = <service-account-json>
FIREBASE_PROJECT_ID = your-project-id
```

### 2. Workflow Already Created

File: `.github/workflows/ops-canary.yml`

**Triggers on:**
- Push to `main` branch
- Manual workflow dispatch

**Actions:**
1. Build & test
2. Deploy functions
3. Set 10% canary rollout
4. Verify health
5. Create deployment record

---

## Monitoring Setup (Optional)

### Import Alert Policies

```bash
# Create notification channel first
gcloud alpha monitoring channels create \
  --display-name="Ops Email" \
  --type=email \
  --channel-labels=email_address=ops@your-domain.com

# Import alerts
gcloud alpha monitoring policies create --policy-from-file=monitoring/alerts.yaml
```

### Configure SLO Dashboard

1. Go to Google Cloud Console → Monitoring
2. Create SLO from `monitoring/slo.json`
3. Set up error budget alerts

---

## Testing the System

### 1. Generate Load

```bash
# Simulate high traffic
for i in {1..100}; do
  curl https://your-api-endpoint.com/api/test &
done
```

### 2. Watch Auto-Scaling

```bash
# Monitor runtime config changes
watch -n 10 'firebase firestore:get config/runtime'
```

**Expected behavior:**
- Concurrency increases to 200
- Cache TTL reduces to 120s
- AutoScaler logs show "high_load" decision

### 3. Trigger Health Failure

```bash
# Set health check to fail
firebase firestore:update ops_health/readyz '{"ok":false,"failCount":3}'

# Watch for watchdog response (within 5 minutes)
firebase functions:log --only watchdog
```

**Expected behavior:**
- Watchdog triggers rollback
- Cache invalidation signal sent
- CanaryManager rolls back to 0%

### 4. View Cognitive Report

```bash
# Wait 15 minutes, then check
firebase firestore:get ops/reports/latest
```

**Should include:**
- Current metrics
- Health status
- AI-generated recommendations

---

## Success Checklist

After deployment, verify:

- [ ] Functions deployed (4 total)
- [ ] Dashboard accessible at `/dashboard/ops`
- [ ] Metrics updating in `ops_stats/current`
- [ ] Runtime config being adjusted
- [ ] Cognitive reports generating every 15 min
- [ ] Canary manager running (check `config/canary`)
- [ ] Helper scripts executable
- [ ] CI/CD workflow passing (if enabled)

---

## Need Help?

### Documentation
- [PHASE_35_COMPLETE.md](PHASE_35_COMPLETE.md) - Full documentation
- [PHASE_35_RUNBOOK.md](docs/PHASE_35_RUNBOOK.md) - Operations manual
- [PHASE_35_COGNITIVE_OPS.md](docs/PHASE_35_COGNITIVE_OPS.md) - Architecture

### Common Issues

**Functions not running?**
```bash
gcloud scheduler jobs list  # Check scheduler
firebase functions:log --only autoScaler  # Check logs
```

**Dashboard showing no data?**
1. Verify API route `/api/firestore` exists
2. Check admin authentication
3. Verify Firestore permissions

**Canary not progressing?**
```bash
firebase firestore:get config/canary  # Check for 'paused: true'
firebase firestore:get ops_slo/window  # Check SLO metrics
```

---

**Deployment Time:** ~10 minutes
**Status:** ✅ Ready to Deploy
**Last Updated:** 2025-10-12
