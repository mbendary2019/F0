# Phase 35 Runbook

## Overview

This runbook covers operational procedures for Phase 35 Cognitive Auto-Ops system.

---

## Routine Operations

### Scheduled Tasks

| Function | Schedule | Purpose | Output |
|----------|----------|---------|--------|
| AutoScaler | Every 5 minutes | Adjust resources based on load | `config/runtime` |
| Watchdog | Every 5 minutes | Self-healing health checks | `config/canary`, cache signals |
| FeedbackLoop | Every 15 minutes | Generate cognitive reports | `ops/reports/latest` |
| CanaryManager | Every 5 minutes | Progressive rollout control | `config/canary` |

### Data Collection

**Every API Request:**
- Record latency
- Track success/error
- Update rolling window stats

**Every 5 Minutes:**
- Aggregate metrics to `ops_stats/current`
- Calculate SLO metrics to `ops_slo/window`
- Update health check status in `ops_health/readyz`

### Deployment Flow

1. **Code Push to `main`**
   - CI/CD builds and tests
   - Deploys functions to Firebase
   - Sets initial canary rollout to 10%

2. **Canary Progression** (every 5 minutes)
   - 10% → 25% → 40% → 55% → 70% → 85% → 100%
   - SLOs monitored at each step
   - Auto-promote if healthy
   - Auto-rollback if breach detected

3. **Promotion to 100%**
   - All traffic on new version
   - Previous version retained for quick rollback
   - Canary config reset for next deployment

---

## Manual Commands

### Force Full Rollout

```bash
# Method 1: Direct Firestore update
firebase firestore:update config/canary '{"rolloutPercent":100,"lastDecision":"manual_promote"}'

# Method 2: Using helper script
node scripts/set-canary.js 100
```

**When to use:**
- Emergency security patch
- Critical bug fix
- Confidence in deployment (all tests passed)

### Force Rollback

```bash
# Method 1: Direct Firestore update
firebase firestore:update config/canary '{"rolloutPercent":0,"rollbackRequested":true,"lastDecision":"manual_rollback"}'

# Method 2: Using helper script
node scripts/set-canary.js 0 --rollback
```

**When to use:**
- SLO breach detected manually
- Customer complaints
- Security vulnerability discovered

### Pause Canary Progression

```bash
# Hold at current percentage
firebase firestore:update config/canary '{"rolloutPercent":25,"paused":true}'

# Resume progression
firebase firestore:update config/canary '{"paused":false}'
```

**When to use:**
- Investigating anomaly
- Awaiting external dependency
- Coordinating with stakeholder

### View Current State

```bash
# Get all ops metrics
firebase firestore:get ops_stats/current
firebase firestore:get ops_slo/window
firebase firestore:get ops_health/readyz

# Get current config
firebase firestore:get config/runtime
firebase firestore:get config/canary

# Get latest cognitive report
firebase firestore:get ops/reports/latest
```

### View Function Logs

```bash
# All ops functions
firebase functions:log --only autoScaler,watchdog,feedbackLoop,canaryManager

# Specific function
firebase functions:log --only canaryManager --limit 50

# Follow real-time
firebase functions:log --only watchdog --follow

# Filter by time
firebase functions:log --only feedbackLoop --since 1h
```

### Manual Metric Updates

```bash
# Reset error count
firebase firestore:update ops_stats/current '{"errorRate":0}'

# Reset health check failures
firebase firestore:update ops_health/readyz '{"failCount":0,"ok":true}'

# Clear cache invalidation signal
firebase firestore:delete ops_signals/cache
```

---

## Incident Response

### Alert Types

#### 1. High Error Rate Alert

**Trigger:** Error rate > 1% for 5 minutes

**Automatic Response:**
- AutoScaler applies throttle (0.7x)
- FeedbackLoop flags in next report
- No automatic rollback (error rate alone)

**Manual Steps:**
1. Check latest cognitive report:
   ```bash
   firebase firestore:get ops/reports/latest
   ```

2. Review function logs for errors:
   ```bash
   firebase functions:log --since 15m | grep ERROR
   ```

3. Identify failing endpoint/function:
   ```bash
   # Check error distribution
   firebase firestore:query admin_audit --where status==500 --limit 20
   ```

4. Decide on action:
   - If isolated issue: fix and deploy patch
   - If widespread: rollback immediately
   - If external dependency: enable graceful degradation

5. Create incident document:
   ```bash
   firebase firestore:set incidents/$(date +%s) '{
     "type": "high_error_rate",
     "startTime": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
     "severity": "high",
     "status": "investigating"
   }'
   ```

#### 2. High Latency Alert

**Trigger:** p95 > 900ms for 5 minutes

**Automatic Response:**
- AutoScaler increases concurrency
- Reduces cache TTL for freshness
- FeedbackLoop recommends investigation

