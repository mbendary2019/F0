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
exports.autoInvoiceOnOrderPaid = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const PDFDocument = require("pdfkit");
const crypto = __importStar(require("crypto"));
const storage_1 = require("firebase-admin/storage");
function hmac(buf, secret) {
    return crypto.createHmac("sha256", secret).update(buf).digest("hex");
}
exports.autoInvoiceOnOrderPaid = functions.firestore
    .document("orders/{orderId}")
    .onWrite(async (change, context) => {
    var _a, _b, _c;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    // Only proceed if status changed to paid
    if (!after || after.status !== "paid" || (before === null || before === void 0 ? void 0 : before.status) === "paid") {
        return;
    }
    const orderId = context.params.orderId;
    const db = admin.firestore();
    // Check if invoice already exists (idempotency)
    const invDoc = await db.collection("invoices").doc(orderId).get();
    if (invDoc.exists) {
        console.log(`Invoice already exists for order ${orderId}`);
        return;
    }
    try {
        // Generate invoice
        const bucket = (0, storage_1.getStorage)().bucket();
        // Invoice numbering
        const invCfgRef = db.collection("config").doc("invoice_counter");
        const { invoiceNo } = await db.runTransaction(async (tr) => {
            var _a;
            const s = await tr.get(invCfgRef);
            const cur = (s.exists && ((_a = s.data()) === null || _a === void 0 ? void 0 : _a.seq)) || 0;
            const next = cur + 1;
            tr.set(invCfgRef, { seq: next }, { merge: true });
            return { invoiceNo: next };
        });
        // Company settings
        const companyRef = db.collection("config").doc("company");
        const company = (await companyRef.get()).data() || {};
        const sellerVat = company.vatId || "N/A";
        const secret = (((_a = functions.config().reports) === null || _a === void 0 ? void 0 : _a.hmac_secret) || "change_me");
        // Generate PDF
        const doc = new PDFDocument({ size: "A4", margin: 48 });
        const chunks = [];
        doc.on("data", (c) => chunks.push(Buffer.from(c)));
        doc.fontSize(18).text(`INVOICE #${invoiceNo}`, { align: "right" });
        doc.moveDown();
        doc.fontSize(12).text(company.name || "Company, Inc.");
        doc.text(company.address || "");
        doc.text(`VAT: ${sellerVat}`);
        doc.moveDown();
        doc.text(`Bill To: ${after.customerName || after.uid}`);
        if (after.customerTaxId)
            doc.text(`Customer Tax ID: ${after.customerTaxId}`);
        doc.text(`Order ID: ${orderId}`);
        doc.text(`Date: ${new Date(after.paidAt || Date.now()).toISOString().slice(0, 10)}`);
        doc.moveDown();
        const currency = after.currency || "USD";
        const gross = Number(after.amountCharged || after.amountUsd || 0);
        const taxUsd = Number(after.taxUsd || 0);
        const fx = Number(after.fxRate || 1);
        const grossInUsd = Number((_b = after.amountUsd) !== null && _b !== void 0 ? _b : (gross / fx));
        const platformFee = Number(after.platformFeeUsd || 0);
        doc.text(`Product: ${((_c = after.product) === null || _c === void 0 ? void 0 : _c.title) || after.productId || "Digital product"}`);
        doc.text(`Amount (${currency}): ${gross.toFixed(2)}`);
        if (taxUsd) {
            doc.text(`Tax (USD): ${taxUsd.toFixed(2)} ${after.taxJurisdiction ? `— ${after.taxJurisdiction}` : ""}`);
        }
        if (after.couponCode)
            doc.text(`Coupon: ${String(after.couponCode).toUpperCase()}`);
        doc.moveDown();
        doc.text(`Gross (USD): ${grossInUsd.toFixed(2)}`);
        doc.text(`Platform Fee (USD): ${platformFee.toFixed(2)}`);
        doc.text(`Net to Creator (USD): ${Math.max(0, grossInUsd - platformFee).toFixed(2)}`);
        doc.moveDown();
        doc.text("Thank you for your purchase.");
        doc.end();
        await new Promise((r) => doc.on("end", r));
        const pdf = Buffer.concat(chunks);
        // HMAC signature
        const sig = hmac(pdf, secret);
        const path = `invoices/${orderId}.pdf`;
        await bucket.file(path).save(pdf, {
            contentType: "application/pdf",
            resumable: false,
            metadata: {
                metadata: { hmac: sig, invoiceNo: String(invoiceNo) },
            },
        });
        await db.collection("invoices").doc(orderId).set({
            invoiceNo,
            path,
            hmac: sig,
            createdAt: Date.now(),
            uid: after.uid,
        });
        console.log(`Auto-generated invoice #${invoiceNo} for order ${orderId}`);
    }
    catch (err) {
        console.error(`Failed to auto-generate invoice for order ${orderId}:`, err);
    }
});
//# sourceMappingURL=autoInvoice.js.map