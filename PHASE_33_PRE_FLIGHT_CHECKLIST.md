# ✅ Phase 33 Pre-Flight Checklist

**Date:** 2025-10-10  
**Status:** Ready for Deployment

---

## 📋 Pre-Flight Verification

### 1️⃣ Deployment Files ✅
- [x] `DEPLOY_PHASE_33.sh` - Automated deployment script (6.3K)
- [x] `PHASE_33_DEPLOYMENT_READY.txt` - Complete deployment guide (19K)
- [x] `PHASE_33_README.md` - Arabic comprehensive guide (13K)
- [x] `PHASE_33_QUICK_START.md` - 10-minute quick start
- [x] `docs/ADMIN_AUTONOMOUS_OPS.md` - Full documentation

---

### 2️⃣ Cloud Functions Verification ✅

**Exported Functions:**
```bash
✅ agentCoordinator (line 16 in coordinator.ts)
✅ runbookExecutor (line 14 in runbookExecutor.ts)
```

**Index Exports:**
```typescript
// functions/src/agents/index.ts
export { agentCoordinator } from './coordinator';
export { runbookExecutor } from './runbookExecutor';

// functions/src/index.ts
export { agentCoordinator } from "./agents/coordinator";
export { runbookExecutor } from "./agents/runbookExecutor";
```

---

### 3️⃣ Script Permissions ✅
- [x] `DEPLOY_PHASE_33.sh` is executable
- [x] `scripts/seed-phase33-security.js` is executable

---

### 4️⃣ TypeScript & Code Quality ✅
- [x] 0 TypeScript errors
- [x] ESLint passing (1 pre-existing warning in AuthGate.tsx)
- [x] All imports resolved
- [x] No build errors

---

### 5️⃣ Security Policies Setup

**Required Firestore Documents:**

#### `ops_policies/denylist`
```json
{
  "actions": [
    "delete_database",
    "drop_collection",
    "modify_auth",
    "delete_user_data",
    "modify_billing",
    "change_ownership"
  ]
}
```

#### `ops_policies/protected_targets`
```json
{
  "targets": [
    "production",
    "main_db",
    "auth_service",
    "payment_service",
    "user_data"
  ]
}
```

#### `admins/{yourUid}`
```json
{
  "uid": "YOUR_UID_HERE",
  "email": "admin@example.com",
  "roles": ["admin", "owner"],
  "active": true,
  "highRiskApproved": true,
  "suspended": false
}
```

#### `observability_cache/totals`
```json
{
  "calls24h": 0,
  "errors24h": 0,
  "p95": 0,
  "updatedAt": 1234567890
}
```

**Quick Seed:**
```bash
# Update UID in script first!
node scripts/seed-phase33-security.js
```

---

### 6️⃣ Environment Variables

**Required:**
- [x] `NEXT_PUBLIC_BASE_URL` - Your production URL
- [x] Firebase Admin SDK credentials configured

**Optional:**
- [ ] `SLACK_WEBHOOK_URL` - For Slack notifications
- [ ] `NEXT_PUBLIC_WS_URL` - For real-time features (Phase 30)

---

### 7️⃣ Dependencies from Previous Phases

**Phase 28 (RBAC):**
- [x] `assertAdminReq()` function exists
- [x] `authGuard()` function exists
- [x] `admin_audit` collection

**Phase 29 (Observability):**
- [x] Rate limiting middleware active
- [x] CSRF protection enabled
- [x] `api_metrics_daily` collection

**Phase 30 (Real-time):**
- [x] Alert system configured (optional)
- [x] WebSocket gateway (optional)

**Phase 31 (Anomaly Detection):**
- [x] `anomaly_events` collection
- [x] Anomaly detection engine

**Phase 32 (Predictive AI):**
- [x] `predictions_daily` collection
- [x] Forecast engine
- [x] Self-healing engine

---

## 🧪 Quick Verification Commands

### Before Deployment

