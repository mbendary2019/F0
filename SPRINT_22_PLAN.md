# 🛡️ Sprint 22 — Reliability, Ops & Status

**Version:** v23.0.0
**Goal:** Production-grade reliability: SLOs, deep monitoring, alerting, incident playbooks, public status page, and accurate cost tracking.

---

## 📦 New Files (11 Files)

### 1) Observability

| File | Purpose |
|------|---------|
| `src/lib/observability/metrics.ts` | Metrics collection (req_latency_ms, error_rate, token_cost) |
| `functions/src/ops/metricsIngest.ts` | Receive metrics from client/server |

#### 📊 Firestore Structure
```
ops_metrics/{day}/{metricId}
  ├── name ("api_latency" | "error_rate" | "token_cost")
  ├── value (number)
  ├── labels ({ endpoint, method, status })
  ├── timestamp (ms)
  └── aggregation ("sum" | "avg" | "p95" | "count")
```

#### 📈 Key Metrics
- **Request Latency:** p50, p95, p99 (ms)
- **Error Rate:** % of 5xx responses
- **Token Cost:** USD per request/user/day
- **Agent Uptime:** % of time agents responsive
- **Database Performance:** Firestore read/write latency
- **Storage Usage:** GB per user/total

---

### 2) SLOs & Alerts

| File | Purpose |
|------|---------|
| `config/slo.json` | SLO definitions (99.5% API uptime, <300ms p95 latency) |
| `functions/src/ops/alertRules.ts` | Periodic evaluation and Slack/Email alerts |

#### 📋 Sample SLO Configuration (`config/slo.json`)
```json
{
  "slos": [
    {
      "name": "API Availability",
      "target": 99.5,
      "window": "30d",
      "metric": "error_rate",
      "threshold": 0.5,
      "alert": {
        "severity": "critical",
        "channels": ["slack", "email"]
      }
    },
    {
      "name": "API Latency (p95)",
      "target": 300,
      "window": "24h",
      "metric": "api_latency_p95",
      "threshold": 400,
      "alert": {
        "severity": "warning",
        "channels": ["slack"]
      }
    },
    {
      "name": "Agent Success Rate",
      "target": 99.0,
      "window": "7d",
      "metric": "agent_success_rate",
      "threshold": 95.0,
      "alert": {
        "severity": "high",
        "channels": ["slack", "email", "pagerduty"]
      }
    },
    {
      "name": "Database Write Latency",
      "target": 100,
      "window": "1h",
      "metric": "firestore_write_latency_p95",
      "threshold": 200,
      "alert": {
        "severity": "warning",
        "channels": ["slack"]
      }
    }
  ]
}
```

#### 🚨 Alert Channels
- **Slack:** `#ops-alerts` channel
- **Email:** `ops@f0.com`
- **PagerDuty:** Critical incidents only
- **In-App:** Admin notification center

---

### 3) Status Page (Public)

| File | Purpose |
|------|---------|
| `src/app/status/page.tsx` | Public status page (Components: API, Auth, Billing, AI Providers) |
| `src/app/api/status/healthz/route.ts` | Health check aggregation endpoint |

#### 🟢 Status Components
```javascript
{
  "API": {
    "status": "operational" | "degraded" | "outage",
    "latency": 123, // ms
    "uptime": 99.8, // %
    "lastCheck": timestamp
  },
  "Auth": {
    "status": "operational",
    "provider": "Firebase Auth",
    "lastCheck": timestamp
  },
  "Billing": {
    "status": "operational",
    "provider": "Stripe",
    "lastCheck": timestamp
  },
  "AI_Providers": {
    "Claude": {
      "status": "operational",
      "models": ["sonnet-4-5", "opus-4"],
      "latency": 1200
    },
    "OpenAI": {
      "status": "degraded",
      "models": ["gpt-4"],
      "latency": 3500,
      "message": "Increased latency detected"
    }
  },
  "Database": {
    "status": "operational",
    "provider": "Firestore",
    "readLatency": 45,
    "writeLatency": 78
  },
  "Storage": {
    "status": "operational",
    "provider": "Cloud Storage",
    "lastCheck": timestamp
  }
}
```

#### 🎨 Status Badge (Navbar)
- **Operational:** Green dot
- **Degraded:** Yellow dot + tooltip
- **Outage:** Red dot + link to status page

---

### 4) Incidents

| File | Purpose |
|------|---------|
| `src/app/(admin)/incidents/page.tsx` | Incident dashboard (open/mitigating/resolved) |
| `src/app/api/incidents/route.ts` | CRUD and incident updates |
| `runbooks/billing-outage.md` | Billing system outage playbook |
| `runbooks/provider-degradation.md` | AI provider degradation playbook |
| `runbooks/firestore-hotspot.md` | Firestore hotspot mitigation |
| `runbooks/auth-issues.md` | Authentication issues playbook |

