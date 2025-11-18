# 🚀 Sprint 21 — Go-to-Market & Growth

**Version:** v22.0.0
**Goal:** Transform F0 into a growth-ready SaaS: Smooth onboarding, clear paywall, transactional emails, simple referrals, and UI that facilitates discovery and usage.

---

## 📦 New Files (12 Files)

### 1) Onboarding & Paywall

| File | Purpose |
|------|---------|
| `src/app/(public)/pricing/page.tsx` | Pricing page (Free/Daily/Monthly plans) |
| `src/app/(protected)/onboarding/page.tsx` | 4-step wizard (Profile → Workspace → Tools → Finish) |
| `src/middleware/entitlements.ts` | Block access if plan doesn't allow (gate + redirect to pricing) |
| `src/lib/entitlements.ts` | Helper functions `checkEntitlement(plan, feature)` |

**Onboarding Flow:**
```
Step 1: Profile
  - Display name
  - Avatar upload (optional)
  - Bio (optional)

Step 2: Workspace
  - Workspace name
  - Default project creation
  - Invite teammates (future)

Step 3: Tools
  - Select primary use case (Code/Docs/Design/Other)
  - Preferred AI model
  - IDE integration preference (VS Code/Cursor/JetBrains)

Step 4: Finish
  - Quick tour start
  - Sample project creation
  - CTA: Start free trial or upgrade
```

---

### 2) Referrals (MVP)

| File | Purpose |
|------|---------|
| `src/app/api/referrals/route.ts` | Create/use referral codes |
| `src/app/(protected)/referrals/page.tsx` | "Invite & Earn" page |

#### 📁 Firestore Structure
```
referrals/{code}
  ├── ownerUid
  ├── createdAt
  ├── uses (current count)
  ├── maxUses (limit, e.g., 100)
  ├── rewardType ("credits" | "discount")
  └── rewardAmount

referral_credits/{uid}
  ├── balance (in USD cents)
  ├── updatedAt
  └── history[] (array of transactions)
      ├── amount
      ├── type ("earned" | "spent")
      ├── referralCode
      └── timestamp
```

**Referral Rewards:**
- **Referrer:** $5 credit per successful signup
- **Referee:** 20% discount on first month
- **Max Uses:** 100 per referral code

---

### 3) Emails & Notifications

| File | Purpose |
|------|---------|
| `functions/src/email/txEmail.ts` | Transactional email Cloud Function |
| `src/lib/notifs/dispatcher.ts` | Multi-channel dispatcher (Email, In-App, Slack) |
| `src/app/(protected)/notifications/page.tsx` | Notification center + preferences |

#### 📧 Transactional Email Templates

**1. Welcome Email**
```
Subject: Welcome to F0! 🚀
Body:
  - Getting started guide
  - Link to first agent setup
  - Referral code
  - Support links
```

**2. Subscription Activated**
```
Subject: Your F0 subscription is active ✅
Body:
  - Plan details
  - Billing cycle
  - Rate limits increased
  - Next invoice date
```

**3. Subscription Failed**
```
Subject: Payment issue with your F0 subscription ⚠️
Body:
  - Payment error details
  - Update payment method link
  - Grace period notice (3 days)
  - Support contact
```

**4. Invoice Paid**
```
Subject: Receipt for your F0 subscription 🧾
Body:
  - Invoice number
  - Amount paid
  - Billing period
  - Download PDF link
```

**5. Passwordless Sign-in (Magic Link) - Optional**
```
Subject: Your F0 sign-in link 🔐
Body:
  - Magic link (expires in 15 min)
  - Security notice
  - IP address shown
```

#### 📬 Notification Types (In-App)
- `subscription_activated`
- `subscription_failed`
- `payment_received`
- `referral_earned`
- `workspace_created`
- `agent_completed`
- `usage_warning` (approaching limit)

---

### 4) Help & Guides

| File | Purpose |
|------|---------|
| `src/app/help/(docs)/[slug]/page.mdx` | MDX-based help center |
| `src/app/(protected)/tours/page.tsx` | Interactive tour with overlay pointers |

