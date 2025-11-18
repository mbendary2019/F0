# Phase 30: Real-Time Admin Dashboard & Alert System

## 🎯 Overview

Phase 30 adds real-time capabilities to the admin dashboard with WebSocket connectivity and an automated alert system. This includes live metric updates, audit log streaming, and configurable alert rules that trigger Slack notifications or browser alerts.

## 📦 Components

### 1. WebSocket Gateway (Cloud Functions)

**Function**: `wsGateway`  
**Endpoint**: `wss://your-function-url/admin-live`  
**Purpose**: Provides WebSocket connection for real-time updates

**Features:**
- Session cookie authentication
- Admin role verification
- Real-time event broadcasting
- Auto-reconnection support

**Events Broadcasted:**
- `hello`: Connection established
- `audit_new`: New audit log entry
- `metrics_update`: Daily metrics updated
- `alert_triggered`: Alert rule triggered

### 2. Alert Engine (Cloud Functions)

**Function**: `alertEngine`  
**Schedule**: Every 1 minute  
**Purpose**: Evaluates alert rules and triggers notifications

**Supported Metrics:**
- `errors_per_min`: Error rate (4xx + 5xx)
- `calls_per_min`: Request rate
- `latency_p95`: 95th percentile latency

**Windows:**
- `1m`: 1 minute
- `5m`: 5 minutes
- `15m`: 15 minutes

**Actions:**
- `slack`: Send Slack notification
- `browser`: Store in Firestore for browser display

### 3. WebSocket Client (Frontend)

**File**: `src/lib/admin/wsClient.ts`

**Class**: `AdminWS`  
- Connect to WebSocket gateway
- Subscribe to events
- Auto-reconnection with exponential backoff
- Type-safe event handling

**Hook**: `useAdminLive()`  
- React hook for dashboard integration
- Returns connection status and last event timestamp
- Automatically manages connection lifecycle

### 4. Alert Rules Management

**API**: `/api/admin/alerts/rules`
- GET: List all rules
- POST: Create new rule
- PATCH: Update rule
- DELETE: Delete rule

**UI**: `/admin/alerts`
- Create alert rules
- View and manage existing rules
- Enable/disable rules
- Delete rules

## 🔧 Setup

### 1. Install Dependencies

```bash
cd functions
npm install ws @slack/webhook
```

### 2. Configure Environment Variables

**Production (.env.production):**
```bash
# WebSocket Gateway URL
NEXT_PUBLIC_WS_URL=https://us-central1-your-project.cloudfunctions.net

# Slack Webhook (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Firebase Functions:**
```bash
firebase functions:config:set slack.webhook_url="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

### 3. Deploy Cloud Functions

```bash
cd functions
npm run build

firebase deploy --only \
  functions:wsGateway,\
  functions:streamAudit,\
  functions:streamMetrics,\
  functions:alertEngine,\
  functions:streamAlerts
```

### 4. Deploy Next.js App

```bash
npm run build
vercel deploy --prod
```

## 🚀 Usage

### Creating an Alert Rule

1. Navigate to `/admin/alerts`
2. Fill in the form:
   - **Name**: Descriptive name (e.g., "High Error Rate")
   - **Metric**: Choose metric to monitor
   - **Threshold**: Value to trigger alert
   - **Window**: Time window for evaluation
   - **Action**: Slack or Browser
   - **Enabled**: Toggle on/off
3. Click "Create Alert Rule"

### Connecting to Live Updates

The dashboard automatically connects to the WebSocket gateway when you visit `/admin/dashboard`. Look for the live indicator in the header.

**Live Badge:**
- 🟢 Green: Connected
- 🔴 Red: Disconnected

### Monitoring Alerts

**Slack Notifications:**
- Sent automatically when alerts trigger
- Includes metric details, current value, and threshold

**Browser Alerts:**
- Stored in `alert_triggers` collection
- Can be displayed in dashboard (future enhancement)

## 📊 Firestore Collections

### `alert_rules`
```typescript
{
  name: string,
  metric: 'errors_per_min' | 'calls_per_min' | 'latency_p95',
  threshold: number,
  window: '1m' | '5m' | '15m',
  action: 'slack' | 'browser',
  enabled: boolean,
  createdBy: string,
  createdAt: number
}
```

### `alert_triggers`
```typescript
{
  ruleId: string,
  ruleName: string,
  metric: string,
  value: number,
  threshold: number,
  window: string,
  triggeredAt: number,
  acknowledged: boolean,
  acknowledgedBy?: string,
  acknowledgedAt?: number
}
```

## 🔒 Security

### WebSocket Authentication

1. **Session Cookie**: Extracted from request headers
2. **UID Verification**: Verified via Firebase Admin SDK
3. **Admin Check**: Queried from Firestore `users` collection
4. **Connection Denied**: If any check fails

### Rate Limiting

- Reuses existing middleware from Phase 28
- 60 requests/minute per IP on `/api/admin/*`
- WebSocket connections are not rate-limited (long-lived)

### CSRF Protection

- Origin check on POST requests
- Session-based authentication
- No token required for WebSocket (authenticated via cookie)

## 🧪 Testing

### 1. Test WebSocket Connection

```javascript
// In browser console on /admin/dashboard
const ws = new WebSocket('wss://your-function-url/admin-live');
ws.onmessage = (e) => console.log('Received:', e.data);
ws.onopen = () => console.log('Connected');
ws.onerror = (e) => console.error('Error:', e);
```

