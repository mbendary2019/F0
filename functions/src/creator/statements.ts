import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import PDFDocument from "pdfkit";

function yyyymm(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function buildCreatorMonthSummary(
  db: FirebaseFirestore.Firestore,
  uid: string,
  month: string
) {
  // month: "YYYY-MM"
  const [y, m] = month.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1);
  const end = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1);

  const os = await db
    .collection("orders")
    .where("creatorUid", "==", uid)
    .where("status", "==", "paid")
    .where("paidAt", ">=", start)
    .where("paidAt", "<", end)
    .get();

  let orders = 0,
    gross = 0,
    platform = 0,
    net = 0;
  const byProduct = new Map<
    string,
    { title?: string; revenue: number; count: number }
  >();

  for (const d of os.docs) {
    const o = d.data() as any;
    orders++;
    const g = Number(o.amountUsd || 0),
      pf = Number(o.platformFeeUsd || 0),
      n = Number(o.amountToCreatorUsd || g - pf);
    gross += g;
    platform += pf;
    net += n;

    const pid = o.productId || o.product?.id || "unknown";
    const t = o.product?.title;
    const cur = byProduct.get(pid) || { title: t, revenue: 0, count: 0 };
    cur.revenue += g;
    cur.count += 1;
    byProduct.set(pid, cur);
  }

  const top = Array.from(byProduct.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10)
    .map(([productId, v]) => ({
      productId,
      title: v.title,
      orders: v.count,
      revenueUsd: Math.round(v.revenue * 100) / 100,
    }));

  return {
    month,
    orders,
    grossUsd: Math.round(gross * 100) / 100,
    platformUsd: Math.round(platform * 100) / 100,
    netUsd: Math.round(net * 100) / 100,
    topProducts: top,
  };
}

/**
 * Generate monthly statement PDF for a creator
 * Callable function - can be invoked by creator or admin
 */
export const generateCreatorStatement = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Auth required");
  }

  const payload = request.data;

  const db = admin.firestore();
  const storage = admin.storage().bucket();

  const targetUid = payload?.uid || request.auth.uid;
  const month = payload?.month || yyyymm(new Date());
  const isAdmin = (request.auth.token as any).admin === true;

  if (targetUid !== request.auth.uid && !isAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Cannot generate for another user"
    );
  }

  const summary = await buildCreatorMonthSummary(db, targetUid, month);

  // Generate PDF
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(Buffer.from(c)));

  const title = `Creator Statement — ${month}`;
  doc.fontSize(18).text(title, { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Creator UID: ${targetUid}`);
  doc.text(`Orders: ${summary.orders}`);
  doc.text(
    `Gross: $${summary.grossUsd.toFixed(2)} | Platform: $${summary.platformUsd.toFixed(2)} | Net: $${summary.netUsd.toFixed(2)}`
  );
  doc.moveDown().text("Top Products:");

  summary.topProducts.forEach((p, i) => {
    doc.text(
      `${i + 1}. ${p.title || p.productId} — $${p.revenueUsd.toFixed(2)} (${p.orders} orders)`
    );
  });

  doc.end();
  await new Promise((resolve) => doc.on("end", resolve));
  const pdf = Buffer.concat(chunks);

  // Save to Storage
  const path = `creator_statements/${targetUid}/${month}.pdf`;
  const file = storage.file(path);
  await file.save(pdf, { contentType: "application/pdf", resumable: false });

  // Store metadata
  await db
    .collection("creator_statements")
    .doc(targetUid)
    .collection("files")
    .doc(month)
    .set(
      {
        month,
        path,
        size: pdf.length,
        createdAt: Date.now(),
      },
      { merge: true }
    );

  // Generate signed URL (7 days)
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return { month, url };
  }
);

/**
 * Scheduled job to generate monthly statements for all creators
 * Runs on 1st of each month at 02:00 UTC
 */
export const generateMonthlyStatements = onSchedule({ schedule: "0 2 1 * *", timeZone: "UTC" }, async (event) => {
const db = admin.firestore();

// Get all creators who have paid orders
const creatorsSnap = await db
  .collection("orders")
  .where("status", "==", "paid")
  .limit(10000)
  .get();

const creatorSet = new Set<string>();
creatorsSnap.docs.forEach((d) => {
  const o = d.data() as any;
  if (o.creatorUid) creatorSet.add(o.creatorUid);
});

// Generate for previous month
const now = new Date();
const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const month = yyyymm(prev);

console.log(`Generating statements for ${creatorSet.size} creators for ${month}`);

for (const uid of Array.from(creatorSet)) {
  try {
    // Internal call to generator
    const ctx: any = { auth: { uid, token: { admin: true } } };
    await (generateCreatorStatement as any)({ month }, ctx);
    console.log(`✅ Generated statement for ${uid}`);
  } catch (err: any) {
    console.error(`Failed to generate statement for ${uid}:`, err.message);
  }
}

return null;
});
