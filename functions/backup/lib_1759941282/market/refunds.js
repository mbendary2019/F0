"use strict";
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundOrder = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2024-06-20",
});
function requireAdmin(ctx) {
    var _a;
    const t = (((_a = ctx.auth) === null || _a === void 0 ? void 0 : _a.token) || {});
    if (!ctx.auth || !t.admin) {
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    }
}
/**
 * Refund an order via Stripe and revoke the associated license
 */
exports.refundOrder = functions.https.onCall(async (payload, ctx) => {
    var _a;
    requireAdmin(ctx);
    const { orderId, amountUsd } = (payload || {});
    if (!orderId) {
        throw new functions.https.HttpsError("invalid-argument", "orderId required");
    }
    const db = admin.firestore();
    const ref = db.collection("orders").doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Order not found");
    }
    const o = snap.data();
    // Already refunded
    if (o.status === "refunded") {
        return { ok: true, already: true };
    }
    // Retrieve payment intent (with fallback for legacy orders)
    const paymentIntentId = o.paymentIntentId || o.stripePaymentIntent || null;
    if (!paymentIntentId) {
        throw new functions.https.HttpsError("failed-precondition", "paymentIntentId missing on order");
    }
    // Create refund in Stripe
    const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountUsd ? Math.round(Number(amountUsd) * 100) : undefined,
        reason: "requested_by_customer",
    });
    // Mark order as refunded
    await ref.set({
        status: "refunded",
        refundedAt: Date.now(),
        refund: {
            id: refund.id,
            amountUsd: refund.amount ? refund.amount / 100 : o.amountUsd,
            status: refund.status,
        },
    }, { merge: true });
    // Revoke license (if one exists)
    if (o.licenseId) {
        await db
            .collection("licenses")
            .doc(o.licenseId)
            .set({
            revoked: true,
            revokedAt: Date.now(),
            revokeReason: "refund",
        }, { merge: true });
    }
    else {
        // Best-effort: find first license by orderId
        const licSnap = await db
            .collection("licenses")
            .where("orderId", "==", orderId)
            .limit(1)
            .get();
        if (!licSnap.empty) {
            await licSnap.docs[0].ref.set({
                revoked: true,
                revokedAt: Date.now(),
                revokeReason: "refund",
            }, { merge: true });
        }
    }
    // Audit log
    await db.collection("audit_logs").add({
        ts: Date.now(),
        kind: "order_refund",
        actor: (_a = ctx.auth) === null || _a === void 0 ? void 0 : _a.uid,
        meta: {
            orderId,
            amountUsd: amountUsd !== null && amountUsd !== void 0 ? amountUsd : o.amountUsd,
        },
    });
    return { ok: true, refundId: refund.id };
});
//# sourceMappingURL=refunds.js.map