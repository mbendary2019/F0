# 🚀 Phase 36 Quick Deploy Guide

**3 Commands. 10 Minutes. Production-Grade Security!**

---

## ✅ Pre-Deployment Checklist

- [x] ✅ Phase 36 files created (12 files)
- [x] ✅ Firestore rules ready (`firestore.rules.phase36.secure`)
- [x] ✅ Audit system implemented
- [x] ✅ Dashboard ready
- [x] ✅ Documentation complete

---

## 🔥 Quick Deploy (3 Commands)

### Command 1: Deploy Firestore Rules

```bash
cd /Users/abdo/Downloads/from-zero-starter

# Copy Phase 36 rules
cp firestore.rules.phase36.secure firestore.rules

# Deploy
firebase deploy --only firestore:rules --project from-zero-84253
```

**Expected Output:**
```
✔  firestore: released rules firestore.rules to cloud.firestore
✔  Deploy complete!
```

**Time:** ~10 seconds

---

### Command 2: Install Sentry & Deploy Functions

```bash
# Install Sentry dependency
cd functions
npm install @sentry/node --save

# Build TypeScript
npm run build

# Deploy functions
cd ..
firebase deploy --only functions --project from-zero-84253
```

**Expected Output:**
```
✔  functions: 16+ functions deployed successfully
✔  Deploy complete!
```

**Time:** ~5-8 minutes

**Note:** If you get TypeScript errors, try:
```bash
cd functions
npx tsc --skipLibCheck
cd ..
firebase deploy --only functions
```

---

### Command 3: Test Audit System

```bash
# Test audit API
curl http://localhost:3000/api/audits | jq

# Expected: {"ok":true,"events":[],"total":0,"day":"all"}

# Open dashboard
open http://localhost:3000/admin/audits
# Or visit: http://localhost:3000/admin/audits in browser
```

---

## 🔑 Optional: Set Sentry DSN

```bash
# Add to functions/.env
echo "SENTRY_DSN=https://YOUR_KEY@sentry.io/PROJECT_ID" >> functions/.env

# Or via Firebase config
firebase functions:config:set sentry.dsn="YOUR_SENTRY_DSN" --project from-zero-84253

# Redeploy
firebase deploy --only functions
```

---

## 🧪 Quick Tests

### Test 1: Audit Logging

```typescript
// In any Cloud Function (e.g., functions/src/index.ts)
import { writeAudit } from './audit';

// Add to existing function
export const readyz = functions.https.onRequest(async (req, res) => {
  await writeAudit({
    action: 'healthcheck.ping',
    actor: { uid: 'system', ip: req.ip },
    ok: true,
  });

  res.json({ ok: true, ts: Date.now() });
});
```

**Test it:**
```bash
curl https://us-central1-from-zero-84253.cloudfunctions.net/readyz

# Check dashboard for logged event
open http://localhost:3000/admin/audits
```

### Test 2: Chain Verification

```bash
# Get today's date
TODAY=$(date +%Y-%m-%d)

# Verify chain integrity
curl "http://localhost:3000/api/audits/verify?day=$TODAY" | jq

# Expected:
# {
#   "ok": true,
#   "valid": true,
#   "totalEvents": 5,
#   "brokenLinks": [],
#   "message": "✅ Chain integrity verified: 5 events"
# }
```

### Test 3: Dashboard Features

1. **Open Dashboard:**
   ```bash
   open http://localhost:3000/admin/audits
   ```

2. **Verify Features:**
   - ✅ Auto-refresh every 5 seconds
   - ✅ Success rate stats
   - ✅ Failed events counter
   - ✅ Filter by action/UID
   - ✅ Export to CSV button
   - ✅ Hash chain visualization

3. **Test Filtering:**
   - Enter "healthcheck" in action filter
   - Click outside input (debounced update)
   - Events should filter in real-time

---

## 🛡️ Enable App Check (Optional)

Follow the complete guide: `APP_CHECK_SETUP.md`

**Quick Steps:**

1. **Enable in Firebase Console:**
   ```
   https://console.firebase.google.com/project/from-zero-84253/appcheck
   ```

2. **Add debug token (dev):**
   ```bash
   # Get token from Firebase Console
   echo "NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=your-token" >> .env.local
   ```

3. **Enable enforcement (production):**
   ```typescript
   // In callable functions
   export const heartbeat = onCall(
     { enforceAppCheck: true },
     async (request) => { /* ... */ }
   );
   ```

---

## 📊 Monitoring

### Firebase Console

