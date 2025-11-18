# 🚀 F0 Extensions - Go-Live Playbook

## ⏰ Timeline (90 minutes)

---

## T-60m: Pre-Flight Checks

### 1. Install & Build
```bash
# Install with frozen lockfile
pnpm install --frozen-lockfile

# Build workspace
pnpm -w build

# Build orchestrator
cd orchestrator && pnpm build && cd ..
```

### 2. Environment Variables Check
```bash
# Required variables:
echo "NEXT_PUBLIC_APPCHECK_SITE_KEY: ${NEXT_PUBLIC_APPCHECK_SITE_KEY:0:20}..."
echo "NEXT_PUBLIC_FIREBASE_VAPID_KEY: ${NEXT_PUBLIC_FIREBASE_VAPID_KEY:0:20}..."
echo "SENTRY_DSN: ${SENTRY_DSN:0:30}..."
```

**Checklist**:
- [ ] `NEXT_PUBLIC_APPCHECK_SITE_KEY` set
- [ ] `NEXT_PUBLIC_FIREBASE_VAPID_KEY` set
- [ ] `SENTRY_DSN` configured (optional)
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY` set
- [ ] Firebase project ID correct

---

## T-30m: Testing Phase

### 1. Smoke Tests
```bash
./scripts/smoke-tests.sh
```
**Expected**: ✅ 7/7 passing

### 2. Complete Test Suite
```bash
pnpm run ext:test
```
**Expected**: ✅ 19/19 passing (12 unit + 7 smoke)

### 3. System Health Check
```bash
pnpm run ext:doctor
```
**Expected**:
- ✅ Node.js version
- ✅ Orchestrator running
- ✅ CLI tools installed
- ✅ Network connectivity

**⚠️ STOP if any test fails! Debug before proceeding.**

---

## T-15m: Deployment

### 1. Firebase Deploy
```bash
# Deploy Functions & Rules
firebase deploy --only functions,firestore:rules --project from-zero-84253

# Deploy Indexes (if needed)
firebase deploy --only firestore:indexes --project from-zero-84253
```

### 2. Web App Deploy
```bash
# Build
npm run build

# Deploy to hosting (choose one):
# - Vercel: vercel --prod
# - Firebase Hosting: firebase deploy --only hosting
# - Other: follow your provider's instructions
```

### 3. Verify Deployment
```bash
# Check Functions
firebase functions:list --project from-zero-84253

# Check Rules
firebase firestore:rules:get --project from-zero-84253
```

---

## T+0: Go Live! 🚀

### Announcement
- [ ] Update status page (if any)
- [ ] Notify team
- [ ] Monitor dashboards

---

## T+15m: Post-Deployment Verification

### 1. Health Check
```bash
# Orchestrator
curl https://your-app.com/readyz
# Expected: {"ok":true,"ts":...}

# Web app
curl https://your-app.com/
# Expected: 200 OK
```

### 2. Admin Dashboard
```bash
# Check audits
open https://your-app.com/admin/audits

# Check diagnostics
open https://your-app.com/admin/diagnostics
```

**Verify**:
- [ ] New audit events appearing
- [ ] chainHash stable
- [ ] No error spikes

### 3. Presence System
```bash
# Check user presence updates (every 30s)
# Firestore: /presence/{uid}/status
```

### 4. Push Notifications
```bash
# Test foreground notification
# Test background notification
# Firebase Console → Cloud Messaging → Send test
```

### 5. Sentry Test
```bash
# Trigger test error
# Check Sentry dashboard for event
```

---

## T+1h: Monitoring Setup

### 1. App Check Status
**Current**: Monitoring mode ✅
**Action**: Keep monitoring for 24-48h

**Firebase Console → App Check**:
- [ ] Coverage > 90%
- [ ] No unusual patterns
- [ ] Tokens refreshing properly

### 2. Set Up Alerts

#### Sentry Alerts
```
Error rate > 1%
Response time > 2s
Failed requests > 10/min
```

#### Cloud Monitoring
```
Functions timeout
Firestore quota exceeded
App Check coverage < 95%
```

#### Custom Alerts
```
Rate limit hits > 100/hour
Extension failures > 5/hour
Audit log gaps detected
```

### 3. Dashboard Monitoring
- [ ] Firebase Console → Functions logs
- [ ] Firestore → Usage
- [ ] Authentication → Usage
- [ ] Sentry → Error tracking

---

## T+24h: Day 1 Review

### Metrics to Check
- [ ] Total requests
- [ ] Error rate (target: <1%)
- [ ] App Check coverage (target: >95%)
- [ ] Average response time (target: <100ms)
- [ ] Rate limit hits
- [ ] Extension runs

### User Feedback
- [ ] Review support tickets
- [ ] Check error reports
- [ ] Monitor social media

### Performance
- [ ] Function execution times
- [ ] Database read/write counts
- [ ] Storage usage

---

## T+48h: App Check Enforcement

### Switch to Enforce Mode

**Prerequisites**:
- [ ] App Check coverage > 95% for 48h
- [ ] No critical issues
- [ ] Error rate < 1%

**Steps**:
1. Firebase Console → App Check
2. Select your app
3. Switch from Monitoring → **Enforce**
4. Monitor for 1 hour after switch

**Rollback Plan**: Switch back to Monitoring if issues

---

## 🧯 Rollback Procedures

### If Critical Issues Detected

#### 1. Quick Rollback (Functions)
```bash
# Firebase Console → Functions → Versions
# Select previous version → "Roll back"