#### 📚 Sample Guide Templates

**`content/guides/first-agent-setup.mdx`**
```markdown
# Setting Up Your First Agent

Learn how to create and configure your first F0 AI agent in 5 minutes.

## Prerequisites
- F0 account (Free or paid)
- VS Code or Cursor installed

## Step 1: Create Workspace
...

## Step 2: Configure Agent
...

## Step 3: Run First Task
...
```

**`content/guides/cursor-integration.mdx`**
```markdown
# Cursor Integration Guide

Connect F0 with Cursor for seamless AI-powered development.

## Installation
1. Install F0 Cursor extension
2. Authenticate with your F0 account
3. Select your workspace

## Configuration
...
```

**Interactive Tour Features:**
- Welcome tooltip on dashboard
- Highlight agent creation button
- Show workspace switcher
- Point to billing/upgrade
- Explain notification bell
- Show help icon

---

## 🧩 Feature Flags

```json
{
  "paywall": {
    "enabled": true,
    "redirect_to": "/pricing"
  },
  "referrals": {
    "enabled": true,
    "reward_per_signup": 500,
    "max_uses_per_code": 100
  },
  "emails": {
    "tx": {
      "enabled": true,
      "provider": "sendgrid"
    }
  },
  "tours": {
    "enabled": true,
    "show_on_first_login": true
  },
  "onboarding": {
    "required": true,
    "skip_for_existing": true
  }
}
```

---

## 🔐 Firestore Structure Updates

### New Collections

**`users/{uid}/entitlements/{feature}`**
```javascript
{
  allowed: boolean,
  plan: "free" | "daily" | "monthly",
  updatedAt: timestamp
}
```

**`notifications/{uid}/inbox/{notifId}`**
```javascript
{
  type: "subscription_activated" | "payment_received" | ...,
  title: string,
  body: string,
  seen: boolean,
  createdAt: timestamp,
  link?: string,
  metadata?: object
}
```

**`referral_credits/{uid}`**
```javascript
{
  balance: number, // in cents
  updatedAt: timestamp,
  history: [
    {
      amount: number,
      type: "earned" | "spent",
      referralCode: string,
      timestamp: number,
      description: string
    }
  ]
}
```

---

## ✅ Pre-Flight Checklist

| # | Item | Status |
|---|------|--------|
| 1 | Stripe price IDs in `.env` | ⬜ |
| 2 | SMTP or email provider (SendGrid/Mailgun) enabled | ⬜ |
| 3 | `paywall.enabled = true` | ⬜ |
| 4 | Entitlements configured for each plan | ⬜ |
| 5 | Onboarding flow works for new account | ⬜ |
| 6 | Auto-workspace creation confirmed | ⬜ |
| 7 | Referral code creation/usage tested | ⬜ |
| 8 | Credit balance updates correctly | ⬜ |
| 9 | Transactional emails sending (test mode) | ⬜ |
| 10 | MDX guides rendering correctly | ⬜ |

---

## 🚀 Deployment Steps

### Step 1: Deploy Functions
```bash
cd functions
npm install

# Deploy transactional email function
firebase deploy --only functions:txEmail

# Verify logs
firebase functions:log --only txEmail
```

### Step 2: Deploy Firestore Rules
```bash
# Deploy updated rules (entitlements/referrals/notifications)
firebase deploy --only firestore:rules

# Verify in Console
firebase firestore:get notifications/test-uid
```

### Step 3: Deploy Hosting
```bash
# Build and deploy
npm run build
firebase deploy --only hosting

# Test routes
curl https://yourapp.web.app/pricing
curl https://yourapp.web.app/help/first-agent-setup
```

### Step 4: Configure Email Provider
```bash
# Set SendGrid API key
firebase functions:config:set sendgrid.api_key="YOUR_API_KEY"
firebase functions:config:set sendgrid.from_email="noreply@f0.com"

# Or Mailgun
firebase functions:config:set mailgun.api_key="YOUR_API_KEY"
firebase functions:config:set mailgun.domain="mg.f0.com"

# Redeploy functions
firebase deploy --only functions:txEmail
```

