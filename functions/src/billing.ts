import Stripe from "stripe";
import * as admin from "firebase-admin";
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import { getConfig } from "./config";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/** Map price ID to our plan key */
function mapPrice(priceId: string) {
  if (priceId === "price_free") return "free";
  if (priceId === "price_pro") return "pro";
  return "enterprise";
}
function planLimits(plan: "free"|"pro"|"enterprise") {
  if (plan === "free") return { ratePerMin: 60, monthlyQuota: 10000, webhooksEnabled: false, maxKeys: 2, maxWebhooks: 0 };
  if (plan === "pro") return { ratePerMin: 600, monthlyQuota: 250000, webhooksEnabled: true, maxKeys: 10, maxWebhooks: 5 };
  return { ratePerMin: 3000, monthlyQuota: 2000000, webhooksEnabled: true, maxKeys: 50, maxWebhooks: 20 };
}

/** Callable: create Stripe Billing Portal session for current user */
export const createBillingPortalLink = onCall<{ return_url?: string }>(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "UNAUTH");

  const cfg = getConfig();
  const stripe = new Stripe(cfg.STRIPE_SECRET_KEY);

  const userDoc = await db.doc(`users/${uid}`).get();
  const customerId = userDoc.get("stripeCustomerId");
  if (!customerId) throw new HttpsError("failed-precondition", "No Stripe customer for user.");

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: req.data?.return_url || cfg.PORTAL_RETURN_URL,
  });

  return { url: session.url };
});

/** Stripe webhook: sync subscription -> Firestore */
export const stripeWebhook = onRequest(async (req, res) => {
  const cfg = getConfig();
  const stripe = new Stripe(cfg.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"] as string, cfg.STRIPE_WEBHOOK_SECRET);
  } catch (err:any) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;

    // find user by stripeCustomerId
    const q = await db.collection("users").where("stripeCustomerId","==",customerId).limit(1).get();
    if (q.empty) {
      res.json({ ok: true, note: "no-user" });
      return;
    }

    const uid = q.docs[0].id;
    const priceId = sub.items.data[0]?.price?.id || "price_free";
    const plan = mapPrice(priceId);
    const limits = planLimits(plan);

    await db.doc(`users/${uid}/subscription`).set({
      plan, status: sub.status, periodEnd: new Date(sub.current_period_end*1000), limits
    }, { merge: true });
  }

  res.json({ received: true });
});
