# 🚀 Deploy Phase 33 NOW!

**Quick Deploy Guide - 5 Minutes**

---

## ⚡ Fastest Path to Deployment

```bash
# Run automated deployment
chmod +x DEPLOY_PHASE_33.sh
./DEPLOY_PHASE_33.sh
```

**That's it!** The script handles everything.

---

## 📋 Manual Deployment (If Script Fails)

### Step 1: Pre-check (30 seconds)
```bash
cd /Users/abdo/Downloads/from-zero-starter
npm run typecheck
```

Expected: ✅ No errors

---

### Step 2: Deploy Functions (2 minutes)
```bash
cd functions
npm install
npm run build
cd ..

firebase deploy --only functions:agentCoordinator,functions:runbookExecutor
```

Expected output:
```
✔  functions[agentCoordinator] Successful create operation
✔  functions[runbookExecutor] Successful create operation
```

---

### Step 3: Deploy Indexes (1 minute)
```bash
firebase deploy --only firestore:indexes
```

**IMPORTANT:** Wait 5-10 minutes for indexes to build!

---

### Step 4: Deploy Frontend (2 minutes)
```bash
npm run build
firebase deploy --only hosting
```

---

### Step 5: Initialize Security (30 seconds)

Via Firebase Console → Firestore:

1. Create collection: `ops_policies`
2. Create document: `denylist`
   ```json
   {
     "actions": ["delete_database", "modify_auth", "drop_collection"]
   }
   ```
3. Create document: `protected_targets`
   ```json
   {
     "targets": ["production", "main_db", "auth_service"]
   }
   ```

---

## ✅ Verify Deployment

### 1. Check Functions
```bash
firebase functions:list | grep -E "(agentCoordinator|runbookExecutor)"
```

Should show both functions as **Enabled**.

---

### 2. Check UI
Visit: `https://your-domain.com/admin/ops-assistant`

Should load without errors.

---

### 3. Test Agent Job
```bash
curl -X POST https://your-domain.com/api/admin/agents/jobs \
  -H "Cookie: session=YOUR_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"kind":"predict","payload":{"question":"System status?"}}'
```

Expected: `{"ok":true,"id":"..."}`

---

### 4. Verify Job Processing
Wait 2 minutes, then:

```bash
firebase functions:log --only agentCoordinator --lines 20
```

Should show job processing logs.

---

## 🐛 If Something Goes Wrong

### Functions Not Deploying
```bash
# Check Firebase project
firebase use

# Retry deployment
firebase deploy --only functions:agentCoordinator,functions:runbookExecutor --force
```

---

### Indexes Not Building
1. Go to Firebase Console → Firestore → Indexes
2. Check status (should be "Enabled" or "Building")
3. Wait 10 minutes if "Building"
4. If "Error", manually create indexes

---

### UI Not Loading
```bash
# Check build
npm run build

# Check deployment
firebase deploy --only hosting --debug
```

---

## 📊 What Got Deployed

### Cloud Functions (2)
- `agentCoordinator` - Processes agent jobs every 2 min
- `runbookExecutor` - Checks triggers every 3 min

### Firestore Indexes (7)
- `agent_jobs` (status+createdAt, requestedBy+createdAt)
- `runbooks` (enabled+name, createdBy+createdAt)
- `ops_commands` (ts, by+ts, status+ts)

### Frontend Pages (1)
- `/admin/ops-assistant` - Ops AI interface

### API Endpoints (2)
- `/api/admin/agents/jobs` - CRUD for jobs
- `/api/admin/runbooks` - CRUD for runbooks

---

## 🎯 Next Steps (First 24h)

### Hour 1: Monitor Logs
```bash
firebase functions:log --tail
```

Watch for errors or warnings.

---

### Hour 2: Create Test Runbook

Via Firestore Console:
```json
{
  "name": "Test Runbook",
  "trigger": "error_rate>95",
  "steps": ["notify:slack"],
  "cooldown": 60,
  "enabled": false,
  "createdBy": "admin",
  "createdAt": 1234567890000,
  "triggerCount": 0
}
```

Keep `enabled: false` for now!

---

### Hour 3: Test Guardian

Create job with blocked action:
```bash
curl -X POST https://your-domain.com/api/admin/agents/jobs \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{"kind":"remediate","payload":{"action":"delete_database","actorUid":"test"}}'
```

Should be rejected by guardian.

---

### Hour 4: Check Audit Trail

Firestore → `admin_audit` collection

Should see:
- `agent_job_created` events
- `guardian_check` events
- Job processing logs

---

### Day 1: Monitor Metrics

Track:
- Jobs processed per hour
- Guardian rejection rate
- Function execution time
- Firestore read/write counts

---

## 📈 Success Criteria

After 24 hours, verify:

- [ ] ✅ Functions running without errors
- [ ] ✅ Agent jobs processing within 2 minutes
- [ ] ✅ Guardian blocking unauthorized actions
- [ ] ✅ Ops Assistant UI responsive
- [ ] ✅ Audit trail complete in Firestore
- [ ] ✅ No unusual spikes in costs
- [ ] ✅ Firestore indexes fully built

---

## 🆘 Emergency Rollback

If something goes wrong:

### 1. Disable Functions
```bash
firebase functions:delete agentCoordinator
firebase functions:delete runbookExecutor
```

### 2. Previous Version Still Works
Phase 28-32 are unaffected. System continues working.

### 3. Re-deploy When Ready
Fix issues, then re-run deployment.

---

## 📚 Full Documentation

- **Complete Guide:** `docs/ADMIN_AUTONOMOUS_OPS.md` (800+ lines)
- **Summary:** `PHASE_33_AUTONOMOUS_OPS_SUMMARY.md` (full overview)
- **Quick Start:** `PHASE_33_QUICK_START.md` (10-min guide)

---

## 🎊 You're Ready!

Phase 33 adds autonomous operations with:
- 🤖 AI-powered agents
- 🛡️ 5-layer security (Guardian)
- 📘 Automated runbooks
- 💬 Conversational UI
- 📊 Complete audit trail

**Status:** Production ready! ✨

**Deploy now:** `./DEPLOY_PHASE_33.sh`

---

**Last Updated:** 2025-10-10  
**Deployment Time:** ~5 minutes  
**Maintainer:** medo bendary


