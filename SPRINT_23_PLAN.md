# 🛍️ Sprint 23 — Marketplace & Creator Payouts

**Version:** v24.0.0
**Goal:** Transform F0 into an open platform for AI agents (Agents Marketplace) with creator payout system.

---

## 📦 New Files (15 Files)

### Marketplace Core

| File | Purpose |
|------|---------|
| `src/app/(public)/marketplace/page.tsx` | Browse agents available for purchase or clone |
| `src/app/api/marketplace/route.ts` | CRUD for agents (listings, search, filters) |
| `src/app/(public)/marketplace/[id]/page.tsx` | Agent detail page with purchase option |

### Creator Dashboard

| File | Purpose |
|------|---------|
| `src/app/(creator)/dashboard/page.tsx` | Sales and download statistics |
| `src/app/(creator)/earnings/page.tsx` | Earnings breakdown and payout history |
| `src/app/(creator)/agents/page.tsx` | Manage uploaded agents |

### Creator Upload

| File | Purpose |
|------|---------|
| `src/app/(creator)/agents/new/page.tsx` | Upload new agent (JSON file + metadata) |
| `src/app/api/agents/upload/route.ts` | Upload, validate, and process agent |

### Reviews & Ratings

| File | Purpose |
|------|---------|
| `src/app/api/reviews/route.ts` | Create/read/update/delete reviews |
| `src/app/(public)/marketplace/[id]/reviews/page.tsx` | Display reviews with images and ratings |

### Stripe Connect Integration

| File | Purpose |
|------|---------|
| `functions/src/billing/connectWebhook.ts` | Receive Connect account events |
| `src/app/api/payouts/route.ts` | Manage payouts to creators |
| `src/app/api/connect/onboard/route.ts` | Stripe Connect onboarding flow |

### Admin Panel Enhancements

| File | Purpose |
|------|---------|
| `src/app/(admin)/payouts/page.tsx` | View and approve payouts |
| `src/app/(admin)/reviews/moderation/page.tsx` | Review moderation queue |

### Analytics & Ranking

| File | Purpose |
|------|---------|
| `src/app/(admin)/analytics/marketplace/page.tsx` | Sales and ratings analytics |

### Marketing Assets

| File | Purpose |
|------|---------|
| `src/app/(public)/featured/page.tsx` | Featured agents section |

### Documentation

| File | Purpose |
|------|---------|
| `MARKETPLACE_GUIDE.md` | Complete guide for uploading agents |
| `CREATOR_PAYOUTS.md` | Payout system documentation |

---

## 💳 Stripe Connect Setup

### Configuration

**Mode:** Standard Accounts (creators manage own Stripe accounts)

**Platform Fee:** 15% (configurable via feature flags)

**Webhook Events:**
- `account.updated` - Connect account status changes
- `account.application.deauthorized` - Account disconnected
- `payout.created` - Payout initiated
- `payout.paid` - Payout completed
- `payout.failed` - Payout failed

### Setup Commands

```bash
# Create Connect webhook endpoint in Stripe Dashboard
# URL: https://yourapp.web.app/api/webhooks/stripe-connect
# Events: account.*, payout.*

# Configure platform fee
firebase functions:config:set stripe.platform_fee_percent=15
```

### Onboarding Flow

```
Creator clicks "Enable Payouts"
  ↓
Redirect to Stripe Connect OAuth
  ↓
Creator authorizes F0 platform
  ↓
Stripe redirects back with account ID
  ↓
Save stripeConnectId to users/{uid}
  ↓
Enable payout eligibility
```

---

## 🧩 Feature Flags

```json
{
  "marketplace": {
    "enabled": true,
    "creator_uploads_enabled": true,
    "min_price": 0.99,
    "max_price": 999.99,
    "review_required": false
  },
  "payouts": {
    "enabled": true,
    "min_balance": 50.00,
    "schedule": "monthly",
    "auto_approve": false
  },
  "reviews": {
    "enabled": true,
    "spam_guard": true,
    "img_mod_required": true,
    "min_purchase_required": true
  },
  "creator_uploads": {
    "enabled": true,
    "max_file_size": 5242880,
    "allowed_formats": [".json", ".yaml"]
  }
}
```

