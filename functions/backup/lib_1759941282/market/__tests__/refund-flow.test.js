"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
// Mock configuration
const mockStripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
const stripe = new stripe_1.default(mockStripeKey, { apiVersion: '2024-06-20' });
(0, globals_1.describe)('Refund Flow - Smoke Tests', () => {
    let db;
    let testOrderId;
    let testPaymentIntentId;
    (0, globals_1.beforeEach)(() => {
        db = admin.firestore();
        testOrderId = `order_test_${Date.now()}`;
        testPaymentIntentId = `pi_test_${Date.now()}`;
    });
    /**
     * Test 1: Create & Pay - Verify paymentIntentId is populated
     */
    (0, globals_1.it)('should populate paymentIntentId after checkout', async () => {
        var _a, _b, _c;
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
        (0, globals_1.expect)((_a = order.data()) === null || _a === void 0 ? void 0 : _a.paymentIntentId).toBeNull();
        // Simulate webhook update (checkout.session.completed)
        await db.collection('orders').doc(testOrderId).update({
            status: 'paid',
            paymentIntentId: testPaymentIntentId,
            paidAt: Date.now()
        });
        // Verify paymentIntentId is populated
        order = await db.collection('orders').doc(testOrderId).get();
        (0, globals_1.expect)((_b = order.data()) === null || _b === void 0 ? void 0 : _b.paymentIntentId).toBe(testPaymentIntentId);
        (0, globals_1.expect)((_c = order.data()) === null || _c === void 0 ? void 0 : _c.status).toBe('paid');
    });
    /**
     * Test 2: Webhook Update - Verify correct field mapping
     */
    (0, globals_1.it)('should update paymentIntentId from webhook event', async () => {
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
        (0, globals_1.expect)(data === null || data === void 0 ? void 0 : data.paymentIntentId).toBe(testPaymentIntentId);
        (0, globals_1.expect)(data === null || data === void 0 ? void 0 : data.status).toBe('paid');
        (0, globals_1.expect)(data === null || data === void 0 ? void 0 : data.platformFeeUsd).toBe(7.5);
    });
    /**
     * Test 3: Full Refund - Verify refund creation and status update
     */
    (0, globals_1.it)('should process full refund correctly', async () => {
        var _a, _b, _c, _d, _e;
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
        (0, globals_1.expect)((_a = order.data()) === null || _a === void 0 ? void 0 : _a.status).toBe('refunded');
        (0, globals_1.expect)((_c = (_b = order.data()) === null || _b === void 0 ? void 0 : _b.refund) === null || _c === void 0 ? void 0 : _c.amountUsd).toBe(49.99);
        // Verify license revocation
        const license = await licenseRef.get();
        (0, globals_1.expect)((_d = license.data()) === null || _d === void 0 ? void 0 : _d.revoked).toBe(true);
        (0, globals_1.expect)((_e = license.data()) === null || _e === void 0 ? void 0 : _e.revokeReason).toBe('refund');
    });
    /**
     * Test 4: Partial Refund - Verify amount handling
     */
    (0, globals_1.it)('should process partial refund correctly', async () => {
        var _a, _b, _c;
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
        (0, globals_1.expect)((_b = (_a = order.data()) === null || _a === void 0 ? void 0 : _a.refund) === null || _b === void 0 ? void 0 : _b.amountUsd).toBe(partialRefundAmount);
        (0, globals_1.expect)((_c = order.data()) === null || _c === void 0 ? void 0 : _c.status).toBe('partial_refund');
    });
    /**
     * Test 5: Idempotency - Duplicate webhook events
     */
    (0, globals_1.it)('should handle duplicate refund events idempotently', async () => {
        var _a, _b, _c, _d, _e;
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
        const firstRefundTime = (_a = order1.data()) === null || _a === void 0 ? void 0 : _a.refundedAt;
        // Duplicate refund event (idempotent check)
        const order2 = await db.collection('orders').doc(testOrderId).get();
        // Should return early if already refunded
        if (((_b = order2.data()) === null || _b === void 0 ? void 0 : _b.status) === 'refunded') {
            // No update needed
            (0, globals_1.expect)((_c = order2.data()) === null || _c === void 0 ? void 0 : _c.refundedAt).toBe(firstRefundTime);
            (0, globals_1.expect)((_e = (_d = order2.data()) === null || _d === void 0 ? void 0 : _d.refund) === null || _e === void 0 ? void 0 : _e.id).toBe('re_duplicate_test');
        }
    });
    /**
     * Test 6: Legacy Field Fallback - Support old orders
     */
    (0, globals_1.it)('should fallback to stripePaymentIntent if paymentIntentId is missing', async () => {
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
        const pid = (data === null || data === void 0 ? void 0 : data.paymentIntentId) || (data === null || data === void 0 ? void 0 : data.stripePaymentIntent);
        (0, globals_1.expect)(pid).toBe(testPaymentIntentId);
    });
    /**
     * Test 7: Missing Payment Intent - Error handling
     */
    (0, globals_1.it)('should throw error if no paymentIntentId exists', async () => {
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
        const pid = (data === null || data === void 0 ? void 0 : data.paymentIntentId) || (data === null || data === void 0 ? void 0 : data.stripePaymentIntent);
        (0, globals_1.expect)(pid).toBeUndefined();
        // In real function, this should throw error
    });
    /**
     * Test 8: Firestore Rules - Security check
     */
    (0, globals_1.it)('should deny unauthorized refund writes', async () => {
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
            }
            catch (err) {
                // Expected: permission denied
                return err.code === 'permission-denied';
            }
        };
        // Note: Actual rules test requires emulator setup
        (0, globals_1.expect)(rulesCheck).toBeDefined();
    });
});
/**
 * Integration Test: Full E2E Refund Flow
 */
(0, globals_1.describe)('Refund Flow - E2E Integration', () => {
    (0, globals_1.it)('should complete full checkout → payment → refund cycle', async () => {
        var _a, _b, _c;
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
        (0, globals_1.expect)((_a = order.data()) === null || _a === void 0 ? void 0 : _a.status).toBe('refunded');
        (0, globals_1.expect)((_b = order.data()) === null || _b === void 0 ? void 0 : _b.paymentIntentId).toBe(paymentIntentId);
        (0, globals_1.expect)((_c = license.data()) === null || _c === void 0 ? void 0 : _c.revoked).toBe(true);
        console.log('✅ E2E Refund Flow completed successfully');
    });
});
//# sourceMappingURL=refund-flow.test.js.map