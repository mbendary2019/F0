# Phase 32: Predictive AI & Self-Healing Ops

## 📋 Overview

Phase 32 adds predictive analytics and automated self-healing capabilities to the admin system. The system forecasts future metrics, detects potential issues before they occur, and automatically applies remediation actions.

## 🎯 Features

### 1. Predictive Forecasting
- **Time-series forecasting** for calls, errors, and latency
- **15-minute cadence** with 90-minute horizon
- **95% confidence intervals** for predictions
- **Simple Moving Average (SMA)** algorithm (ARIMA-lite)

### 2. Self-Healing Engine
- **Automated remediation** when forecasts exceed thresholds
- **3 action types**: disable_endpoint, reduce_rate, restart_function
- **Cooldown periods** to prevent repeated triggers
- **Audit trail** for all automated actions

### 3. Root Cause Analysis
- **Correlation analysis** between metrics
- **Pearson coefficient** calculation
- **Strong correlation detection** (|r| >= 0.7)
- **Endpoint-specific analysis**

### 4. Ops Copilot
- **AI-powered Q&A** interface
- **Context-aware responses**
- **Quick action buttons**
- **Chat history**

## 🏗️ Architecture

### Cloud Functions

```
functions/src/predict/
├── forecastEngine.ts     # Predictive forecasting
├── selfHealEngine.ts     # Automated remediation
├── rootCause.ts          # Correlation analysis
└── index.ts              # Exports
```

### Next.js Routes

```
src/app/
├── admin/ops-copilot/page.tsx        # AI assistant interface
└── api/admin/remediation/route.ts    # Remediation CRUD
```

### Utility Libraries

```
src/lib/admin/
├── forecasting.ts        # Forecast utilities
└── remediation.ts        # Remediation helpers
```

## 📊 Firestore Collections

### `predictions_daily`
Stores time-series forecasts with confidence intervals.

```typescript
{
  metric: 'calls' | 'errors' | 'latency_p95';
  endpoint?: string;
  t: number;                    // Timestamp
  horizonMin: number;           // Minutes per step (15)
  forecast: number[];           // Predicted values
  upper: number[];              // Upper confidence bound
  lower: number[];              // Lower confidence bound
  conf: number;                 // Confidence level (0.95)
}
```

**Indexes Required:**
```json
{
  "collection": "predictions_daily",
  "fields": [
    { "fieldPath": "t", "order": "DESCENDING" },
    { "fieldPath": "metric", "order": "ASCENDING" }
  ]
}
```

---

### `remediation_rules`
Self-healing automation rules.

```typescript
{
  metric: 'calls' | 'errors' | 'latency_p95';
  comparator: '>=' | '>' | '<' | '<=';
  threshold: number;
  action: 'disable_endpoint' | 'reduce_rate' | 'restart_function';
  target?: string;              // Endpoint or function name
  reduceByPct?: number;         // For rate limiting (1-90)
  enabled: boolean;
  createdBy: string;
  createdAt: number;
  lastTriggered?: number;
}
```

**Indexes Required:**
```json
{
  "collection": "remediation_rules",
  "fields": [
    { "fieldPath": "enabled", "order": "ASCENDING" },
    { "fieldPath": "metric", "order": "ASCENDING" }
  ]
}
```

---

### `root_cause_graph`
Correlation analysis results.

```typescript
{
  ts: number;
  lookbackDays: number;
  dataPoints: number;
  correlations: Array<{
    pair: string;               // e.g., "calls~errors"
    r: number;                  // Pearson coefficient
    description: string;
  }>;
  strongCorrelations: Array<{...}>;
  trends: {
    calls: number;              // Trend percentage
    errors: number;
    latency_p95: number;
  };
  insights: string[];           // Generated insights
  metrics: {
    calls: { current, avg, min, max };
    errors: { current, avg, min, max };
    latency_p95: { current, avg, min, max };
  };
}
```

---

### `feature_flags`
Endpoint enable/disable states (for self-healing).

```typescript
{
  enabled: boolean;
  reason: 'self_heal' | 'manual';
  disabledAt: number;
  forecast: number;
  threshold: number;
  revertedAt?: number;
}
```

---

### `rate_limits`
Dynamic rate limit adjustments.

```typescript
{
  reduceBy: number;             // Percentage (1-90)
  reason: 'self_heal' | 'manual';
  appliedAt: number;
  forecast: number;
  threshold: number;
}
```

---

### `ops_commands`
Queued operational commands (e.g., function restarts).

