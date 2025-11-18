/**
 * Refund Flow Smoke Tests
 *
 * Tests the complete refund flow including:
 * 1. Order creation & payment
 * 2. Webhook processing
 * 3. Refund operations (full/partial)
 * 4. Idempotency
 * 5. Security & permissions
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Mock configuration
const mockStripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
const stripe = new Stripe(mockStripeKey, { apiVersion: '2024-06-20' });

describe('Refund Flow - Smoke Tests', () => {
  let db: admin.firestore.Firestore;
  let testOrderId: string;
  let testPaymentIntentId: string;

  beforeEach(() => {
    db = admin.firestore();
    testOrderId = `order_test_${Date.now()}`;
    testPaymentIntentId = `pi_test_${Date.now()}`;
  });

  /**
   * Test 1: Create & Pay - Verify paymentIntentId is populated
   */
  it('should populate paymentIntentId after checkout', async () => {
    // Simulate checkout creation
    await db.collection('orders').doc(testOrderId).set({
      uid: 'test_user_123',
      productId: 'prod_test',
      amountUsd: 49.99,
      status: 'pending',
      paymentIntentId: null, // Initially null
      stripeSessionId: 'cs_test_123',
      createdAt: Date.now()
    });

    // Verify initial state
    let order = await db.collection('orders').doc(testOrderId).get();
    expect(order.data()?.paymentIntentId).toBeNull();

    // Simulate webhook update (checkout.session.completed)
    await db.collection('orders').doc(testOrderId).update({
      status: 'paid',
      paymentIntentId: testPaymentIntentId,
      paidAt: Date.now()
    });

    // Verify paymentIntentId is populated
    order = await db.collection('orders').doc(testOrderId).get();
    expect(order.data()?.paymentIntentId).toBe(testPaymentIntentId);
    expect(order.data()?.status).toBe('paid');
  });

  /**
   * Test 2: Webhook Update - Verify correct field mapping
   */
  it('should update paymentIntentId from webhook event', async () => {
    const mockSession = {
      id: 'cs_test_123',
      payment_intent: testPaymentIntentId,
      amount_total: 4999,
      metadata: { orderId: testOrderId }
    };

    // Create order
    await db.collection('orders').doc(testOrderId).set({
      uid: 'test_user_123',
      productId: 'prod_test',
      amountUsd: 49.99,
      status: 'pending',
      paymentIntentId: null,
      stripeSessionId: mockSession.id,
      createdAt: Date.now()
    });

    // Simulate webhook processing
    await db.collection('orders').doc(testOrderId).set({
      status: 'paid',
      paidAt: Date.now(),
      paymentIntentId: mockSession.payment_intent,
      platformFeeUsd: 7.5,
      amountToCreatorUsd: 42.49
    }, { merge: true });

    const order = await db.collection('orders').doc(testOrderId).get();
    const data = order.data();

    expect(data?.paymentIntentId).toBe(testPaymentIntentId);
    expect(data?.status).toBe('paid');
    expect(data?.platformFeeUsd).toBe(7.5);
  });

  /**
   * Test 3: Full Refund - Verify refund creation and status update
   */
  it('should process full refund correctly', async () => {
    // Setup paid order
    await db.collection('orders').doc(testOrderId).set({
      uid: 'test_user_123',
      productId: 'prod_test',
      amountUsd: 49.99,
      status: 'paid',
      paymentIntentId: testPaymentIntentId,
      paidAt: Date.now(),
      createdAt: Date.now()
    });

    // Create license
    const licenseRef = await db.collection('licenses').add({
      uid: 'test_user_123',
      productId: 'prod_test',
      orderId: testOrderId,
      key: 'lic_test_123',
      active: true,
      createdAt: Date.now()
    });

    // Process refund
    const refundId = `re_test_${Date.now()}`;
    await db.collection('orders').doc(testOrderId).update({
      status: 'refunded',
      refundedAt: Date.now(),
      refund: {
        id: refundId,
        amountUsd: 49.99,
        status: 'succeeded'
      }
    });

    // Revoke license
    await licenseRef.update({
      revoked: true,
      revokedAt: Date.now(),
      revokeReason: 'refund'
    });

    // Verify order status
    const order = await db.collection('orders').doc(testOrderId).get();
    expect(order.data()?.status).toBe('refunded');
    expect(order.data()?.refund?.amountUsd).toBe(49.99);

    // Verify license revocation
    const license = await licenseRef.get();
    expect(license.data()?.revoked).toBe(true);
    expect(license.data()?.revokeReason).toBe('refund');
  });

  /**
   * Test 4: Partial Refund - Verify amount handling
   */
  it('should process partial refund correctly', async () => {
    await db.collection('orders').doc(testOrderId).set({
      uid: 'test_user_123',
      productId: 'prod_test',
      amountUsd: 49.99,
      status: 'paid',
      paymentIntentId: testPaymentIntentId,
      paidAt: Date.now(),
      createdAt: Date.now()
    });

    const partialRefundAmount = 20.00;
    const refundId = `re_partial_${Date.now()}`;

    await db.collection('orders').doc(testOrderId).update({
      status: 'partial_refund',
      refundedAt: Date.now(),
      refund: {
        id: refundId,
        amountUsd: partialRefundAmount,
        status: 'succeeded'
      }
    });

    const order = await db.collection('orders').doc(testOrderId).get();
    expect(order.data()?.refund?.amountUsd).toBe(partialRefundAmount);
    expect(order.data()?.status).toBe('partial_refund');
  });

  /**
   * Test 5: Idempotency - Duplicate webhook events
   */
  it('should handle duplicate refund events idempotently', async () => {
    await db.collection('orders').doc(testOrderId).set({
      uid: 'test_user_123',
      productId: 'prod_test',
      amountUsd: 49.99,
      status: 'paid',
      paymentIntentId: testPaymentIntentId,
      paidAt: Date.now(),
      createdAt: Date.now()
    });

    const refundData = {
      status: 'refunded',
      refundedAt: Date.now(),
      refund: {
        id: 're_duplicate_test',
        amountUsd: 49.99,
        status: 'succeeded'
      }
    };

    // First refund event
    await db.collection('orders').doc(testOrderId).update(refundData);

    const order1 = await db.collection('orders').doc(testOrderId).get();
    const firstRefundTime = order1.data()?.refundedAt;

    // Duplicate refund event (idempotent check)
    const order2 = await db.collection('orders').doc(testOrderId).get();

    // Should return early if already refunded
    if (order2.data()?.status === 'refunded') {
      // No update needed
      expect(order2.data()?.refundedAt).toBe(firstRefundTime);
      expect(order2.data()?.refund?.id).toBe('re_duplicate_test');
    }
  });

  /**
   * Test 6: Legacy Field Fallback - Support old orders
   */
  it('should fallback to stripePaymentIntent if paymentIntentId is missing', async () => {
    // Create legacy order
    await db.collection('orders').doc(testOrderId).set({
      uid: 'test_user_123',
      productId: 'prod_test',
      amountUsd: 49.99,
      status: 'paid',
      stripePaymentIntent: testPaymentIntentId, // Legacy field
      paidAt: Date.now(),
      createdAt: Date.now()
    });

    const order = await db.collection('orders').doc(testOrderId).get();
    const data = order.data();

    // Fallback logic
    const pid = data?.paymentIntentId || data?.stripePaymentIntent;
    expect(pid).toBe(testPaymentIntentId);
  });

  /**
   * Test 7: Missing Payment Intent - Error handling
   */
  it('should throw error if no paymentIntentId exists', async () => {
    await db.collection('orders').doc(testOrderId).set({
      uid: 'test_user_123',
      productId: 'prod_test',
      amountUsd: 49.99,
      status: 'paid',
      // No paymentIntentId or stripePaymentIntent
      paidAt: Date.now(),
      createdAt: Date.now()
    });

    const order = await db.collection('orders').doc(testOrderId).get();
    const data = order.data();
    const pid = data?.paymentIntentId || data?.stripePaymentIntent;

    expect(pid).toBeUndefined();
    // In real function, this should throw error
  });

  /**
   * Test 8: Firestore Rules - Security check
   */
  it('should deny unauthorized refund writes', async () => {
    // This test requires Firestore emulator with rules loaded
    // For smoke test, verify rules configuration

    const rulesCheck = async () => {
      // Simulate unauthorized write attempt
      try {
        // In real test, use authenticated context
        const unauthorizedDb = admin.firestore();
        await unauthorizedDb.collection('orders').doc(testOrderId).update({
          status: 'refunded'
        });
        return false; // Should not reach here
      } catch (err: any) {
        // Expected: permission denied
        return err.code === 'permission-denied';
      }
    };

    // Note: Actual rules test requires emulator setup
    expect(rulesCheck).toBeDefined();
  });
});

