# Admin RBAC Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. Code Quality & Testing
- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run lint` passes (or only minor warnings)
- [ ] `npm test` passes all unit tests
- [ ] Manual testing of admin endpoints completed
- [ ] Smoke tests pass: `./scripts/smoke-admin.sh http://localhost:3000`

### 2. Security Review
- [ ] Session cookies have `Secure`, `HttpOnly`, `SameSite=Lax/Strict` flags
- [ ] All `/api/admin/*` routes protected by `assertAdminReq()`
- [ ] Rate limiting middleware active on admin routes (60 req/min)
- [ ] CSRF protection via Origin check enabled for production
- [ ] Audit logging connected to Firestore (not console.log)
- [ ] No sensitive data logged in audit records (passwords, tokens, etc.)

### 3. Configuration
- [ ] `NEXT_PUBLIC_BASE_URL` set correctly in production env
- [ ] Firebase Admin SDK credentials configured
- [ ] Firestore indexes created (if needed for admin_audit queries)
- [ ] Environment variables verified:
  ```bash
  # Required
  NEXT_PUBLIC_BASE_URL=https://your-domain.com
  # Firebase Admin SDK will use default credentials or GOOGLE_APPLICATION_CREDENTIALS
  ```

### 4. Documentation
- [ ] README updated with admin features
- [ ] API documentation includes admin endpoints
- [ ] Team notified about new admin capabilities
- [ ] Runbook created for common admin operations

---

## 🚀 Deployment Steps

### Phase 1: Deploy to Staging (15 min)

1. **Deploy Code**
   ```bash
   git checkout main
   git pull origin main
   git merge feature/admin-rbac
   npm run build
   # Deploy to staging environment
   vercel deploy --prebuilt  # or your deployment command
   ```

2. **Verify Deployment**
   ```bash
   ./scripts/smoke-admin.sh https://staging.your-domain.com
   ```