#### 📁 Firestore Structure
```
incidents/{id}
  ├── title (string)
  ├── impact ("low" | "medium" | "high" | "critical")
  ├── status ("investigating" | "identified" | "mitigating" | "resolved")
  ├── components (array of affected components)
  ├── startedAt (timestamp)
  ├── identifiedAt (timestamp)
  ├── mitigatedAt (timestamp)
  ├── resolvedAt (timestamp)
  ├── updates[] (timeline)
  │   ├── timestamp
  │   ├── status
  │   ├── message
  │   └── author (uid)
  ├── rootCause (string, after resolution)
  ├── actionItems[] (follow-up tasks)
  └── publicVisible (boolean)
```

#### 📖 Sample Runbook Structure

**`runbooks/billing-outage.md`**
```markdown
# Billing System Outage Runbook

## Severity: Critical

## Detection
- Alert: "Stripe webhook failure rate > 10%"
- Symptom: Users reporting failed payments
- Monitoring: Check `/admin/analytics/usage` for payment drops

## Initial Response (5 min)
1. Verify Stripe Dashboard status
2. Check webhook logs: `firebase functions:log --only stripeWebhook`
3. Create incident: `/admin/incidents` → "Billing Outage"
4. Post to #ops-alerts Slack channel

## Diagnosis (15 min)
1. Check Stripe API status: https://status.stripe.com
2. Verify webhook endpoint accessible
3. Check Firebase Functions quota/errors
4. Review recent deployments

## Mitigation
### If Stripe is down:
- Enable feature flag: `billing.stripe_fallback = true`
- Queue payments in Firestore for retry
- Display banner: "Payment processing delayed"

### If webhook is failing:
- Manually process failed webhooks from Stripe Dashboard
- Redeploy webhook function: `firebase deploy --only functions:stripeWebhook`

### If quota exceeded:
- Increase Cloud Functions quota
- Scale up instances temporarily

## Resolution
1. Verify payments processing normally
2. Process queued payments
3. Update incident status: "resolved"
4. Post-mortem within 48h

## Prevention
- Add webhook retry logic
- Implement circuit breaker pattern
- Monitor Stripe API rate limits
- Set up Stripe status webhook
```

---

### 5) Cost & Quotas

| File | Purpose |
|------|---------|
| `src/app/(admin)/costs/page.tsx` | Cost estimation dashboard (by model and plan) |

#### 📊 Enhanced Usage Summary
```javascript
usage_summary/{uid}/daily/{dayId}
  ├── calls (count)
  ├── tokens (total)
  ├── duration (ms)
  ├── cost (cents)
  ├── estimated_cost_usd (calculated)
  ├── quota_pct (% of plan limit used)
  └── breakdown_by_model
      ├── claude_sonnet_4_5 { calls, tokens, cost }
      ├── claude_opus_4 { calls, tokens, cost }
      └── openai_gpt4 { calls, tokens, cost }
```

#### 💰 Cost Calculation
```typescript
// Model pricing (per 1M tokens)
const MODEL_COSTS = {
  "claude-sonnet-4-5": { input: 3.00, output: 15.00 },
  "claude-opus-4": { input: 15.00, output: 75.00 },
  "gpt-4": { input: 30.00, output: 60.00 },
  "gpt-4-turbo": { input: 10.00, output: 30.00 }
};

function calculateCost(tokens: { input: number, output: number }, model: string) {
  const pricing = MODEL_COSTS[model];
  const inputCost = (tokens.input / 1_000_000) * pricing.input;
  const outputCost = (tokens.output / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
```

---

## 🧩 Feature Flags

```json
{
  "alerts": {
    "slack": true,
    "email": true,
    "pagerduty": false
  },
  "ops": {
    "slo_enforced": true,
    "public_status_page": true,
    "metrics_collection": true
  },
  "quotas": {
    "enabled": true,
    "soft_limit_warning": 0.8,
    "hard_limit_block": 1.0
  },
  "costs": {
    "dashboard": true,
    "realtime_tracking": true
  }
}
```

---

## 🔐 Firestore Structure Updates

### New Collections

**`status/components/{id}`**
```javascript
{
  name: "API" | "Auth" | "Billing" | "AI_Providers" | "Database" | "Storage",
  state: "operational" | "degraded" | "outage",
  lastCheck: timestamp,
  metadata: {
    latency?: number,
    uptime?: number,
    provider?: string
  }
}
```

