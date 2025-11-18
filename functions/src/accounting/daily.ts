import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

export const accountingDailyRollup = onSchedule("every 24 hours", async () => {
  const db = admin.firestore();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const dayKey = new Date(dayAgo).toISOString().split("T")[0]; // YYYY-MM-DD

  // Fetch orders paid in last 24h
  const ordersSnap = await db
    .collection("orders")
    .where("status", "==", "paid")
    .where("paidAt", ">=", dayAgo)
    .where("paidAt", "<=", now)
    .get();

  let revenueUsd = 0;
  let platformFeesUsd = 0;
  let creatorPayoutsUsd = 0;

  for (const doc of ordersSnap.docs) {
    const o = doc.data() as any;
    const gross = Number(o.amountUsd || 0);
    const fee = Number(o.platformFeeUsd || 0);
    const payout = Number(o.amountToCreatorUsd || (gross - fee));

    revenueUsd += gross - fee;
    platformFeesUsd += fee;
    creatorPayoutsUsd += payout;
  }

  // Fetch refunds in last 24h
  const refundsSnap = await db
    .collection("orders")
    .where("status", "==", "refunded")
    .where("refundedAt", ">=", dayAgo)
    .where("refundedAt", "<=", now)
    .get();

  let refundsUsd = 0;
  for (const doc of refundsSnap.docs) {
    const r = doc.data() as any;
    refundsUsd += Number(r.refund?.amountUsd || r.amountUsd || 0);
  }

  // Store in analytics_accounting/daily/{dayKey}
  await db
    .collection("analytics_accounting")
    .doc("daily")
    .collection("days")
    .doc(dayKey)
    .set({
      dayKey,
      revenueUsd: Math.round(revenueUsd * 100) / 100,
      platformFeesUsd: Math.round(platformFeesUsd * 100) / 100,
      creatorPayoutsUsd: Math.round(creatorPayoutsUsd * 100) / 100,
      refundsUsd: Math.round(refundsUsd * 100) / 100,
      ordersCount: ordersSnap.size,
      refundsCount: refundsSnap.size,
      computedAt: Date.now(),
    });

  console.log(`[accountingDailyRollup] ${dayKey}: revenue=${revenueUsd}, platformFees=${platformFeesUsd}, refunds=${refundsUsd}`);
});
