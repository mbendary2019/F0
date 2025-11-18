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
exports.analyticsAdvancedDaily = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
/**
 * Advanced analytics daily aggregation
 * Computes 24h/7d metrics, top products, coupon usage
 */
exports.analyticsAdvancedDaily = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    const db = admin.firestore();
    const now = Date.now();
    const d1 = now - 24 * 60 * 60 * 1000;
    const d7 = now - 7 * 24 * 60 * 60 * 1000;
    const orders24 = await db
        .collection("orders")
        .where("status", "==", "paid")
        .where("paidAt", ">", d1)
        .get();
    const orders7 = await db
        .collection("orders")
        .where("status", "==", "paid")
        .where("paidAt", ">", d7)
        .get();
    function collect(orders) {
        var _a, _b, _c;
        let ordersCount = 0, rev = 0, plat = 0, creators = 0;
        const byProduct = new Map();
        const byCoupon = new Map();
        for (const d of orders.docs) {
            const o = d.data();
            ordersCount++;
            const amount = Number(o.amountUsd || 0);
            const platformFee = Number(o.platformFeeUsd || 0);
            const toCreator = Number(o.amountToCreatorUsd || amount - platformFee);
            rev += amount;
            plat += platformFee;
            creators += toCreator;
            const pid = o.productId || ((_a = o.product) === null || _a === void 0 ? void 0 : _a.id) || null;
            if (pid) {
                const cur = byProduct.get(pid) || {
                    productId: pid,
                    title: (_b = o.product) === null || _b === void 0 ? void 0 : _b.title,
                    orders: 0,
                    revenueUsd: 0,
                };
                cur.orders += 1;
                cur.revenueUsd += amount;
                byProduct.set(pid, cur);
            }
            const code = (o.couponCode || ((_c = o.metadata) === null || _c === void 0 ? void 0 : _c.couponCode) || "").toUpperCase();
            if (code) {
                const cur = byCoupon.get(code) || { code, orders: 0, revenueUsd: 0 };
                cur.orders += 1;
                cur.revenueUsd += amount;
                byCoupon.set(code, cur);
            }
        }
        const topProducts = Array.from(byProduct.values())
            .sort((a, b) => b.revenueUsd - a.revenueUsd)
            .slice(0, 10);
        const couponUsage = Array.from(byCoupon.values())
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 10);
        return {
            summary: {
                orders: ordersCount,
                revenueUsd: Math.round(rev * 100) / 100,
                platformUsd: Math.round(plat * 100) / 100,
                creatorsUsd: Math.round(creators * 100) / 100,
            },
            topProducts,
            couponUsage,
        };
    }
    const s24 = collect(orders24);
    const s7 = collect(orders7);
    await db
        .collection("analytics")
        .doc("advanced_daily")
        .set({
        ts: now,
        last24h: s24.summary,
        last7d: s7.summary,
        topProducts24h: s24.topProducts,
        topProducts7d: s7.topProducts,
        couponUsage24h: s24.couponUsage,
        couponUsage7d: s7.couponUsage,
    }, { merge: true });
    console.log(`📊 Advanced analytics computed: 24h=${s24.summary.orders} orders, 7d=${s7.summary.orders} orders`);
});
//# sourceMappingURL=advancedDaily.js.map