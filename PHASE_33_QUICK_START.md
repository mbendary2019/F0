# Phase 33 Quick Start Guide

**Time:** 10 minutes  
**Goal:** Deploy and test Autonomous Ops AI

---

## ⚡ Quick Deploy

### Option 1: Automated Script
```bash
chmod +x DEPLOY_PHASE_33.sh
./DEPLOY_PHASE_33.sh
```

### Option 2: Manual Steps
```bash
# 1. Type check
npm run typecheck

# 2. Build functions
cd functions && npm install && npm run build && cd ..

# 3. Deploy indexes
firebase deploy --only firestore:indexes

# 4. Deploy functions
firebase deploy --only functions:agentCoordinator,functions:runbookExecutor

# 5. Deploy frontend
npm run build
firebase deploy --only hosting
```

**Wait 5-10 minutes for indexes to build.**

---

## 🛡️ Initialize Security Policies

### Via Firestore Console

1. Go to Firestore Console
2. Create collection: `ops_policies`
3. Create document: `denylist`
   ```json
   {
     "actions": [
       "delete_database",
       "modify_auth",
       "drop_collection"
     ]
   }
   ```
4. Create document: `protected_targets`
   ```json
   {
     "targets": [
       "production",
       "main_db",
       "auth_service"
     ]
   }
   ```

### Via Firebase CLI
```bash
firebase firestore:set ops_policies/denylist '{
  "actions": ["delete_database", "modify_auth", "drop_collection"]
}'

firebase firestore:set ops_policies/protected_targets '{
  "targets": ["production", "main_db", "auth_service"]
}'
```

---

## 🧪 Test Agent System

### 1. Test Job Creation (via UI)

Visit: `https://your-domain.com/admin/ops-assistant`

1. Enter query: "What is the current system status?"
2. Click "Ask Agent"
3. Wait 2-3 seconds
4. Verify response appears in log

### 2. Test Job Creation (via API)

```bash
# Get your session cookie from browser
curl -X POST https://your-domain.com/api/admin/agents/jobs \
  -H "Cookie: session=YOUR_SESSION_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "predict",
    "payload": {
      "question": "Why is latency high?"
    }
  }'
```

Expected response:
```json
{
  "ok": true,
  "id": "abc123xyz"
}
```

### 3. Verify Job Processing

Wait 2 minutes, then check:
```bash
curl https://your-domain.com/api/admin/agents/jobs \
  -H "Cookie: session=YOUR_SESSION_HERE"
```

Look for your job with `status: "done"` and `result` field.

---

## 📘 Create First Runbook

### Via UI (Coming Soon)
Currently via Firestore Console only.

### Via Firestore Console

1. Collection: `runbooks`
2. Auto-generate Document ID
3. Add fields:
   ```json
   {
     "name": "High Error Rate Response",
     "trigger": "error_rate>80",
     "steps": [
       "restart_function:api",
       "reduce_rate:main_api",
       "notify:slack"
     ],
     "cooldown": 30,
     "enabled": false,
     "createdBy": "admin",
     "createdAt": 1234567890000,
     "triggerCount": 0
   }
   ```

**Note:** Keep `enabled: false` for testing!

### Test Runbook (Manual Trigger)

Since we can't easily trigger `error_rate>80` in test, we'll simulate:

1. Set runbook `enabled: true`
2. Temporarily change trigger to `error_rate>0` (will always trigger)
3. Wait 3 minutes for runbookExecutor to run
4. Check Firestore `agent_jobs` collection for new jobs
5. Set back to `error_rate>80` and `enabled: false`

---

## 🛡️ Test Guardian Security

### 1. Test Blocked Action

Create job with blocked action:
```bash
curl -X POST https://your-domain.com/api/admin/agents/jobs \
  -H "Cookie: session=YOUR_SESSION_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "remediate",
    "payload": {
      "action": "delete_database",
      "actorUid": "test_user"
    }
  }'
```

Wait 2 minutes, then check job status:
```bash
# Should show status: "rejected"
# With decision.reason: "action_blocked_by_policy"
```

### 2. Test Protected Target

```bash
curl -X POST https://your-domain.com/api/admin/agents/jobs \
  -H "Cookie: session=YOUR_SESSION_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "remediate",
    "payload": {
      "action": "restart_function",
      "target": "production",
      "actorUid": "test_user"
    }
  }'
```

Should be rejected with `target_protected`.

### 3. Test Valid Action

```bash
curl -X POST https://your-domain.com/api/admin/agents/jobs \
  -H "Cookie: session=YOUR_SESSION_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "remediate",
    "payload": {
      "action": "restart_function",
      "target": "test_worker",
      "actorUid": "YOUR_ADMIN_UID"
    }
  }'
```

Should succeed (status: "done").

---

## 📊 Monitor Deployment

### Check Function Logs

```bash
# Coordinator logs
firebase functions:log --only agentCoordinator --lines 50

# Runbook executor logs
firebase functions:log --only runbookExecutor --lines 50

# Follow logs in real-time
firebase functions:log --only agentCoordinator --tail
```

### Check Firestore Data