---

## 📁 Firestore Structure

### agents/{agentId}

```javascript
{
  id: string,
  creatorUid: string,
  name: string,
  description: string,
  category: "code" | "design" | "data" | "productivity" | "other",
  price: number, // in cents
  currency: "USD",
  configJson: string, // Agent configuration
  imageUrl: string,
  published: boolean,
  featured: boolean,
  downloads: number,
  revenue: number, // total revenue in cents
  rating: number, // average 0-5
  reviewCount: number,
  tags: string[],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### reviews/{reviewId}

```javascript
{
  id: string,
  agentId: string,
  uid: string,
  orderId: string, // Proof of purchase
  rating: number, // 1-5
  title: string,
  body: string,
  images: string[], // URLs
  helpful: number, // Count of helpful votes
  spam: boolean, // AI spam detection
  moderated: boolean,
  moderatorNotes: string,
  createdAt: timestamp
}
```

### payouts/{payoutId}

```javascript
{
  id: string,
  creatorUid: string,
  amount: number, // in cents
  currency: "USD",
  status: "pending" | "approved" | "processing" | "paid" | "failed",
  stripePayoutId: string,
  period: {
    start: timestamp,
    end: timestamp
  },
  salesCount: number,
  platformFee: number, // in cents
  createdAt: timestamp,
  approvedAt: timestamp,
  paidAt: timestamp,
  failureReason: string
}
```

### creator_earnings/{uid}

```javascript
{
  balance: number, // Available for payout (in cents)
  pendingBalance: number, // Not yet released (in cents)
  lifetimeEarnings: number,
  lifetimePaidOut: number,
  salesCount: number,
  lastPayoutAt: timestamp,
  updatedAt: timestamp
}
```

---

## 🧪 Smoke Tests (10 Tests)

### Test 1: Create and Publish Agent

1. Login as creator
2. Visit `/creator/agents/new`
3. Upload agent JSON file
4. Fill metadata (name, description, price, category)
5. Upload cover image
6. Submit
7. Verify agent appears in `/creator/agents` (unpublished)
8. Publish agent
9. Verify appears in `/marketplace`

**✅ Pass Criteria:**
- Upload succeeds
- Agent saves to Firestore
- Published agents visible in marketplace

---

### Test 2: Agent Purchase Flow

1. Login as buyer
2. Browse `/marketplace`
3. Click agent
4. View details and reviews
5. Click "Purchase for $X"
6. Complete Stripe Checkout
7. Verify order created
8. Verify license issued
9. Verify creator earnings updated

**✅ Pass Criteria:**
- Purchase completes successfully
- Platform fee (15%) deducted
- Creator balance increases
- Buyer gets license to agent

---

### Test 3: Payout Failure Handling

1. Create payout for creator without Connect account
2. Verify payout status = "failed"
3. Check Slack alert sent
4. Verify retry queue entry created
5. Creator connects Stripe account
6. Retry payout manually
7. Verify succeeds

**✅ Pass Criteria:**
- Failure logged correctly
- Alert sent
- Retry mechanism works

---

### Test 4: Marketplace Filtering

1. Visit `/marketplace`
2. Filter by category: "code"
3. Verify only code agents shown
4. Filter by price range: $0-$10
5. Verify only agents in range shown
6. Sort by: "Most Popular"
7. Verify sorting works

**✅ Pass Criteria:**
- Filters work correctly
- Results update in real-time
- No performance issues

---

### Test 5: Review Submission with Spam Detection

1. Purchase agent
2. Visit agent detail page
3. Submit review with spam content (e.g., "Buy now at example.com")
4. Verify AI spam guard flags review
5. Review appears in moderation queue
6. Admin approves/rejects
7. Verify review visibility updates

**✅ Pass Criteria:**
- Spam detection works
- Only verified purchasers can review
- Moderation queue accessible to admins

---

### Test 6: Admin Payout Approval

1. Creator has $50+ balance
2. Creator requests payout
3. Admin visits `/admin/payouts`
4. Verify pending payout appears
5. Admin approves
6. Verify Stripe payout created
7. Webhook updates status to "paid"

**✅ Pass Criteria:**
- Approval workflow works
- Stripe integration successful
- Creator balance deducted

---

### Test 7: Featured Agents Section

1. Admin selects agent
2. Mark as "featured"
3. Visit `/featured`
4. Verify agent appears
5. Verify higher visibility in marketplace

**✅ Pass Criteria:**
- Featured flag works
- Section displays correctly
- Featured badge visible

---

### Test 8: Creator Dashboard Analytics

1. Login as creator with sales
2. Visit `/creator/dashboard`
3. Verify metrics shown:
   - Total sales
   - Revenue (lifetime)
   - Downloads
   - Average rating
4. Verify charts render (sales over time)

**✅ Pass Criteria:**
- All metrics accurate
- Charts load <2 seconds
- Data updates real-time

---

### Test 9: Review Helpful Votes

1. View agent reviews
2. Click "Helpful" on review
3. Verify count increments
4. Prevent duplicate votes from same user
5. Verify reviews sorted by helpful count

**✅ Pass Criteria:**
- Vote system works
- No duplicate votes
- Sorting accurate

---

### Test 10: Agent Download with License Verification

1. Purchase agent
2. Visit "My Agents" page
3. Click "Download"
4. Verify license checked
5. Download agent JSON
6. Verify file integrity (config valid)

**✅ Pass Criteria:**
- License verification works
- Download succeeds
- Config JSON valid

---

## ⏱ Timeline (6 Weeks)

### Week 1-2: Marketplace Core + Upload

**Tasks:**
- Marketplace listing page
- Agent detail page
- Upload flow (creator)
- Agent validation logic
- Search and filters

**Deliverables:**
- Functional marketplace
- Creator upload working
- Basic search

---

### Week 3: Stripe Connect Integration

**Tasks:**
- Connect onboarding flow
- Webhook handler
- Payout creation logic
- Platform fee calculation
- Connect account management

**Deliverables:**
- Creators can connect Stripe
- Payouts create successfully
- Webhook processing works

---

### Week 4: Reviews + Moderation

**Tasks:**
- Review submission
- AI spam detection
- Moderation queue (admin)
- Helpful votes system
- Image upload for reviews

**Deliverables:**
- Review system live
- Spam guard active
- Moderation UI working

---

### Week 5: Analytics + Featured

**Tasks:**
- Creator dashboard analytics
- Admin marketplace analytics
- Featured agents section
- Trending algorithm
- Revenue forecasting

**Deliverables:**
- Analytics dashboards
- Featured section
- Trending agents visible

---

### Week 6: Beta Launch

**Tasks:**
- Invite 100 creators
- Monitor performance
- Fix critical bugs
- Gather feedback
- Optimize queries

**Deliverables:**
- 100 creators onboarded
- >500 agents published
- >1000 transactions
- Feedback collected

---

## 🎯 Success Metrics

### Week 1 Post-Launch

| Metric | Target |
|--------|--------|
| Creators onboarded | ≥ 50 |
| Agents published | ≥ 200 |
| Agent purchases | ≥ 100 |
| Payout success rate | ≥ 99% |
| Review spam detection accuracy | ≥ 95% |
| Marketplace load time | < 2 seconds |
| Search result accuracy | ≥ 90% |

### Month 1 Post-Launch

| Metric | Target |
|--------|--------|
| Active creators | ≥ 200 |
| Total agents | ≥ 1000 |
| GMV (Gross Merchandise Value) | ≥ $10,000 |
| Average creator revenue | ≥ $100 |
| Review volume | ≥ 500 |
| Creator retention | ≥ 80% |
| Buyer satisfaction | ≥ 4.5/5 average rating |

---

## 📐 Technical Architecture

### Agent Purchase Flow

```
Buyer clicks "Purchase Agent"
  ↓
