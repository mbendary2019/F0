import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * Hourly job to reconcile Stripe Connect transfers with orders
 * Validates that transfer destination matches expected creator account
 */
export const reconcileTransfersHourly = onSchedule("every 60 minutes", async () => {
  const db = admin.firestore();
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000; // Last 7 days

  // Find paid orders that haven't been reconciled yet
  const q = await db
    .collection("orders")
    .where("status", "==", "paid")
    .where("paidAt", ">", since)
    .where("transferReconciled", "==", false)
    .limit(200)
    .get();

  for (const d of q.docs) {
    const o = d.data() as any;
    const pi = o.paymentIntentId;
    if (!pi) continue;

    try {
      // Retrieve payment intent and charges with transfer data
      const intent = await stripe.paymentIntents.retrieve(pi, {
        expand: ["charges.data.transfer_data"],
      }) as any;

      const ch = intent.charges?.data?.[0];
      const dest =
        ch?.transfer_data?.destination ||
        intent.transfer_data?.destination ||
        null;

      // Match expected creator account
      const expected = o.creatorStripeAccountId || null;
      const match = expected ? String(dest) === String(expected) : !!dest;

      await d.ref.set(
        {
          transferDestinationAccount: dest || null,
          transferReconciled: !!match,
          reconciledAt: Date.now(),
        },
        { merge: true }
      );

      // Alert on mismatch
      if (!match) {
        await db.collection("audit_logs").add({
          ts: Date.now(),
          kind: "transfer_mismatch",
          meta: {
            orderId: d.id,
            expected,
            actual: dest,
            pi,
          },
        });
        console.warn(
          `⚠️ Transfer mismatch: order=${d.id}, expected=${expected}, actual=${dest}`
        );
      }
    } catch (err: any) {
      console.error(`Failed to reconcile order ${d.id}:`, err.message);
      // Continue with other orders
    }
  }

  console.log(`✅ Reconciled ${q.size} orders`);
});
