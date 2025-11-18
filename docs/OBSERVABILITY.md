# Observability & Alerts

**Sprint 9** - Complete system monitoring, error tracking, and alerting infrastructure.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Sentry Setup](#sentry-setup)
4. [Alert System](#alert-system)
5. [Cloud Functions Monitoring](#cloud-functions-monitoring)
6. [API Routes](#api-routes)
7. [UI Dashboard](#ui-dashboard)
8. [Performance Tracking](#performance-tracking)
9. [Incident Response Runbook](#incident-response-runbook)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This observability system provides comprehensive monitoring and alerting for your production SaaS platform:

### Key Features

✅ **Error Tracking** - Sentry integration for client and server errors
✅ **Automated Alerts** - Slack and email notifications
✅ **Health Checks** - System health monitoring endpoint
✅ **Performance Monitoring** - Request timing and tracing
✅ **Alert Dashboard** - Admin UI for viewing and managing alerts
✅ **Scheduled Monitoring** - Cloud Functions check error rates, auth failures, quota breaches
✅ **Audit Integration** - Leverages existing audit logs for monitoring

---

## Architecture

### Data Flow

```
System Events (Errors, Auth Failures, Quota Usage)
    ↓
Audit Logs + Usage Events (Firestore)
    ↓
Cloud Functions (every 5-15 minutes)
    ↓
Check Thresholds
    ↓
Create Alerts (Firestore)
    ↓
Send Notifications (Slack/Email)
    ↓
Admin Dashboard (/admin/alerts)
```

### Components

```
├── Server Utilities
│   ├── src/server/alerts.ts    # Alert creation and notifications
│   └── src/server/obs.ts       # Performance tracking and tracing
│
├── Cloud Functions
│   └── functions/src/alerts.ts # Scheduled monitoring jobs
│
├── API Routes
│   ├── /api/admin/health          # System health check
│   ├── /api/admin/alerts/test     # Test alert creation
│   ├── /api/admin/alerts/list     # Get alerts with filters
│   └── /api/admin/alerts/acknowledge # Acknowledge alert
│
└── UI
    └── /admin/alerts              # Alert dashboard
```

---

## Sentry Setup

### 1. Create Sentry Project

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project (Next.js)
3. Copy your DSN

### 2. Configure Environment Variables

```bash
# .env.local
SENTRY_DSN=https://xxx@sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENV=production
```

### 3. Enable Instrumentation

The instrumentation hook in [`src/instrumentation.ts`](../src/instrumentation.ts) automatically initializes Sentry:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENV || 'development',
      tracesSampleRate: 0.1, // 10% performance sampling
    });
  }
}
```

### 4. Enable in Next.js Config

```javascript
// next.config.js
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};
```

### 5. Install Sentry Package

```bash
npm install @sentry/nextjs
```

---

## Alert System

### Alert Schema

```typescript
{
  severity: 'info' | 'warning' | 'critical';
  kind: 'error_rate' | 'auth_fail' | 'quota_breach' | 'function_error' | 'custom';
  message: string;
  context?: Record<string, any>;
  status: 'open' | 'ack' | 'closed';
  createdAt: Timestamp;
  acknowledgedBy?: string;
  acknowledgedAt?: Timestamp;
  closedAt?: Timestamp;
}
```

### Alert Severities

- **Info** 📌 - Informational, no action required
- **Warning** 🚨 - Requires attention, not urgent
- **Critical** 🧯 - Requires immediate action

### Alert Kinds

- **error_rate** - High error rate (>5% in 5 min)
- **auth_fail** - High authentication failures from same IP
- **quota_breach** - User approaching daily quota
- **function_error** - Cloud Function errors
- **custom** - Manual/test alerts

---

## Cloud Functions Monitoring

### 1. Error Rate Monitor

**Schedule**: Every 5 minutes
**Threshold**: 5% error rate with min 50 requests

```typescript
// Checks audit_logs for HTTP 500+ errors
// Triggers critical alert if threshold exceeded
```

**Configuration**:
```bash
ALERT_THRESHOLD_ERROR_RATE=0.05  # 5%
```

---

### 2. Auth Failure Monitor

**Schedule**: Every 5 minutes
**Threshold**: 20 failures per IP hash

```typescript
// Checks audit_logs for 401/403 errors
// Groups by IP hash
// Triggers warning alert for suspicious IPs
```

**Configuration**:
```bash
ALERT_THRESHOLD_AUTH_FAILS=20
```

**Use Case**: Detect brute force attacks or misconfigured clients

---

### 3. Quota Breach Monitor

**Schedule**: Every 15 minutes
**Threshold**: 95% of daily quota

```typescript
// Checks user_quotas collection
// Triggers warning alert when users are close to limit
// Prevents duplicate alerts for same user/day
```

**Configuration**:
```bash
ALERT_THRESHOLD_QUOTA_PERCENT=0.95  # 95%
```

**Use Case**: Proactive notification before quota exhaustion

---

### 4. Function Error Monitor

**Schedule**: Every 10 minutes
**Status**: Placeholder (extend with Cloud Logging API)

```typescript
// Future: Query Cloud Logging for function errors
// Create alerts for frequently failing functions
```

---

## API Routes

### 1. Health Check

**Endpoint**: `GET /api/admin/health`
**Auth**: Admin only

**Response**:
```json
{
  "healthy": true,
  "timestamp": "2025-01-07T12:00:00Z",
  "services": {
    "firestore": true
  },
  "config": {
    "sentry": true,
    "slack": true,
    "email": false,
    "stripe": true,
    "redis": true
  },
  "alerts": {
    "open": 3,
    "critical": 0
  },
  "environment": "production"
}
```

**Use Case**: Integration with uptime monitors (Pingdom, UptimeRobot)

---

### 2. Test Alert

**Endpoint**: `POST /api/admin/alerts/test`
**Auth**: Admin only

**Request**:
```json
{
  "severity": "warning",
  "message": "Test alert from UI"
}
```

**Response**:
```json
{
  "success": true,
  "alertId": "alert_abc123",
  "message": "Test alert created and notifications sent",
  "notifications": {
    "slack": true,
    "email": false
  }
}
```

---

### 3. List Alerts

**Endpoint**: `GET /api/admin/alerts/list?status=open&severity=critical`
**Auth**: Admin only

**Query Params**:
- `status` - Filter by status (open/ack/closed)
- `severity` - Filter by severity (info/warning/critical)
- `kind` - Filter by kind
- `limit` - Max results (default: 100, max: 500)

**Response**:
```json
{
  "alerts": [...],
  "stats": {
    "total": 42,
    "bySeverity": { "info": 10, "warning": 30, "critical": 2 },
    "byStatus": { "open": 15, "ack": 20, "closed": 7 }
  },
  "filters": { "status": "open", "severity": null, "kind": null, "limit": 100 }
}
```

---

### 4. Acknowledge Alert

**Endpoint**: `POST /api/admin/alerts/acknowledge`
**Auth**: Admin only

**Request**:
```json
{
  "alertId": "alert_abc123"
}
```

**Response**:
```json
{
  "success": true,
  "alertId": "alert_abc123",
  "acknowledgedBy": "user_xyz"
}
```

---

## UI Dashboard

### Location

[`/admin/alerts`](../src/app/admin/alerts/page.tsx)

### Features

✅ **Real-time Stats** - Total, critical, warnings, open
✅ **Filtering** - By status, severity, kind
✅ **Acknowledge Button** - Mark alerts as acknowledged
✅ **Test Alert** - Create test alert with one click
✅ **Context Expansion** - View full alert context
✅ **Time Ago** - Human-readable timestamps
✅ **Color Coding** - Visual severity indicators

### Access Control

- Requires `admin: true` custom claim
- Automatically redirects non-admin users

---

## Performance Tracking

### Timing Utilities

**`timeIt()`** - Time async operations:

```typescript
import { timeIt } from '@/server/obs';

const result = await timeIt('fetchUserData', async () => {
  return await db.collection('users').doc(uid).get();
});
// [⏱️ Performance] fetchUserData: 45ms
```

---

### Sentry Tracing

**`trace()`** - Create transaction with spans:

```typescript
import { trace } from '@/server/obs';

await trace('processPayment', async () => {
  // Your code here
}, { userId: 'user_123', amount: 1000 });
```

---

### Manual Metrics

**`metric()`** - Log custom metrics:

```typescript
import { metric } from '@/server/obs';

metric('api.request.duration', 120, { endpoint: '/api/users' });
// [📊 Metric] api.request.duration=120 {"endpoint":"/api/users"}
```

---

### Error Capture

**`captureError()`** - Send error to Sentry with context:

```typescript
import { captureError } from '@/server/obs';

try {
  await riskyOperation();
} catch (error) {
  captureError(error, {
    level: 'error',
    tags: { component: 'payment' },
    user: { id: uid },
    extra: { transactionId: 'txn_123' },
  });
}
```

---

## Incident Response Runbook

### 1. Critical Error Rate Alert 🧯

**Trigger**: >5% error rate in last 5 minutes

**Immediate Actions**:
1. Check [`/admin/alerts`](http://localhost:3000/admin/alerts) for context
2. Review Sentry dashboard for error details
3. Check Cloud Functions logs: `firebase functions:log`
4. Review recent deployments
5. Identify affected endpoints from alert context

**Investigation**:
- Check audit logs for error patterns
- Review error messages and stack traces in Sentry
- Verify external service status (Stripe, Firebase)

**Resolution**:
- Fix bug and deploy
- Or rollback recent deployment
- Acknowledge alert once resolved
- Monitor error rate for 30 minutes

---

### 2. Auth Failure Alert 🚨

**Trigger**: >20 auth failures from same IP in 5 minutes

**Immediate Actions**:
1. Check alert context for IP hash
2. Review audit logs for this IP hash
3. Determine if brute force attack or legitimate issue

**Investigation**:
- Check if user account is locked
- Verify rate limiting is working
- Check for credential stuffing patterns

**Resolution Options**:
- **Brute Force Attack**: IP is already rate-limited. Monitor for escalation.
- **Legitimate User**: Check for expired tokens, password reset issues
- **Misconfigured Client**: Contact user/team to fix integration

---

### 3. Quota Breach Alert 🚨

**Trigger**: User at >95% of daily quota

**Immediate Actions**:
1. Identify user from alert context
2. Check user's subscription tier
3. Review usage patterns

**Investigation**:
- Is usage legitimate or abuse?
- Check usage by kind (LLM vs API vs jobs)
- Review user's workspace activity

**Resolution Options**:
- **Legitimate High Usage**: Prompt user to upgrade plan
- **Unexpected Spike**: Contact user to verify usage
- **Potential Abuse**: Investigate and potentially suspend account

---

### 4. Function Error Alert 🧯

**Trigger**: Cloud Function failing frequently

**Immediate Actions**:
1. Check Cloud Functions logs
2. Identify failing function from context
3. Check recent deployments

**Investigation**:
- Review function code for bugs
- Check environment variables
- Verify external service connectivity

**Resolution**:
- Fix and redeploy function
- Or rollback to previous version
- Monitor function execution logs

---

## Troubleshooting

### Alerts Not Being Created

**Symptoms**: Cloud Functions running but no alerts in Firestore

**Checks**:
1. Verify thresholds are not too high
2. Check Cloud Functions logs for errors
3. Verify Firestore write permissions
4. Ensure audit logs have data

**Fix**:
```bash
# Check function logs
firebase functions:log --only watchErrorRate

# Test manually
firebase functions:shell
> watchErrorRate()
```

---

### Slack Notifications Not Working

**Symptoms**: Alerts created but no Slack messages

**Checks**:
1. Verify `SLACK_WEBHOOK_URL` is set
2. Test webhook manually:
```bash
curl -X POST <WEBHOOK_URL> \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test from curl"}'
```
3. Check server logs for Slack API errors

**Fix**:
- Regenerate webhook URL in Slack
- Verify webhook has correct permissions

---

### Email Alerts Not Sending

**Symptoms**: Critical alerts not triggering emails

**Checks**:
1. Verify `SENDGRID_API_KEY` and `ALERT_EMAIL_TO` are set
2. Check SendGrid account status
3. Verify API key has send permissions
4. Check server logs for SendGrid errors

**Fix**:
- Regenerate SendGrid API key
- Verify sender email is verified in SendGrid

---

### Admin Dashboard Not Loading

**Symptoms**: 403 Forbidden or alerts not showing

**Checks**:
1. Verify user has `admin: true` custom claim
2. Check Firestore rules allow admin read access
3. Verify API routes require admin claim

**Fix**:
```typescript
// Grant admin claim
await admin.auth().setCustomUserClaims(uid, {
  admin: true,
});

// User must sign out and back in
```

---

### High False Positive Rate

**Symptoms**: Too many alerts for normal operations

**Adjustments**:
```bash
# Increase error rate threshold
ALERT_THRESHOLD_ERROR_RATE=0.10  # 10% instead of 5%

# Increase auth fail threshold
ALERT_THRESHOLD_AUTH_FAILS=50    # 50 instead of 20

# Increase quota threshold
ALERT_THRESHOLD_QUOTA_PERCENT=0.98  # 98% instead of 95%
```

---

## Monitoring Checklist

### Daily
- [ ] Check [`/admin/alerts`](http://localhost:3000/admin/alerts) for open critical alerts
- [ ] Review Sentry dashboard for new errors
- [ ] Acknowledge and close resolved alerts

### Weekly
- [ ] Review alert trends (are we getting more/fewer?)
- [ ] Adjust thresholds if needed
- [ ] Check Cloud Functions execution logs
- [ ] Verify Slack/email notifications working

### Monthly
- [ ] Review alert response times
- [ ] Update runbook based on lessons learned
- [ ] Check Sentry quota usage
- [ ] Audit admin users list

---

## Integration with External Monitoring

### Datadog

```typescript
// src/server/obs.ts
export function metric(name: string, value: number, tags?: Record<string, string>) {
  // Send to Datadog
  fetch('https://api.datadoghq.com/api/v1/series', {
    method: 'POST',
    headers: {
      'DD-API-KEY': process.env.DATADOG_API_KEY!,
    },
    body: JSON.stringify({
      series: [{
        metric: name,
        points: [[Date.now() / 1000, value]],
        tags: Object.entries(tags || {}).map(([k, v]) => `${k}:${v}`),
      }],
    }),
  });
}
```

### Prometheus

```typescript
// Expose /metrics endpoint
// Use prom-client library
```

---

## Summary

You now have a complete observability and alerting system:

✅ **Sentry** - Error tracking and performance monitoring
✅ **Alert System** - Automated Slack and email notifications
✅ **Cloud Functions** - Scheduled monitoring for error rate, auth failures, quota breaches
✅ **Admin Dashboard** - UI for viewing and managing alerts
✅ **Health Check** - Endpoint for uptime monitoring
✅ **Performance Tracking** - Utilities for timing and tracing
✅ **Runbook** - Incident response procedures

### Next Steps

1. Configure Sentry project and copy DSN
2. Set up Slack incoming webhook (optional)
3. Configure SendGrid for email alerts (optional)
4. Deploy Cloud Functions
5. Set appropriate alert thresholds
6. Test alert creation
7. Grant admin claim to ops team
8. Set up external uptime monitor for /api/admin/health

---

## Related Documentation

- [Sprint 6 - Security & Audit Logs](./SECURITY-HARDENING.md)
- [Sprint 8 - Usage Analytics](./USAGE-ANALYTICS.md)
- [Master README](./README.md)

---

**Questions?** Check logs, review Sentry dashboard, or use test alert endpoint to verify configuration.
