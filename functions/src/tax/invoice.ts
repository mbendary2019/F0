import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as PDFKit from "pdfkit";
import * as crypto from "crypto";
import { getStorage } from "firebase-admin/storage";

function hmac(buf: Buffer, secret: string) {
  return crypto.createHmac("sha256", secret).update(buf).digest("hex");
}

export const generateVatInvoice = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
  const { orderId } = request.data || {};
  if (!orderId) throw new HttpsError("invalid-argument", "orderId required");

  const db = admin.firestore();
  const bucket = getStorage().bucket();
  const oRef = db.collection("orders").doc(orderId);
  const oSnap = await oRef.get();
  if (!oSnap.exists) throw new HttpsError("not-found", "Order not found");
  const order = oSnap.data() as any;

  const isAdmin = (request.auth.token as any)?.admin === true;
  if (!isAdmin && order.uid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Forbidden");
  }
  if (order.status !== "paid") {
    throw new HttpsError("failed-precondition", "Only paid orders");
  }

  // Invoice numbering
  const invCfgRef = db.collection("config").doc("invoice_counter");
  const { invoiceNo } = await db.runTransaction(async (tr) => {
    const s = await tr.get(invCfgRef);
    const cur = (s.exists && (s.data() as any)?.seq) || 0;
    const next = cur + 1;
    tr.set(invCfgRef, { seq: next }, { merge: true });
    return { invoiceNo: next };
  });

  // Company settings
  const companyRef = db.collection("config").doc("company");
  const company = (await companyRef.get()).data() || {};
  const sellerVat = company.vatId || "N/A";
  const secret = (process.env.REPORTS_HMAC_SECRET || "change_me") as string;

  // Generate PDF
  const doc = new (PDFKit as any)({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(Buffer.from(c)));

  doc.fontSize(18).text(`INVOICE #${invoiceNo}`, { align: "right" });
  doc.moveDown();
  doc.fontSize(12).text(company.name || "Company, Inc.");
  doc.text(company.address || "");
  doc.text(`VAT: ${sellerVat}`);
  doc.moveDown();
  doc.text(`Bill To: ${order.customerName || order.uid}`);
  if (order.customerTaxId) doc.text(`Customer Tax ID: ${order.customerTaxId}`);
  doc.text(`Order ID: ${orderId}`);
  doc.text(`Date: ${new Date(order.paidAt || Date.now()).toISOString().slice(0, 10)}`);
  doc.moveDown();

  // Product line
  const currency = order.currency || "USD";
  const gross = Number(order.amountCharged || order.amountUsd || 0);
  const taxUsd = Number(order.taxUsd || 0);
  const fx = Number(order.fxRate || 1);
  const grossInUsd = Number(order.amountUsd ?? (gross / fx));
  const platformFee = Number(order.platformFeeUsd || 0);

  doc.text(`Product: ${order.product?.title || order.productId || "Digital product"}`);
  doc.text(`Amount (${currency}): ${gross.toFixed(2)}`);
  if (taxUsd) {
    doc.text(
      `Tax (USD): ${taxUsd.toFixed(2)} ${order.taxJurisdiction ? `— ${order.taxJurisdiction}` : ""}`
    );
  }
  if (order.couponCode) doc.text(`Coupon: ${String(order.couponCode).toUpperCase()}`);
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

  await db.collection("invoices").doc(orderId).set(
    {
      invoiceNo,
      path,
      hmac: sig,
      createdAt: Date.now(),
      uid: order.uid,
    },
    { merge: true }
  );

  const [url] = await bucket.file(path).getSignedUrl({
    action: "read",
    expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });

  return { invoiceNo, url, hmac: sig };
});
