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
exports.generateVatInvoice = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const PDFDocument = require("pdfkit");
const crypto = __importStar(require("crypto"));
const storage_1 = require("firebase-admin/storage");
function hmac(buf, secret) {
    return crypto.createHmac("sha256", secret).update(buf).digest("hex");
}
exports.generateVatInvoice = functions.https.onCall(async (payload, ctx) => {
    var _a, _b, _c, _d;
    if (!ctx.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const { orderId } = payload || {};
    if (!orderId)
        throw new functions.https.HttpsError("invalid-argument", "orderId required");
    const db = admin.firestore();
    const bucket = (0, storage_1.getStorage)().bucket();
    const oRef = db.collection("orders").doc(orderId);
    const oSnap = await oRef.get();
    if (!oSnap.exists)
        throw new functions.https.HttpsError("not-found", "Order not found");
    const order = oSnap.data();
    const isAdmin = ((_a = ctx.auth.token) === null || _a === void 0 ? void 0 : _a.admin) === true;
    if (!isAdmin && order.uid !== ctx.auth.uid) {
        throw new functions.https.HttpsError("permission-denied", "Forbidden");
    }
    if (order.status !== "paid") {
        throw new functions.https.HttpsError("failed-precondition", "Only paid orders");
    }
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
    const secret = (((_b = functions.config().reports) === null || _b === void 0 ? void 0 : _b.hmac_secret) || "change_me");
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
    doc.text(`Bill To: ${order.customerName || order.uid}`);
    if (order.customerTaxId)
        doc.text(`Customer Tax ID: ${order.customerTaxId}`);
    doc.text(`Order ID: ${orderId}`);
    doc.text(`Date: ${new Date(order.paidAt || Date.now()).toISOString().slice(0, 10)}`);
    doc.moveDown();
    // Product line
    const currency = order.currency || "USD";
    const gross = Number(order.amountCharged || order.amountUsd || 0);
    const taxUsd = Number(order.taxUsd || 0);
    const fx = Number(order.fxRate || 1);
    const grossInUsd = Number((_c = order.amountUsd) !== null && _c !== void 0 ? _c : (gross / fx));
    const platformFee = Number(order.platformFeeUsd || 0);
    doc.text(`Product: ${((_d = order.product) === null || _d === void 0 ? void 0 : _d.title) || order.productId || "Digital product"}`);
    doc.text(`Amount (${currency}): ${gross.toFixed(2)}`);
    if (taxUsd) {
        doc.text(`Tax (USD): ${taxUsd.toFixed(2)} ${order.taxJurisdiction ? `— ${order.taxJurisdiction}` : ""}`);
    }
    if (order.couponCode)
        doc.text(`Coupon: ${String(order.couponCode).toUpperCase()}`);
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
        uid: order.uid,
    }, { merge: true });
    const [url] = await bucket.file(path).getSignedUrl({
        action: "read",
        expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    return { invoiceNo, url, hmac: sig };
});
//# sourceMappingURL=invoice.js.map