---

## 🔥 Smoke Tests (8 Tests)

### Test 1: New User Onboarding
1. Create new account
2. Verify automatic redirect to `/onboarding`
3. Complete all 4 steps
4. Verify workspace created
5. Verify entitlements set to "free"

### Test 2: Paywall Enforcement
1. Login with Free tier account
2. Try accessing premium feature (e.g., unlimited workspaces)
3. Verify redirect to `/pricing`
4. Verify banner: "Upgrade to unlock this feature"

### Test 3: Plan Upgrade
1. Select Daily/Monthly plan on `/pricing`
2. Complete Stripe Checkout
3. Verify webhook fired
4. Verify `users/{uid}.subscription.status = "active"`
5. Verify entitlements updated
6. Verify premium features unlocked immediately

### Test 4: Payment Failure
1. Trigger `invoice.payment_failed` in Stripe test mode
2. Verify email sent: "payment_failed"
3. Verify notification appears in-app
4. Wait for grace period (3 days in test = 3 minutes)
5. Verify downgrade to Free tier
6. Verify entitlements revoked

### Test 5: Referral Flow
1. Login and visit `/referrals`
2. Generate referral code (e.g., `F0-ALICE-XYZ`)
3. Copy link
4. Open incognito, signup with referral link
5. Verify new user gets 20% discount
6. Verify referrer gets $5 credit added to `referral_credits/{uid}.balance`

### Test 6: In-App Notifications
1. Trigger event (e.g., upgrade subscription)
2. Visit `/notifications`
3. Verify notification appears
4. Click notification
5. Verify marked as `seen = true`
6. Verify count badge decrements

### Test 7: Transactional Emails
1. Complete signup → Verify "Welcome" email received
2. Upgrade subscription → Verify "Subscription Activated" email
3. Complete payment → Verify "Invoice Paid" email with PDF link
4. Cancel subscription → Verify "Subscription Canceled" email

### Test 8: MDX Guides
1. Visit `/help/first-agent-setup`
2. Verify MDX content renders
3. Verify code blocks have syntax highlighting
4. Verify table of contents works
5. Check search functionality (if implemented)
6. Verify navigation between guides

---

## 🎯 Success Metrics

### Week 1 Post-Launch

| Metric | Target |
|--------|--------|
| Onboarding completion rate | ≥ 60% |
| Free → Paid conversion | ≥ 25% |
| Email delivery success | ≥ 98% |
| Payment activation failure | ≤ 2% |
| Users reading ≥1 guide | ≥ 70% |
| Referral code usage | ≥ 10% of signups |
| Notification open rate | ≥ 50% |
| Tour completion rate | ≥ 40% |

### Month 1 Post-Launch

| Metric | Target |
|--------|--------|
| Monthly Recurring Revenue (MRR) | $5,000+ |
| Average Revenue Per User (ARPU) | $18+ |
| Churn rate | < 5% |
| Referral-driven signups | ≥ 15% |
| Support tickets per active user | < 3% |
| Help article views | ≥ 2 per user |

---

## 📐 Technical Architecture

### Entitlement Check Flow
```
User Request
  ↓
Check Feature Flag (paywall.enabled)
  ↓
Get User Subscription Plan
  ↓
Query Firestore: users/{uid}/entitlements/{feature}
  ↓
If allowed = false → Redirect to /pricing
  ↓
If allowed = true → Continue
```

### Referral Flow
```
User A generates code "F0-ALICE-XYZ"
  ↓
User B signs up with referral link
  ↓
Cloud Function: onUserCreate trigger
  ↓
Verify referral code valid (uses < maxUses)
  ↓
Apply 20% discount to User B's first subscription
  ↓
Add $5 credit to User A's referral_credits/{uid}
  ↓
Increment referrals/{code}.uses
  ↓
Send notifications to both users
```

