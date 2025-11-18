# 🧭 F0 SPRINT 20 PLAN — SaaS Launch & Operations Layer

**Version:** v21.0.0
**Goal:** Transform F0 into a production SaaS with subscriptions, intelligent monitoring, and secure operations environment.

---

## 📦 New Files Overview (10 Core Files)

### 1. Subscription System

| File | Purpose |
|------|---------|
| `src/app/api/subscriptions/route.ts` | REST API for subscription management (create/cancel/status) |
| `functions/src/billing/subscriptionWebhook.ts` | Stripe webhook handler (updated/payment_failed/canceled) |
| `src/app/(protected)/billing/page.tsx` | User billing dashboard - manage plans and payment |
| `src/app/(admin)/billing/subscriptions/page.tsx` | Admin dashboard for plans and customers |

#### 🧾 Stripe Setup Commands
```bash
# Create product
stripe products create \
  --name "F0 Agent Access" \
  --type=service \
  --description="AI-powered development assistant"

# Create pricing plans
stripe prices create \
  --product prod_F0_AGENT_ACCESS \
  --unit-amount 100 \
  --currency usd \
  --recurring interval=day \
  --nickname "Daily Plan"

stripe prices create \
  --product prod_F0_AGENT_ACCESS \
  --unit-amount 2000 \
  --currency usd \
  --recurring interval=month \
  --nickname "Monthly Plan"
```

#### ✅ Required Webhook Events
- `customer.subscription.created`
- `customer.subscription.updated`
- `invoice.payment_failed`
- `customer.subscription.deleted`

---

### 2. Agent Orchestration Monitoring

| File | Purpose |
|------|---------|
| `src/app/api/agent/status/route.ts` | API to expose active agent status |
| `src/app/(admin)/agents/monitor/page.tsx` | Live dashboard with real-time metrics |

#### 🧠 Metrics Displayed
- **Agent ID** - Unique identifier
- **Model** - Claude version (sonnet-4-5, etc.)
- **Uptime** - Duration since start
- **Active Jobs** - Current running tasks
- **Avg Task Duration** - Performance metric
- **Error Rate** - Failure percentage
- **Usage Cost** - Cumulative spend

---

### 3. Workspace Provisioning

| File | Purpose |
|------|---------|
| `src/app/api/workspaces/route.ts` | Auto-create workspace on signup |
| `src/app/(protected)/workspace/page.tsx` | User workspace UI - projects and settings |

#### 📁 Firestore Structure
```
users/{uid}/workspace/
  └── projects/{projectId}
      ├── name
      ├── createdAt
      ├── lastAccessed
      └── files/
  └── settings/
      ├── defaultModel
      ├── theme
      └── preferences
```

---

### 4. Security & Compliance

| File | Purpose |
|------|---------|
| `src/app/api/security/mfa/route.ts` | MFA management for users |
| `src/app/api/security/rate-limit/route.ts` | Request throttling based on plan |
| `src/lib/security/rateLimiter.ts` | Node.js rate limiting module |
| `firestore.rules` | Updated with workspaces & usage_summary rules |

#### ✅ New Feature Flags
```javascript
{
  "subscriptions.enforced": true,
  "subscriptions.require_active": true,
  "mfa.enforced": true,
  "workspace.auto_create": true,
  "rate_limit.enabled": true
}
```

---

### 5. Analytics & Usage Tracking

| File | Purpose |
|------|---------|
| `src/app/api/usage/summary/route.ts` | Aggregate user consumption (calls/tokens/time) |
| `src/app/(admin)/analytics/usage/page.tsx` | Real-time usage analytics dashboard |

#### 📊 Firestore Collections
```
usage_summary/{uid}/
  └── daily/{dayId}
      ├── calls
      ├── tokens
      ├── duration
      ├── cost
      └── timestamp
  └── totals/
      ├── lifetimeCalls
      ├── lifetimeTokens
      ├── lifetimeCost
      └── updatedAt
```

---

