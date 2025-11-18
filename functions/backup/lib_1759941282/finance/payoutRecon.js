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
exports.creatorPayoutReconDaily = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const functions = __importStar(require("firebase-functions"));
const stripe = new stripe_1.default(((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" });
/**
 * Daily job to reconcile creator payouts with orders
 * Compares net earnings from orders vs actual Stripe payouts
 * Writes daily deltas to: creator_payouts/{uid}/recon/{YYYYMMDD}
 */
exports.creatorPayoutReconDaily = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    var _a;
    const db = admin.firestore();
    const since = Date.now() - 24 * 60 * 60 * 1000;
    // Get all paid orders from last 24 hours
    const orders = await db
        .collection("orders")
        .where("status", "==", "paid")
        .where("paidAt", ">", since)
        .get();
    // Aggregate net earnings by creator
    const byCreator = new Map();
    for (const d of orders.docs) {
        const o = d.data();
        if (!o.creatorUid || !o.creatorStripeAccountId)
            continue;
        const net = Number((_a = o.amountToCreatorUsd) !== null && _a !== void 0 ? _a : Number(o.amountUsd || 0) - Number(o.platformFeeUsd || 0));
        const cur = byCreator.get(o.creatorUid) || {
            acct: o.creatorStripeAccountId,
            net: 0,
        };
        cur.net += net;
        byCreator.set(o.creatorUid, cur);
    }
    // Generate day key: YYYYMMDD
    const dayKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    for (const [uid, v] of byCreator) {
        try {
            // Fetch payouts from creator's connected account for last 24 hours
            const payouts = await stripe.payouts.list({ limit: 50 }, { stripeAccount: v.acct });
            const sum = payouts.data
                .filter((p) => (p.created * 1000) > since)
                .reduce((a, p) => a + (p.amount || 0) / 100, 0);
            const netFromOrders = Math.round(v.net * 100) / 100;
            const payoutsAmount = Math.round(sum * 100) / 100;
            const delta = Math.round((v.net - sum) * 100) / 100;
            await db
                .collection("creator_payouts")
                .doc(uid)
                .collection("recon")
                .doc(dayKey)
                .set({
                ts: Date.now(),
                netFromOrdersUsd: netFromOrders,
                payoutsUsd: payoutsAmount,
                deltaUsd: delta,
            }, { merge: true });
            if (Math.abs(delta) > 1) {
                console.warn(`⚠️ Payout reconciliation mismatch for creator ${uid}: orders=$${netFromOrders}, payouts=$${payoutsAmount}, delta=$${delta}`);
            }
        }
        catch (err) {
            console.error(`Failed to reconcile payouts for creator ${uid}:`, err.message);
        }
    }
    console.log(`✅ Reconciled payouts for ${byCreator.size} creators`);
});
//# sourceMappingURL=payoutRecon.js.map