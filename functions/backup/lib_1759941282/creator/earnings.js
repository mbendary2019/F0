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
exports.creatorEarningsDaily = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
/**
 * Daily job to aggregate creator earnings from paid orders
 * Creates/updates analytics_creator documents with last24h metrics
 */
exports.creatorEarningsDaily = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    const db = admin.firestore();
    const since = Date.now() - 24 * 60 * 60 * 1000;
    // Get all paid orders from last 24 hours
    const q = await db
        .collection("orders")
        .where("status", "==", "paid")
        .where("paidAt", ">", since)
        .get();
    // Aggregate by creator
    const byCreator = new Map();
    for (const d of q.docs) {
        const o = d.data();
        const uid = o.creatorUid || null;
        if (!uid)
            continue;
        const cur = byCreator.get(uid) || { orders: 0, gross: 0, platform: 0, net: 0 };
        const gross = Number(o.amountUsd || 0);
        const platform = Number(o.platformFeeUsd || 0);
        const net = Number(o.amountToCreatorUsd || gross - platform);
        cur.orders += 1;
        cur.gross += gross;
        cur.platform += platform;
        cur.net += net;
        byCreator.set(uid, cur);
    }
    // Batch update analytics_creator documents
    const batch = db.batch();
    for (const [uid, s] of byCreator) {
        const doc = db.collection("analytics_creator").doc(uid);
        batch.set(doc, {
            ts: Date.now(),
            last24h: {
                orders: s.orders,
                grossUsd: Math.round(s.gross * 100) / 100,
                platformUsd: Math.round(s.platform * 100) / 100,
                netUsd: Math.round(s.net * 100) / 100,
            },
        }, { merge: true });
    }
    await batch.commit();
    console.log(`📊 Creator earnings updated for ${byCreator.size} creators`);
});
//# sourceMappingURL=earnings.js.map