**`ops_metrics/{day}/{metricId}`**
```javascript
{
  name: string,
  value: number,
  labels: object,
  timestamp: number,
  aggregation: "sum" | "avg" | "p95" | "count"
}
```

---

## ✅ Pre-Flight Checklist

| # | Item | Status |
|---|------|--------|
| 1 | Slack webhook created and `SLACK_WEBHOOK_URL` in env | ⬜ |
| 2 | `config/slo.json` populated with SLOs | ⬜ |
| 3 | `metricsIngest` function deployed and tested | ⬜ |
| 4 | `ops_metrics` collection writes working | ⬜ |
| 5 | Status page shows all components | ⬜ |
| 6 | Health check endpoint returns 200 | ⬜ |
| 7 | Incident creation tested (dummy incident) | ⬜ |
| 8 | Alert rules triggering correctly | ⬜ |
| 9 | Runbooks reviewed and accessible | ⬜ |
| 10 | Cost dashboard showing accurate data | ⬜ |

---

## 🚀 Deployment Steps

### Step 1: Deploy Functions
```bash
cd functions
npm install

# Deploy metrics and alerting functions
firebase deploy --only functions:metricsIngest,functions:alertRules

# Verify logs
firebase functions:log --only metricsIngest
```

### Step 2: Configure SLOs
```bash
# Upload SLO config to Firestore
node scripts/upload-slo-config.js

# Or manually create config/slo document in Firestore Console
```

### Step 3: Set Up Slack Webhook
```bash
# Set Slack webhook URL
firebase functions:config:set slack.webhook_url="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
firebase functions:config:set slack.ops_channel="#ops-alerts"

# Redeploy alert rules
firebase deploy --only functions:alertRules
```

### Step 4: Deploy Hosting
```bash
npm run build
firebase deploy --only hosting

# Test status page
curl https://yourapp.web.app/status
curl https://yourapp.web.app/api/status/healthz
```

### Step 5: Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

---

## 🔥 Chaos & Smoke Tests (7 Tests)

### Test 1: Service Degradation Detection
1. Temporarily disable API endpoint (local test)
2. Wait 60 seconds for health check
3. Verify status page shows "degraded"
4. Verify badge in navbar turns yellow
5. Re-enable endpoint
6. Verify status returns to "operational"

### Test 2: Latency Alert Trigger
1. Artificially increase response time (add `sleep(500)`)
2. Wait for metrics collection (1 min)
3. Verify alert rule evaluates
4. Check Slack channel for p95 latency warning
5. Remove sleep, verify alert clears

### Test 3: Provider Quota Exceeded
1. Reduce user's quota to 5 calls
2. Make 6 API calls
3. Verify 6th call returns 429 (quota exceeded)
4. Check notification: "Usage warning: 100% of quota"
5. Create incident: "provider-degradation"
6. Verify incident appears on status page

### Test 4: Cost Tracking Accuracy
1. Make 10 agent requests with different models
2. Visit `/admin/costs`
3. Verify cost calculation matches expected
4. Check breakdown by model
5. Verify daily/monthly aggregation correct

### Test 5: Incident Timeline
1. Create incident: "Billing Outage"
2. Add update: "Investigating payment failures"
3. Add update: "Identified Stripe webhook issue"
4. Add update: "Mitigated - redeployed webhook function"
5. Resolve incident
6. Verify timeline shows all updates with timestamps
7. Verify public status page displays incident (if `publicVisible = true`)

### Test 6: SLO Violation Handling
1. Trigger sustained error rate > 1% (simulate with test script)
2. Wait for alert rule evaluation (runs every 5 min)
3. Verify Slack alert sent
4. Verify email sent to ops team
5. Check incident auto-created (if configured)
6. Clear errors, verify SLO returns to normal

### Test 7: Service Restoration
1. Create outage incident
2. Update status: "mitigating"
3. Fix issue
4. Update status: "resolved"
5. Verify status page shows "operational"
6. Verify timeline shows MTTR (Mean Time To Resolve)
7. Verify post-mortem template generated

---

## 🎯 Success Metrics

### Week 1 Post-Launch

| Metric | Target |
|--------|--------|
| Service availability | ≥ 99.5% |
| False positive alerts | ≤ 1% |
| p95 API latency | ≤ 400ms |
| MTTR (Mean Time To Resolve) | < 2 hours |
| Status page uptime | 100% |
| Cost tracking accuracy | ≥ 99% |
| Alert delivery success | ≥ 99.9% |

### Month 1 Post-Launch

| Metric | Target |
|--------|--------|
| Service availability | ≥ 99.5% |
| False positive rate | ≤ 1% |
| p95 latency | ≤ 400ms across 90% of hours |
| Incidents resolved | ≥ 80% within 2h MTTR |
| SLO compliance | 100% (all SLOs met) |
| Cost variance | < 5% difference from actual bills |

