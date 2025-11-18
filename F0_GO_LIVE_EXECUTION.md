# 🚀 F0 Go-Live Execution Plan

> **Operational guide for launching F0 SaaS Public Beta step-by-step. Ready for immediate execution.**

**Version:** 1.0
**Last Updated:** 2025-01-30
**Owner:** _____________________

---

## 🧭 Scope

This document covers the period from **T-3 days** until **T+7 days** from launch.

**Assumptions:**
- **Sprint 20** complete (Feature Flags, App Config)
- **SPRINT_21_PLAN.md** and **SPRINT_22_PLAN.md** prepared
- All Sprint 19 components deployed (Taxes, Multi-Currency, Bundles)

---

## 📅 Timeline (T-3 → T+7)

### T-3 Days — Code Freeze + Production Environment Setup

#### 🔒 Code Freeze
Freeze critical interfaces:
- Billing system (`/api/subscriptions/*`)
- Checkout flow (`/api/market/checkout`)
- Customer portal (`/billing`)
- Entitlements middleware

#### 🔑 Environment Variables
Verify production keys:

```bash
# Stripe (Live Mode)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Firebase
FIREBASE_PROJECT=f0-prod
APP_BASE_URL=https://yourapp.web.app

# Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Email Provider
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@f0.com
# OR
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=mg.f0.com

# Optional
PAGERDUTY_INTEGRATION_KEY=...
```

#### 🎛️ Feature Flags (Firestore: config/feature_flags)
Enable core flags:

```json
{
  "subscriptions": {
    "enforced": true,
    "require_active": true
  },
  "workspace": {
    "auto_create": true
  },
  "rate_limit": {
    "enabled": true,
    "free_tier": 10,
    "daily_tier": 100,
    "monthly_tier": 1000
  },
  "mfa": {
    "enforced": true,
    "admin_required": true
  },
  "usage": {
    "analytics": true,
    "tracking": true
  },
  "alerts": {
    "slack": true,
    "email": true
  }
}
```

#### 📋 Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules --project $FIREBASE_PROJECT
```

**Verify:**
```bash
firebase firestore:get config/feature_flags --project $FIREBASE_PROJECT
```

---

### T-2 Days — Webhooks + Live Billing Test

#### 🔗 Stripe Webhook Setup

**Create webhook in Stripe Dashboard:**
- URL: `https://yourapp.web.app/api/webhooks/stripe`
- Events to listen:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.payment_succeeded`

**Verify webhook secret:**
```bash
firebase functions:config:get stripe.webhook_secret --project $FIREBASE_PROJECT
```

#### 💳 Live Test Transactions

**Test with Stripe test cards in Live mode:**

1. **Daily Plan ($1/day)**
   - Card: `4242 4242 4242 4242`
   - Verify subscription created
   - Check `users/{uid}.subscription.status = "active"`
   - Verify entitlements updated
   - Check rate limit increased to 100/day

2. **Monthly Plan ($20/month)**
   - Complete checkout
   - Verify subscription active
   - Check rate limit 1000/day

3. **Payment Failure**
   - Card: `4000 0000 0000 0341` (attach then decline)
   - Trigger `invoice.payment_failed` event
   - Verify email sent
   - Verify 48h grace period starts
   - After grace period: verify downgrade to Free

#### 📊 Monitor Webhook Logs
```bash
firebase functions:log --only subscriptionWebhook --project $FIREBASE_PROJECT --lines 100
```

**Expected output:**
```
✅ Subscription created: sub_xxx for user abc123
✅ Entitlements updated: daily plan
✅ Email sent: subscription_activated
```

---

### T-1 Day — Performance Check + Rate Limits

#### ⚡ Rate Limit Verification

**Test rate limits by plan:**

```bash
# Free tier (10 req/min)
for i in {1..15}; do curl -X GET $APP_BASE_URL/api/agent/status; done
# Expected: First 10 succeed, 11-15 return 429

# Daily tier (100 req/min)
# Upgrade account, then:
for i in {1..105}; do curl -X GET $APP_BASE_URL/api/agent/status; done
# Expected: First 100 succeed, 101-105 return 429
```

#### 🔥 Light Load Test

**Using k6 or locust (local):**

```javascript
// k6-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10, // 10 virtual users
  duration: '5m',
};

