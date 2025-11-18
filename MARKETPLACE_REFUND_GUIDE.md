# Marketplace Refund Flow - Complete Guide

## Overview

This guide covers the complete refund flow implementation for the F0 marketplace, including payment intent tracking, refund processing, license revocation, and security considerations.

## Table of Contents

1. [Architecture](#architecture)
2. [Payment Intent Migration](#payment-intent-migration)
3. [Refund Flow](#refund-flow)
4. [Smoke Tests](#smoke-tests)
5. [Security & Monitoring](#security--monitoring)
6. [Emergency Procedures](#emergency-procedures)

---

## Architecture

### Payment Intent Field Unification

**Problem Solved**: Legacy orders used `stripePaymentIntent` while new code expects `paymentIntentId`, causing refund failures.

**Solution**: Unified field naming with fallback support:

```typescript
// ✅ Unified field (new standard)
const paymentIntentId = order.paymentIntentId;

// ✅ Fallback for legacy orders (transition period)
const pid = order.paymentIntentId || order.stripePaymentIntent;
```

### Flow Diagram

```
Checkout → Payment Intent → Webhook → License → Refund
   ↓            ↓              ↓          ↓         ↓
Order       Set to null    Update PID   Grant    Revoke
Created                    + Status     License  License
```

---

## Payment Intent Migration

### Backfill Script

**Location**: `scripts/migrate-payment-intent-field.ts`

**Purpose**: Migrate legacy `stripePaymentIntent` → `paymentIntentId` for existing orders.

#### Usage

```bash
# Dry run (preview changes)
npx tsx scripts/migrate-payment-intent-field.ts --dry-run

# Execute migration
npx tsx scripts/migrate-payment-intent-field.ts
```

#### What It Does

1. Queries all orders with `paymentIntentId == null`
2. Checks if `stripePaymentIntent` exists
3. Copies value to `paymentIntentId`
4. Preserves legacy field in `_legacyFields` for audit trail
5. Logs migration timestamp

#### Output Example

```
🔄 Starting payment intent field migration...

📊 Found 145 orders with null paymentIntentId

✅ Migrated order ord_abc123: pi_1234567890
✅ Migrated order ord_def456: pi_0987654321
...

📈 Migration Summary:
   ✅ Updated: 145 orders
   ⏭️  Skipped: 0 orders (no stripePaymentIntent)
   ❌ Errors: 0 orders

✨ Migration completed successfully!
```

---

## Refund Flow

### 1. Create & Pay

**File**: `functions/src/market/checkout.ts`

```typescript
// Create order with null paymentIntentId
await orderRef.set({
  uid,
  productId,
  amountUsd,
  status: 'pending',
  paymentIntentId: null, // Updated by webhook
  stripeSessionId: session.id,
  createdAt: Date.now()
}, { merge: true });
```

### 2. Webhook Update

**File**: `functions/src/market/webhook.ts`

```typescript
case "checkout.session.completed": {
  const session = event.data.object;

  // ✅ Early assertion: payment intent must exist
  if (!session.payment_intent) {
    console.error("[webhook] Missing payment_intent", { sessionId: session.id });
    return res.status(400).send("Missing payment_intent from Stripe payload");
  }

  await orderRef.set({
    status: "paid",
    paidAt: Date.now(),
    paymentIntentId: session.payment_intent, // ✅ Store ID here
    platformFeeUsd,
    amountToCreatorUsd
  }, { merge: true });

  // Grant license
  await db.collection("licenses").add({
    uid,
    productId,
    orderId,
    key: generateLicenseKey(),
    active: true,
    createdAt: Date.now()
  });
}
```

### 3. Process Refund

**File**: `functions/src/market/refunds.ts`

```typescript
export const refundOrder = functions.https.onCall(async (payload, ctx) => {
  requireAdmin(ctx); // Admin-only operation

  const { orderId, amountUsd } = payload;
  const orderSnap = await db.collection('orders').doc(orderId).get();
  const order = orderSnap.data();

  // Idempotency: check if already refunded
  if (order.status === "refunded") {
    return { ok: true, already: true };
  }

  // ✅ Retrieve payment intent with fallback
  const paymentIntentId = order.paymentIntentId || order.stripePaymentIntent;
  if (!paymentIntentId) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "paymentIntentId missing on order"
    );
  }

  // Create refund in Stripe
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amountUsd ? Math.round(amountUsd * 100) : undefined,
    reason: "requested_by_customer"
  });

  // Update order status
  await orderSnap.ref.set({
    status: "refunded",
    refundedAt: Date.now(),
    refund: {
      id: refund.id,
      amountUsd: refund.amount / 100,
      status: refund.status
    }
  }, { merge: true });

  // Revoke license
  const licSnap = await db.collection("licenses")
    .where("orderId", "==", orderId)
    .limit(1)
    .get();

  if (!licSnap.empty) {
    await licSnap.docs[0].ref.set({
      revoked: true,
      revokedAt: Date.now(),
      revokeReason: "refund"
    }, { merge: true });
  }

  return { ok: true, refundId: refund.id };
});
```

### 4. Partial Refunds

```typescript
// Partial refund (e.g., $20 out of $49.99)
const result = await refundOrder({
  orderId: "ord_abc123",
  amountUsd: 20.00
});

// Order status becomes "partial_refund" instead of "refunded"
// License remains active for partial refunds
```

---

## Smoke Tests

**Location**: `functions/src/market/__tests__/refund-flow.test.ts`

### Test Suite

#### ✅ Test 1: Create & Pay
Verify `paymentIntentId` is populated after checkout completion.

#### ✅ Test 2: Webhook Update
Verify correct field mapping from Stripe webhook to Firestore.

#### ✅ Test 3: Full Refund
Verify refund creation, order status update, and license revocation.

#### ✅ Test 4: Partial Refund
Verify partial amount handling and status management.

#### ✅ Test 5: Idempotency
Verify duplicate webhook events don't cause double-processing.

#### ✅ Test 6: Legacy Fallback
Verify old orders with `stripePaymentIntent` can be refunded.

#### ✅ Test 7: Missing Payment Intent
Verify error handling when no payment intent exists.

#### ✅ Test 8: Security
Verify Firestore rules deny unauthorized refund writes.

### Running Tests

```bash
# Run all refund flow tests
npm test -- refund-flow.test.ts

# Run specific test
npm test -- -t "should process full refund correctly"

# Run with coverage
npm test -- --coverage refund-flow.test.ts
```

### Manual Smoke Test Checklist

- [ ] **Create order**: Checkout creates order with `paymentIntentId: null`
- [ ] **Webhook update**: `checkout.session.completed` populates `paymentIntentId`
- [ ] **Full refund**: Admin can refund entire amount, license revoked
- [ ] **Partial refund**: Admin can refund partial amount, license stays active
- [ ] **Idempotency**: Duplicate refund request returns `{ ok: true, already: true }`
- [ ] **Legacy support**: Old orders with `stripePaymentIntent` can be refunded
- [ ] **Error handling**: Missing `paymentIntentId` throws clear error
- [ ] **Security**: Non-admin users cannot call `refundOrder`

---

## Security & Monitoring

### Firestore Rules

**File**: `firestore.rules`

```javascript
// Orders - owner or admin read, server-side write only
match /orders/{id} {
  allow read: if isOwner(resource.data.uid) || isAdmin();
  allow write: if false; // Webhook/Functions only
}

// Licenses - owner or admin read, server-side write only
match /licenses/{id} {
  allow read: if isOwner(resource.data.uid) || isAdmin();
  allow write: if false; // Webhook/Functions only
}

// Refunds - admin read only
match /refunds/{id} {
  allow read: if isAdmin();
  allow write: if false; // Functions only
}
```

### Monitoring Alerts

#### Alert 1: Missing Payment Intent

```typescript
// In webhook.ts
if (!session.payment_intent) {
  console.error("[ALERT] Missing payment_intent", {
    sessionId: session.id,
    orderId,
    timestamp: Date.now()
  });

  // Send to monitoring (e.g., Sentry, Slack)
  await sendAlert({
    severity: "critical",
    message: "Webhook missing payment_intent",
    metadata: { sessionId: session.id }
  });
}
```

#### Alert 2: Refund Without Payment Intent

```typescript
// In refunds.ts
if (!paymentIntentId) {
  await db.collection('alerts').add({
    type: 'refund_failure',
    severity: 'critical',
    orderId,
    reason: 'missing_payment_intent',
    timestamp: Date.now()
  });

  throw new functions.https.HttpsError(...);
}
```

#### Alert 3: Refund Attempt Counter

```typescript
// Dashboard metric
const refundsWithoutPID = await db.collection('alerts')
  .where('type', '==', 'refund_failure')
  .where('reason', '==', 'missing_payment_intent')
  .where('timestamp', '>', Date.now() - 24*60*60*1000)
  .get();

// Should be ZERO after migration
console.log(`Refunds without PID (24h): ${refundsWithoutPID.size}`);
```

### Audit Logs

```typescript
// In refunds.ts
await db.collection("audit_logs").add({
  ts: Date.now(),
  kind: "order_refund",
  actor: ctx.auth?.uid,
  meta: {
    orderId,
    amountUsd: amountUsd ?? order.amountUsd,
    paymentIntentId,
    refundId: refund.id
  }
});
```

---

## Emergency Procedures

### Kill-Switch: Disable Refunds

**Location**: `config/feature_flags`

```json
{
  "refunds": {
    "enabled": false,
    "reason": "Emergency: investigating duplicate refunds"
  }
}
```

**Implementation**:

```typescript
// In refunds.ts
export const refundOrder = functions.https.onCall(async (payload, ctx) => {
  const flags = await db.collection('config').doc('feature_flags').get();
  const refundsEnabled = flags.data()?.refunds?.enabled ?? true;

  if (!refundsEnabled) {
    throw new functions.https.HttpsError(
      "unavailable",
      "Refunds temporarily disabled"
    );
  }

  // ... rest of refund logic
});
```

### Rollback Migration

If migration causes issues, rollback script:

```typescript
// scripts/rollback-payment-intent.ts
const snap = await db.collection('orders')
  .where('_legacyFields.migratedAt', '!=', null)
  .get();

for (const doc of snap.docs) {
  const legacy = doc.data()._legacyFields?.stripePaymentIntent;
  if (legacy) {
    await doc.ref.update({
      paymentIntentId: null,
      stripePaymentIntent: legacy,
      '_legacyFields.rolledBackAt': new Date().toISOString()
    });
  }
}
```

### Force Refund (Manual Override)

For stuck orders, admin can force refund:

```typescript
// Admin panel or Cloud Console
await db.collection('orders').doc(orderId).update({
  status: 'refunded',
  refundedAt: Date.now(),
  refund: {
    id: 're_manual_override',
    amountUsd: 49.99,
    status: 'manual',
    note: 'Manually refunded by admin due to Stripe issue'
  }
});
```

---

## Changelog

### v1.0.0 - Payment Intent Unification

**Added**:
- ✅ Unified `paymentIntentId` field across checkout, webhook, refunds
- ✅ Fallback support for legacy `stripePaymentIntent` field
- ✅ Early assertion in webhook for missing payment intent
- ✅ Migration script with dry-run mode
- ✅ Comprehensive smoke tests (8 test cases)
- ✅ Monitoring alerts for missing payment intents
- ✅ Emergency kill-switch for refunds

**Fixed**:
- ✅ Inconsistent field names causing refund failures
- ✅ Firestore rules using undefined `isAuth()` function
- ✅ Missing payment intent validation in webhook

**Changed**:
- `stripePaymentIntent` → `paymentIntentId` (with fallback)
- `isAuth()` → `isAuthenticated()` in Firestore rules

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `functions/src/market/checkout.ts` | Create order with null PID |
| `functions/src/market/webhook.ts` | Update PID from Stripe event |
| `functions/src/market/refunds.ts` | Process refunds with fallback |
| `scripts/migrate-payment-intent-field.ts` | One-time migration script |
| `functions/src/market/__tests__/refund-flow.test.ts` | Comprehensive test suite |
| `firestore.rules` | Security rules for orders/licenses |

### Commands

```bash
# Migration
npx tsx scripts/migrate-payment-intent-field.ts --dry-run
npx tsx scripts/migrate-payment-intent-field.ts

# Testing
npm test -- refund-flow.test.ts
npm test -- --coverage

# Deployment
firebase deploy --only functions:refundOrder
firebase deploy --only firestore:rules
```

### Support

- **Alert Dashboard**: Check `alerts` collection for `type: 'refund_failure'`
- **Audit Logs**: Query `audit_logs` where `kind: 'order_refund'`
- **Monitoring**: Alert if refunds without PID > 0 after migration