---

## 📐 Technical Architecture

### Metrics Collection Flow
```
Client/Server Event
  ↓
metrics.ts → record("api_latency", 123, { endpoint: "/api/agent" })
  ↓
Push to metricsIngest Cloud Function
  ↓
Write to ops_metrics/{today}/{metricId}
  ↓
Aggregate every 5 minutes (p50, p95, p99)
  ↓
Store aggregated metrics
  ↓
Evaluate against SLOs (alertRules function)
  ↓
If threshold exceeded → Send alert
```

### Alert Flow
```
alertRules runs every 5 minutes (Cloud Scheduler)
  ↓
Load config/slo.json
  ↓
For each SLO:
  Query ops_metrics for metric value
  ↓
  Compare against threshold
  ↓
  If violated:
    Create/update incident
    ↓
    Send alerts via configured channels (Slack/Email)
    ↓
    Update status page component state
```

### Status Page Update Flow
```
Health check runs every 30 seconds
  ↓
Ping each component:
  - API: /api/health
  - Auth: Firebase Auth SDK check
  - Billing: Stripe API ping
  - Database: Firestore test query
  - Storage: Test file read
  ↓
Update status/components/{id}.state
  ↓
Frontend polls /api/status/healthz every 10s
  ↓
Updates badge and status page in real-time
```

---

## 🔐 Security Considerations

### Public Status Page
- **No sensitive data:** Only component states, no user data
- **Rate limiting:** 60 requests/min per IP
- **DDoS protection:** Cloudflare/CDN caching

### Incident Data
- **Admin-only write:** Only admins can create/update incidents
- **Public visibility flag:** Control what's shown on status page
- **Audit log:** All incident updates logged with author UID

### Metrics Collection
- **Sampling:** Reduce load by sampling (10% of requests)
- **PII scrubbing:** Remove user IDs from labels
- **Retention:** Auto-delete metrics older than 90 days

---

## 🧯 Emergency Controls

| Issue | Kill Switch |
|-------|-------------|
| Alert storm (too many alerts) | `alerts.enabled = false` |
| Status page performance issues | `ops.public_status_page = false` |
| Metrics collection causing load | `ops.metrics_collection = false` |
| Cost tracking inaccuracies | `costs.realtime_tracking = false` |
| SLO false positives | `ops.slo_enforced = false` |

---

## 📚 Runbook Index

1. **`runbooks/billing-outage.md`** - Stripe webhook failures, payment issues
2. **`runbooks/provider-degradation.md`** - AI provider latency/errors (Claude, OpenAI)
3. **`runbooks/firestore-hotspot.md`** - Database write contention, slow queries
4. **`runbooks/auth-issues.md`** - Firebase Auth outages, login failures
5. **`runbooks/ddos-attack.md`** - Traffic spikes, rate limit exhaustion
6. **`runbooks/data-corruption.md`** - Firestore data integrity issues

---

## 📘 Documentation to Create

1. **SLO_DEFINITIONS.md** - All SLOs with targets and thresholds
2. **INCIDENT_RESPONSE.md** - Process for handling incidents
3. **METRICS_GUIDE.md** - Available metrics and how to use them
4. **RUNBOOK_TEMPLATE.md** - Template for creating new runbooks
5. **COST_TRACKING.md** - How cost calculation works

---

## 🗓️ Implementation Timeline

| Week | Task | Deliverables |
|------|------|--------------|
| 1 | Metrics collection + storage | ✅ ops_metrics writes working |
| 2 | SLO definitions + alert rules | ✅ Alerts firing correctly |
| 3 | Status page + health checks | ✅ Public status page live |
| 4 | Incident management + runbooks | ✅ 6 runbooks complete |
| 5 | Cost tracking dashboard | ✅ Real-time cost visibility |
| 6 | Testing + chaos engineering | ✅ All 7 smoke tests passing |

---

## 🟢 Status Goal

**Target State:**
- ✅ Service availability ≥ 99.5%
- ✅ MTTR < 2 hours
- ✅ All SLOs compliant
- ✅ Status page public and accurate
- ✅ Cost tracking ±5% accuracy

**Go-Live Criteria:**
- All 7 chaos tests passing
- SLO config reviewed and approved
- Runbooks tested in staging
- Alert channels verified (Slack/Email)
- Status page accessible and updating

---

**Sprint Owner:** _____________________
**Start Date:** _____________________
**Target Completion:** 6 weeks
**Dependencies:** Sprint 21 (Go-to-Market & Growth)

🛡️ **Sprint 22 - Ready to Execute**
