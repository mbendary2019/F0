import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import express from "express";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const app = express();
app.use(express.raw({ type: "application/json" })); // raw body

app.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch (err: any) {
    console.error("Webhook signature verification failed", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const db = admin.firestore();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      const { orderId, uid, productId, creatorAcct, platformFee } = meta as any;

      if (!orderId) break;

      const orderRef = db.collection("orders").doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) break;

      // Idempotency: if already paid, skip
      if ((orderSnap.data() as any).status === "paid") {
        return res.json({ received: true });
      }

      // Early assertion: payment intent must exist
      if (!session.payment_intent) {
        console.error("[webhook] Missing payment_intent in checkout.session.completed", {
          sessionId: session.id,
          orderId
        });
        return res.status(400).send("Missing payment_intent from Stripe payload");
      }

      const amountTotal = typeof session.amount_total === "number" ? session.amount_total : 0;
      const platformFeeUsd = platformFee ? Number(platformFee)/100 : 0;
      const toCreatorUsd = (amountTotal/100) - platformFeeUsd;

      await orderRef.set({
        status: "paid",
        paidAt: Date.now(),
        paymentIntentId: session.payment_intent,
        destinationAccount: creatorAcct || null,
        platformFeeUsd,
        amountToCreatorUsd: toCreatorUsd
      }, { merge: true });

      // Grant license
      await db.collection("licenses").add({
        uid,
        productId,
        orderId,
        grantedAt: Date.now(),
        downloadCount: 0,
        lastDownloadAt: null
      });

      await db.collection("audit_logs").add({
        ts: Date.now(),
        kind: "payment_completed",
        actor: "system",
        meta: { orderId, uid, productId, creatorAcct: creatorAcct || null, platformFeeUsd, toCreatorUsd }
      });

      break;
    }

    case "account.updated": {
      const acct = event.data.object as Stripe.Account;
      const uid = acct.metadata?.uid || null;
      if (!uid) break;

      await db.collection("creators").doc(uid).set({
        stripeAccountId: acct.id,
        chargesEnabled: !!acct.charges_enabled,
        payoutsEnabled: !!acct.payouts_enabled,
        updatedAt: Date.now()
      }, { merge: true });

      await db.collection("audit_logs").add({
        ts: Date.now(),
        kind: "creator_account_updated",
        actor: "system",
        meta: { uid, acct: acct.id, chargesEnabled: acct.charges_enabled, payoutsEnabled: acct.payouts_enabled }
      });
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as any;
      const pi = charge.payment_intent;

      // Find order by paymentIntentId
      const os = await db.collection("orders").where("paymentIntentId", "==", pi).limit(1).get();
      if (!os.empty) {
        const orderDoc = os.docs[0];
        const orderData = orderDoc.data() as any;

        // Mark order as refunded
        await orderDoc.ref.set({
          status: "refunded",
          refundedAt: Date.now(),
          refund: {
            id: charge.refunds?.data?.[0]?.id || null,
            status: "succeeded"
          }
        }, { merge: true });

        // Revoke associated license
        if (orderData.licenseId) {
          await db.collection("licenses").doc(orderData.licenseId).set({
            revoked: true,
            revokedAt: Date.now(),
            revokeReason: "refund"
          }, { merge: true });
        } else {
          // Best-effort: find license by orderId
          const licSnap = await db.collection("licenses").where("orderId", "==", orderDoc.id).limit(1).get();
          if (!licSnap.empty) {
            await licSnap.docs[0].ref.set({
              revoked: true,
              revokedAt: Date.now(),
              revokeReason: "refund"
            }, { merge: true });
          }
        }

        await db.collection("audit_logs").add({
          ts: Date.now(),
          kind: "charge_refunded",
          actor: "system",
          meta: { orderId: orderDoc.id, pi, chargeId: charge.id }
        });

        // Slack alert for large refunds (optional)
        const hook = process.env.SLACK_WEBHOOK;
        if (hook && orderData.amountUsd && orderData.amountUsd >= 100) {
          try {
            await fetch(hook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `💸 *Large Refund*\nOrder: ${orderDoc.id}\nAmount: $${orderData.amountUsd}\nPI: ${pi}`
              })
            });
          } catch (err) {
            console.error("Failed to send Slack alert:", err);
          }
        }
      }
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as any;
      const pi = dispute.payment_intent;
      const charge = dispute.charge;

      // Link order if found
      let orderRef = null;
      const os = await db.collection("orders").where("paymentIntentId", "==", pi).limit(1).get();
      if (!os.empty) orderRef = os.docs[0].ref;

      const doc = {
        id: dispute.id,
        paymentIntentId: pi || null,
        chargeId: charge || null,
        status: dispute.status,
        amountUsd: (dispute.amount || 0) / 100,
        reason: dispute.reason || null,
        evidenceDueBy: dispute.evidence_details?.due_by
          ? dispute.evidence_details.due_by * 1000
          : null,
        createdAt: Date.now(),
        orderId: orderRef?.id || null,
      };

      await db.collection("disputes").doc(dispute.id).set(doc, { merge: true });

      // Slack alert (optional)
      const hook = process.env.SLACK_WEBHOOK;
      if (hook) {
        try {
          await fetch(hook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `⚠️ *Dispute Created*\nPI: ${pi}\nAmount: $${doc.amountUsd}\nStatus: ${doc.status}\n${doc.orderId ? "Order: " + doc.orderId : ""}`
            })
          });
        } catch (err) {
          console.error("Failed to send Slack alert:", err);
        }
      }

      await db.collection("audit_logs").add({
        ts: Date.now(),
        kind: "dispute_created",
        actor: "system",
        meta: { disputeId: dispute.id, pi, orderId: orderRef?.id || null }
      });
      break;
    }

    case "charge.dispute.closed": {
      const dispute = event.data.object as any;
      await db.collection("disputes").doc(dispute.id).set(
        {
          status: dispute.status,
          closedAt: Date.now(),
          outcome: dispute.outcome?.type || null,
        },
        { merge: true }
      );

      await db.collection("audit_logs").add({
        ts: Date.now(),
        kind: "dispute_closed",
        actor: "system",
        meta: { disputeId: dispute.id, status: dispute.status, outcome: dispute.outcome?.type || null }
      });
      break;
    }

    default:
      break;
  }

  return res.json({ received: true });
});

export const marketplaceWebhook = onRequest(app);