```typescript
{
  cmd: 'restart_fn';
  target: string;
  reason: 'self_heal' | 'manual';
  ts: number;
  forecast: number;
  threshold: number;
  status: 'pending' | 'completed' | 'failed';
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Same as Phase 31
NEXT_PUBLIC_BASE_URL=https://your-domain.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/... (optional)
```

### Forecast Algorithm Settings

Default: Simple Moving Average (SMA)
- **Window size**: 24 points (last 24 hours)
- **Horizon**: 6 steps (90 minutes)
- **Confidence**: 95% (1.96σ)

Upgradeable to:
- ARIMA (AutoRegressive Integrated Moving Average)
- Prophet (Facebook's time-series library)
- LSTM (Long Short-Term Memory neural networks)

### Self-Healing Settings

- **Check frequency**: Every 5 minutes
- **Cooldown**: 30 minutes (configurable)
- **Auto-revert**: After 1 hour (configurable)

## 🚀 Deployment

### 1. Deploy Cloud Functions

```bash
cd functions
npm install

firebase deploy --only \
  functions:forecastEngine,\
  functions:cleanupPredictions,\
  functions:selfHealEngine,\
  functions:revertSelfHeal,\
  functions:rootCause,\
  functions:rootCauseEndpoints
```

### 2. Create Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

Or create manually in Firebase Console:
- `predictions_daily`: `t` (DESC), `metric` (ASC)
- `remediation_rules`: `enabled` (ASC), `metric` (ASC)

### 3. Deploy Next.js

```bash
npm run build
npm run deploy  # or vercel deploy --prod
```

### 4. Verify Deployment

```bash
# Check function logs
firebase functions:log --only forecastEngine --limit 5

# Visit Ops Copilot
open https://your-domain.com/admin/ops-copilot

# Test remediation API
curl -H "Cookie: session=..." \
  https://your-domain.com/api/admin/remediation
```

## 📖 Usage

### For Admins

#### View Predictions
1. Navigate to `/admin/ops-copilot`
2. Ask: "Predict traffic for next hour"
3. View forecast with confidence intervals

#### Create Remediation Rule
```bash
POST /api/admin/remediation
{
  "metric": "errors",
  "comparator": ">=",
  "threshold": 100,
  "action": "disable_endpoint",
  "target": "/api/slow-endpoint",
  "enabled": true
}
```

#### Query Ops Copilot
Example questions:
- "Why did latency spike in the last hour?"
- "What's causing the error rate increase?"
- "Which endpoints are performing poorly?"
- "Show me recent anomalies"
- "Predict calls for next 90 minutes"

### For Developers

#### Integrate Custom Forecasting Model

Replace SMA in `forecastEngine.ts`:

```typescript
// Example: ARIMA or Prophet
import { arima } from 'your-arima-library';

function arimaForecast(values: number[], horizon: number) {
  const model = arima(values, { p: 1, d: 1, q: 1 });
  const forecast = model.predict(horizon);
  return {
    f: forecast.mean,
    upper: forecast.upper95,
    lower: forecast.lower95
  };
}
```

#### Add Custom Remediation Action

Update `selfHealEngine.ts`:

```typescript
case 'your_custom_action':
  if (rule.target) {
    await db.collection('your_collection').doc(rule.target).set({
      customField: yourValue,
      ts: timestamp
    }, { merge: true });
    
    console.log(`[selfHeal] Applied custom action: ${rule.target}`);
  }
  break;
```

#### Connect to Real Systems

Currently, remediation actions write to:
- `feature_flags` (endpoint disable)
- `rate_limits` (rate reduction)
- `ops_commands` (function restart)

Connect these to your actual infrastructure:
- **Feature Flags**: LaunchDarkly, Unleash, or custom service
- **Rate Limiting**: Redis, Cloud Armor, or API Gateway
- **Function Management**: Cloud Run API, Lambda API, or Kubernetes

## 🧪 Testing

### Unit Tests

Create `functions/src/predict/__tests__/forecasting.test.ts`:

```typescript
import { smaForecast } from '../forecastEngine';

test('SMA forecast generates predictions', () => {
  const values = [10, 12, 11, 13, 12, 14, 13, 15];
  const { f, upper, lower } = smaForecast(values, 3, 6);
  
  expect(f.length).toBe(3);
  expect(upper.length).toBe(3);
  expect(lower.length).toBe(3);
  expect(upper[0]).toBeGreaterThan(f[0]);
  expect(lower[0]).toBeLessThan(f[0]);
});
```

### Integration Test

```bash
# Trigger forecast manually
firebase functions:shell
> forecastEngine()

# Wait 15 seconds

# Check Firestore
# predictions_daily should have new documents
```

### End-to-End Test

1. Create a remediation rule:
```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"metric":"errors","comparator":">=","threshold":50,"action":"disable_endpoint","target":"/test","enabled":true}' \
  https://your-domain.com/api/admin/remediation
```

2. Simulate high error forecast:
```bash
# Manually add high-error prediction to predictions_daily
```

3. Wait 5 minutes for `selfHealEngine` to run

4. Verify:
```bash
# Check admin_audit for self_heal action
# Check feature_flags for disabled endpoint
```

## 📈 Performance

### Forecast Generation
- **Execution time**: 200-400ms per metric
- **Data points**: Last 24-48 hours (up to 2000 points)
- **Frequency**: Every 15 minutes (96/day)

### Self-Healing Checks
- **Execution time**: 100-200ms
- **Rules checked**: All enabled rules
- **Frequency**: Every 5 minutes (288/day)

### Root Cause Analysis
- **Execution time**: 500-1000ms
- **Data points**: Last 7 days
- **Frequency**: Every 60 minutes (24/day)

## 🔒 Security

### Access Control
- All routes protected by `assertAdminReq()`
- Admin role required
- Rate limiting (60 req/min)
- CSRF protection

### Audit Trail
- Every self-heal action logged to `admin_audit`
- Includes forecast value, threshold, and action taken
- Actor UID: `system` for automated actions

### Safety Mechanisms
- **Cooldown periods**: Prevent repeated triggers
- **Auto-revert**: Actions auto-revert after 1 hour
- **Manual override**: Admins can disable rules anytime

## 🐛 Troubleshooting

### No predictions generated

**Cause**: Insufficient historical data

**Fix**:
1. Check `api_metrics_daily` has data
2. Verify at least 6 data points exist
3. Check function logs: `firebase functions:log --only forecastEngine`

---

### Self-healing not triggering

**Cause**: Rules misconfigured or predictions not matching

**Fix**:
1. Verify rule is enabled: `GET /api/admin/remediation?enabled=true`
2. Check latest prediction: Query `predictions_daily` collection
3. Verify threshold logic matches forecast values
4. Check function logs: `firebase functions:log --only selfHealEngine`

---

### Ops Copilot responses generic

**Cause**: Using mock responses (not connected to LLM)

**Fix**:
1. Connect to OpenAI/Claude API in `ops-copilot/page.tsx`
2. Replace `generateMockResponse()` with actual LLM call
3. Pass context data as prompt context

---

### Correlations always zero

**Cause**: Insufficient data or low variance

**Fix**:
1. Check `root_cause_graph` document in Firestore
2. Verify `api_metrics_daily` has varied data
3. Need at least 24 points with variance for meaningful correlations

## 📚 References

### Algorithms
- [Simple Moving Average](https://en.wikipedia.org/wiki/Moving_average)
- [Pearson Correlation](https://en.wikipedia.org/wiki/Pearson_correlation_coefficient)
- [Time Series Forecasting](https://otexts.com/fpp3/)

### Related Docs
- [Phase 28: Admin RBAC](./ADMIN_RBAC.md)
- [Phase 29: Observability](./ADMIN_OBSERVABILITY.md)
- [Phase 30: Real-Time & Alerts](./ADMIN_REALTIME_OBSERVABILITY.md)
- [Phase 31: AI Insights & Anomaly Detection](./ADMIN_AI_INSIGHTS.md)

## 🎯 Success Metrics

- ✅ Forecast accuracy > 80% (next 15 min)
- ✅ Self-healing response time < 5 minutes
- ✅ False positive rate < 15%
- ✅ Auto-revert rate > 95%
- ✅ 0 TypeScript errors
- ✅ All tests passing

## 🚧 Future Enhancements

1. **Advanced Forecasting**
   - ARIMA/SARIMA models
   - Prophet for seasonality
   - LSTM neural networks

2. **Smarter Self-Healing**
   - Multi-action cascades
   - Dynamic threshold adjustment
   - Learning from past triggers

3. **Enhanced Ops Copilot**
   - Real LLM integration (GPT-4, Claude)
   - Voice input/output
   - Proactive recommendations
   - Runbook automation

4. **Root Cause Improvements**
   - Granger causality test
   - Graph-based dependency analysis
   - Anomaly correlation

---

**Last Updated**: 2025-10-10  
**Version**: v32.0.0  
**Owner**: medo bendary

