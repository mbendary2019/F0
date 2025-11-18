import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as PDFKit from "pdfkit";
import * as crypto from "crypto";
import { getStorage } from "firebase-admin/storage";

function hmac(buf: Buffer, secret: string) {
  return crypto.createHmac("sha256", secret).update(buf).digest("hex");
}

export const autoInvoiceOnOrderPaid = onDocumentWritten(
  "orders/{orderId}",
  async (event) => {
    const before = event.data?.before.exists ? (event.data.before.data() as any) : null;
    const after = event.data?.after.exists ? (event.data.after.data() as any) : null;

    // Only proceed if status changed to paid
    if (!after || after.status !== "paid" || before?.status === "paid") {
      return;
    }

    const orderId = event.params.orderId;
    const db = admin.firestore();

    // Check if invoice already exists (idempotency)
    const invDoc = await db.collection("invoices").doc(orderId).get();
    if (invDoc.exists) {
      console.log(`Invoice already exists for order ${orderId}`);
      return;
    }

    try {
      // Generate invoice
      const bucket = getStorage().bucket();

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
      doc.text(`Bill To: ${after.customerName || after.uid}`);
      if (after.customerTaxId) doc.text(`Customer Tax ID: ${after.customerTaxId}`);
      doc.text(`Order ID: ${orderId}`);
      doc.text(`Date: ${new Date(after.paidAt || Date.now()).toISOString().slice(0, 10)}`);
      doc.moveDown();

      const currency = after.currency || "USD";
      const gross = Number(after.amountCharged || after.amountUsd || 0);
      const taxUsd = Number(after.taxUsd || 0);
      const fx = Number(after.fxRate || 1);
      const grossInUsd = Number(after.amountUsd ?? (gross / fx));
      const platformFee = Number(after.platformFeeUsd || 0);

      doc.text(`Product: ${after.product?.title || after.productId || "Digital product"}`);
      doc.text(`Amount (${currency}): ${gross.toFixed(2)}`);
      if (taxUsd) {
        doc.text(
          `Tax (USD): ${taxUsd.toFixed(2)} ${
            after.taxJurisdiction ? `— ${after.taxJurisdiction}` : ""
          }`
        );
      }
      if (after.couponCode) doc.text(`Coupon: ${String(after.couponCode).toUpperCase()}`);
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
    } catch (err) {
      console.error(`Failed to auto-generate invoice for order ${orderId}:`, err);
    }
  }
);
