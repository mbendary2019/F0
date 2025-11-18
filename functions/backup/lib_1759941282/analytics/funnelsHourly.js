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
exports.analyticsFunnelsHourly = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
/**
 * Funnels analytics hourly aggregation
 * Tracks view → checkout → purchase conversion rates
 */
exports.analyticsFunnelsHourly = (0, scheduler_1.onSchedule)("every 60 minutes", async () => {
    var _a;
    const db = admin.firestore();
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const evSnap = await db.collection("events").where("ts", ">", since).get();
    const viewByProduct = new Map();
    const startByProduct = new Map();
    for (const d of evSnap.docs) {
        const e = d.data();
        if (e.kind === "view_product" && e.productId) {
            viewByProduct.set(e.productId, (viewByProduct.get(e.productId) || 0) + 1);
        }
        if (e.kind === "start_checkout" && e.productId) {
            startByProduct.set(e.productId, (startByProduct.get(e.productId) || 0) + 1);
        }
    }
    const orders = await db.collection("orders").where("paidAt", ">", since).get();
    const buyByProduct = new Map();
    for (const d of orders.docs) {
        const o = d.data();
        const pid = o.productId || ((_a = o.product) === null || _a === void 0 ? void 0 : _a.id);
        if (pid)
            buyByProduct.set(pid, (buyByProduct.get(pid) || 0) + 1);
    }
    const rows = [];
    const pids = new Set([
        ...viewByProduct.keys(),
        ...startByProduct.keys(),
        ...buyByProduct.keys(),
    ]);
    pids.forEach((pid) => {
        const v = viewByProduct.get(pid) || 0;
        const s = startByProduct.get(pid) || 0;
        const b = buyByProduct.get(pid) || 0;
        const v2c = v ? Math.round((s / v) * 1000) / 10 : 0; // %
        const c2p = s ? Math.round((b / s) * 1000) / 10 : 0; // %
        const v2p = v ? Math.round((b / v) * 1000) / 10 : 0; // %
        rows.push({
            productId: pid,
            views24h: v,
            starts24h: s,
            buys24h: b,
            viewToCheckoutPct: v2c,
            checkoutToPurchasePct: c2p,
            viewToPurchasePct: v2p,
        });
    });
    await db
        .collection("analytics")
        .doc("funnels_1h")
        .set({ ts: Date.now(), rows }, { merge: true });
    console.log(`📊 Funnels computed: ${rows.length} products analyzed`);
});
//# sourceMappingURL=funnelsHourly.js.map