**Manual Steps:**
1. Check current load and capacity:
   ```bash
   firebase firestore:get ops_stats/current
   firebase firestore:get config/runtime
   ```

2. Review slow queries/operations:
   ```bash
   firebase functions:log --since 15m | grep "latency"
   ```

3. Identify bottlenecks:
   - Database query performance
   - External API calls
   - Cold starts

4. Apply fixes:
   - Increase concurrency manually if needed
   - Add indexes for slow queries
   - Implement caching for expensive operations

5. Monitor improvement:
   ```bash
   watch -n 10 'firebase firestore:get ops_stats/current'
   ```

#### 3. Health Check Failure

**Trigger:** 3+ consecutive health check failures

**Automatic Response:**
- Watchdog sets `rollbackRequested: true`
- CanaryManager rolls back to 0%
- Cache invalidation signal sent

**Manual Steps:**
1. Confirm rollback occurred:
   ```bash
   firebase firestore:get config/canary
   ```

2. Investigate root cause:
   ```bash
   firebase firestore:get ops_health/readyz
   firebase functions:log --only watchdog --limit 20
   ```

3. Check for:
   - Database connectivity issues
   - External service outages
   - Configuration errors
   - Memory/CPU exhaustion

4. Fix underlying issue

5. Clear health check failures:
   ```bash
   firebase firestore:update ops_health/readyz '{"failCount":0,"ok":true,"lastError":null}'
   ```

6. Resume deployment after verification

#### 4. Canary Rollback Triggered

**Trigger:** SLO breach during canary deployment

**Automatic Response:**
- CanaryManager sets rollout to 0%
- Previous stable version serves 100% traffic

**Manual Steps:**
1. Review canary decision:
   ```bash
   firebase firestore:get config/canary
   ```

2. Check what caused breach:
   ```bash
   firebase firestore:get ops_slo/window
   firebase firestore:get ops/reports/latest
   ```

3. Analyze deployment diff:
   ```bash
   git log -1 --stat
   git show HEAD
   ```

4. Identify problematic changes

5. Options:
   - **Quick Fix:** Apply patch and redeploy
   - **Revert:** Revert commit and redeploy
   - **Investigate:** Keep at 0% while debugging

6. Document incident:
   ```bash
   firebase firestore:set incidents/canary_$(date +%s) '{
     "type": "canary_rollback",
     "commit": "'$(git rev-parse HEAD)'",
     "reason": "SLO breach - error rate spike",
     "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
   }'
   ```

---

## Escalation Procedures

### Severity Levels

**P0 - Critical (Page Immediately)**
- Complete service outage
- Data loss or corruption
- Security breach

**P1 - High (Alert Team)**
- Multiple SLO breaches
- Automated rollback failed
- Customer-impacting errors

**P2 - Medium (Business Hours)**
- Single SLO breach
- Non-critical feature degradation
- Performance degradation

**P3 - Low (Monitor)**
- Single metric anomaly
- FeedbackLoop recommendation
- Capacity planning alert

### On-Call Response

1. **Acknowledge alert** (within 5 minutes)
2. **Assess severity** (within 10 minutes)
3. **Begin mitigation** (within 15 minutes)
4. **Communicate status** (within 30 minutes)
5. **Resolve or escalate** (within 1 hour for P0/P1)

### Communication Channels

- **Status Page:** Update public status
- **Internal Slack:** #incidents channel
- **Email:** ops@fz-labs.io for stakeholders
- **Pager:** On-call engineer via PagerDuty

---

## Maintenance Procedures

### Weekly Tasks

**Monday:**
- Review cognitive reports from previous week
- Check for trending issues
- Update capacity plans

**Wednesday:**
- Review canary rollback incidents
- Tune AutoScaler thresholds if needed
- Check monitoring alert accuracy

**Friday:**
- Review SLO compliance for the week
- Update runbook based on incidents
- Plan infrastructure improvements

### Monthly Tasks

- Export metrics to BigQuery for analysis
- Review and update SLO targets
- Conduct incident retrospectives
- Update disaster recovery procedures

### Quarterly Tasks

- Load testing and capacity validation
- Security audit of ops functions
- Review and optimize Cloud Functions costs
- Update documentation and training materials

---

## Tuning Guide

### AutoScaler Thresholds

Current values in `functions/src/ops/autoScaler.ts`:

```typescript
const highLoad = stats.rps > 120 || stats.p95ms > 800;
const degraded = stats.errorRate > 0.02 || stats.p95ms > 1200;
```

**Adjust based on:**
- Historical traffic patterns
- Infrastructure capacity
- Cost constraints
- SLO targets

**Example: Increase sensitivity**
```typescript
const highLoad = stats.rps > 100 || stats.p95ms > 600;
const degraded = stats.errorRate > 0.01 || stats.p95ms > 900;
```

