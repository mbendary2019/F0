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
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountingDailyRollup = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
exports.accountingDailyRollup = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    var _a;
    const db = admin.firestore();
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const dayKey = new Date(dayAgo).toISOString().split("T")[0]; // YYYY-MM-DD
    // Fetch orders paid in last 24h
    const ordersSnap = await db
        .collection("orders")
        .where("status", "==", "paid")
        .where("paidAt", ">=", dayAgo)
        .where("paidAt", "<=", now)
        .get();
    let revenueUsd = 0;
    let platformFeesUsd = 0;
    let creatorPayoutsUsd = 0;
    for (const doc of ordersSnap.docs) {
        const o = doc.data();
        const gross = Number(o.amountUsd || 0);
        const fee = Number(o.platformFeeUsd || 0);
        const payout = Number(o.amountToCreatorUsd || (gross - fee));
        revenueUsd += gross - fee;
        platformFeesUsd += fee;
        creatorPayoutsUsd += payout;
    }
    // Fetch refunds in last 24h
    const refundsSnap = await db
        .collection("orders")
        .where("status", "==", "refunded")
        .where("refundedAt", ">=", dayAgo)
        .where("refundedAt", "<=", now)
        .get();
    let refundsUsd = 0;
    for (const doc of refundsSnap.docs) {
        const r = doc.data();
        refundsUsd += Number(((_a = r.refund) === null || _a === void 0 ? void 0 : _a.amountUsd) || r.amountUsd || 0);
    }
    // Store in analytics_accounting/daily/{dayKey}
    await db
        .collection("analytics_accounting")
        .doc("daily")
        .collection("days")
        .doc(dayKey)
        .set({
        dayKey,
        revenueUsd: Math.round(revenueUsd * 100) / 100,
        platformFeesUsd: Math.round(platformFeesUsd * 100) / 100,
        creatorPayoutsUsd: Math.round(creatorPayoutsUsd * 100) / 100,
        refundsUsd: Math.round(refundsUsd * 100) / 100,
        ordersCount: ordersSnap.size,
        refundsCount: refundsSnap.size,
        computedAt: Date.now(),
    });
    console.log(`[accountingDailyRollup] ${dayKey}: revenue=${revenueUsd}, platformFees=${platformFeesUsd}, refunds=${refundsUsd}`);
});
//# sourceMappingURL=daily.js.map