export default function () {
  let res = http.get('https://yourapp.web.app/api/agent/status');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'latency < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

**Run:**
```bash
k6 run k6-load-test.js
```

**Target metrics:**
- p95 latency: <400ms
- Error rate: <1%
- Throughput: >50 req/sec

#### 👥 On-Call Rotation

**Set up 24/7 on-call for first 72 hours:**
- Primary: _____________________
- Secondary: _____________________
- Escalation: _____________________

**Alert channels:**
- Slack: `#f0-ops`
- Email: `ops@f0.com`
- PagerDuty (optional): Critical only

---

### T (Launch Day) — Canary 10%

#### 🎯 Canary Configuration

```json
{
  "ai_eval": {
    "enabled": true,
    "sampleRate": 0.10  // Start at 10%
  },
  "reviews": {
    "img_mod_required": false  // Auto-approve initially
  }
}
```

#### 🚢 Final Deployment

```bash
# 1. Build production
npm run build

# 2. Deploy hosting
firebase deploy --only hosting --project $FIREBASE_PROJECT

# 3. Verify deployment
curl -I https://yourapp.web.app
# Expected: HTTP/2 200

# 4. Check functions
firebase functions:list --project $FIREBASE_PROJECT
```

#### ✅ 30-Minute Smoke Tests

**Run all tests within 30 minutes of launch:**

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 1 | New account signup | Auto-redirect to `/onboarding` | ⬜ |
| 2 | Complete onboarding | Workspace created, entitlements = free | ⬜ |
| 3 | Free user tries premium feature | Redirect to `/pricing` | ⬜ |
| 4 | Upgrade to Daily plan | Checkout → Success → Entitlements updated | ⬜ |
| 5 | Verify rate limit increased | 100 req/min allowed | ⬜ |
| 6 | Payment failure simulation | Email sent + Grace period starts | ⬜ |
| 7 | Agent dashboard | Shows active jobs, error rate | ⬜ |
| 8 | Usage analytics | Records today's calls | ⬜ |
| 9 | Status page | All components "operational" | ⬜ |
| 10 | Notification center | Shows subscription_activated | ⬜ |

**If ANY test fails:**
1. Document failure in `#f0-incidents`
2. Decide: Fix immediately or rollback
3. If fix takes >15 min, consider rollback

#### 📢 Launch Announcement

**Email blast (existing beta users):**
```
Subject: F0 Public Beta is Live! 🚀

We're excited to announce that F0 is now available for public beta!

🎁 Launch Special:
- First 100 signups: 50% off Monthly plan (first 3 months)
- Referral bonus: $10 credit per friend

Get Started: https://yourapp.web.app/pricing

Questions? Visit our Help Center: https://yourapp.web.app/help
```

**Social media:**
- X/Twitter: Thread with demo video
- LinkedIn: Post with use cases
- Product Hunt: Launch post

**Update status page:**
```json
{
  "status": "Launch Event",
  "message": "F0 Public Beta now available! 🚀",
  "link": "/pricing"
}
```

---

### T+1 to T+2 — Intensive Monitoring + Hot Fixes

#### 📊 Monitoring Dashboards

**Check every hour:**

1. **Cloud Logging (Errors)**
   ```bash
   gcloud logging read "resource.type=cloud_function AND severity>=ERROR" \
     --limit 50 --format json --project $FIREBASE_PROJECT
   ```

2. **Metrics Dashboard** (`/admin/analytics/usage`)
   - Signups/hour
   - Conversion rate (Free → Paid)
   - Error rate
   - p95 latency

3. **Stripe Dashboard**
   - Successful payments
   - Failed payments (should be <2%)
   - Webhook delivery success

4. **Firestore Console**
   - Read/write operations (check for spikes)
   - Document count growth
   - Index status (verify no missing indexes)

#### 🚨 Alert Thresholds (Slack)

Configure in `functions/src/ops/alertRules.ts`:

```typescript
const ALERT_RULES = [
  {
    metric: "api_latency_p95",
    threshold: 400, // ms
    window: "10min",
    severity: "warning",
    channels: ["slack"]
  },
  {
    metric: "error_rate",
    threshold: 3, // %
    window: "5min",
    severity: "critical",
    channels: ["slack", "email", "pagerduty"]
  },
  {
    metric: "webhook_failure_rate",
    threshold: 10, // %
    window: "10min",
    severity: "high",
    channels: ["slack", "email"]
  },
  {
    metric: "subscription_conversion_rate",
    threshold: 15, // % (below this is warning)
    window: "1hour",
    severity: "info",
    channels: ["slack"]
  }
];
```

#### 🔧 Hot Fix Policy

**Allowed during T+1 to T+2:**
- Feature flag toggles (no code deploy)
- Firestore rule updates (if security issue)
- Minor UI text changes (behind feature flag)

**NOT allowed:**
- Major code refactors
- Database schema changes
- New feature deployments

**If critical fix needed:**
1. Test in staging
2. Deploy to production
3. Monitor for 30 minutes
4. Document in incident log

---

### T+3 to T+5 — Expand to 50%

#### 📈 Canary Expansion

**If metrics are stable (T+3):**

```json
{
  "ai_eval": {
    "sampleRate": 0.5  // Increase to 50%
  }
}
```

**Verify via `/admin/config/feature-flags`**

#### 🎚️ Rate Limit Adjustment (Optional)

**If Monthly plan users hit limits frequently:**

```json
{
  "rate_limit": {
    "monthly_tier": 2000  // Increase from 1000
  }
}
```

#### 📬 Notification Center Rollout

**Enable for paid users first:**

```typescript
// In notification dispatcher
if (user.subscription.plan !== "free") {
  await sendInAppNotification(uid, {
    type: "feature_unlocked",
    title: "Notification Center is now available!",
    body: "Stay updated with real-time notifications.",
    link: "/notifications"
  });
}
```

#### 📧 Email Campaign (T+4)

**"Quick Start Guide" email to all signups:**
```
Subject: Your F0 Quick Start Guide 📚

Hi {name},

Welcome to F0! Here's how to get the most out of your account:

1. Complete your workspace setup
2. Try your first agent task
3. Explore integrations (VS Code, Cursor)
4. Invite your team (coming soon)

Watch our 2-minute demo: [video link]

Need help? Visit /help or reply to this email.
```

---

### T+6 to T+7 — Full Rollout 100%

#### 🎯 Full Canary

```json
{
  "ai_eval": {
    "sampleRate": 1.0  // 100% rollout
  },
  "reviews": {
    "img_mod_required": true  // Enable if needed
  }
}
```

#### 📊 Post-Launch Report

**Generate report covering:**

1. **Growth Metrics**
   - Total signups (T to T+7)
   - Onboarding completion rate
   - Free → Paid conversion rate
   - Referral usage

2. **Reliability Metrics**
   - Uptime % (target: >99.5%)
   - p95 latency (target: <400ms)
   - Error rate (target: <0.5%)
   - Webhook success rate (target: >99%)

3. **Monetization Metrics**
   - MRR (Monthly Recurring Revenue)
   - ARPU (Average Revenue Per User)
   - Churn rate (7-day)
   - Plan distribution (Free/Daily/Monthly %)

4. **Issues & Incidents**
   - Total incidents
   - Mean Time To Resolve (MTTR)
   - Root causes
   - Action items

5. **Recommendations**
   - Feature requests (top 5)
   - Performance optimizations
   - Cost optimizations
   - Next sprint priorities

**Report template:** `POST_LAUNCH_REPORT_TEMPLATE.md`

---

## ✅ Checklists

### A) Pre-Flight Checklist (Before T)

| # | Item | Verified By | Status |
|---|------|-------------|--------|
| 1 | Stripe Live mode enabled with correct keys | _______ | ⬜ |
| 2 | Webhook updates `users/{uid}/billing` correctly | _______ | ⬜ |
| 3 | Firestore rules deployed (workspaces, usage_summary) | _______ | ⬜ |
| 4 | Entitlements middleware working on critical routes | _______ | ⬜ |
| 5 | Email provider configured (SendGrid/Mailgun) | _______ | ⬜ |
| 6 | Welcome + Invoice Paid emails sending | _______ | ⬜ |
| 7 | Slack alerts enabled and tested | _______ | ⬜ |
| 8 | Status badge visible in navbar | _______ | ⬜ |
| 9 | Status page shows "Operational" for all components | _______ | ⬜ |
| 10 | On-call rotation configured (24/7 for 72h) | _______ | ⬜ |
| 11 | Load testing completed (p95 <400ms) | _______ | ⬜ |
| 12 | Rate limits tested per plan | _______ | ⬜ |
| 13 | Backup procedures documented | _______ | ⬜ |
| 14 | Rollback plan prepared | _______ | ⬜ |
| 15 | Launch announcement ready | _______ | ⬜ |

---

### B) Smoke Test Checklist (Day T - 30 minutes)

| # | Test | Expected Result | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | New signup | Redirect to `/onboarding` | ⬜ | |
| 2 | Complete onboarding | Workspace created + entitlements set | ⬜ | |
| 3 | Pricing page | All 3 plans visible (Free/Daily/Monthly) | ⬜ | |
| 4 | Checkout (Daily) | Stripe session → success → activated | ⬜ | |
| 5 | Checkout (Monthly) | Stripe session → success → activated | ⬜ | |
| 6 | Paywall enforcement | Free user blocked from premium feature | ⬜ | |
| 7 | Rate limit (Free) | 11th request returns 429 | ⬜ | |
| 8 | Rate limit (Paid) | Higher limits working | ⬜ | |
| 9 | Portal access | `/billing` opens Stripe portal | ⬜ | |
| 10 | Agent dashboard | Shows active jobs, metrics | ⬜ | |
| 11 | Usage analytics | Records today's calls correctly | ⬜ | |
| 12 | Notification center | Shows subscription_activated | ⬜ | |
| 13 | Status page | All green, <2s load time | ⬜ | |
| 14 | Help center | MDX guides render correctly | ⬜ | |
| 15 | Referral code | Generated and usable | ⬜ | |

**If 3+ tests fail:** STOP and investigate before continuing.

---

### C) Post-Launch Checklist (T+1 to T+7)

| Day | Task | Status |
|-----|------|--------|
| T+1 | Monitor p95 latency every hour | ⬜ |
| T+1 | Review payment failures, apply grace periods | ⬜ |
| T+1 | Check Slack alerts functioning | ⬜ |
| T+1 | Verify webhook delivery >99% | ⬜ |
| T+2 | Analyze early churn (cancellations <48h) | ⬜ |
| T+2 | Update FAQ based on top 5 support questions | ⬜ |
| T+3 | Expand canary to 50% | ⬜ |
| T+3 | Send "Quick Start Guide" email | ⬜ |
| T+4 | Review cost metrics (per user, per model) | ⬜ |
| T+5 | Check conversion funnel (signup → paid) | ⬜ |
| T+6 | Full rollout (100%) | ⬜ |
| T+7 | Generate post-launch report | ⬜ |
| T+7 | Team retrospective meeting | ⬜ |

---

## 🧪 Quick Test Commands

### Health Checks

```bash
# API health
curl -s $APP_BASE_URL/api/agent/status | jq

# Subscription status
curl -s $APP_BASE_URL/api/subscriptions/status \
  -H "Authorization: Bearer $USER_TOKEN" | jq

# Public status page
curl -s $APP_BASE_URL/api/status/healthz | jq
```

### Create Checkout Session

```bash
# Daily plan
curl -X POST $APP_BASE_URL/api/subscriptions/create-checkout \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"priceId":"'$STRIPE_PRICE_DAILY'"}'

# Monthly plan
curl -X POST $APP_BASE_URL/api/subscriptions/create-checkout \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"priceId":"'$STRIPE_PRICE_MONTHLY'"}'
```

### Open Customer Portal

```bash
curl -X POST $APP_BASE_URL/api/subscriptions/portal \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Check Rate Limit

```bash
# Test 15 requests (should see 429 on 11th for free tier)
for i in {1..15}; do
  curl -w "\n%{http_code}\n" -s $APP_BASE_URL/api/agent/status \
    -H "Authorization: Bearer $USER_TOKEN"
done
```

---

## 🧯 Emergency Playbooks

### 1) Stripe Outage / Widespread Payment Failures

**Symptoms:**
- Spike in `payment_failed` events (>10%)
- Webhook alerts in Slack
- User complaints about payment issues

**Immediate Actions (5 min):**
1. Check Stripe Status: https://status.stripe.com
2. Verify webhook logs:
   ```bash
   firebase functions:log --only subscriptionWebhook --lines 50
   ```
3. Create incident: `/admin/incidents` → "Billing Outage"
4. Post to `#f0-ops` Slack channel

**Mitigation (15 min):**

**If Stripe is down:**
```json
// Disable subscription enforcement temporarily
{
  "subscriptions": {
    "enforced": false  // Allow access without active subscription
  }
}
```

- Enable banner: "Payment processing temporarily delayed. Your access is not affected."
- Queue failed payments in Firestore for retry
- Monitor Stripe status for recovery

**If webhook is failing:**
- Manually process failed webhooks from Stripe Dashboard
- Redeploy webhook function:
  ```bash
  firebase deploy --only functions:subscriptionWebhook
  ```

**If quota exceeded:**
- Increase Cloud Functions quota in GCP Console
- Scale up instances temporarily

**Resolution:**
1. Verify payments processing normally
2. Process queued payments via script
3. Update incident status: "resolved"
4. Post-mortem within 48h

**Prevention:**
- Add webhook retry logic
- Implement circuit breaker pattern
- Monitor Stripe API rate limits
- Set up Stripe status webhook

---

### 2) LLM Provider Outage or Slow Response

**Symptoms:**
- Error rate >5% for agent requests
- p95 latency >2s
- User complaints about slow/failing agents

**Immediate Actions:**
1. Identify affected provider (Claude/OpenAI/etc.)
2. Check provider status pages
3. Review Cloud Logging for provider errors

**Mitigation:**

**Reduce load:**
```json
{
  "ai_eval": {
    "sampleRate": 0.1  // Reduce to 10%
  }
}
```

**Switch provider (if router available):**
```typescript
// In agent orchestration
if (claudeStatus === "degraded") {
  fallbackProvider = "openai";
}
```

**Create incident:**
- Type: `provider-degradation`
- Update public status page
- Send email to affected users (if prolonged >30min)

**Resolution:**
1. Monitor provider recovery
2. Gradually increase sampleRate back to 1.0
3. Document incident and add to SLO tracking

---

### 3) Firestore Hotspot / Write Contention

**Symptoms:**
- Firestore write latency >200ms (p95)
- `RESOURCE_EXHAUSTED` errors in logs
- Slow dashboard loads

**Diagnosis:**
1. Check Firestore metrics in GCP Console
2. Identify hot document (likely `usage_summary` or `ops_metrics`)
3. Review recent write patterns

**Mitigation:**

**Reduce sampling:**
```json
{
  "usage": {
    "tracking": false  // Temporarily disable usage tracking
  }
}
```

**Or batch writes:**
```typescript
// Instead of real-time writes, batch every 5 minutes
const batch = db.batch();
for (const metric of metrics) {
  batch.set(metricRef, metric, { merge: true });
}
await batch.commit();
```

**Long-term fix:**
- Deploy composite index if missing
- Shard hot documents (e.g., `usage_summary/{uid}/daily/{day}-{shard}`)
- Implement write coalescing (debounce)

---

### 4) Rate Limit Misconfiguration

**Symptoms:**
- Spike in 429 errors (>5% of requests)
- User complaints: "I'm on Monthly plan but getting rate limited"

**Immediate Actions:**
1. Check rate limit configuration in feature flags
2. Review recent changes to `rateLimiter.ts`
3. Check `users/{uid}.subscription.plan` matches entitlements

**Mitigation:**

**Disable rate limiting temporarily:**
```json
{
  "rate_limit": {
    "enabled": false
  }
}
```

**Or increase limits:**
```json
{
  "rate_limit": {
    "free_tier": 20,    // From 10
    "daily_tier": 200,  // From 100
    "monthly_tier": 2000 // From 1000
  }
}
```

**Fix:**
1. Identify misconfiguration source
2. Deploy corrected logic
3. Re-enable rate limiting:
   ```json
   { "rate_limit": { "enabled": true } }
   ```

**Post-incident:**
- Add integration test for rate limit logic
- Document expected limits per plan

---

### 5) Webhook Delivery Failures

**Symptoms:**
- Stripe events not updating user subscriptions
- Users report "paid but access not granted"

**Diagnosis:**
```bash
# Check webhook logs
firebase functions:log --only subscriptionWebhook

# Check Stripe Dashboard → Webhooks → Recent deliveries
# Look for failed deliveries (4xx or 5xx responses)
```

**Mitigation:**

**Manual subscription sync:**
```typescript
// Admin tool: Sync user subscription from Stripe
async function syncSubscription(uid: string) {
  const user = await db.collection("users").doc(uid).get();
  const stripeCustomerId = user.data()?.stripeCustomerId;

  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "active",
    limit: 1
  });

  if (subscriptions.data.length > 0) {
    const sub = subscriptions.data[0];
    await db.collection("users").doc(uid).update({
      "subscription.status": sub.status,
      "subscription.plan": sub.items.data[0].price.nickname,
      "subscription.updatedAt": Date.now()
    });
  }
}
```

**Redeploy webhook:**
```bash
firebase deploy --only functions:subscriptionWebhook
```

**Verify webhook URL in Stripe:**
- Should be: `https://yourapp.web.app/api/webhooks/stripe`
- Should have correct signing secret

---

## 📣 Communication Plan

### Pre-Launch (T-2)

**Email to beta users:**
```
Subject: F0 Public Beta Launching Soon! 🎉

Hi {name},

Thank you for being an early F0 user! We're excited to announce that F0 Public Beta launches in 2 days.

What's New:
✅ New subscription plans (Free, Daily $1, Monthly $20)
✅ Improved onboarding experience
✅ Referral program ($10 per friend)
✅ Enhanced monitoring and reliability

Early Adopter Bonus:
🎁 First 100 signups: 50% off Monthly plan (3 months)
🎁 Referral bonus: $10 credit per friend

Get ready: https://yourapp.web.app

Questions? Reply to this email or visit /help.

Best,
The F0 Team
```

**Blog post:**
- Title: "F0 Public Beta: AI-Powered Development for Everyone"
- Content: Use cases, pricing, roadmap, FAQ
- Publish on: Medium, Dev.to, personal blog

---

### Launch Day (T)

**Email blast:**
```
Subject: F0 Public Beta is Live! 🚀

We're thrilled to announce that F0 is now available for public beta!

🚀 Get Started:
1. Sign up: https://yourapp.web.app
2. Complete onboarding (4 easy steps)
3. Start building with AI agents

💰 Pricing:
- Free: 10 requests/day
- Daily: $1/day, 100 requests
- Monthly: $20/month, 1000 requests

🎁 Launch Special:
- First 100 users: 50% off for 3 months
- Referral bonus: $10 credit per friend

📚 Resources:
- Quick Start Guide: /help/first-agent-setup
- Video Demo: [YouTube link]
- Discord Community: [invite link]

Have questions? We're here to help: support@f0.com

Let's build the future together! 🎯

The F0 Team
```

**Social media posts:**

**X/Twitter thread:**
```
🚀 F0 Public Beta is LIVE!

After months of development, we're excited to open F0 to everyone.

What is F0? An AI-powered development assistant that helps you code, debug, and ship faster.

Thread 🧵👇

1/ Key Features:
✅ Multi-agent orchestration
✅ IDE integration (VS Code, Cursor)
✅ Usage analytics
✅ 99.5% uptime SLA

2/ Pricing:
🆓 Free: 10 requests/day
💵 Daily: $1/day, 100 requests
💎 Monthly: $20/month, 1000 requests

3/ Launch Special:
🎁 First 100 users: 50% off for 3 months
🎁 Referrals: $10 credit per friend

Get started: https://yourapp.web.app

4/ What's Next?
📱 Mobile companion (Q3 2025)
🖥️ Desktop client (Q2 2025)
🏢 Enterprise features (Q4 2025)

Join us: https://yourapp.web.app

Questions? Drop them below! 👇
```

**LinkedIn:**
```
Excited to announce F0 Public Beta! 🚀

F0 is an AI-powered development platform that helps teams ship faster and smarter.

After working with 50+ beta users, we're ready to open the doors to everyone.

🎯 Key Benefits:
→ Faster development cycles
→ Reduced debugging time
→ AI-assisted code reviews
→ Real-time collaboration

💡 Perfect for:
→ Indie developers
→ Startups
→ Dev teams
→ AI enthusiasts

Try it free: https://yourapp.web.app

#AI #Development #SaaS #ProductLaunch
```

**Product Hunt:**
- Title: "F0 - AI-Powered Development Assistant"
- Tagline: "Ship faster with AI agents"
- Description: [250 words about features, benefits, use cases]
- Media: Demo video + screenshots
- First Comment: Founder story + roadmap

---

### Post-Launch (T+3)

**Email (to signups who haven't completed onboarding):**
```
Subject: Get started with F0 in 5 minutes ⏱️

Hi {name},

We noticed you signed up for F0 but haven't completed onboarding yet.

Quick start (5 minutes):
1️⃣ Complete your profile
2️⃣ Create your first workspace
3️⃣ Connect your IDE
4️⃣ Run your first agent task

Need help? Watch our 2-minute demo: [video link]

Or check out our step-by-step guide: /help/first-agent-setup

Still have questions? Reply to this email - we read every message!

See you inside,
The F0 Team

P.S. First 100 users get 50% off Monthly plan 🎁
```

**Case study email (T+5):**
```
Subject: How Sarah shipped 10x faster with F0 📈

Hi {name},

Meet Sarah, a solo indie developer who used F0 to launch her SaaS in 2 weeks instead of 2 months.

📊 Results:
- 80% faster development
- 50% fewer bugs
- $0 additional dev costs

Read her story: [blog link]

Want similar results? Here's how:
1. Complete onboarding
2. Try the Quick Start guide
3. Upgrade to Daily/Monthly for more power

Start building: https://yourapp.web.app

Questions? We're here to help!

The F0 Team
```

---

## 📊 Monitoring Dashboards & Metrics

### Growth Dashboard (`/admin/analytics/growth`)

**Key Metrics:**
- **Signups/day:** Track trend (target: 10+ on T, 50+ by T+7)
- **Onboarding completion:** % (target: >60%)
- **Free → Paid conversion:** % (target: >25%)
- **Activation rate:** % of signups who run first agent (target: >70%)

**Visualizations:**
- Line chart: Signups over time
- Funnel: Signup → Onboarding → First use → Upgrade
- Pie chart: Plan distribution (Free/Daily/Monthly)

---

### Reliability Dashboard (`/admin/analytics/reliability`)

**Key Metrics:**
- **Uptime %:** Rolling 24h (target: >99.5%)
- **p95 Latency:** API response time (target: <400ms)
- **Error Rate:** 5xx errors % (target: <0.5%)
- **Webhook Success:** % (target: >99%)

**Visualizations:**
- Line chart: Latency (p50, p95, p99)
- Heatmap: Error rate by endpoint
- Bar chart: Webhook delivery status

---

### Monetization Dashboard (`/admin/analytics/monetization`)

**Key Metrics:**
- **MRR:** Monthly Recurring Revenue
- **ARPU:** Average Revenue Per User
- **Churn (7d):** % of users canceling within 7 days
- **LTV:** Customer Lifetime Value (estimated)

**Visualizations:**
- Line chart: MRR growth
- Table: Top 10 users by revenue
- Funnel: Pricing page → Checkout → Success

---

### Cost Dashboard (`/admin/costs`)

**Key Metrics:**
- **Cost per model:** USD/day for each LLM (Claude, OpenAI)
- **Cost per user:** Average infrastructure cost
- **Gross margin:** (Revenue - Costs) / Revenue %
- **Quota usage:** % of plan limits used

**Visualizations:**
- Stacked bar: Costs by model
- Line chart: Cost trend over time
- Table: Top 10 users by cost

---

## 👩‍💻 On-Call & Operations

### On-Call Schedule (First 72 Hours)

| Shift | Primary | Secondary | Escalation |
|-------|---------|-----------|------------|
| T: 00:00-08:00 | _______ | _______ | _______ |
| T: 08:00-16:00 | _______ | _______ | _______ |
| T: 16:00-24:00 | _______ | _______ | _______ |
| T+1: 00:00-08:00 | _______ | _______ | _______ |
| T+1: 08:00-16:00 | _______ | _______ | _______ |
| T+1: 16:00-24:00 | _______ | _______ | _______ |
| T+2: 00:00-08:00 | _______ | _______ | _______ |
| T+2: 08:00-16:00 | _______ | _______ | _______ |
| T+2: 16:00-24:00 | _______ | _______ | _______ |

**Response Time Targets:**
- **Critical alerts:** ≤10 minutes
- **High alerts:** ≤30 minutes
- **Warning alerts:** ≤2 hours

**Escalation Path:**
1. Primary on-call (10 min)
2. Secondary on-call (20 min)
3. Engineering lead (30 min)
4. CTO/Founder (immediate for critical outages)

### Communication Channels

**Slack:**
- `#f0-ops` - Operations and monitoring
- `#f0-incidents` - Active incident discussion
- `#f0-alerts` - Automated alerts (Slack webhooks)

**Email:**
- `ops@f0.com` - Operations team
- `incidents@f0.com` - Incident notifications

**PagerDuty (Optional):**
- Critical incidents only
- Escalates if no response in 10 min

### Incident Documentation

**For every incident:**
1. Create document: `incidents/YYYYMMDD-{incident-name}.md`
2. Real-time updates in `#f0-incidents`
3. Post-mortem within 48h

**Template:** See `runbooks/INCIDENT_TEMPLATE.md`

---

## 🗃 Appendices

### Related Documentation

**Core Guides:**
- [F0_ACTIVATION.md](F0_ACTIVATION.md) - F0 Production Mode activation
- [SPRINT_20_PLAN.md](SPRINT_20_PLAN.md) - Feature Flags & App Config
- [GO_LIVE_SPRINT_19.md](GO_LIVE_SPRINT_19.md) - Sprint 19 deployment
- [SPRINT_21_PLAN.md](SPRINT_21_PLAN.md) - Go-to-Market & Growth
- [SPRINT_22_PLAN.md](SPRINT_22_PLAN.md) - Reliability & Ops

**Runbooks:**
- `runbooks/billing-outage.md`
- `runbooks/provider-degradation.md`
- `runbooks/firestore-hotspot.md`
- `runbooks/auth-issues.md`
- `runbooks/ddos-attack.md`
- `runbooks/data-corruption.md`

**Internal App Links:**
- `/status` - Public status page
- `/help` - Help center (MDX guides)
- `/billing` - User billing and plans
- `/admin/agents/monitor` - Agent monitoring dashboard
- `/admin/analytics/usage` - Usage and cost analytics
- `/admin/analytics/growth` - Growth metrics
- `/admin/analytics/reliability` - Reliability metrics
- `/admin/analytics/monetization` - Revenue metrics
- `/admin/costs` - Cost breakdown
- `/admin/incidents` - Incident management
- `/admin/config/feature-flags` - Feature flags control panel

---

## ✅ Final Checklist

**Before going live, ensure:**

- [ ] All T-3 tasks complete
- [ ] All T-2 tasks complete
- [ ] All T-1 tasks complete
- [ ] All Pre-Flight checklist items checked
- [ ] On-call rotation confirmed
- [ ] Communication plan ready
- [ ] Rollback plan documented
- [ ] Team briefed on launch procedure

**On launch day (T):**

- [ ] Deploy hosting
- [ ] Run 30-minute smoke tests
- [ ] Send launch announcement
- [ ] Monitor for first 4 hours continuously

**Post-launch:**

- [ ] Daily metrics review (T+1 to T+7)
- [ ] Expand canary (T+3)
- [ ] Full rollout (T+6)
- [ ] Generate post-launch report (T+7)
- [ ] Team retrospective (T+7)

---

**Plan Status:** ✅ Ready for Execution
**Next Action:** Begin T-3 checklist
**Launch Date:** _____________________

---

## 🎯 Launch Day Cheat-Sheet (30 Minutes)

> **Quick copy/paste commands for Day-T smoke testing. Run in terminal immediately after deployment.**

### Environment Setup

```bash
# Set environment variables
export FIREBASE_PROJECT=f0-prod
export APP_BASE_URL="https://yourapp.web.app"
export PLAN_DAILY="price_xxx"  # Your Stripe Daily price ID
export PLAN_MONTHLY="price_yyy"  # Your Stripe Monthly price ID
```

---

### 1) Service Health Checks

```bash
# Agent status (should return JSON with agents/updatedAt)
curl -s $APP_BASE_URL/api/agent/status | jq

# Subscription status
curl -s $APP_BASE_URL/api/subscriptions/status | jq

# Public status page
curl -s $APP_BASE_URL/api/status/healthz | jq

# Expected: All return 200 OK with valid JSON
```

**✅ Pass Criteria:**
- All endpoints return 200
- JSON is well-formed
- No error messages

---

### 2) Onboarding & Paywall

```bash
# Open signup page in browser
open "$APP_BASE_URL/auth/signup"

# Manual steps:
# 1. Sign up new user
# 2. Verify redirect to /onboarding
# 3. Complete onboarding
# 4. Try accessing premium feature
# 5. Verify redirect to /pricing
```

**✅ Pass Criteria:**
- Onboarding wizard appears automatically
- Workspace created after completion
- Paywall blocks Free users from premium features

---

### 3) Checkout Flow (Daily Plan)

```bash
# Create checkout session
curl -s -X POST "$APP_BASE_URL/api/subscriptions/create-checkout" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"priceId":"'$PLAN_DAILY'"}' | jq

# Expected output:
# {
#   "url": "https://checkout.stripe.com/c/pay/cs_test_..."
# }

# Open URL in browser and complete test payment
```

**✅ Pass Criteria:**
- Returns valid Stripe checkout URL
- Payment completes successfully
- User subscription status updates to "active"
- Rate limit increases to 100/day

---

### 4) Customer Portal

```bash
# Open customer portal
curl -s -X POST "$APP_BASE_URL/api/subscriptions/portal" \
  -H 'Authorization: Bearer YOUR_TOKEN' | jq

# Expected output:
# {
#   "url": "https://billing.stripe.com/p/session/..."
# }
```

**✅ Pass Criteria:**
- Returns valid portal URL
- Portal opens and shows subscription
- Can cancel/update payment method

---

### 5) Rate Limit Enforcement

```bash
# Test Free tier (10 req/min limit)
# Make 12 requests in 60 seconds - should get 429 after 10th
for i in {1..12}; do
  curl -s -w "\nRequest $i: %{http_code}\n" \
    "$APP_BASE_URL/api/agent/status" \
    -H "Authorization: Bearer YOUR_FREE_USER_TOKEN" > /dev/null
  echo "---"
done

# Expected: Requests 1-10 return 200, requests 11-12 return 429
```

**✅ Pass Criteria:**
- First 10 requests succeed (200)
- 11th and 12th requests fail with 429
- Error message mentions rate limit

---

### 6) Usage Tracking

```bash
# Check usage summary for today
curl -s "$APP_BASE_URL/api/usage/summary" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq

# Expected output:
# {
#   "today": {
#     "calls": 5,
#     "tokens": 12450,
#     "cost": 0.037,
#     "timestamp": 1738195200000
#   },
#   "totals": {
#     "lifetimeCalls": 127,
#     "lifetimeTokens": 315600,
#     "lifetimeCost": 0.95
#   }
# }
```

**✅ Pass Criteria:**
- Returns valid usage data
- Today's calls increment after each request
- Cost calculation looks reasonable

---

### 7) Agent Monitoring Dashboard

```bash
# Open admin dashboard in browser
open "$APP_BASE_URL/admin/agents/monitor"

# Verify:
# - Shows active agents
# - Displays metrics (uptime, jobs, error rate)
# - Real-time updates working
```

**✅ Pass Criteria:**
- Dashboard loads <2 seconds
- Shows agent metrics
- No errors in console

---

### 8) Email Delivery Test

```bash
# Trigger welcome email by creating new account
# Or trigger invoice email by completing payment

# Check email inbox for:
# 1. Welcome email (for new signup)
# 2. Subscription activated email (after payment)
# 3. Invoice paid email (with PDF link)

# Verify in SendGrid/Mailgun dashboard:
firebase functions:log --only txEmail --lines 20
```

**✅ Pass Criteria:**
- Emails deliver within 2 minutes
- All links work
- PDF invoice downloads successfully

---

## 🚦 Go / No-Go Decision (5 Critical Checks)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | ✅ Checkout returns valid Stripe URL | ⬜ | |
| 2 | ✅ Portal opens subscription management | ⬜ | |
| 3 | ✅ Paywall blocks Free users from premium features | ⬜ | |
| 4 | ✅ Rate limit enforces 429 after 10 requests (Free) | ⬜ | |
| 5 | ✅ Usage tracking writes to usage_summary | ⬜ | |

**Decision:**
- **All 5 passed:** ✅ GO - Proceed with launch
- **1-2 failed:** ⚠️ CAUTION - Fix and re-test
- **3+ failed:** ❌ NO-GO - Investigate and delay launch

---

## 🧯 Kill-Switch Quick Toggles

> **Emergency feature flag changes via `/admin/config/feature-flags` UI or direct Firestore edit**

### Issue: Widespread Payment Failures

**Symptom:** Spike in `payment_failed` events, users can't upgrade

**Action:**
```json
{
  "subscriptions": {
    "enforced": false  // Temporarily disable subscription requirement
  }
}
```

**Effect:** All users get access regardless of subscription status
**Rollback:** Set back to `true` after Stripe recovers

---

### Issue: Rate Limit Complaints / 429 Errors

**Symptom:** Users reporting "Too many requests" errors, conversion dropping

**Action:**
```json
{
  "rate_limit": {
    "enabled": false  // Temporarily disable rate limiting
  }
}
```

**Or increase limits:**
```json
{
  "rate_limit": {
    "free_tier": 20,    // Double from 10
    "daily_tier": 200,  // Double from 100
    "monthly_tier": 2000  // Double from 1000
  }
}
```

**Effect:** Remove rate limiting temporarily or increase capacity
**Rollback:** Re-enable after fixing limit logic

---

### Issue: MFA Breaking Logins

**Symptom:** Users locked out, can't complete MFA setup

**Action:**
```json
{
  "mfa": {
    "enforced": false,  // Disable MFA requirement
    "admin_required": true  // Keep for admins only
  }
}
```

**Effect:** MFA becomes optional for regular users
**Rollback:** Re-enable after fixing MFA flow

---

### Issue: LLM Provider Degradation

**Symptom:** High error rate (>5%), slow responses from Claude/OpenAI

**Action:**
```json
{
  "ai_eval": {
    "sampleRate": 0.1  // Reduce load to 10%
  }
}
```

**Or switch provider in code:**
```typescript
// In agent router
if (claudeStatus === "degraded") {
  defaultProvider = "openai";  // Fallback
}
```

**Effect:** Reduce load on degraded provider
**Rollback:** Increase sampleRate gradually as provider recovers

---

### Issue: High Telemetry Write Volume

**Symptom:** Firestore write quota warnings, slow dashboard

**Action:**
```json
{
  "usage": {
    "tracking": false,  // Disable real-time tracking
    "analytics": false  // Disable analytics writes
  }
}
```

**Or reduce sampling:**
```typescript
// In metrics.ts
const SAMPLE_RATE = 0.1;  // Only track 10% of events
```

**Effect:** Reduce Firestore write pressure
**Rollback:** Re-enable with batching implemented

---

### Issue: Workspace Auto-Creation Failures

**Symptom:** New signups not getting workspaces, errors in logs

**Action:**
```json
{
  "workspace": {
    "auto_create": false  // Disable auto-creation
  }
}
```

**Communicate:**
- Add banner: "Workspace creation temporarily manual. Contact support."
- Manually create workspaces for affected users

**Effect:** Prevent signup failures
**Rollback:** Fix trigger function, re-enable

---

## 📱 Quick Access Links

**Admin Dashboards:**
- Feature Flags: `$APP_BASE_URL/admin/config/feature-flags`
- Agent Monitor: `$APP_BASE_URL/admin/agents/monitor`
- Usage Analytics: `$APP_BASE_URL/admin/analytics/usage`
- Incidents: `$APP_BASE_URL/admin/incidents`

**Monitoring:**
- Firebase Console: https://console.firebase.google.com/project/$FIREBASE_PROJECT
- Stripe Dashboard: https://dashboard.stripe.com
- Cloud Logging: https://console.cloud.google.com/logs

**Communication:**
- Slack: `#f0-ops` and `#f0-incidents`
- Status Page: `$APP_BASE_URL/status`

---

## 🎯 30-Minute Smoke Test Summary

```bash
# Run this complete sequence
export FIREBASE_PROJECT=f0-prod
export APP_BASE_URL="https://yourapp.web.app"

echo "1/8 Health checks..."
curl -s $APP_BASE_URL/api/agent/status | jq > /dev/null && echo "✅" || echo "❌"

echo "2/8 Onboarding (manual)..."
echo "Visit: $APP_BASE_URL/auth/signup"

echo "3/8 Checkout flow..."
curl -s -X POST "$APP_BASE_URL/api/subscriptions/create-checkout" \
  -H 'Content-Type: application/json' -d '{"priceId":"'$PLAN_DAILY'"}' | jq

echo "4/8 Portal access..."
curl -s -X POST "$APP_BASE_URL/api/subscriptions/portal" | jq

echo "5/8 Rate limit test..."
for i in {1..12}; do curl -s "$APP_BASE_URL/api/agent/status" > /dev/null; done

echo "6/8 Usage tracking..."
curl -s "$APP_BASE_URL/api/usage/summary" | jq

echo "7/8 Agent dashboard (manual)..."
echo "Visit: $APP_BASE_URL/admin/agents/monitor"

echo "8/8 Email delivery (manual)..."
echo "Check inbox for welcome/invoice emails"

echo ""
echo "✅ Smoke tests complete! Review results and make Go/No-Go decision."
```

---

**Cheat-Sheet Version:** 1.0
**Print This Section:** For quick reference during launch

🚀 **Let's Ship F0!**