# Or via CLI:
firebase functions:delete <name> --project from-zero-84253
# Then redeploy previous version
```

#### 2. Web App Rollback
```bash
# Git revert
git revert HEAD
git push

# Redeploy
npm run build
# Deploy to hosting
```

#### 3. App Check Rollback
```bash
# Firebase Console → App Check
# Switch back to Monitoring mode
```

#### 4. Communication
- [ ] Notify team
- [ ] Update status page
- [ ] Inform affected users (if needed)

---

## 🛡️ Security & Governance (Verification)

### ✅ Completed Security Features
- [x] Manifest SHA-256 checksums verified
- [x] Rate limiting: 10 runs/min/user
- [x] Timeouts: 60s default, 5min max
- [x] Secrets via ENV only
- [x] Stdout/stderr sanitization
- [x] Audit logging enabled (install/run/validate)
- [x] Hash-chain for audit integrity

### Post-Launch Security Tasks
- [ ] Review audit logs daily (first week)
- [ ] Monitor rate limit hits
- [ ] Check for secret leaks in logs
- [ ] Verify App Check coverage
- [ ] Test emergency rollback procedure

---

## 🎯 Success Criteria (Day 1)

### Must Have ✅
- [x] 19/19 tests passing
- [ ] `/readyz` responding
- [ ] `/audits` updating (≤5s)
- [ ] chainHash stable
- [ ] Push notifications working (FG/BG)
- [ ] Sentry receiving test error

### Nice to Have
- [ ] 0 critical errors
- [ ] Response time < 100ms
- [ ] App Check > 95% coverage
- [ ] User feedback positive

---

## 📋 Post-Launch Checklist

### Immediate (T+0 to T+1h)
- [ ] Health checks passing
- [ ] No error spikes
- [ ] Monitoring active
- [ ] Team notified

### First 24 Hours
- [ ] App Check coverage stable
- [ ] Error rate < 1%
- [ ] Performance baseline established
- [ ] User feedback reviewed

### First Week
- [ ] App Check enforced (after 48h)
- [ ] Alerts fine-tuned
- [ ] Documentation updated
- [ ] Retrospective meeting

---

## 🏷️ Version Tagging

### Create Release Tag
```bash
# Tag the release
git tag v1.0.0 -m "F0 Extensions Platform v1.0.0 (Production-Ready)"

# Push tag
git push origin v1.0.0

# Create GitHub release (optional)
gh release create v1.0.0 \
  --title "F0 Extensions v1.0.0" \
  --notes "Production-ready release with full security hardening"
```

### Update Documentation
```bash
# Update LAUNCH_COMPLETE.txt with today's date
echo "Launch Date: $(date +%Y-%m-%d)" >> LAUNCH_COMPLETE.txt
echo "Smoke Tests: PASSED" >> LAUNCH_COMPLETE.txt
echo "Deployment: SUCCESS" >> LAUNCH_COMPLETE.txt
```

---

## 📞 Emergency Contacts

### Firebase Support
- Console: https://console.firebase.google.com
- Status: https://status.firebase.google.com
- Support: Firebase Console → Support

### Sentry
- Dashboard: https://sentry.io
- Status: https://status.sentry.io

### Team Contacts
- Lead Developer: [Add contact]
- DevOps: [Add contact]
- On-Call: [Add rotation]

---

## 📊 Monitoring Dashboards

### Firebase Console
- Functions: Logs, metrics, versions
- Firestore: Usage, queries, indexes
- Authentication: Users, methods
- App Check: Coverage, metrics

### Sentry
- Errors: Count, frequency, users affected
- Performance: Transaction times
- Releases: Version tracking

### Custom Dashboards
- Admin: `/admin/diagnostics`
- Audits: `/admin/audits`
- Orchestrator: `http://localhost:8080/readyz`

---

## ✅ Final Checklist

### Pre-Launch
- [x] All tests passing (19/19)
- [x] Security hardened
- [x] Documentation complete
- [ ] Environment variables set
- [ ] Backup plan ready

### Launch
- [ ] Firebase deployed
- [ ] Web app deployed
- [ ] Health checks passing
- [ ] Monitoring active

### Post-Launch
- [ ] No critical errors
- [ ] App Check monitoring
- [ ] Alerts configured
- [ ] Team briefed

---

## 🎊 Success!

**When all checks pass**:
```
✅ F0 Extensions Platform is LIVE!
✅ All systems operational
✅ Monitoring active
✅ Team ready

🚀 Congratulations on a successful launch! 🚀
```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-12
**Next Review**: After 48h monitoring
