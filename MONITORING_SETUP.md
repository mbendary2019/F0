# 📊 Monitoring & Alerts - Sprint 26 & 27

## 🎯 First 24 Hours - Critical Metrics

### Key Performance Indicators (KPIs)

| Metric | Target | Alert Threshold | Check Frequency |
|--------|--------|----------------|-----------------|
| **Success Rate** | ≥ 99% | < 98% | Every 5 minutes |
| **5xx Error Rate** | < 0.5% | > 2% | Every 5 minutes |
| **p95 Latency** | < 400ms | > 800ms | Every 5 minutes |
| **429 Rate Limit** | < 50/hour | > 100/hour | Every 15 minutes |
| **Scheduler Success** | 100% | 1 failure | After each run |
| **Daily Cost** | < $1 | > $2 | Daily |
| **Memory Usage** | < 512MB | > 768MB | Every 15 minutes |
| **Cold Starts** | < 20% | > 40% | Hourly |

---

## 🔧 Google Cloud Monitoring Setup

### 1. Enable Cloud Monitoring

```bash
# Enable required APIs
gcloud services enable monitoring.googleapis.com \
  --project=cashout-swap

gcloud services enable logging.googleapis.com \
  --project=cashout-swap
```

### 2. Create Monitoring Workspace

1. Visit: https://console.cloud.google.com/monitoring?project=cashout-swap
2. Click "Create Workspace"
3. Select project: `cashout-swap`
4. Add notification channels:
   - Email: your-email@example.com
   - Slack (optional): Configure webhook

---

## 🚨 Alert Policies

### Alert 1: High Error Rate (Critical)

**Metric:** `cloudfunctions.googleapis.com/function/execution_count`

**Filter:**
```
resource.type = "cloud_function"
metric.type = "cloudfunctions.googleapis.com/function/execution_count"
metric.labels.status != "ok"
```

**Condition:**
```
Rate of errors > 2% over 5 minutes
```

**Notification:**
- Email immediately
- Slack channel: #alerts-critical

**gcloud command:**
```bash
gcloud alpha monitoring policies create \
  --notification-channels=EMAIL_CHANNEL_ID \
  --display-name="Cloud Functions - High Error Rate" \
  --condition-display-name="Error rate > 2%" \
  --condition-threshold-value=0.02 \
  --condition-threshold-duration=300s \
  --condition-filter='resource.type="cloud_function" AND metric.type="cloudfunctions.googleapis.com/function/execution_count" AND metric.labels.status!="ok"' \
  --project=cashout-swap
```

### Alert 2: Quota Exceeded Spike (Warning)

**Metric:** Custom metric or HTTP 429 responses

**Condition:**
```
429 responses > 100 in 15 minutes
```

**Notification:**
- Email
- Track for capacity planning

### Alert 3: Scheduler Failure (Critical)

**Functions to Monitor:**
- `rollupDailyToMonthly`
- `pushUsageToStripe`
- `closeBillingPeriod`
- `quotaWarning`

**Condition:**
```
Function execution status != "ok"
```

**Notification:**
- Immediate email + Slack
- Page on-call if consecutive failures

### Alert 4: High Latency (Warning)

**Metric:** `cloudfunctions.googleapis.com/function/execution_times`

**Condition:**
```
p95 latency > 800ms over 5 minutes
```

**Action:**
- Investigate function performance
- Check Firestore query times
- Review Stripe API response times

### Alert 5: Budget Alert (Critical)

**Service:** Google Cloud Billing

**Budgets:**
- $25/month total
- Alerts at 50% ($12.50), 90% ($22.50), 100% ($25)

**Setup:**
1. Visit: https://console.cloud.google.com/billing/budgets?project=cashout-swap
2. Create Budget:
   - Name: "Sprint 26/27 Production Budget"
   - Projects: cashout-swap
   - Amount: $25
   - Thresholds: 50%, 90%, 100%
3. Add notification emails

---

## 📈 Custom Dashboards

### Dashboard 1: API Monetization Overview

**Widgets:**

1. **Gate Enforcement Decisions** (Pie Chart)
   - Allow vs Block
   - Reasons: quota_exceeded, subscription_inactive, overage

2. **Usage by Plan** (Stacked Area)
   - Free plan usage
   - Pro plan usage
   - Enterprise usage

3. **Monthly Quota Consumption** (Line Chart)
   - Total requests per user
   - Quota limit overlay

4. **Overage Billing** (Table)
   - Users in overage
   - Units reported to Stripe
   - Revenue impact

### Dashboard 2: Function Health

**Widgets:**

1. **Execution Count by Function** (Bar Chart)
2. **Error Rate by Function** (Heatmap)
3. **Average Execution Time** (Line Chart)
4. **Memory Usage** (Gauge)
5. **Cold Start Percentage** (Number)

### Dashboard 3: Cost Analysis

**Widgets:**

1. **Daily Cost Breakdown** (Stacked Bar)
   - Cloud Functions
   - Cloud Build
   - Firestore
   - Networking

2. **Cost per 1000 Requests** (Number)
3. **Projected Monthly Cost** (Forecast Line)

---

## 🔍 Log-Based Metrics

### Custom Metrics to Create

#### 1. Gate Decisions
```
resource.type="cloud_function"
jsonPayload.decision.allow=true
```

Count by decision reason:
```
EXTRACT(jsonPayload.decision.reason)
```

#### 2. Stripe Usage Records Created
```
resource.type="cloud_function"
textPayload=~"pushUsageToStripe.*created usage record"
```

#### 3. Webhook Delivery Success
```
resource.type="cloud_function"
jsonPayload.webhookDelivered=true
```