**Functions:**
https://console.firebase.google.com/project/from-zero-84253/functions

**Firestore:**
https://console.firebase.google.com/project/from-zero-84253/firestore

**App Check (when enabled):**
https://console.firebase.google.com/project/from-zero-84253/appcheck

### Sentry (when configured)

https://sentry.io/organizations/YOUR_ORG/issues/

### Audit Dashboard

http://localhost:3000/admin/audits (dev)
https://yourapp.web.app/admin/audits (prod)

---

## 🔧 Troubleshooting

### Issue: "Cannot find module '@sentry/node'"

**Solution:**
```bash
cd functions
npm install @sentry/node --save
npm run build
```

### Issue: TypeScript build fails

**Solution:**
```bash
cd functions
npx tsc --skipLibCheck
# Or adjust tsconfig.json:
# "strict": false
```

### Issue: Firestore Rules deployment fails

**Solution:**
```bash
# Verify rules syntax
firebase firestore:rules:validate firestore.rules

# Check Firebase billing (Blaze plan required for some features)
```

### Issue: Dashboard shows no events

**Possible Causes:**
1. No functions have been called yet → Test `readyz` endpoint
2. Audit logging not integrated → Add `writeAudit()` calls
3. Firestore rules blocking reads → Check admin token

**Solution:**
```bash
# Generate test event
curl https://us-central1-from-zero-84253.cloudfunctions.net/readyz

# Check Firestore directly
firebase firestore:get audits_meta/$(date +%Y-%m-%d) --project from-zero-84253
```

---

## 🔐 Security Checklist

### Immediate (< 1 day)
- [ ] Firestore rules deployed
- [ ] Audit system tested
- [ ] Dashboard accessible
- [ ] At least 1 admin user created

### Short-term (< 1 week)
- [ ] Sentry DSN configured
- [ ] App Check enabled (monitoring mode)
- [ ] Key rotation runbook reviewed
- [ ] Admin access documented

### Long-term (< 1 month)
- [ ] App Check enforced
- [ ] Weekly chain verification scheduled
- [ ] BigQuery export configured (optional)
- [ ] Quarterly key rotation scheduled

---

## 📚 Next Steps

### 1. Integrate Audit Logging

Add `writeAudit()` to critical functions:

```typescript
import { writeAudit } from './audit';

export const deployProject = onCall(async (data, context) => {
  const start = Date.now();
  let ok = true;

  try {
    // ... deployment logic
  } catch (error) {
    ok = false;
    throw error;
  } finally {
    await writeAudit({
      action: 'deploy.project',
      actor: {
        uid: context.auth?.uid || 'anon',
        email: context.auth?.token?.email,
        ip: context.rawRequest?.ip,
      },
      target: {
        type: 'project',
        id: data.projectId,
      },
      ok,
      latencyMs: Date.now() - start,
    });
  }
});
```

### 2. Create Admin Users

```typescript
// In Firebase Console or via Admin SDK
import { getAuth } from 'firebase-admin/auth';

const auth = getAuth();
await auth.setCustomUserClaims(uid, { admin: true, role: 'admin' });
```

### 3. Set Up Weekly Chain Verification

```typescript
// Scheduled function (every Sunday)
export const verifyAuditChains = pubsub.schedule('0 0 * * 0')
  .onRun(async () => {
    const days = last7Days();
    const results = await Promise.all(
      days.map(day => verifyAuditChain(day))
    );

    const invalid = results.filter(r => !r.valid);
    if (invalid.length > 0) {
      // Alert security team
      await Sentry.captureMessage('Audit chain integrity compromised!', 'critical');
    }
  });
```

---

## ✅ Success Criteria

Phase 36 is successfully deployed when:

1. ✅ Firestore rules deployed (admin-only audit access)
2. ✅ Cloud Functions deployed (with Sentry)
3. ✅ Dashboard accessible (`/admin/audits`)
4. ✅ Audit events being logged
5. ✅ Chain verification passes
6. ✅ No errors in Firebase Console

---

## 🎉 You're Done!

**Phase 36 is now live in your environment!**

Your platform now has:
- ✅ Tamper-evident audit logs
- ✅ Real-time security dashboard
- ✅ RBAC hardening
- ✅ Sentry error tracking
- ✅ Complete documentation

**Next:** Enable App Check and configure Sentry for full production readiness!

---

**Version:** 1.0.0  
**Status:** ✅ Ready to Deploy  
**Time Estimate:** 10 minutes  
**Difficulty:** Easy

**Good luck! 🚀**