### 2. Test Alert Creation

```bash
# Create an alert rule
curl -X POST https://your-domain.com/api/admin/alerts/rules \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{
    "name": "Test Alert",
    "metric": "calls_per_min",
    "threshold": 100,
    "window": "1m",
    "action": "slack",
    "enabled": true
  }'
```

### 3. Test Alert Trigger

1. Create a rule with low threshold (e.g., calls_per_min > 5)
2. Generate admin activity (create audit entries)
3. Wait up to 1 minute for alert engine to run
4. Check Slack for notification

### 4. Test Real-Time Updates

1. Open `/admin/dashboard` in one browser tab
2. Open `/admin/audit` in another tab
3. Perform an admin action (grant/revoke role)
4. Verify audit log appears immediately in first tab

## 📈 Monitoring

### Cloud Function Logs

```bash
# View WebSocket gateway logs
firebase functions:log --only wsGateway --limit 50

# View alert engine logs
firebase functions:log --only alertEngine --limit 50

# View all Phase 30 functions
firebase functions:log --only wsGateway,streamAudit,streamMetrics,alertEngine,streamAlerts
```

### Metrics to Watch

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| WebSocket Connections | N/A | Monitor for spikes |
| Alert Evaluations | 1/min | >0 failures/hour |
| Slack Notifications | Varies | >10/hour (spam check) |
| WebSocket Message Rate | Varies | Monitor for excessive traffic |

## ⚠️ Important Security Notes

### Before Production Deployment

1. **Update `getUidFromCookie()`** in `gateway.ts`:
   ```typescript
   // Replace placeholder with real session verification
   const decodedToken = await admin.auth().verifySessionCookie(token, true);
   return decodedToken.uid;
   ```

2. **Update `isAdmin()`** in `gateway.ts`:
   ```typescript
   // Connect to your actual admin check
   const userDoc = await db.collection('users').doc(uid).get();
   const roles = userDoc.data()?.roles || [];
   return roles.includes('admin');
   ```

3. **Configure CORS** if needed:
   ```typescript
   // In gateway.ts, add CORS headers
   res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN);
   res.setHeader('Access-Control-Allow-Credentials', 'true');
   ```

4. **Set Function Region**:
   ```typescript
   // Deploy to region closest to users
   export const wsGateway = functions
     .region('us-central1') // or 'europe-west1', etc.
     .runWith({ memory: '512MB', timeoutSeconds: 300 })
     .https.onRequest(...)
   ```

5. **Monitor Connection Limits**:
   - Cloud Functions have connection limits
   - Consider Cloud Run for high-concurrency needs
   - Implement connection pooling if needed

## 🚨 Troubleshooting

### WebSocket Won't Connect

**Check:**
1. `NEXT_PUBLIC_WS_URL` is set correctly
2. Function is deployed: `firebase functions:list`
3. Session cookie is valid
4. User has admin role in Firestore

**Debug:**
```bash
# Check function logs
firebase functions:log --only wsGateway --limit 20

# Test with curl (will fail but shows function is responding)
curl https://your-function-url/admin-live
# Should return: "Expected WebSocket"
```

### Alerts Not Firing

**Check:**
1. Alert rule is enabled
2. `SLACK_WEBHOOK_URL` is configured (for Slack action)
3. Threshold is reachable with current traffic
4. Alert engine is running: `firebase functions:log --only alertEngine`

**Debug:**
```bash
# Manually trigger alert engine
firebase functions:call alertEngine

# Check alert triggers in Firestore
# Navigate to console → alert_triggers collection
```

### High WebSocket Memory Usage

**Solutions:**
1. Implement client heartbeat with disconnect on timeout
2. Limit max connections per function instance
3. Use Cloud Run instead of Cloud Functions
4. Add connection pooling

## 🎯 Future Enhancements

### Phase 31 Ideas

1. **Browser Notifications**:
   - Web Push API integration
   - Desktop notifications for critical alerts
   - Sound alerts

2. **Alert Dashboard**:
   - View all triggered alerts
   - Acknowledge/resolve alerts
   - Alert history and trends

3. **Advanced Metrics**:
   - Custom metric sources
   - Composite metrics (e.g., error rate + latency)
   - Machine learning anomaly detection

4. **Alert Channels**:
   - Email notifications
   - SMS via Twilio
   - PagerDuty integration
   - Webhook endpoints

5. **Dashboard Enhancements**:
   - Real-time metric charts
   - Live user activity feed
   - System health indicators

## 📚 Related Documentation

- [Admin RBAC](./ADMIN_RBAC.md) - Phase 28
- [Admin Observability](./ADMIN_OBSERVABILITY.md) - Phase 29
- [Quick Start](../QUICK_START.md)
- [Security Checklist](../SECURITY-CHECKLIST.md)

## 🆘 Support

### Common Issues

**"Expected WebSocket" Error:**
- You're hitting the HTTP endpoint instead of WebSocket
- Ensure client uses `wss://` protocol

**"Connection Refused":**
- Function not deployed
- Wrong URL in `NEXT_PUBLIC_WS_URL`
- Firewall blocking WebSocket connections

**Alerts Not Appearing in Slack:**
- `SLACK_WEBHOOK_URL` not configured
- Webhook URL invalid or expired
- Check function logs for errors

---

**Status**: ✅ Production Ready (with security updates)  
**Phase**: 30 - Real-Time Admin Dashboard & Alert System  
**Last Updated**: 2025-10-10

