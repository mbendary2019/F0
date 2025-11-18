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
exports.customerVatStatementsMonthly = exports.generateCustomerVatStatement = void 0;
const functions = __importStar(require("firebase-functions"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const PDFDocument = require("pdfkit");
const storage_1 = require("firebase-admin/storage");
exports.generateCustomerVatStatement = functions.https.onCall(async (payload, ctx) => {
    var _a;
    if (!ctx.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const { month } = payload || {}; // "YYYY-MM"
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid month format (expected YYYY-MM)");
    }
    const db = admin.firestore();
    const bucket = (0, storage_1.getStorage)().bucket();
    const uid = ctx.auth.uid;
    // Get orders for this user in this month
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).getTime();
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0)).getTime() - 1;
    const ordersSnap = await db
        .collection("orders")
        .where("uid", "==", uid)
        .where("status", "==", "paid")
        .where("paidAt", ">=", start)
        .where("paidAt", "<=", end)
        .get();
    if (ordersSnap.empty) {
        throw new functions.https.HttpsError("not-found", "No orders found for this month");
    }
    const orders = ordersSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    // Calculate totals
    let totalGross = 0;
    let totalTax = 0;
    for (const o of orders) {
        totalGross += Number(o.amountUsd || 0);
        totalTax += Number(o.taxUsd || 0);
    }
    // Generate PDF
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(Buffer.from(c)));
    doc.fontSize(18).text(`VAT STATEMENT - ${month}`, { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Customer: ${uid}`);
    doc.moveDown();
    doc.text(`Summary for ${month}:`);
    doc.text(`Total Orders: ${orders.length}`);
    doc.text(`Total Gross (USD): ${totalGross.toFixed(2)}`);
    doc.text(`Total Tax (USD): ${totalTax.toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(10).text("Order Details:");
    for (const o of orders) {
        doc.text(`- ${o.id.slice(0, 8)}: ${o.currency || "USD"} ${(_a = (o.amountCharged || o.amountUsd)) === null || _a === void 0 ? void 0 : _a.toFixed(2)} (Tax: $${(o.taxUsd || 0).toFixed(2)})`);
    }
    doc.end();
    await new Promise((r) => doc.on("end", r));
    const pdf = Buffer.concat(chunks);
    // Save to storage
    const path = `customer_statements/${uid}/${month}.pdf`;
    await bucket.file(path).save(pdf, {
        contentType: "application/pdf",
        resumable: false,
    });
    // Store metadata
    await db
        .collection("customer_statements")
        .doc(uid)
        .collection("files")
        .doc(month)
        .set({
        month,
        uid,
        createdAt: Date.now(),
        path,
        ordersCount: orders.length,
        totalGross,
        totalTax,
    });
    // Get signed URL
    const [url] = await bucket.file(path).getSignedUrl({
        action: "read",
        expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    return { month, url, ordersCount: orders.length };
});
exports.customerVatStatementsMonthly = (0, scheduler_1.onSchedule)("0 2 1 * *", async () => {
    // Run on 1st of month at 02:00 UTC
    const db = admin.firestore();
    // Get previous month
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).getTime();
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0)).getTime() - 1;
    // Get all users with paid orders in previous month
    const ordersSnap = await db
        .collection("orders")
        .where("status", "==", "paid")
        .where("paidAt", ">=", start)
        .where("paidAt", "<", end)
        .get();
    const uids = new Set();
    for (const doc of ordersSnap.docs) {
        const o = doc.data();
        if (o.uid)
            uids.add(o.uid);
    }
    console.log(`Generating VAT statements for ${uids.size} users for month ${month}`);
    // Generate statements for each user
    for (const uid of uids) {
        try {
            // Check if already generated
            const existing = await db
                .collection("customer_statements")
                .doc(uid)
                .collection("files")
                .doc(month)
                .get();
            if (existing.exists) {
                console.log(`Statement already exists for ${uid} - ${month}`);
                continue;
            }
            // Simulate callable execution
            await exports.generateCustomerVatStatement({ month }, { auth: { uid, token: {} } });
            console.log(`Generated statement for ${uid} - ${month}`);
        }
        catch (err) {
            console.error(`Failed to generate statement for ${uid}:`, err);
        }
    }
});
//# sourceMappingURL=customerStatements.js.map