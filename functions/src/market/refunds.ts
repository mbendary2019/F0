import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function requireAdmin(request: CallableRequest) {
  const t = (request.auth?.token || {}) as any;
  if (!request.auth || !t.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }
}

/**
 * Refund an order via Stripe and revoke the associated license
 */
export const refundOrder = onCall(async (request) => {
  requireAdmin(request);

  const { orderId, amountUsd } = (request.data || {}) as {
    orderId: string;
    amountUsd?: number;
  };

  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId required");
  }

  const db = admin.firestore();
  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Order not found");
  }

  const o = snap.data() as any;

  // Already refunded
  if (o.status === "refunded") {
    return { ok: true, already: true };
  }

  // Retrieve payment intent (with fallback for legacy orders)
  const paymentIntentId = o.paymentIntentId || o.stripePaymentIntent || null;
  if (!paymentIntentId) {
    throw new HttpsError(
      "failed-precondition",
      "paymentIntentId missing on order"
    );
  }

  // Create refund in Stripe
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amountUsd ? Math.round(Number(amountUsd) * 100) : undefined,
    reason: "requested_by_customer",
  });

  // Mark order as refunded
  await ref.set(
    {
      status: "refunded",
      refundedAt: Date.now(),
      refund: {
        id: refund.id,
        amountUsd: refund.amount ? refund.amount / 100 : o.amountUsd,
        status: refund.status,
      },
    },
    { merge: true }
  );

  // Revoke license (if one exists)
  if (o.licenseId) {
    await db
      .collection("licenses")
      .doc(o.licenseId)
      .set(
        {
          revoked: true,
          revokedAt: Date.now(),
          revokeReason: "refund",
        },
        { merge: true }
      );
  } else {
    // Best-effort: find first license by orderId
    const licSnap = await db
      .collection("licenses")
      .where("orderId", "==", orderId)
      .limit(1)
      .get();
    if (!licSnap.empty) {
      await licSnap.docs[0].ref.set(
        {
          revoked: true,
          revokedAt: Date.now(),
          revokeReason: "refund",
        },
        { merge: true }
      );
    }
  }

  // Audit log
  await db.collection("audit_logs").add({
    ts: Date.now(),
    kind: "order_refund",
    actor: request.auth?.uid,
    meta: {
      orderId,
      amountUsd: amountUsd ?? o.amountUsd,
    },
  });

  return { ok: true, refundId: refund.id };
});
