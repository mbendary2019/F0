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
exports.reconcileTransfersHourly = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const functions = __importStar(require("firebase-functions"));
const stripe = new stripe_1.default(((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" });
/**
 * Hourly job to reconcile Stripe Connect transfers with orders
 * Validates that transfer destination matches expected creator account
 */
exports.reconcileTransfersHourly = (0, scheduler_1.onSchedule)("every 60 minutes", async () => {
    var _a, _b, _c, _d;
    const db = admin.firestore();
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000; // Last 7 days
    // Find paid orders that haven't been reconciled yet
    const q = await db
        .collection("orders")
        .where("status", "==", "paid")
        .where("paidAt", ">", since)
        .where("transferReconciled", "==", false)
        .limit(200)
        .get();
    for (const d of q.docs) {
        const o = d.data();
        const pi = o.paymentIntentId;
        if (!pi)
            continue;
        try {
            // Retrieve payment intent and charges with transfer data
            const intent = await stripe.paymentIntents.retrieve(pi, {
                expand: ["charges.data.transfer_data"],
            });
            const ch = (_b = (_a = intent.charges) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b[0];
            const dest = ((_c = ch === null || ch === void 0 ? void 0 : ch.transfer_data) === null || _c === void 0 ? void 0 : _c.destination) ||
                ((_d = intent.transfer_data) === null || _d === void 0 ? void 0 : _d.destination) ||
                null;
            // Match expected creator account
            const expected = o.creatorStripeAccountId || null;
            const match = expected ? String(dest) === String(expected) : !!dest;
            await d.ref.set({
                transferDestinationAccount: dest || null,
                transferReconciled: !!match,
                reconciledAt: Date.now(),
            }, { merge: true });
            // Alert on mismatch
            if (!match) {
                await db.collection("audit_logs").add({
                    ts: Date.now(),
                    kind: "transfer_mismatch",
                    meta: {
                        orderId: d.id,
                        expected,
                        actual: dest,
                        pi,
                    },
                });
                console.warn(`⚠️ Transfer mismatch: order=${d.id}, expected=${expected}, actual=${dest}`);
            }
        }
        catch (err) {
            console.error(`Failed to reconcile order ${d.id}:`, err.message);
            // Continue with other orders
        }
    }
    console.log(`✅ Reconciled ${q.size} orders`);
});
//# sourceMappingURL=reconcile.js.map