---

## 📊 Firestore Monitoring

### Collections to Watch

#### 1. `billing_events`
**Query Pattern:**
```javascript
db.collection('billing_events')
  .where('type', '==', 'overage_error')
  .where('createdAt', '>', yesterday)
  .get()
```

**Alert if:** > 5 errors in 1 hour

#### 2. `usage_logs/{uid}/monthly/{month}`
**Monitor:**
- Total requests per user
- Users approaching quota (80%+)
- Overage usage trends

#### 3. `webhook_queue`
**Monitor:**
```javascript
db.collection('webhook_queue')
  .where('status', '==', 'failed')
  .where('attempts', '>', 3)
  .get()
```

**Alert if:** > 10 permanently failed webhooks

---

## 🎛️ Real-Time Monitoring Commands

### Firebase Functions Logs

```bash
# Stream all function logs
firebase functions:log --limit 100

# Filter by specific function
firebase functions:log --only gateCheck --limit 50

# Filter by error level
firebase functions:log | grep ERROR

# Export logs for analysis
firebase functions:log --limit 1000 > logs/production-$(date +%Y%m%d).log
```

### Cloud Logging

```bash
# View logs for specific function
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=gateCheck" \
  --limit 50 \
  --project=cashout-swap

# Filter by severity
gcloud logging read "severity>=ERROR" \
  --limit 100 \
  --project=cashout-swap

# Tail logs in real-time
gcloud logging tail "resource.type=cloud_function" \
  --project=cashout-swap
```

### Cost Monitoring

```bash
# Current month costs
gcloud billing accounts get-billing-info BILLING_ACCOUNT_ID

# Cost breakdown by service
gcloud billing accounts get-price-list BILLING_ACCOUNT_ID
```

---

## 📱 Notification Channels

### Email Notifications

**Setup:**
```bash
gcloud alpha monitoring channels create \
  --display-name="Primary Email" \
  --type=email \
  --channel-labels=email_address=your-email@example.com \
  --project=cashout-swap
```

### Slack Notifications (Optional)

**Setup:**
1. Create Slack App: https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Copy Webhook URL
4. Configure in Cloud Monitoring:
   ```bash
   gcloud alpha monitoring channels create \
     --display-name="Slack Alerts" \
     --type=slack \
     --channel-labels=url=SLACK_WEBHOOK_URL \
     --project=cashout-swap
   ```

### SMS/Phone (High Priority)

For P0 incidents:
```bash
gcloud alpha monitoring channels create \
  --display-name="Emergency SMS" \
  --type=sms \
  --channel-labels=number=+1234567890 \
  --project=cashout-swap
```

---

## 📊 Weekly Review Checklist

### Every Monday Morning:

- [ ] Review error rate trends (past 7 days)
- [ ] Check cost vs budget (% consumed)
- [ ] Analyze top 10 users by usage
- [ ] Review scheduler job success rate
- [ ] Check Stripe vs Firestore reconciliation
- [ ] Review webhook delivery success rate
- [ ] Analyze API endpoint performance
- [ ] Check for unusual traffic patterns
- [ ] Review security logs for anomalies
- [ ] Update capacity planning projections

---

## 🔧 Troubleshooting Queries

### Find High-Error Users
```javascript
// Firestore Console
db.collectionGroup('monthly')
  .where('errors', '>', 100)
  .orderBy('errors', 'desc')
  .limit(10)
  .get()
```

### Check Scheduler Execution History
```bash
gcloud scheduler jobs describe rollupDailyToMonthly \
  --location=us-central1 \
  --project=cashout-swap
```

### Analyze Slow Functions
```bash
gcloud logging read "
  resource.type=cloud_function
  AND jsonPayload.executionTime > 1000
" --limit 50 --format json --project=cashout-swap | \
jq '.[] | {function: .resource.labels.function_name, time: .jsonPayload.executionTime}'
```

---

## 📈 Performance Baselines

After 7 days, establish baselines:

| Metric | Baseline | Description |
|--------|----------|-------------|
| Avg Requests/Day | TBD | Total API calls |
| Avg Cost/Day | TBD | Daily spend |
| p50 Latency | TBD | Median response time |
| p95 Latency | TBD | 95th percentile |
| p99 Latency | TBD | 99th percentile |
| Error Rate | TBD | % of failed requests |
| Cold Start Rate | TBD | % of cold starts |

Update alert thresholds based on baselines + 20% buffer.

---

## 🎯 Success Metrics (30-Day Review)

### Business Metrics
- Free → Pro conversion rate
- Average quota utilization
- Overage revenue
- User retention rate

### Technical Metrics
- 99.9% uptime achieved
- p95 latency < 400ms
- Total cost < $25/month
- Zero data loss incidents
- Zero billing discrepancies

### Operational Metrics
- Mean time to detect (MTTD) < 5 minutes
- Mean time to resolve (MTTR) < 30 minutes
- Zero rollbacks required
- All schedulers 100% reliable

---

## 🔗 Quick Links

- **Firebase Console:** https://console.firebase.google.com/project/cashout-swap
- **Cloud Monitoring:** https://console.cloud.google.com/monitoring?project=cashout-swap
- **Cloud Logging:** https://console.cloud.google.com/logs?project=cashout-swap
- **Billing:** https://console.cloud.google.com/billing?project=cashout-swap
- **Stripe Dashboard:** https://dashboard.stripe.com
- **Functions List:** https://console.cloud.google.com/functions/list?project=cashout-swap

---

**Remember:** Proactive monitoring prevents incidents. Check dashboards daily for the first week, then move to weekly reviews.
