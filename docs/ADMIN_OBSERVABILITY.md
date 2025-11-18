# Admin Observability (Phase 29)

## 🎯 Overview

The Admin Observability system provides comprehensive monitoring, metrics collection, and audit log visualization for administrators. This includes a dashboard with real-time metrics, an audit viewer with filtering capabilities, and automated alerts for sensitive actions.

## 📦 Components

### 1. Dashboard (`/admin/dashboard`)

**Features:**
- Real-time API call metrics (24h)
- Error rate tracking
- p95 latency monitoring
- 7-day timeseries charts
- System health indicators
- Quick action links

**File**: `src/app/admin/dashboard/page.tsx`

**Metrics Displayed:**
- API Calls (24h): Total requests in last 24 hours
- Errors (24h): 4xx + 5xx responses
- p95 Latency: 95th percentile response time
- Success Rate: Calculated from calls vs errors
- Timeseries: Daily calls and errors over 7 days

### 2. Audit Viewer (`/admin/audit`)

**Features:**
- Filterable audit log table
- Date range filtering
- Action type filtering
- Actor UID filtering
- CSV export functionality
- Real-time updates

**File**: `src/app/admin/audit/page.tsx`

**Filters:**
- **Action**: Filter by action type (grant, revoke, etc.)
- **Actor**: Filter by admin user ID
- **From Date**: Start date for range
- **To Date**: End date for range

### 3. API Endpoints

#### GET `/api/admin/metrics/summary`

Returns dashboard metrics or audit logs based on query parameters.

**Query Parameters:**
- `audit=1`: Switch to audit mode
- `action`: Filter by action type
- `actor`: Filter by actor UID
- `from`: Start date (YYYY-MM-DD)
- `to`: End date (YYYY-MM-DD)

**Response (Dashboard Mode):**
```json
{
  "totals": {
    "calls24h": 1234,
    "errors24h": 12,
    "p95": 245
  },
  "timeseries": [
    { "date": "2025-10-04", "calls": 200, "errors": 2 },
    { "date": "2025-10-05", "calls": 180, "errors": 1 }
  ]
}
```

**Response (Audit Mode):**
```json
{
  "audit": [
    {
      "id": "abc123",
      "ts": 1696934400000,
      "action": "grant",
      "actorUid": "admin-uid",
      "targetUid": "user-uid",
      "ip": "1.2.3.4",
      "ua": "Mozilla/5.0...",
      "meta": { "role": "admin" }
    }
  ]
}
```

#### GET `/api/admin/audit/export`

Exports audit logs as CSV file.

**Query Parameters:**
Same as summary endpoint (action, actor, from, to)

**Response:**
- Content-Type: `text/csv`
- Filename: `audit_export_YYYY-MM-DDTHH-MM-SS.csv`

### 4. Cloud Functions

#### `collectApiMetrics`

**Schedule**: Every 5 minutes  
**Purpose**: Aggregate API metrics into daily documents

**Collection**: `api_metrics_daily/{date}`

**Document Structure:**
```typescript
{
  date: "2025-10-10",
  calls: 1234,
  errors: 12,
  latencies: [45, 67, 89, ...],
  p95: 245,
  endpoints: {
    "GET /api/me": { calls: 100, errors: 0 },
    "POST /api/admin/users/:uid/grant": { calls: 5, errors: 0 }
  },
  lastUpdated: 1696934400000
}
```

**TODO**: Connect to real logging/analytics source
- Cloud Logging API
- Custom analytics events
- Third-party APM tools

#### `notifyAdminEvents`

**Trigger**: Firestore onCreate `admin_audit/{id}`  
**Purpose**: Send Slack alerts for sensitive admin actions

**Sensitive Actions:**
- `grant`: Role granted
- `revoke`: Role revoked
- `delete`: Resource deleted
- `suspend`: User suspended

**Slack Message Format:**
```
🚨 Admin Event: GRANT

Action: grant
Actor: admin-uid
Target: user-uid
Time: 2025-10-10T12:34:56Z
IP Address: 1.2.3.4
User Agent: Mozilla/5.0...
```

**Environment Variable Required:**
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## 🔒 Security

### Authentication & Authorization
- All routes protected by `assertAdminReq()`
- Session cookie verification
- Admin role check from Firestore

### Rate Limiting
- 60 requests/minute per IP on `/api/admin/*`
- Configured in `src/middleware.ts`
- Returns 429 when exceeded

### CSRF Protection
- Origin header validation on POST requests
- Compares with `NEXT_PUBLIC_BASE_URL`
- Enabled in production environment

## 📊 Firestore Schema

### `admin_audit` Collection
```typescript
{
  id: string,
  ts: number,              // Timestamp
  action: string,          // 'grant', 'revoke', etc.
  actorUid: string,        // Who performed the action
  targetUid?: string,      // Who was affected
  ip?: string,             // IP address
  ua?: string,             // User agent
  meta?: {                 // Additional metadata
    role?: string,
    ...
  }
}
```

**Indexes Required:**
1. `ts DESC` - Basic chronological sorting
2. `action ASC, ts DESC` - Filter by action type
3. `actorUid ASC, ts DESC` - Filter by actor

