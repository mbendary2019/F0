# Product Requirements Document: FZ Credits Wallet

**Version:** 1.0  
**Date:** October 11, 2025  
**Status:** Draft  
**Owner:** Product Team

---

## 1. Executive Summary

The FZ Credits Wallet enables users to purchase, track, and spend FZ credits for AI-powered development services. Users subscribe at $29/month and receive 29 FZ credits automatically. The wallet provides real-time balance tracking, transaction history, and seamless integration with Stripe payments.

### Goals
- Enable frictionless subscription and credit purchase flow
- Provide transparent balance tracking and transaction history
- Ensure reliable credit allocation after successful payments
- Support future credit-based features (marketplace, pay-per-use APIs)

---

## 2. User Stories

### As a Developer User
- **US-1:** I want to subscribe to the $29/month plan so that I receive 29 FZ credits monthly
- **US-2:** I want to see my current FZ balance so that I know how many credits I have available
- **US-3:** I want to view my transaction history so that I can track credit additions and deductions
- **US-4:** I want credits added automatically after successful payment so that I don't need manual intervention
- **US-5:** I want to be notified when my balance is low so that I can recharge before running out

### As a System Admin
- **US-6:** I want to view all user balances so that I can monitor credit distribution
- **US-7:** I want to manually adjust balances so that I can handle edge cases or refunds
- **US-8:** I want audit logs of all balance changes so that I can track system integrity

---

## 3. Data Model

### Firestore Schema