## ⚙️ Feature Flags Configuration

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
  }
}
```

---

## 🧪 Pre-Flight Checklist

| # | Item | Status |
|---|------|--------|
| 1 | Stripe enabled in Live Mode | ⬜ |
| 2 | Webhook endpoint deployed and secured | ⬜ |
| 3 | MFA tested on Admin account | ⬜ |
| 4 | Auto workspace creation works after signup | ⬜ |
| 5 | Firestore rules updated | ⬜ |
| 6 | `usage_summary` writes correctly | ⬜ |
| 7 | Rate limits tiered by plan | ⬜ |
| 8 | Agent monitoring dashboard accessible | ⬜ |
| 9 | Subscription webhook handles all events | ⬜ |
| 10 | Kill-switches tested (disable subscriptions) | ⬜ |

---

## 🚀 Deployment Steps

### Phase 1: Backend Functions
```bash
# Deploy subscription webhook
cd functions
npm install
firebase deploy --only functions:subscriptionWebhook

# Verify webhook registered
firebase functions:log --only subscriptionWebhook
```

### Phase 2: Firestore Rules
```bash
# Deploy updated rules
firebase deploy --only firestore:rules

# Verify in Console
firebase firestore:get usage_summary/test-uid
```

### Phase 3: Frontend & APIs
```bash
# Build and deploy hosting
npm run build
firebase deploy --only hosting

# Test APIs
curl -X GET https://yourapp.web.app/api/agent/status
curl -X GET https://yourapp.web.app/api/usage/summary
```

### Phase 4: Stripe Configuration
```bash
# Create webhook endpoint in Stripe Dashboard
# URL: https://yourapp.web.app/api/webhooks/stripe
# Events: customer.subscription.*, invoice.payment_failed

# Test webhook
stripe trigger customer.subscription.created
```

---

## 🧯 Emergency Controls (Kill Switches)

| Issue | Action |
|-------|--------|
| Stripe payment failures | `subscriptions.enforced = false` |
| Server overload | `rate_limit.enabled = false` |
| MFA issues | `mfa.enforced = false` |
| Workspace provisioning errors | `workspace.auto_create = false` |
| Usage tracking bugs | `usage.tracking = false` |

**Access:** `/admin/config/feature-flags`

---

## 📊 Subscription Plans

### Free Tier
- **Price:** $0/month
- **Rate Limit:** 10 requests/day
- **Features:** Basic agent access, 1 workspace
- **Storage:** 100MB

### Daily Plan
- **Price:** $1/day
- **Rate Limit:** 100 requests/day
- **Features:** Full agent access, 5 workspaces
- **Storage:** 1GB

### Monthly Plan
- **Price:** $20/month
- **Rate Limit:** 1000 requests/day
- **Features:** Unlimited agent access, unlimited workspaces
- **Storage:** 10GB
- **Priority Support:** Email + Slack

---

## 📘 Documentation Files to Create

1. **F0_SAAS_GUIDE.md** - Running F0 as SaaS platform
2. **AGENT_MONITORING.md** - AI runner monitoring guide
3. **LICENSE_MODEL.md** - Subscription system details
4. **F0_DASHBOARDS.md** - Admin and user dashboards

---

## 🗓️ Implementation Timeline

| Week | Task | Deliverables |
|------|------|--------------|
| 1 | Build subscription system & webhook | ✅ Live Stripe integration |
| 2 | Provisioning & workspaces | ✅ Auto workspace creation |
| 3 | Monitoring dashboards | ✅ Live agent stats |
| 4 | Security + MFA + rate limiting | ✅ Enforced security |
| 5 | Comprehensive testing (beta users) | ✅ Ready for rollout |
| 6 | Public SaaS Beta launch | 🚀 |

---

## 📐 Technical Architecture

### Subscription Flow
```
User Signup
  ↓
Auto-create Workspace (Function trigger)
  ↓
Prompt for Subscription Plan
  ↓
Stripe Checkout Session
  ↓
Payment Success
  ↓
Webhook → Update users/{uid}.subscription
  ↓
Enable Agent Access
```

### Rate Limiting Flow
```
API Request
  ↓
Check Feature Flag (rate_limit.enabled)
  ↓
Verify User Subscription Plan
  ↓
Check Daily Usage (usage_summary/{uid}/daily/{today})
  ↓
Allow/Deny based on limit
  ↓
Increment usage counter
```

### Agent Monitoring Flow
```
Agent Starts
  ↓
Write to agents/{agentId}/status (startedAt, model)
  ↓
Periodic Heartbeat (every 30s)
  ↓
Task Complete
  ↓
Write to agents/{agentId}/jobs/{jobId} (duration, cost)
  ↓
