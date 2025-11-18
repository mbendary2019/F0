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
exports.creatorPayoutsDaily = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" });
/**
 * Daily job to fetch and reconcile payouts for all creators from Stripe Connect
 * Stores payouts under: creator_payouts/{creatorUid}/payouts/{payoutId}
 * Also computes simple 30-day aggregate: creator_payouts/{creatorUid}/agg_last30
 */
exports.creatorPayoutsDaily = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    const db = admin.firestore();
    const since = Date.now() - 24 * 60 * 60 * 1000;
    // Collect list of creators who have recent paid orders
    const os = await db
        .collection("orders")
        .where("status", "==", "paid")
        .where("paidAt", ">", since)
        .get();
    const creators = new Map(); // uid -> stripe account
    for (const d of os.docs) {
        const o = d.data();
        if (o.creatorUid && o.creatorStripeAccountId) {
            creators.set(o.creatorUid, o.creatorStripeAccountId);
        }
    }
    if (!creators.size) {
        console.log("No creators with recent orders found");
        return;
    }
    for (const [uid, acct] of creators) {
        try {
            // Fetch payouts from creator's connected account
            const payouts = await stripe.payouts.list({ limit: 50 }, { stripeAccount: acct });
            const col = db.collection("creator_payouts").doc(uid).collection("payouts");
            for (const p of payouts.data) {
                // Only process payouts from last 24 hours
                const createdMs = (p.created || 0) * 1000;
                if (createdMs < since)
                    continue;
                await col.doc(p.id).set({
                    id: p.id,
                    amountUsd: (p.amount || 0) / 100,
                    currency: p.currency,
                    status: p.status,
                    arrivalDate: p.arrival_date ? p.arrival_date * 1000 : null,
                    createdAt: createdMs,
                    stripeAccount: acct,
                    type: p.type || "payout",
                }, { merge: true });
            }
            // Compute simple 30-day aggregate
            const monthSince = Date.now() - 30 * 24 * 60 * 60 * 1000;
            const ps = await col.where("createdAt", ">", monthSince).get();
            let total = 0;
            let cnt = 0;
            for (const d of ps.docs) {
                const x = d.data();
                total += Number(x.amountUsd || 0);
                cnt++;
            }
            await db
                .collection("creator_payouts")
                .doc(uid)
                .set({
                agg_last30: {
                    count: cnt,
                    amountUsd: Math.round(total * 100) / 100,
                    ts: Date.now(),
                },
            }, { merge: true });
            console.log(`✅ Updated payouts for creator ${uid} (${cnt} payouts)`);
        }
        catch (err) {
            console.error(`Failed to fetch payouts for creator ${uid}:`, err.message);
        }
    }
    console.log(`📊 Processed payouts for ${creators.size} creators`);
});
//# sourceMappingURL=payouts.js.map