### Watchdog Sensitivity

Current threshold: 3 consecutive failures

**Increase for stability** (fewer false positives):
```typescript
if (!health.ok && (health.failCount ?? 0) >= 5) {
  // More conservative
}
```

**Decrease for responsiveness** (faster reaction):
```typescript
if (!health.ok && (health.failCount ?? 0) >= 2) {
  // More aggressive
}
```

### Canary Progression Rate

Current: +15% every 5 minutes

**Slower (safer):**
```typescript
next = Math.min(100, next + 10); // 10% increments
```

**Faster (aggressive):**
```typescript
next = Math.min(100, next + 20); // 20% increments
```

### FeedbackLoop Thresholds

Current recommendation triggers:

```typescript
if ((s.errorRate ?? 0) > 0.01) // 1% error rate
if ((s.p95ms ?? 0) > 800)      // 800ms latency
if (h.ok === false)             // Health check fail
```

**Adjust based on SLO targets and noise levels**

---

## Troubleshooting Common Issues

### Issue: Functions Not Running on Schedule

**Symptoms:**
- Metrics not updating
- Reports stale
- Config not changing

**Diagnosis:**
```bash
# Check scheduler jobs
gcloud scheduler jobs list

# Check function logs
firebase functions:log --only autoScaler --since 1h
```

**Solutions:**
- Verify Firebase project has Cloud Scheduler enabled
- Check IAM permissions for scheduler
- Redeploy functions: `firebase deploy --only functions`

### Issue: High False Positive Rate on Alerts

**Symptoms:**
- Frequent alerts during normal operation
- Unnecessary rollbacks
- Alert fatigue

**Diagnosis:**
- Review alert history
- Compare thresholds to actual metrics
- Check for metric collection issues

**Solutions:**
- Increase alert thresholds
- Add longer evaluation windows
- Implement alert dampening

### Issue: Canary Stuck at Low Percentage

**Symptoms:**
- Rollout not progressing past 10-25%
- No obvious SLO breach
- Manual promotion required

**Diagnosis:**
```bash
firebase firestore:get config/canary
firebase firestore:get ops_slo/window
firebase functions:log --only canaryManager
```

**Solutions:**
- Check for `paused: true` flag
- Verify CanaryManager is running
- Check SLO calculation accuracy
- Manual promote if metrics are healthy

### Issue: AutoScaler Oscillating

**Symptoms:**
- Config changing too frequently
- Alternating between high/low concurrency
- Unstable performance

**Diagnosis:**
- Review AutoScaler decisions over time
- Check metric stability
- Look for feedback loops

**Solutions:**
- Add hysteresis (delay between changes)
- Smooth metrics with moving average
- Increase decision interval

---

## Emergency Procedures

### Complete System Outage

1. **Immediate Actions:**
   ```bash
   # Rollback all traffic
   node scripts/set-canary.js 0 --rollback

   # Check health
   curl https://readyz-vpxyxgcfbq-uc.a.run.app
   ```

2. **Investigate:**
   - Check Cloud Status Dashboard
   - Review recent deployments
   - Check database connectivity

3. **Communicate:**
   - Update status page
   - Notify stakeholders
   - Page on-call team

4. **Resolve:**
   - Apply fix or rollback
   - Verify restoration
   - Post-mortem within 48 hours

### Database Failure

1. **Detect:**
   - Health checks failing
   - Firestore errors in logs
   - Timeout errors

2. **Respond:**
   - Enable read-only mode
   - Serve from cache
   - Contact Firebase support

3. **Recover:**
   - Wait for service restoration
   - Verify data integrity
   - Resume normal operations

### Security Incident

1. **Contain:**
   - Immediate rollback
   - Disable affected endpoints
   - Rotate credentials

2. **Assess:**
   - Scope of breach
   - Data exposure
   - Attack vector

3. **Remediate:**
   - Apply security patch
   - Audit all access
   - Notify affected users

---

## Appendix

### Useful Queries

**High-error endpoints:**
```bash
firebase firestore:query admin_audit \
  --where status==500 \
  --order-by ts desc \
  --limit 50
```

**Slow operations:**
```bash
firebase functions:log --since 1h | grep "latency" | sort -k4 -n | tail -20
```

**Recent canary decisions:**
```bash
firebase firestore:query ops/reports/history \
  --order-by ts desc \
  --limit 10 \
  --select recommendations
```

### Reference Links

- Firebase Console: https://console.firebase.google.com
- Cloud Monitoring: https://console.cloud.google.com/monitoring
- Status Page: https://status.fz-labs.io
- Incident Log: https://dashboard.fz-labs.io/incidents

---

**Last Updated:** 2025-10-12
**Version:** 1.0
**Maintainer:** DevOps Team
