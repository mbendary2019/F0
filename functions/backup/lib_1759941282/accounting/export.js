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
exports.accountingMonthlyExport = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const storage_1 = require("firebase-admin/storage");
const requireAdmin = (ctx) => {
    var _a, _b;
    if (!((_b = (_a = ctx.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.admin))
        throw new functions.https.HttpsError("permission-denied", "Admin only");
};
function monthRange(month) {
    // month = "YYYY-MM"
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).getTime();
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0)).getTime() - 1;
    return { start, end };
}
async function getGL(db) {
    const snap = await db.collection("config").doc("accounting_gl").get();
    if (!snap.exists) {
        // Default GL mapping
        return {
            revenue: "4000",
            platformFees: "4050",
            creatorPayouts: "5000",
            refunds: "4090",
            cash: "1000",
            ar: "1100",
        };
    }
    return snap.data() || {};
}
function csv(rows) {
    return rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}
exports.accountingMonthlyExport = functions.https.onCall(async (payload, ctx) => {
    var _a, _b, _c, _d;
    requireAdmin(ctx);
    const { month } = payload; // "YYYY-MM"
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid month format (expected YYYY-MM)");
    }
    const db = admin.firestore();
    const { start, end } = monthRange(month);
    const gl = await getGL(db);
    // 1) Fetch orders
    const ordersSnap = await db
        .collection("orders")
        .where("status", "==", "paid")
        .where("paidAt", ">=", start)
        .where("paidAt", "<=", end)
        .get();
    const orders = ordersSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    // 2) Fetch refunds
    const refundsSnap = await db
        .collection("orders")
        .where("status", "==", "refunded")
        .where("refundedAt", ">=", start)
        .where("refundedAt", "<=", end)
        .get();
    const refunds = refundsSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    // 3) Build journal entries (double-entry)
    const journal = [
        ["Date", "Account", "Debit", "Credit", "Description", "Reference"],
    ];
    // Orders: DR Cash/AR, CR Revenue, CR Platform Fees, DR Creator Payouts
    for (const o of orders) {
        const date = new Date(o.paidAt).toISOString().split("T")[0];
        const gross = Number(o.amountUsd || 0);
        const platformFee = Number(o.platformFeeUsd || 0);
        const revenue = gross - platformFee;
        const creatorPayout = Number(o.amountToCreatorUsd || revenue);
        // DR Cash (or A/R if unpaid - but we only process "paid")
        journal.push([date, gl.cash, gross.toFixed(2), "0.00", `Order ${o.id}`, o.id]);
        // CR Revenue
        journal.push([date, gl.revenue, "0.00", revenue.toFixed(2), `Order ${o.id} revenue`, o.id]);
        // CR Platform Fees
        journal.push([date, gl.platformFees, "0.00", platformFee.toFixed(2), `Order ${o.id} platform fee`, o.id]);
        // DR Creator Payouts (expense)
        journal.push([date, gl.creatorPayouts, creatorPayout.toFixed(2), "0.00", `Order ${o.id} creator payout`, o.id]);
    }
    // Refunds: DR Refunds (contra-revenue), CR Cash
    for (const r of refunds) {
        const date = new Date(r.refundedAt).toISOString().split("T")[0];
        const amt = Number(((_a = r.refund) === null || _a === void 0 ? void 0 : _a.amountUsd) || r.amountUsd || 0);
        // DR Refunds (contra-revenue account)
        journal.push([date, gl.refunds, amt.toFixed(2), "0.00", `Refund ${r.id}`, r.id]);
        // CR Cash
        journal.push([date, gl.cash, "0.00", amt.toFixed(2), `Refund ${r.id}`, r.id]);
    }
    // 4) Build orders detail CSV
    const ordersCSV = [
        ["OrderID", "Date", "Gross", "Platform Fee", "Creator Payout", "Product ID", "Buyer UID"],
    ];
    for (const o of orders) {
        ordersCSV.push([
            o.id,
            new Date(o.paidAt).toISOString().split("T")[0],
            (o.amountUsd || 0).toFixed(2),
            (o.platformFeeUsd || 0).toFixed(2),
            (o.amountToCreatorUsd || 0).toFixed(2),
            o.productId || "",
            o.uid || "",
        ]);
    }
    // 5) Build refunds detail CSV
    const refundsCSV = [["OrderID", "Date", "Amount", "Product ID", "Buyer UID"]];
    for (const r of refunds) {
        refundsCSV.push([
            r.id,
            new Date(r.refundedAt).toISOString().split("T")[0],
            (((_b = r.refund) === null || _b === void 0 ? void 0 : _b.amountUsd) || r.amountUsd || 0).toFixed(2),
            r.productId || "",
            r.uid || "",
        ]);
    }
    // 6) Upload to Storage
    const bucket = (0, storage_1.getStorage)().bucket();
    const basePath = `platform_accounting/${month}`;
    const journalContent = csv(journal);
    const ordersContent = csv(ordersCSV);
    const refundsContent = csv(refundsCSV);
    await bucket.file(`${basePath}/journal.csv`).save(journalContent, { contentType: "text/csv" });
    await bucket.file(`${basePath}/orders.csv`).save(ordersContent, { contentType: "text/csv" });
    await bucket.file(`${basePath}/refunds.csv`).save(refundsContent, { contentType: "text/csv" });
    // Signed URLs (7 days)
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const [journalURL] = await bucket.file(`${basePath}/journal.csv`).getSignedUrl({
        action: "read",
        expires: exp,
    });
    const [ordersURL] = await bucket.file(`${basePath}/orders.csv`).getSignedUrl({
        action: "read",
        expires: exp,
    });
    const [refundsURL] = await bucket.file(`${basePath}/refunds.csv`).getSignedUrl({
        action: "read",
        expires: exp,
    });
    // 7) Store metadata in Firestore
    await db
        .collection("platform_accounting")
        .doc("files")
        .collection("months")
        .doc(month)
        .set({
        month,
        generatedAt: Date.now(),
        generatedBy: ((_c = ctx.auth) === null || _c === void 0 ? void 0 : _c.uid) || "system",
        journal: { path: `${basePath}/journal.csv`, url: journalURL },
        orders: { path: `${basePath}/orders.csv`, url: ordersURL },
        refunds: { path: `${basePath}/refunds.csv`, url: refundsURL },
        ordersCount: orders.length,
        refundsCount: refunds.length,
    });
    await db.collection("audit_logs").add({
        ts: Date.now(),
        kind: "accounting_export_generated",
        actor: ((_d = ctx.auth) === null || _d === void 0 ? void 0 : _d.uid) || "system",
        meta: { month, ordersCount: orders.length, refundsCount: refunds.length },
    });
    return {
        month,
        journal: journalURL,
        orders: ordersURL,
        refunds: refundsURL,
        ordersCount: orders.length,
        refundsCount: refunds.length,
    };
});
//# sourceMappingURL=export.js.map