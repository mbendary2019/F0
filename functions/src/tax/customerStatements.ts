import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as PDFKit from "pdfkit";
import { getStorage } from "firebase-admin/storage";

export const generateCustomerVatStatement = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

  const { month } = request.data || {}; // "YYYY-MM"
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new HttpsError("invalid-argument", "Invalid month format (expected YYYY-MM)");
  }

  const db = admin.firestore();
  const bucket = getStorage().bucket();
  const uid = request.auth.uid;

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
    throw new HttpsError("not-found", "No orders found for this month");
  }

  const orders = ordersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  // Calculate totals
  let totalGross = 0;
  let totalTax = 0;
  for (const o of orders) {
    totalGross += Number(o.amountUsd || 0);
    totalTax += Number(o.taxUsd || 0);
  }

  // Generate PDF
  const doc = new (PDFKit as any)({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
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
    doc.text(
      `- ${o.id.slice(0, 8)}: ${o.currency || "USD"} ${(o.amountCharged || o.amountUsd)?.toFixed(
        2
      )} (Tax: $${(o.taxUsd || 0).toFixed(2)})`
    );
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

export const customerVatStatementsMonthly = onSchedule("0 2 1 * *", async () => {
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

  const uids = new Set<string>();
  for (const doc of ordersSnap.docs) {
    const o = doc.data() as any;
    if (o.uid) uids.add(o.uid);
  }

  console.log(`Generating VAT statements for ${uids.size} users for month ${month}`);

  // Generate statements for each user
  for (const uid of Array.from(uids)) {
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
      await (generateCustomerVatStatement as any)({
        data: { month },
        auth: { uid, token: {} }
      });

      console.log(`Generated statement for ${uid} - ${month}`);
    } catch (err) {
      console.error(`Failed to generate statement for ${uid}:`, err);
    }
  }
});