Create Stripe Checkout session
  price = agent.price
  metadata = { agentId, creatorUid }
  ↓
Buyer completes payment
  ↓
Webhook: checkout.session.completed
  ↓
Calculate platform fee (15%)
  creatorEarnings = price * 0.85
  platformFee = price * 0.15
  ↓
Update creator_earnings/{creatorUid}
  balance += creatorEarnings
  ↓
Create license
  licenses/{licenseId} = { uid, agentId, orderId }
  ↓
Increment agent.downloads
  ↓
Send confirmation email
```

### Payout Flow

```
Creator requests payout (balance >= $50)
  ↓
Create payout/{payoutId}
  status = "pending"
  ↓
Admin reviews and approves
  ↓
Update status = "approved"
  ↓
Create Stripe payout via Connect API
  destination = creator.stripeConnectId
  amount = payout.amount
  ↓
Webhook: payout.paid
  ↓
Update payout status = "paid"
  ↓
Deduct from creator_earnings.balance
  ↓
Send payout confirmation email
```

### Review Spam Detection Flow

```
User submits review
  ↓
Check: user has purchased agent?
  ↓
AI spam detection (check for URLs, spam keywords)
  ↓
If spam_score > 0.7:
  Set review.spam = true
  Add to moderation queue
  ↓