#### Collection: `users`
```typescript
{
  uid: string;                    // Firebase Auth UID
  email: string;
  displayName: string;
  balances: {
    fz: number;                   // Current FZ credit balance
    lastUpdated: Timestamp;       // Last balance modification
  };
  subscriptions: {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    status: 'active' | 'canceled' | 'past_due';
    currentPeriodEnd: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Collection: `transactions`
```typescript
{
  id: string;                     // Auto-generated
  userId: string;                 // Reference to users.uid
  type: 'credit' | 'debit';
  amount: number;                 // FZ credits (positive for credit, negative for debit)
  balanceBefore: number;
  balanceAfter: number;
  source: 'subscription' | 'purchase' | 'admin' | 'refund' | 'usage';
  metadata: {
    stripeSessionId?: string;
    taskId?: string;
    reason?: string;
  };
  timestamp: Timestamp;
}
```

---

## 4. API Endpoints

### GET `/api/me`
**Purpose:** Fetch current user profile and FZ balance

**Response:**
```json
{
  "ok": true,
  "data": {
    "uid": "user123",
    "email": "user@example.com",
    "balances": {
      "fz": 29,
      "lastUpdated": "2025-10-11T12:00:00Z"
    },
    "subscriptions": {
      "status": "active",
      "currentPeriodEnd": "2025-11-11T12:00:00Z"
    }
  }
}
```

### POST `/api/checkout`
**Purpose:** Create Stripe checkout session for subscription

**Request:**
```json
{
  "priceId": "price_xxx",
  "metadata": {
    "uid": "user123"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "sessionId": "cs_test_xxx",
  "url": "https://checkout.stripe.com/..."
}
```

### POST `/api/webhooks/stripe`
**Purpose:** Handle Stripe webhook events (internal only)

**Events Handled:**
- `checkout.session.completed` → Add 29 FZ credits
- `invoice.payment_succeeded` → Monthly credit renewal
- `customer.subscription.deleted` → Mark subscription as canceled

### GET `/api/transactions`
**Purpose:** Fetch user transaction history

**Query Params:**
- `limit` (default: 50, max: 100)
- `offset` (default: 0)
- `type` (filter by: credit, debit, all)

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "txn_123",
      "type": "credit",
      "amount": 29,
      "balanceAfter": 29,
      "source": "subscription",
      "timestamp": "2025-10-11T12:00:00Z"
    }
  ],
  "total": 1,
  "hasMore": false
}
```

---

## 5. Business Logic

### Credit Allocation Rules
1. **Subscription Payment:**
   - Event: `checkout.session.completed` or `invoice.payment_succeeded`
   - Amount: 29 FZ credits
   - Timing: Immediate upon payment confirmation

2. **Failed Payment:**
   - Subscription status → `past_due`
   - No credits deducted, but no new credits added
   - User notified via email

3. **Cancellation:**
   - Existing credits remain available until depleted
   - No new credits on next billing cycle

4. **Refund:**
   - Deduct corresponding FZ credits
   - If balance < refund amount, set to 0 (admin review)

### Credit Usage Rules
1. **AI Task Execution:**
   - Deduct credits before task starts
   - If insufficient balance, task fails with error
   - Partial refund if task fails due to system error

2. **Minimum Balance:**
   - Alert user when balance < 5 FZ
   - Prevent task start if balance = 0

---

## 6. Edge Cases

### EC-1: Race Condition (Concurrent Transactions)
**Scenario:** Two tasks start simultaneously with balance = 10 FZ, each requiring 8 FZ

**Solution:** Use Firestore transactions for atomic balance updates
```typescript
await db.runTransaction(async (tx) => {
  const userDoc = await tx.get(userRef);
  const currentBalance = userDoc.get('balances.fz');
  
  if (currentBalance < requiredAmount) {
    throw new Error('Insufficient balance');
  }
  
  tx.update(userRef, {
    'balances.fz': currentBalance - requiredAmount
  });
});
```

### EC-2: Webhook Delivered Multiple Times
**Scenario:** Stripe webhook fires twice for same payment

**Solution:** Use Stripe event ID as idempotency key in transactions collection
```typescript
const existingTxn = await db.collection('transactions')
  .where('metadata.stripeEventId', '==', eventId)
  .limit(1)
  .get();

if (!existingTxn.empty) {
  return; // Already processed
}
```

### EC-3: User Deleted But Subscription Active
**Scenario:** User account deleted, but Stripe subscription still billing

**Solution:**
- Cancel Stripe subscription via webhook when user deleted
- Store subscription data separately for audit trail
- Refund last payment if deletion within 7 days

### EC-4: Negative Balance
**Scenario:** Admin error or refund causes balance < 0

**Solution:**
- Validation: Block balance updates that result in negative
- Admin override: Allow with audit log entry
- Recovery: Alert ops team for manual review

### EC-5: Firestore Write Fails After Stripe Charge
**Scenario:** Payment succeeds but Firestore update fails

**Solution:**
- Retry mechanism: Webhook redelivery (Stripe retries for 3 days)
- Dead letter queue: Log failed events for manual processing
- Monitoring: Alert on webhook failures

---

## 7. Success Metrics

### Product Metrics
- **Subscription Rate:** % of signups that complete checkout within 7 days (Target: >30%)
- **Credit Utilization:** Average FZ credits used per user per month (Target: >20)
- **Balance Zero Events:** % of users hitting 0 balance (Target: <10%)
- **Recharge Rate:** % of users who recharge before next billing cycle (Future metric)

### Technical Metrics
- **Webhook Reliability:** % of webhooks processed successfully (Target: 99.9%)
- **Balance Update Latency:** Time from payment to credit addition (Target: <2 seconds)
- **Transaction Integrity:** % of transactions with balanceAfter = balanceBefore ± amount (Target: 100%)
- **API Uptime:** Availability of `/api/me` and `/api/checkout` (Target: 99.5%)

### User Satisfaction
- **Support Tickets:** # of tickets related to credits/billing (Target: <5/month)
- **User Feedback:** Rating on payment flow (Target: >4.5/5)

---

## 8. Dependencies

### Internal
- Firebase Authentication (user identity)
- Firestore (data storage)
- Next.js API routes (backend)
- BuyButton component (frontend)

### External
- Stripe (payment processing)
- Stripe Webhook (event notifications)

---

## 9. Security & Compliance

### Authentication
- All API endpoints require Firebase Auth token (except webhook)
- Webhook secured with Stripe signature verification

### Authorization
- Users can only read/modify their own balance
- Admin endpoints require special claims

### Data Privacy
- PII (email, name) encrypted at rest
- Transaction history limited to 12 months for non-admin users
- GDPR: User can request balance/transaction export or deletion

### Financial Compliance
- Store Stripe IDs only (no direct card data)
- Audit log for all manual balance adjustments
- Refund policy: Full refund within 7 days

---

## 10. Rollout Plan

### Phase 1: MVP (Current)
- ✅ Basic balance tracking
- ✅ Stripe subscription integration
- ✅ Webhook credit allocation
- ✅ `/api/me` endpoint

### Phase 2: Enhanced (Next 30 days)
- Transaction history API
- Low balance alerts
- Admin dashboard for balance management

### Phase 3: Advanced (60-90 days)
- One-time credit purchases
- Credit gifting
- Usage analytics dashboard

---

## 11. Open Questions

1. **Q:** Should unused credits roll over month-to-month?  
   **A:** Yes, credits never expire (decided)

2. **Q:** What happens if a user upgrades mid-cycle?  
   **A:** Pro-rated credit allocation (TBD)

3. **Q:** Can users share credits with team members?  
   **A:** Not in MVP, consider for Phase 3

---

## 12. Appendix

### Calculation Example
```
Monthly Subscription: $29
FZ Rate: 1 FZ / $1 USD
Credits Allocated: 29 × 1 = 29 FZ

AI Task Costs (estimated):
- Simple code generation: 2 FZ
- Complex PRD generation: 5 FZ
- Full page component: 3 FZ
- Average user tasks/month: ~8-12 tasks
```

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId 
                   && (!request.resource.data.diff(resource.data).affectedKeys()
                       .hasAny(['balances'])); // Prevent direct balance modification
    }
    
    match /transactions/{txnId} {
      allow read: if request.auth.uid == resource.data.userId;
      allow create: if false; // Only server can create transactions
    }
  }
}
```

---

**Approval:**
- [ ] Product Lead
- [ ] Engineering Lead
- [ ] Finance/Legal
- [ ] Security Team

**Next Steps:**
1. Review and approve this PRD
2. Implement Phase 2 features
3. Set up monitoring dashboards
4. Schedule user testing


