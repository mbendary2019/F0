# Phase 35 – Cognitive Auto-Ops

**Goals**
1) Auto-scale behavior based on live load
2) Self-healing scheduled checks
3) Cognitive feedback loop that summarizes issues & proposes actions
4) Canary rollouts with automatic rollback if SLOs breach
5) Unified Ops dashboard (web) for real-time view

**KPIs**
- p95 latency < 600ms for public APIs
- Error rate < 1% over 5-minute windows
- MTTR < 10 minutes (auto remediation)
- Canary rollback < 3 minutes after breach

**Runbook**: see `docs/PHASE_35_RUNBOOK.md`.

## Architecture Overview

### Components

1. **AutoScaler** (`functions/src/ops/autoScaler.ts`)
   - Runs every 5 minutes
   - Monitors: RPS, error rate, p95 latency
   - Adjusts: concurrency, cache TTL, throttle rate
   - Stores decisions in `config/runtime`

2. **Watchdog** (`functions/src/ops/watchdog.ts`)
   - Runs every 5 minutes
   - Monitors health checks
   - Triggers rollback if 3+ consecutive failures
   - Invalidates caches on degradation

3. **FeedbackLoop** (`functions/src/ops/feedbackLoop.ts`)
   - Runs every 15 minutes
   - Aggregates metrics and health data
   - Generates cognitive recommendations
   - Stores reports in `ops/reports/latest` and history

4. **CanaryManager** (`functions/src/ops/canaryManager.ts`)
   - Runs every 5 minutes
   - Progressive rollout: 10% → 25% → 40% → 55% → 70% → 85% → 100%
   - Monitors SLOs during rollout
   - Auto-rollback on breach

### Data Flow

```
┌─────────────┐
│  API Layer  │ → writes metrics
└─────┬───────┘
      │
      v
┌─────────────────────────────────────────────┐
│          Firestore Collections              │
│                                             │
│  ops_stats/current    → { rps, p95ms, ... }│
│  ops_slo/window       → { errorRate, ... } │
│  ops_health/readyz    → { ok, failCount }  │
└─────┬───────────────────────────────────────┘
      │
      v
┌─────────────────────────────────────────────┐
│      Scheduled Cloud Functions              │
│                                             │
│  autoScaler    (5m)  → config/runtime      │
│  watchdog      (5m)  → config/canary       │
│  feedbackLoop  (15m) → ops/reports/latest  │
│  canaryManager (5m)  → config/canary       │
└─────┬───────────────────────────────────────┘
      │
      v
┌─────────────┐
│  API Layer  │ ← reads config
└─────────────┘
```

### Firestore Schema

#### Input Collections (written by API layer)

**`ops_stats/current`**
```json
{
  "rps": 45.2,
  "p95ms": 234,
  "errorRate": 0.003,
  "timestamp": "2025-10-12T08:00:00Z"
}
```

**`ops_slo/window`**
```json
{
  "errorRate": 0.005,
  "p95ms": 456,
  "windowStart": "2025-10-12T07:55:00Z",
  "windowEnd": "2025-10-12T08:00:00Z"
}
```

**`ops_health/readyz`**
```json
{
  "ok": true,
  "failCount": 0,
  "lastError": null,
  "lastCheck": "2025-10-12T08:00:00Z"
}
```

#### Output Collections (written by ops functions)

**`config/runtime`**
```json
{
  "concurrency": 80,
  "cacheTtl": 300,
  "throttle": 1.0,
  "updatedAt": "2025-10-12T08:00:00Z",
  "reason": "normal"
}
```

**`config/canary`**
```json
{
  "rolloutPercent": 55,
  "rollbackRequested": false,
  "lastDecision": "promote",
  "updatedAt": "2025-10-12T08:00:00Z"
}
```

**`ops/reports/latest`**
```json
{
  "ts": "2025-10-12T08:00:00Z",
  "rps": 45.2,
  "p95ms": 234,
  "errorRate": 0.003,
  "healthOk": true,
  "recommendations": [
    "All green. Maintain current rollout."
  ]
}
```

## Implementation Guide

### Step 1: Deploy Functions

```bash
# Deploy all ops functions
firebase deploy --only functions:autoScaler,functions:watchdog,functions:feedbackLoop,functions:canaryManager

# Verify deployment
firebase functions:log --only autoScaler
```

### Step 2: Instrument API Layer

Add metric collection to your API routes:

```typescript
// Example: API route with metrics
import { db } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  const startTime = Date.now();

  try {
    // Your API logic here
    const result = await someOperation();

    // Record success
    await recordMetric({
      latency: Date.now() - startTime,
      success: true
    });

    return Response.json(result);
  } catch (error) {
    // Record error
    await recordMetric({
      latency: Date.now() - startTime,
      success: false
    });

    throw error;
  }
}

async function recordMetric(data: { latency: number; success: boolean }) {
  const statsRef = db.doc('ops_stats/current');

  // Update rolling window stats
  await statsRef.set({
    rps: FieldValue.increment(1/300), // 5-minute window
    p95ms: data.latency, // Simplified; use proper percentile calculation
    errorRate: data.success ? 0 : 0.01,
    timestamp: FieldValue.serverTimestamp()
  }, { merge: true });
}
```