Else:
  Publish immediately
  ↓
Moderator reviews flagged items
  ↓
Approve/Reject
  ↓
Update agent.rating (recalculate average)
```

---

## 🔐 Security Considerations

### Agent Upload Validation

- **File size limit:** 5MB max
- **Format check:** Only .json or .yaml
- **Schema validation:** Agent config must match expected structure
- **Malicious code detection:** Scan for eval(), exec(), etc.
- **Rate limiting:** Max 10 uploads per creator per day

### Payout Fraud Prevention

- **Minimum balance:** $50 before payout
- **Verification required:** Creator must verify email + phone
- **Stripe Connect verification:** Identity verification by Stripe
- **Velocity checks:** Flag creators with unusual payout patterns
- **Manual review:** All first payouts require admin approval

### Review Authenticity

- **Purchase verification:** Only buyers can review
- **One review per user per agent:** Prevent spam
- **Image moderation:** All review images require approval if `img_mod_required = true`
- **Vote manipulation:** Track IP addresses to prevent abuse

---

## 🧯 Emergency Controls

| Issue | Kill Switch |
|-------|-------------|
| Marketplace abuse (spam agents) | `marketplace.creator_uploads_enabled = false` |
| Payout fraud detected | `payouts.enabled = false` + manual review |
| Review spam wave | `reviews.enabled = false` + increase `spam_guard` threshold |
| Platform fee miscalculation | Pause checkouts, fix, redeploy |
| Stripe Connect outage | Queue payouts, retry when recovered |

---

## 📚 Documentation to Create

1. **MARKETPLACE_GUIDE.md** - How to upload and sell agents
2. **CREATOR_PAYOUTS.md** - Payout schedule, fees, tax forms
3. **AGENT_JSON_SCHEMA.md** - Required agent configuration format
4. **REVIEW_GUIDELINES.md** - Review policy and spam detection

---

## 🟢 Status Goal

**Target State:**
- ✅ 100 creators onboarded
- ✅ 500+ agents in marketplace
- ✅ $10k GMV in first month
- ✅ 99%+ payout success rate
- ✅ <2s marketplace load time

**Go-Live Criteria:**
- All 10 smoke tests passing
- Stripe Connect tested in production
- Spam detection >95% accuracy
- Admin payout approval flow tested
- Creator onboarding guide published

---

**Sprint Owner:** _____________________
**Start Date:** _____________________
**Target Completion:** 6 weeks
**Dependencies:** Sprint 20-22 (SaaS Platform, Reliability)

🛍️ **Sprint 23 - Ready to Execute**
