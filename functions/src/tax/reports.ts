import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getStorage } from "firebase-admin/storage";

export const exportTaxReport = onCall(async (request) => {
  const t = (request.auth?.token || {}) as any;
  if (!request.auth || !t.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  const { start, end } = request.data || {};
  if (!start || !end) {
    throw new HttpsError("invalid-argument", "start/end ms required");
  }

  const db = admin.firestore();
  const bucket = getStorage().bucket();
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
  const byJur: Record<string, number> = {};

  for (const d of snap.docs) {
    const o = d.data() as any;
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
