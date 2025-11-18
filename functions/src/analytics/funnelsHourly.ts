import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

/**
 * Funnels analytics hourly aggregation
 * Tracks view → checkout → purchase conversion rates
 */
export const analyticsFunnelsHourly = onSchedule("every 60 minutes", async () => {
  const db = admin.firestore();
  const since = Date.now() - 24 * 60 * 60 * 1000;

  const evSnap = await db.collection("events").where("ts", ">", since).get();
  const viewByProduct = new Map<string, number>();
  const startByProduct = new Map<string, number>();

  for (const d of evSnap.docs) {
    const e = d.data() as any;
    if (e.kind === "view_product" && e.productId) {
      viewByProduct.set(e.productId, (viewByProduct.get(e.productId) || 0) + 1);
    }
    if (e.kind === "start_checkout" && e.productId) {
      startByProduct.set(e.productId, (startByProduct.get(e.productId) || 0) + 1);
    }
  }

  const orders = await db.collection("orders").where("paidAt", ">", since).get();
  const buyByProduct = new Map<string, number>();
  for (const d of orders.docs) {
    const o = d.data() as any;
    const pid = o.productId || o.product?.id;
    if (pid) buyByProduct.set(pid, (buyByProduct.get(pid) || 0) + 1);
  }

  const rows: any[] = [];
  const pids = new Set([
    ...Array.from(viewByProduct.keys()),
    ...Array.from(startByProduct.keys()),
    ...Array.from(buyByProduct.keys()),
  ]);

  pids.forEach((pid) => {
    const v = viewByProduct.get(pid) || 0;
    const s = startByProduct.get(pid) || 0;
    const b = buyByProduct.get(pid) || 0;
    const v2c = v ? Math.round((s / v) * 1000) / 10 : 0; // %
    const c2p = s ? Math.round((b / s) * 1000) / 10 : 0; // %
    const v2p = v ? Math.round((b / v) * 1000) / 10 : 0; // %
    rows.push({
      productId: pid,
      views24h: v,
      starts24h: s,
      buys24h: b,
      viewToCheckoutPct: v2c,
      checkoutToPurchasePct: c2p,
      viewToPurchasePct: v2p,
    });
  });

  await db
    .collection("analytics")
    .doc("funnels_1h")
    .set({ ts: Date.now(), rows }, { merge: true });

  console.log(`📊 Funnels computed: ${rows.length} products analyzed`);
});
