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
exports.exportTaxReport = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const storage_1 = require("firebase-admin/storage");
exports.exportTaxReport = functions.https.onCall(async (payload, ctx) => {
    var _a;
    const t = (((_a = ctx.auth) === null || _a === void 0 ? void 0 : _a.token) || {});
    if (!ctx.auth || !t.admin) {
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    }
    const { start, end } = payload || {};
    if (!start || !end) {
        throw new functions.https.HttpsError("invalid-argument", "start/end ms required");
    }
    const db = admin.firestore();
    const bucket = (0, storage_1.getStorage)().bucket();
    const snap = await db
        .collection("orders")
        .where("status", "==", "paid")
        .where("paidAt", ">=", start)
        .where("paidAt", "<", end)
        .get();
    const hdr = [
        "orderId",
        "paidAt",
        "currency",
        "grossUsd",
        "taxUsd",
        "jurisdiction",
        "customerTaxId",
        "taxExempt",
    ];
    const rows = [hdr];
    let totalTax = 0;
    const byJur = {};
    for (const d of snap.docs) {
        const o = d.data();
        totalTax += Number(o.taxUsd || 0);
        const j = o.taxJurisdiction || "N/A";
        byJur[j] = (byJur[j] || 0) + Number(o.taxUsd || 0);
        rows.push([
            d.id,
            String(o.paidAt || ""),
            o.currency || "USD",
            Number(o.amountUsd || 0).toFixed(2),
            Number(o.taxUsd || 0).toFixed(2),
            j,
            o.customerTaxId || "",
            o.taxExempt || "none",
        ]);
    }
    rows.push([]);
    rows.push(["TOTAL_TAX_USD", totalTax.toFixed(2)]);
    Object.entries(byJur).forEach(([k, v]) => rows.push([`JUR_${k}`, v.toFixed(2)]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const p = `tax_reports/${Date.now()}.csv`;
    await bucket.file(p).save(Buffer.from(csv), {
        contentType: "text/csv",
        resumable: false,
    });
    const [url] = await bucket.file(p).getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    return { url };
});
//# sourceMappingURL=reports.js.map