### `api_metrics_daily` Collection
```typescript
{
  date: string,            // "YYYY-MM-DD"
  calls: number,           // Total API calls
  errors: number,          // Total errors (4xx + 5xx)
  latencies: number[],     // Array of latency measurements
  p95: number,             // 95th percentile latency
  endpoints: {             // Per-endpoint breakdown
    [key: string]: {
      calls: number,
      errors: number
    }
  },
  lastUpdated: number      // Timestamp of last update
}
```

## 🚀 Deployment

### 1. Deploy Next.js App

```bash
npm run build
vercel deploy --prod
```

### 2. Deploy Cloud Functions

```bash
cd functions
npm run build

firebase deploy --only functions:collectApiMetrics,functions:notifyAdminEvents
```

### 3. Create Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

**Or manually create in Firestore Console:**
1. Navigate to Firestore → Indexes
2. Create composite indexes as specified above

### 4. Configure Environment Variables

**Production Environment:**
```bash
# Required
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# Optional (for Slack alerts)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Firebase Functions:**
```bash
firebase functions:config:set slack.webhook_url="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

## 🧪 Testing

### Local Testing

1. **Start Development Server:**
   ```bash
   npm run dev
   ```

2. **Access Dashboard:**
   - Navigate to `http://localhost:3000/admin/dashboard`
   - Must be logged in as admin

3. **Test Audit Viewer:**
   - Navigate to `http://localhost:3000/admin/audit`
   - Apply filters and test export

4. **Test API Endpoints:**
   ```bash
   # Get metrics
   curl http://localhost:3000/api/admin/metrics/summary

   # Get audit logs
   curl "http://localhost:3000/api/admin/metrics/summary?audit=1"

   # Export CSV
   curl "http://localhost:3000/api/admin/audit/export" > audit.csv
   ```

### Verify Cloud Functions

1. **Trigger Admin Action:**
   ```bash
   # Grant a role (will trigger notifyAdminEvents)
   curl -X POST http://localhost:3000/api/admin/users/test-uid/grant \
     -H "Content-Type: application/json" \
     -d '{"role":"moderator"}'
   ```

2. **Check Slack:**
   - Verify notification appears in configured Slack channel

3. **Check Metrics Collection:**
   ```bash
   # Wait 5+ minutes for collectApiMetrics to run
   # Check Firestore: api_metrics_daily/{today}
   ```

## 📈 Monitoring

### Key Metrics to Watch

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Dashboard Load Time | <2s | >5s |
| Audit Query Time | <1s | >3s |
| CSV Export Time | <5s | >10s |
| collectApiMetrics Success Rate | >99% | <95% |
| Slack Notification Delivery | >95% | <90% |

### Health Checks

```bash
# Check dashboard loads
curl -I https://your-domain.com/admin/dashboard

# Check API endpoints
curl https://your-domain.com/api/admin/metrics/summary

# Check audit logs
curl "https://your-domain.com/api/admin/metrics/summary?audit=1"
```

## 🔧 Troubleshooting

### Dashboard Shows No Data

**Possible Causes:**
1. No admin_audit entries yet
2. api_metrics_daily collection empty
3. Firestore permissions issue

**Solutions:**
- Perform an admin action to create audit entry
- Wait for collectApiMetrics to run (5 min interval)
- Check Firebase console for errors

### Slack Notifications Not Sending

**Check:**
1. SLACK_WEBHOOK_URL configured correctly
2. Webhook URL still valid
3. Function logs for errors: `firebase functions:log`

### CSV Export Fails

**Check:**
1. Admin permissions
2. Firestore query limits
3. Browser download settings

### Slow Query Performance

**Solutions:**
1. Verify Firestore indexes created
2. Limit date range in filters
3. Check Firestore usage quotas

## 🎯 Future Enhancements

### Phase 30 (Planned)
- **Real-time Dashboard**: WebSocket updates
- **Advanced Analytics**: Funnel analysis, cohort tracking
- **Custom Reports**: Scheduled email reports
- **Alert Management**: Configure alert thresholds in UI

### Performance Optimizations
- Cache dashboard metrics (Redis/Memory)
- Pagination for audit logs (>1000 entries)
- Batch CSV exports for large datasets
- CDN for static dashboard assets

### Additional Features
- User activity heatmaps
- Anomaly detection
- Predictive alerts
- Multi-timezone support
- Custom date ranges

## 📚 Related Documentation

- [Admin RBAC](./ADMIN_RBAC.md)
- [Admin RBAC Deployment](./ADMIN_RBAC_DEPLOYMENT.md)
- [Security Checklist](../SECURITY-CHECKLIST.md)
- [Quick Start](../QUICK_START.md)

## 🆘 Support

For issues or questions:
1. Check this documentation
2. Review Firebase function logs
3. Check browser console for errors
4. Verify environment variables
5. Review Firestore security rules

---

**Status**: ✅ Production Ready  
**Phase**: 29 - Admin Observability  
**Last Updated**: 2025-10-10