```bash
# 1. Check function exports
grep -n "export const agentCoordinator" functions/src/agents/coordinator.ts
grep -n "export const runbookExecutor" functions/src/agents/runbookExecutor.ts

# 2. Verify TypeScript
npm run typecheck

# 3. Build functions
cd functions && npm run build && cd ..

# 4. Check indexes
cat firestore-indexes-phase33.json
```

### After Deployment

```bash
# 1. Verify functions deployed
firebase functions:list | grep -E "(agentCoordinator|runbookExecutor)"

# Expected output:
# ✔ agentCoordinator    (us-central1)
# ✔ runbookExecutor     (us-central1)

# 2. Check function logs
firebase functions:log --only agentCoordinator --limit 20

# 3. Test UI
# Visit: https://your-domain.com/admin/ops-assistant

# 4. Create test job via API
curl -X POST "https://your-domain.com/api/admin/agents/jobs" \
  -H "Cookie: session=YOUR_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"kind":"predict","payload":{"question":"System status?"}}'

# Expected: {"ok":true,"id":"..."}

# 5. Wait 2 minutes, check job status
curl "https://your-domain.com/api/admin/agents/jobs" \
  -H "Cookie: session=YOUR_SESSION"

# Expected: Job status changed to "done" with result

# 6. Test Guardian (should be rejected)
curl -X POST "https://your-domain.com/api/admin/agents/jobs" \
  -H "Cookie: session=YOUR_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"kind":"remediate","payload":{"action":"delete_database","actorUid":"test"}}'

# Expected: Job rejected with guardian decision
```

---

## ✅ What to Verify After 2-3 Minutes

### Firestore Collections

1. **`agent_jobs`**
   - Status transitions: `queued` → `running` → `done`/`rejected`
   - Result field populated for successful jobs
   - Decision field for guardian validations

2. **`admin_audit`**
   - `agent_job_created` events
   - `guardian_check` events with allow/deny decisions
   - Actor UID and timestamp logged

3. **`ops_commands`**
   - Executed remediation actions
   - Command, target, and timestamp

### Cloud Function Logs

```bash
firebase functions:log --only agentCoordinator --limit 50
```

**Look for:**
- `[AgentCoordinator] Starting job processing`
- `[AgentCoordinator] Processing X jobs`
- `[AgentCoordinator] Completed: X jobs`
- `[Guardian] Action approved/denied`

### UI Verification

1. Visit `/admin/ops-assistant`
2. Should load without errors
3. Try asking: "What is the current system status?"
4. Verify response appears in activity log
5. Check recent jobs table updates

---

## 🛡️ Security Verification

### Test Guardian Layers

**1. Actor Validation:**
```bash
# Test with non-admin user (should fail)
curl -X POST ".../api/admin/agents/jobs" \
  -H "Cookie: session=NON_ADMIN_SESSION" \
  -d '{"kind":"predict","payload":{}}'
# Expected: 403 Forbidden
```

**2. Action Blacklist:**
```bash
# Test blocked action
curl -X POST ".../api/admin/agents/jobs" \
  -H "Cookie: session=ADMIN_SESSION" \
  -d '{"kind":"remediate","payload":{"action":"delete_database","actorUid":"admin"}}'
# Expected: Rejected with reason "action_blocked_by_policy"
```

**3. Protected Targets:**
```bash
# Test protected target
curl -X POST ".../api/admin/agents/jobs" \
  -H "Cookie: session=ADMIN_SESSION" \
  -d '{"kind":"remediate","payload":{"action":"restart","target":"production","actorUid":"admin"}}'
# Expected: Rejected with reason "target_protected"
```

**4. Rate Limiting:**
```bash
# Send 15 requests quickly
for i in {1..15}; do
  curl -X POST ".../api/admin/agents/jobs" \
    -H "Cookie: session=ADMIN_SESSION" \
    -d '{"kind":"predict","payload":{}}' &
done
wait
# Expected: Some requests return 429 or guardian rejection
```

**5. Audit Trail:**
```bash
# Check all decisions logged
firebase firestore:get admin_audit --limit 20
# Should see all guardian decisions with reasons
```

---

## 📊 Performance Expectations