### Step 3: Deploy Dashboard

```bash
# Build and deploy web app
npm run build
firebase deploy --only hosting
```

### Step 4: Configure Monitoring

1. Import alerts to Google Cloud Monitoring
2. Set up notification channels (email, Slack, PagerDuty)
3. Configure SLO tracking

## Operational Guidelines

### Normal Operation

- AutoScaler adjusts resources based on load
- Watchdog monitors health checks
- FeedbackLoop generates insights every 15 minutes
- CanaryManager gradually promotes deployments

### Degradation Scenarios

**High Load (RPS > 120 or p95 > 800ms)**
- AutoScaler increases concurrency to 200
- Reduces cache TTL to 120s for freshness
- System operates at higher capacity

**Degraded State (Error rate > 2% or p95 > 1200ms)**
- AutoScaler applies throttle (0.7x)
- Reduces load to stabilize system
- FeedbackLoop recommends investigation

**Health Check Failures (3+ consecutive)**
- Watchdog requests rollback
- Invalidates caches
- CanaryManager rolls back to 0%

### Manual Interventions

**Force Full Rollout**
```bash
# Set rollout to 100%
firebase firestore:update config/canary '{"rolloutPercent":100}'
```

**Force Rollback**
```bash
# Rollback to 0%
firebase firestore:update config/canary '{"rolloutPercent":0,"rollbackRequested":true}'
```

**View Cognitive Reports**
```bash
# Get latest report
firebase firestore:get ops/reports/latest

# Query history
firebase firestore:query ops/reports/history --order-by ts --limit 10
```

## Monitoring & Alerts

### Key Metrics

1. **Availability**: % of successful health checks
2. **Latency**: p50, p95, p99 response times
3. **Error Rate**: % of failed requests
4. **Throughput**: Requests per second

### Alert Thresholds

- Error rate > 1% for 5 minutes → Page on-call
- p95 latency > 900ms for 5 minutes → Alert team
- Health check fail count ≥ 3 → Auto-rollback + alert
- Canary rollback triggered → Alert + incident doc

### SLO Targets

- **Availability**: 99.9% (43 minutes downtime/month)
- **Latency**: p95 < 600ms
- **Error Budget**: 0.1% (1 error per 1000 requests)

## Troubleshooting

### AutoScaler Not Adjusting

1. Check `ops_stats/current` is being updated
2. Verify function logs: `firebase functions:log --only autoScaler`
3. Check IAM permissions for Firestore writes

### Watchdog Not Triggering Rollback

1. Verify `ops_health/readyz` fail count
2. Check watchdog logs for errors
3. Ensure `config/canary` write permissions

### FeedbackLoop Not Generating Reports

1. Check input collections exist
2. Verify scheduler is running
3. Review function logs for errors

### Dashboard Not Loading Data

1. Verify API route `/api/firestore` exists and is secured
2. Check browser console for errors
3. Test Firestore queries directly

## Performance Optimization

### Reduce Latency

1. **Enable AutoScaler aggressive mode**
   - Higher concurrency
   - Shorter cache TTL
   - More aggressive scaling

2. **Optimize Firestore reads**
   - Use cached reads where possible
   - Batch multiple reads
   - Use subcollections for large datasets

3. **CDN Caching**
   - Cache static content aggressively
   - Use edge locations
   - Implement stale-while-revalidate

### Reduce Error Rate

1. **Implement Circuit Breakers**
   - Fast-fail on known issues
   - Prevent cascade failures
   - Auto-recovery

2. **Graceful Degradation**
   - Fallback to cached data
   - Return partial results
   - Queue non-critical operations

3. **Rate Limiting**
   - Per-user limits
   - Per-endpoint limits
   - Adaptive throttling

## Security Considerations

### Access Control

- Ops functions run with admin privileges
- Dashboard requires admin authentication
- API routes validate admin tokens

### Data Protection

- Sensitive metrics excluded from reports
- PII sanitized in logs
- Audit trail for manual interventions

### Incident Response

- Automated rollback on security alerts
- Manual override capability
- Incident documentation in Firestore

## Future Enhancements

1. **Machine Learning Integration**
   - Predictive scaling based on historical patterns
   - Anomaly detection for unusual traffic
   - Automated capacity planning

2. **Multi-Region Support**
   - Regional health checks
   - Cross-region failover
   - Geographic load balancing

3. **Advanced Canary Strategies**
   - User cohort targeting
   - Feature flag integration
   - A/B testing framework

4. **Extended Observability**
   - Distributed tracing
   - Custom metrics dashboard
   - Real-time alerting improvements

## Success Metrics

After Phase 35 implementation, expect:

- ✅ 90% reduction in manual scaling interventions
- ✅ <3 minute rollback time on SLO breach
- ✅ <10 minute MTTR for common issues
- ✅ 99.9%+ uptime with automated remediation
- ✅ Cognitive insights surfacing 80%+ of issues before user impact

---

**Status**: Ready for Production
**Last Updated**: 2025-10-12
**Owner**: DevOps Team