Aggregate to usage_summary/{uid}
```

---

## 🔐 Security Considerations

### MFA Enforcement
- **Admin accounts:** Required immediately
- **User accounts:** Grace period of 7 days
- **Backup codes:** Auto-generated on first MFA setup

### Rate Limiting Strategy
- **In-memory cache:** 60-second window
- **Firestore fallback:** If cache miss
- **Grace period:** First 3 violations = warning

### Workspace Isolation
- **Firestore rules:** User can only read/write own workspace
- **Storage rules:** Files scoped to `workspaces/{uid}/*`
- **No shared workspaces:** (Future: team features)

---

## 📈 Success Metrics

### Week 1 Post-Launch
- [ ] Subscription webhook success rate > 99%
- [ ] Auto workspace creation 100% success
- [ ] Agent monitoring dashboard < 2s load time
- [ ] Rate limiting accurate (no false denials)
- [ ] MFA enrollment > 50% of active users

### Month 1 Post-Launch
- [ ] Monthly plan conversion > 10%
- [ ] Average revenue per user (ARPU) > $15
- [ ] Churn rate < 5%
- [ ] Support tickets < 2% of active users
- [ ] Uptime > 99.9%

---

## 🧪 Smoke Tests (Sprint 20)

### Test 1: Subscription Creation
1. Visit `/billing`
2. Click "Subscribe to Monthly Plan"
3. Complete Stripe Checkout
4. Verify `users/{uid}.subscription.status = "active"`
5. Verify rate limit increased to 1000/day

### Test 2: Workspace Auto-Creation
1. Create new user account
2. Wait for Cloud Functions trigger
3. Check `users/{uid}/workspace/settings` exists
4. Verify default project created

### Test 3: Agent Monitoring
1. Start an agent task
2. Visit `/admin/agents/monitor`
3. Verify agent appears in active list
4. Check metrics updating in real-time
5. Complete task, verify agent removed from active list

### Test 4: Rate Limiting
1. Make 11 requests with Free Tier account
2. Verify 11th request returns 429 (Too Many Requests)
3. Upgrade to Daily Plan
4. Verify limit increased to 100/day

### Test 5: MFA Enforcement
1. Enable `mfa.enforced = true`
2. Login with non-MFA account
3. Verify prompted to setup MFA
4. Complete setup
5. Verify backup codes generated

### Test 6: Usage Analytics
1. Make 10 agent requests
2. Visit `/admin/analytics/usage`
3. Verify user appears with 10 calls
4. Check cost calculation accurate
5. Verify daily aggregation working

### Test 7: Subscription Cancellation
1. Visit `/billing`
2. Click "Cancel Subscription"
3. Verify Stripe webhook fired
4. Check `users/{uid}.subscription.status = "canceled"`
5. Verify rate limit reverted to free tier

### Test 8: Payment Failure Handling
1. Trigger `invoice.payment_failed` event in Stripe
2. Verify webhook updates user status
3. Check email notification sent
4. Verify grace period applied (3 days)
5. After grace period, verify access revoked

---

## 🟢 Status Goal

**Target State:**
- ✅ Ready for F0 SaaS Public Beta
- **Mode:** `"SaaS"`
- **Canary:** `subscription_required = true`
- **Monitoring:** `agent.status.live = true`

**Go-Live Criteria:**
- All 8 smoke tests passing
- Stripe webhook tested in production
- MFA enforced for admins
- Rate limiting accurate
- Agent monitoring dashboard live
- Documentation complete

---

## 📞 Support & Escalation

### Subscription Issues
- **Stripe Dashboard:** Check payment status
- **Webhook Logs:** `firebase functions:log --only subscriptionWebhook`
- **Kill-Switch:** `subscriptions.enforced = false`

### Agent Monitoring Issues
- **Check Firestore:** `agents/{agentId}/status`
- **Cloud Logging:** Filter by `agent.status`
- **Restart:** Delete stale agent documents

### Rate Limiting Issues
- **Check Usage:** `usage_summary/{uid}/daily/{today}`
- **Override:** Set `users/{uid}.rateLimitOverride = 9999`
- **Disable:** `rate_limit.enabled = false`

---

**Sprint Owner:** _____________________
**Start Date:** _____________________
**Target Completion:** 6 weeks
**Dependencies:** Sprint 19 (Taxes & Multi-Currency), v20.0.0 (Feature Flags)

🚀 **Sprint 20 - Ready to Execute**