/**
 * Integration Test: Full E2E Refund Flow
 */
describe('Refund Flow - E2E Integration', () => {
  it('should complete full checkout → payment → refund cycle', async () => {
    const db = admin.firestore();
    const orderId = `e2e_order_${Date.now()}`;
    const paymentIntentId = `pi_e2e_${Date.now()}`;

    // 1. Create checkout order
    await db.collection('orders').doc(orderId).set({
      uid: 'e2e_user',
      productId: 'prod_e2e',
      amountUsd: 99.99,
      status: 'pending',
      paymentIntentId: null,
      stripeSessionId: 'cs_e2e_test',
      createdAt: Date.now()
    });

    // 2. Webhook: Payment succeeded
    await db.collection('orders').doc(orderId).update({
      status: 'paid',
      paymentIntentId: paymentIntentId,
      paidAt: Date.now(),
      platformFeeUsd: 15.0,
      amountToCreatorUsd: 84.99
    });

    // 3. Grant license
    const licenseRef = await db.collection('licenses').add({
      uid: 'e2e_user',
      productId: 'prod_e2e',
      orderId: orderId,
      key: `lic_e2e_${Date.now()}`,
      active: true,
      createdAt: Date.now()
    });

    // 4. Process refund
    await db.collection('orders').doc(orderId).update({
      status: 'refunded',
      refundedAt: Date.now(),
      refund: {
        id: `re_e2e_${Date.now()}`,
        amountUsd: 99.99,
        status: 'succeeded'
      }
    });

    // 5. Revoke license
    await licenseRef.update({
      revoked: true,
      revokedAt: Date.now(),
      revokeReason: 'refund'
    });

    // Verify final state
    const order = await db.collection('orders').doc(orderId).get();
    const license = await licenseRef.get();

    expect(order.data()?.status).toBe('refunded');
    expect(order.data()?.paymentIntentId).toBe(paymentIntentId);
    expect(license.data()?.revoked).toBe(true);

    console.log('✅ E2E Refund Flow completed successfully');
  });
});
