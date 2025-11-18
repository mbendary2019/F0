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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertsWatcherQuarterHour = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const REFUND_MIN = Number(((_a = functions.config().alerts) === null || _a === void 0 ? void 0 : _a.large_refund_usd) || 100);
const DISPUTE_BURST = Number(((_b = functions.config().alerts) === null || _b === void 0 ? void 0 : _b.disputes_threshold) || 3);
/**
 * Runs every 15 minutes to watch for:
 * - Large refunds (≥ configurable threshold)
 * - Dispute bursts (≥ threshold in 24h)
 * Sends Slack alerts if configured
 */
exports.alertsWatcherQuarterHour = (0, scheduler_1.onSchedule)("every 15 minutes", async () => {
    var _a;
    const db = admin.firestore();
    const hook = (_a = functions.config().alerts) === null || _a === void 0 ? void 0 : _a.slack_webhook;
    const since = Date.now() - 24 * 60 * 60 * 1000;
    // Check for large refunds in last 24 hours
    const rs = await db
        .collection("orders")
        .where("status", "==", "refunded")
        .where("refundedAt", ">", since)
        .limit(200)
        .get();
    const big = rs.docs.filter((d) => {
        var _a, _b;
        const refundAmount = Number(((_b = (_a = d.data()) === null || _a === void 0 ? void 0 : _a.refund) === null || _b === void 0 ? void 0 : _b.amountUsd) || 0);
        return refundAmount >= REFUND_MIN;
    });
    if (hook && big.length) {
        try {
            await fetch(hook, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: `🔔 *Large Refunds Alert*\n${big.length} refund(s) in last 24h (≥ $${REFUND_MIN})`,
                }),
            });
            console.log(`✅ Sent large refund alert: ${big.length} refunds`);
        }
        catch (err) {
            console.error("Failed to send Slack alert for refunds:", err.message);
        }
    }
    // Check for dispute burst in last 24 hours
    const ds = await db.collection("disputes").where("createdAt", ">", since).get();
    if (hook && ds.size >= DISPUTE_BURST) {
        try {
            await fetch(hook, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: `🚨 *Dispute Burst Alert*\n${ds.size} dispute(s) in last 24h (threshold: ${DISPUTE_BURST})`,
                }),
            });
            console.log(`✅ Sent dispute burst alert: ${ds.size} disputes`);
        }
        catch (err) {
            console.error("Failed to send Slack alert for disputes:", err.message);
        }
    }
    // Log alert check
    await db.collection("audit_logs").add({
        ts: Date.now(),
        kind: "alerts_check",
        actor: "system",
        meta: {
            largeRefunds: big.length,
            disputes: ds.size,
            alertsSent: (big.length > 0 || ds.size >= DISPUTE_BURST) && !!hook,
        },
    });
});
//# sourceMappingURL=refundWatcher.js.map