### Email Dispatch Flow
```
Event Triggered (e.g., subscription activated)
  ↓
Cloud Function: txEmail
  ↓
Check Feature Flag (emails.tx.enabled)
  ↓
Load Email Template (Handlebars/EJS)
  ↓
Populate Variables (user.name, plan.name, etc.)
  ↓
Send via Provider (SendGrid/Mailgun)
  ↓
Log to Firestore: email_logs/{uid}/{emailId}
  ↓
Handle Bounces/Failures
```

---

## 🔐 Security Considerations

### Entitlement Checks
- **Server-side only:** Never trust client-side checks
- **Cache:** 60-second cache for frequently checked features
- **Firestore rules:** Enforce read-only for entitlements collection

### Referral Code Security
- **Unique codes:** UUID-based with user prefix
- **Rate limiting:** Max 10 codes per user
- **Expiration:** Optional 90-day expiry
- **Fraud detection:** Flag if same IP/device claims multiple referrals

### Email Security
- **SPF/DKIM:** Properly configured for domain
- **Unsubscribe:** Required link in all marketing emails (not transactional)
- **Rate limiting:** Max 5 emails/hour per user
- **Link expiry:** Magic links expire in 15 minutes

---

## 🧯 Emergency Controls

| Issue | Kill Switch |
|-------|-------------|
| Paywall causing access issues | `paywall.enabled = false` |
| Referral abuse detected | `referrals.enabled = false` |
| Email provider down | `emails.tx.enabled = false` (queue in Firestore) |
| Onboarding breaking signups | `onboarding.required = false` |
| Tour overlay bugs | `tours.enabled = false` |

---

## 📊 Plan Features Matrix

| Feature | Free | Daily ($1) | Monthly ($20) |
|---------|------|------------|---------------|
| Agent calls/day | 10 | 100 | 1000 |
| Workspaces | 1 | 5 | Unlimited |
| Storage | 100MB | 1GB | 10GB |
| Model access | Basic | Full | Full + Preview |
| Support | Community | Email | Priority (Email + Slack) |
| Referral earnings | ✅ | ✅ | ✅ |
| Custom integrations | ❌ | ✅ | ✅ |
| Team collaboration | ❌ | ❌ | ✅ (coming soon) |

---

## 📘 Documentation to Create

1. **ONBOARDING_GUIDE.md** - How to complete onboarding flow
2. **PAYWALL_IMPLEMENTATION.md** - Developer guide for adding paywalled features
3. **REFERRAL_PROGRAM.md** - User-facing referral program details
4. **EMAIL_TEMPLATES.md** - All transactional email templates
5. **HELP_CENTER_SETUP.md** - Adding and managing MDX guides

---

## 🗓️ Implementation Timeline

| Week | Task | Deliverables |
|------|------|--------------|
| 1 | Paywall + Entitlements | ✅ Gated features working |
| 2 | Onboarding wizard | ✅ 4-step flow complete |
| 3 | Referral system | ✅ Code generation + credits |
| 4 | Transactional emails | ✅ 5 templates sending |
| 5 | Help center + Tours | ✅ MDX guides + interactive tour |
| 6 | Testing + optimization | ✅ All 8 smoke tests passing |

---

## 🟢 Status Goal

**Target State:**
- ✅ Onboarding completion ≥ 60%
- ✅ Free → Paid conversion ≥ 25%
- ✅ Email delivery ≥ 98%
- ✅ Help article engagement ≥ 70%
- ✅ Referral system active

**Go-Live Criteria:**
- All 8 smoke tests passing
- Email templates reviewed and approved
- Onboarding flow tested with 10+ beta users
- Referral fraud detection active
- Paywall tested across all features

---

**Sprint Owner:** _____________________
**Start Date:** _____________________
**Target Completion:** 6 weeks
**Dependencies:** Sprint 20 (SaaS Launch & Operations Layer)

🚀 **Sprint 21 - Ready to Execute**