1. **agent_jobs** - Should see test jobs
2. **admin_audit** - Should see guardian decisions
3. **ops_commands** - Should see executed commands
4. **runbooks** - Should see your test runbook

### Check Function Status

```bash
firebase functions:list | grep -E "(agentCoordinator|runbookExecutor)"
```

Expected output:
```
✓ agentCoordinator    (us-central1)  Enabled
✓ runbookExecutor     (us-central1)  Enabled
```

---

## 🐛 Troubleshooting

### Jobs Not Processing

**Problem:** Jobs stay in `queued` status  
**Solutions:**
1. Check coordinator logs: `firebase functions:log --only agentCoordinator`
2. Verify Pub/Sub schedule is active
3. Check Firestore indexes are built (wait 10 min)
4. Redeploy: `firebase deploy --only functions:agentCoordinator`

---

### Runbooks Not Triggering

**Problem:** Runbook never executes  
**Solutions:**
1. Verify `enabled: true`
2. Check `observability_cache/totals` document exists
3. Verify trigger syntax: `metric>value`
4. Check cooldown hasn't expired
5. Review runbookExecutor logs

---

### Guardian Rejecting Everything

**Problem:** All actions rejected  
**Solutions:**
1. Verify actor UID in `admins` collection:
   ```bash
   # Via Firebase Console > Firestore > admins
   # Or create manually:
   {
     "uid": "YOUR_ADMIN_UID",
     "email": "admin@example.com",
     "roles": ["admin"],
     "highRiskApproved": true
   }
   ```
2. Check `ops_policies/denylist` isn't too restrictive
3. Review guardian logs in `admin_audit`

---

### UI Not Loading

**Problem:** `/admin/ops-assistant` shows error  
**Solutions:**
1. Check Next.js build logs
2. Verify hosting deployment
3. Check browser console for errors
4. Clear cache and reload
5. Verify session cookie is present

---

## 📈 Performance Expectations

### Cloud Functions
- **agentCoordinator:** Runs every 2 minutes, processes up to 10 jobs
- **runbookExecutor:** Runs every 3 minutes, checks all enabled runbooks
- **Processing time:** < 500ms per job
- **Cold start:** ~2 seconds

### API Endpoints
- **GET /agents/jobs:** < 300ms
- **POST /agents/jobs:** < 200ms
- **GET /runbooks:** < 250ms

### Firestore Operations
- **Reads:** ~50 per minute (coordinator)
- **Writes:** ~10 per minute (jobs + audit)

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Functions deployed: `firebase functions:list`
- [ ] Indexes building: Firebase Console > Firestore > Indexes
- [ ] Security policies exist: `ops_policies/denylist`, `ops_policies/protected_targets`
- [ ] Ops Assistant UI loads: `/admin/ops-assistant`
- [ ] Can create test job via API
- [ ] Job processed within 2 minutes
- [ ] Guardian blocks unauthorized action
- [ ] Audit trail in `admin_audit`
- [ ] Runbook created successfully
- [ ] Function logs show activity

---

## 🎯 Quick Actions Reference

### One-Click Buttons in UI

The Ops Assistant provides quick action buttons:

1. **🔄 Restart workerA**
   - Action: `restart_function`
   - Target: `workerA`
   - Goes through guardian validation

2. **🚫 Disable /api/heavy**
   - Action: `disable_endpoint`
   - Target: `/api/heavy`
   - Requires medium-risk approval

3. **⬇️ Reduce Rate**
   - Action: `reduce_rate`
   - Target: `main_api`
   - Reduces rate limit by 50%

---

## 📚 Next Steps

1. **Read Full Documentation**
   - `docs/ADMIN_AUTONOMOUS_OPS.md` (800+ lines)
   - `PHASE_33_AUTONOMOUS_OPS_SUMMARY.md` (complete overview)

2. **Create Production Runbooks**
   - Error rate response
   - Latency spike mitigation
   - Traffic overload handling

3. **Configure Monitoring**
   - Set up alerts for high rejection rate
   - Monitor job queue depth
   - Track runbook trigger frequency

4. **Upgrade to LLM** (Optional)
   - Choose provider (GPT-4, Claude, Gemini)
   - Update `llmBrain.ts`
   - Add API key to environment

5. **Train Your Team**
   - Share Ops Assistant UI
   - Document custom runbooks
   - Establish escalation procedures

---

## 🆘 Get Help

### Documentation
- Full guide: `docs/ADMIN_AUTONOMOUS_OPS.md`
- Summary: `PHASE_33_AUTONOMOUS_OPS_SUMMARY.md`

### Logs
```bash
# Real-time logs
firebase functions:log --tail

# Specific function
firebase functions:log --only agentCoordinator --lines 100
```

### Firestore Console
- https://console.firebase.google.com/project/YOUR_PROJECT/firestore

### Common Issues
- Jobs not processing → Check indexes
- Guardian rejecting → Verify admin in `admins` collection
- Runbooks not triggering → Check `observability_cache/totals`

---

**Quick Start Complete!** 🎊

You now have a fully autonomous operations platform with AI agents, runbooks, and guardian security.

**Next:** Monitor for 24 hours, then create production runbooks! 🚀


