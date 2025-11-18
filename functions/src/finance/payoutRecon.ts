import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * Daily job to reconcile creator payouts with orders
 * Compares net earnings from orders vs actual Stripe payouts
 * Writes daily deltas to: creator_payouts/{uid}/recon/{YYYYMMDD}
 */
export const creatorPayoutReconDaily = onSchedule("every 24 hours", async () => {
  const db = admin.firestore();
  const since = Date.now() - 24 * 60 * 60 * 1000;

  // Get all paid orders from last 24 hours
  const orders = await db
    .collection("orders")
    .where("status", "==", "paid")
    .where("paidAt", ">", since)
    .get();

  // Aggregate net earnings by creator
  const byCreator = new Map<string, { acct: string; net: number }>();
  for (const d of orders.docs) {
    const o = d.data() as any;
    if (!o.creatorUid || !o.creatorStripeAccountId) continue;

    const net = Number(
      o.amountToCreatorUsd ?? Number(o.amountUsd || 0) - Number(o.platformFeeUsd || 0)
    );

    const cur = byCreator.get(o.creatorUid) || {
      acct: o.creatorStripeAccountId,
      net: 0,
    };
    cur.net += net;
    byCreator.set(o.creatorUid, cur);
  }

  // Generate day key: YYYYMMDD
  const dayKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  for (const [uid, v] of Array.from(byCreator)) {
    try {
      // Fetch payouts from creator's connected account for last 24 hours
      const payouts = await stripe.payouts.list(
        { limit: 50 },
        { stripeAccount: v.acct }
      );

      const sum = payouts.data
        .filter((p) => (p.created * 1000) > since)
        .reduce((a, p) => a + (p.amount || 0) / 100, 0);

      const netFromOrders = Math.round(v.net * 100) / 100;
      const payoutsAmount = Math.round(sum * 100) / 100;
      const delta = Math.round((v.net - sum) * 100) / 100;

      await db
        .collection("creator_payouts")
        .doc(uid)
        .collection("recon")
        .doc(dayKey)
        .set(
          {
            ts: Date.now(),
            netFromOrdersUsd: netFromOrders,
            payoutsUsd: payoutsAmount,
            deltaUsd: delta,
          },
          { merge: true }
        );

      if (Math.abs(delta) > 1) {
        console.warn(
          `⚠️ Payout reconciliation mismatch for creator ${uid}: orders=$${netFromOrders}, payouts=$${payoutsAmount}, delta=$${delta}`
        );
      }
    } catch (err: any) {
      console.error(`Failed to reconcile payouts for creator ${uid}:`, err.message);
    }
  }

  console.log(`✅ Reconciled payouts for ${byCreator.size} creators`);
});