3. **Manual Testing**
   - [ ] Visit `/admin` - should load without errors
   - [ ] Visit `/api/me` - should return user profile
   - [ ] Visit `/api/admin/admins` - should list admins (if you're admin)
   - [ ] Test grant role: `POST /api/admin/users/{uid}/grant`
   - [ ] Test revoke role: `POST /api/admin/users/{uid}/revoke`

4. **Check Firestore**
   - [ ] Open Firestore console
   - [ ] Navigate to `admin_audit` collection
   - [ ] Verify audit records appear after admin actions
   - [ ] Check that IP and User-Agent are captured

5. **Monitor for 15 minutes**
   - [ ] Check error logs (should be clean)
   - [ ] Verify response times < 500ms
   - [ ] Check rate limiting works (try 61+ requests in 1 minute)

### Phase 2: Deploy to Production (30 min)

1. **Final Pre-Flight Checks**
   ```bash
   # Verify staging is stable
   # Review any error logs from staging
   # Confirm all checklist items above
   ```

2. **Create Backup**
   ```bash
   # Backup current production build
   # Note: Firestore has automatic backups, but verify:
   # - Point-in-time recovery enabled
   # - Backup retention policy set
   ```

3. **Deploy to Production**
   ```bash
   git checkout main
   npm run build
   # Deploy to production
   vercel deploy --prod  # or your deployment command
   ```

4. **Post-Deployment Verification** (within 5 minutes)
   - [ ] Visit `https://your-domain.com/admin` - loads successfully
   - [ ] Check `/api/me` returns expected shape
   - [ ] Check `/api/admin/admins` (must be admin to test)
   - [ ] Verify admin action creates audit log in Firestore
   - [ ] Test rate limiting doesn't affect normal users
   - [ ] Check error logs - should be clean

5. **Monitoring** (first 24 hours)
   ```bash
   # Check logs every hour for first 4 hours
   # Then every 4 hours for rest of day
   
   # Key metrics to watch:
   # - Error rate on /api/admin/* routes (target: <0.1%)
   # - p95 latency (target: <400ms)
   # - Rate limit rejections (target: ~0, only from actual abuse)
   # - Audit log creation rate (should match admin actions)
   ```

6. **Success Criteria**
   - [ ] No 5xx errors on admin routes
   - [ ] 4xx errors only for unauthorized access (expected)
   - [ ] Admin actions visible in Firestore audit log
   - [ ] Response times within acceptable range
   - [ ] No customer impact reported

---

## 🔄 Rollback Plan

If issues arise, follow this rollback procedure:

### Quick Rollback (< 5 minutes)

1. **Disable Admin Routes via Feature Flag** (if available)
   ```typescript
   // In middleware.ts or admin routes
   if (!process.env.ADMIN_ENABLED || process.env.ADMIN_ENABLED !== 'true') {
     return new Response('Service Temporarily Unavailable', { status: 503 });
   }
   ```

2. **Revert to Previous Deployment**
   ```bash
   # Vercel example
   vercel rollback
   
   # Or redeploy previous git commit
   git checkout <previous-commit-hash>
   npm run build
   vercel deploy --prod
   ```

3. **Verify Rollback**
   ```bash
   # Check that admin routes return 503 or are not accessible
   curl -I https://your-domain.com/api/admin/admins
   # Should return 503 or 404
   ```

### Root Cause Analysis

After rollback, investigate:
- Error logs and stack traces
- Firestore write patterns (excessive writes?)
- Rate limiting impact on legitimate traffic
- Any security issues reported

---

## 📊 Post-Deployment Monitoring

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Error Rate (admin routes) | <0.1% | >1% |
| p95 Latency | <400ms | >800ms |
| Rate Limit Rejections | ~0 | >10/hour |
| Audit Log Write Success | >99.9% | <95% |
| Unauthorized Access (403) | Expected | Spike >100/min |

### Monitoring Commands

```bash
# Check recent admin actions
# (Firestore Console → admin_audit collection → Sort by timestamp desc)

# Check error logs
vercel logs --follow  # or your logging command

# Test rate limiting
for i in {1..65}; do 
  curl -s -o /dev/null -w "%{http_code}\n" https://your-domain.com/api/admin/admins
done
# Last 5 should return 429
```

### Alert Setup

Recommended alerts:
1. **Error Rate Alert**: >1% errors on `/api/admin/*` for 5 minutes
2. **Latency Alert**: p95 >800ms for 10 minutes
3. **Security Alert**: >100 403 errors from same IP in 1 minute
4. **Audit Log Alert**: No writes to `admin_audit` for >1 hour (if admin activity expected)

---

## 🔒 Security Hardening (Post-Launch)

After successful deployment, consider:

1. **IP Allowlisting** (optional for extra security)
   ```typescript
   // In middleware.ts
   const ADMIN_ALLOWED_IPS = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];
   if (ADMIN_ALLOWED_IPS.length > 0 && !ADMIN_ALLOWED_IPS.includes(ip)) {
     return new Response('Forbidden', { status: 403 });
   }
   ```

2. **Admin Session Timeout**
   - Reduce session duration for admin users (e.g., 15 minutes instead of 24 hours)

3. **Two-Factor Authentication**
   - Require 2FA for all admin accounts

4. **Audit Log Retention**
   - Set up Firestore TTL for old audit logs (retain 90+ days)
   - Export to cold storage for compliance

5. **Admin Activity Dashboard**
   - Build real-time dashboard of admin actions
   - Set up alerts for suspicious patterns

---

## 📞 Incident Response

If a security incident is detected:

1. **Immediate Actions**
   - Disable admin routes via feature flag
   - Review audit logs for unauthorized actions
   - Check for compromised admin accounts
   - Rotate any exposed credentials

2. **Investigation**
   - Query `admin_audit` for suspicious activity
   - Check IP addresses and user agents
   - Review recent role grants/revokes

3. **Communication**
   - Notify security team
   - Document timeline of events
   - Prepare incident report

4. **Recovery**
   - Revoke compromised admin roles
   - Reset affected user permissions
   - Re-enable admin routes after fixes

---

## ✅ Post-Deployment Sign-Off

Deployment is complete when:
- [ ] All smoke tests pass
- [ ] No errors in logs for 1 hour
- [ ] Admin actions successfully logged to Firestore
- [ ] Rate limiting verified working
- [ ] Team trained on new admin features
- [ ] Monitoring and alerts configured
- [ ] Rollback plan tested and ready

**Deployed by**: _________________  
**Date**: _________________  
**Sign-off**: _________________

---

## 📚 Additional Resources

- [Admin RBAC Documentation](./ADMIN_RBAC.md)
- [API Reference](../QUICK_START.md#admin-features)
- [Security Checklist](../SECURITY-CHECKLIST.md)
- [Firestore Rules](../firestore.rules)

