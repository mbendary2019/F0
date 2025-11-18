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
exports.analyticsDaily = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
/**
 * Daily analytics aggregation
 * Runs every 24 hours to compute metrics
 */
exports.analyticsDaily = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    const db = admin.firestore();
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    // Aggregate orders in last 24h
    const ordersSnap = await db
        .collection("orders")
        .where("createdAt", ">", last24h)
        .get();
    const totalOrders = ordersSnap.size;
    let totalRevenue = 0;
    let platformRevenue = 0;
    let creatorRevenue = 0;
    ordersSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.status === "paid") {
            const amount = data.amountUsd || 0;
            totalRevenue += amount;
            platformRevenue += data.platformFeeUsd || 0;
            creatorRevenue += data.amountToCreatorUsd || 0;
        }
    });
    // Store daily snapshot
    const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    await db.collection("analytics_daily").doc(dateKey).set({
        date: dateKey,
        totalOrders,
        totalRevenue,
        platformRevenue,
        creatorRevenue,
        computedAt: now,
    });
    console.log(`📊 Daily analytics computed: ${totalOrders} orders, $${totalRevenue.toFixed(2)} revenue`);
});
//# sourceMappingURL=daily.js.map