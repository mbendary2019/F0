import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * Daily analytics aggregation
 * Runs every 24 hours to compute metrics
 */
export const analyticsDaily = onSchedule("every 24 hours", async () => {
  const db = admin.firestore();
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;

  // Aggregate orders in last 24h
  const ordersSnap = await db
    .collection("orders")
    .where("createdAt", ">", last24h)
    .get();

  const totalOrders = ordersSnap.size;
  let totalRevenue = 0;
  let platformRevenue = 0;
  let creatorRevenue = 0;

  ordersSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.status === "paid") {
      const amount = data.amountUsd || 0;
      totalRevenue += amount;
      platformRevenue += data.platformFeeUsd || 0;
      creatorRevenue += data.amountToCreatorUsd || 0;
    }
  });

  // Store daily snapshot
  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  await db.collection("analytics_daily").doc(dateKey).set({
    date: dateKey,
    totalOrders,
    totalRevenue,
    platformRevenue,
    creatorRevenue,
    computedAt: now,
  });

  console.log(`📊 Daily analytics computed: ${totalOrders} orders, $${totalRevenue.toFixed(2)} revenue`);
});
