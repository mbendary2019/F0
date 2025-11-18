import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * Daily job to fetch and reconcile payouts for all creators from Stripe Connect
 * Stores payouts under: creator_payouts/{creatorUid}/payouts/{payoutId}
 * Also computes simple 30-day aggregate: creator_payouts/{creatorUid}/agg_last30
 */
export const creatorPayoutsDaily = onSchedule("every 24 hours", async () => {
  const db = admin.firestore();
  const since = Date.now() - 24 * 60 * 60 * 1000;

  // Collect list of creators who have recent paid orders
  const os = await db
    .collection("orders")
    .where("status", "==", "paid")
    .where("paidAt", ">", since)
    .get();

  const creators = new Map<string, string>(); // uid -> stripe account
  for (const d of os.docs) {
    const o = d.data() as any;
    if (o.creatorUid && o.creatorStripeAccountId) {
      creators.set(o.creatorUid, o.creatorStripeAccountId);
    }
  }

  if (!creators.size) {
    console.log("No creators with recent orders found");
    return;
  }

  for (const [uid, acct] of Array.from(creators)) {
    try {
      // Fetch payouts from creator's connected account
      const payouts = await stripe.payouts.list(
        { limit: 50 },
        { stripeAccount: acct }
      );

      const col = db.collection("creator_payouts").doc(uid).collection("payouts");

      for (const p of payouts.data) {
        // Only process payouts from last 24 hours
        const createdMs = (p.created || 0) * 1000;
        if (createdMs < since) continue;

        await col.doc(p.id).set(
          {
            id: p.id,
            amountUsd: (p.amount || 0) / 100,
            currency: p.currency,
            status: p.status,
            arrivalDate: p.arrival_date ? p.arrival_date * 1000 : null,
            createdAt: createdMs,
            stripeAccount: acct,
            type: p.type || "payout",
          },
          { merge: true }
        );
      }

      // Compute simple 30-day aggregate
      const monthSince = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const ps = await col.where("createdAt", ">", monthSince).get();

      let total = 0;
      let cnt = 0;
      for (const d of ps.docs) {
        const x = d.data() as any;
        total += Number(x.amountUsd || 0);
        cnt++;
      }

      await db
        .collection("creator_payouts")
        .doc(uid)
        .set(
          {
            agg_last30: {
              count: cnt,
              amountUsd: Math.round(total * 100) / 100,
              ts: Date.now(),
            },
          },
          { merge: true }
        );

      console.log(`✅ Updated payouts for creator ${uid} (${cnt} payouts)`);
    } catch (err: any) {
      console.error(`Failed to fetch payouts for creator ${uid}:`, err.message);
    }
  }

  console.log(`📊 Processed payouts for ${creators.size} creators`);
});