### Cloud Functions
- **agentCoordinator:**
  - Execution time: < 500ms per job
  - Memory usage: ~256MB
  - Processes up to 10 jobs per run

- **runbookExecutor:**
  - Execution time: < 1s for 10 runbooks
  - Memory usage: ~256MB
  - Evaluates all enabled runbooks

### API Endpoints
- **GET /agents/jobs:** < 300ms
- **POST /agents/jobs:** < 200ms
- **GET /runbooks:** < 250ms
- **POST /runbooks:** < 200ms

### Firestore Operations
- **Reads per hour:** ~120 (coordinator + executor)
- **Writes per hour:** ~30 (jobs + audit)
- **Document growth:** ~50 new docs per day

---

## 🚨 Common Issues & Solutions

### Issue 1: Jobs Stuck in "queued"
**Symptoms:**
- Jobs never transition to "running"
- No logs from agentCoordinator

**Solutions:**
1. Check Pub/Sub schedule:
   ```bash
   gcloud scheduler jobs list
   ```
2. Verify indexes built:
   ```bash
   firebase firestore:indexes
   ```
3. Check function logs for errors:
   ```bash
   firebase functions:log --only agentCoordinator
   ```

---

### Issue 2: Runbooks Not Triggering
**Symptoms:**
- Runbooks enabled but never execute
- No agent jobs created

**Solutions:**
1. Verify `observability_cache/totals` exists:
   ```bash
   firebase firestore:get observability_cache/totals
   ```
2. Check trigger syntax (must be `metric>value`)
3. Verify cooldown period passed
4. Check runbookExecutor logs:
   ```bash
   firebase functions:log --only runbookExecutor
   ```

---

### Issue 3: Guardian Rejecting Everything
**Symptoms:**
- All remediation jobs rejected
- Decision reason: "actor_not_admin"

**Solutions:**
1. Verify actor exists in `admins` collection
2. Check actor UID matches request:
   ```bash
   firebase firestore:get admins/YOUR_UID
   ```
3. Ensure `active: true` and `suspended: false`
4. For high-risk actions, set `highRiskApproved: true`

---

### Issue 4: UI Not Loading
**Symptoms:**
- `/admin/ops-assistant` shows error
- Browser console has errors

**Solutions:**
1. Check Next.js build:
   ```bash
   npm run build
   ```
2. Verify hosting deployment:
   ```bash
   firebase deploy --only hosting --debug
   ```
3. Check browser console for specific errors
4. Verify session cookie present

---

## 🎯 Success Criteria

### Technical ✅
- [ ] 0 TypeScript errors
- [ ] All functions deployed successfully
- [ ] Firestore indexes built and enabled
- [ ] UI loads in < 2 seconds
- [ ] API responses < 500ms

### Functional ✅
- [ ] Agent coordinator processes jobs within 2 minutes
- [ ] Guardian blocks unauthorized actions
- [ ] Runbooks trigger based on metrics
- [ ] Ops Assistant responds to queries
- [ ] Complete audit trail in Firestore

### Security ✅
- [ ] All 5 guardian layers active
- [ ] Denylist enforced
- [ ] Protected targets secure
- [ ] Rate limiting working
- [ ] All decisions logged

### Business ✅
- [ ] System monitoring autonomous
- [ ] Incidents detected automatically
- [ ] Remediation actions logged
- [ ] Manual intervention reduced
- [ ] Compliance trail complete

---

## 🚀 Ready to Deploy!

All checklist items verified. You can now deploy Phase 33:

```bash
./DEPLOY_PHASE_33.sh
```

Or manual deployment:
```bash
# 1. Seed security policies
node scripts/seed-phase33-security.js

# 2. Deploy functions
firebase deploy --only functions:agentCoordinator,functions:runbookExecutor

# 3. Deploy indexes
firebase deploy --only firestore:indexes

# 4. Deploy frontend
npm run build
firebase deploy --only hosting
```

---

**Last Verified:** 2025-10-10  
**Status:** ✅ All Systems Go!  
**Next:** Deploy and monitor for 24 hours


