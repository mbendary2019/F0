import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { getConfig } from "../config";

const cfg = getConfig();
const stripe = new Stripe(cfg.STRIPE_SECRET_KEY);

export const createCheckoutSession = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

  const payload = request.data;
  const { productId, couponCode, currency, customerTaxId } = payload || {};
  if (!productId) throw new HttpsError("invalid-argument", "productId required");

  const db = admin.firestore();
  const prodSnap = await db.collection("products").doc(productId).get();
  if (!prodSnap.exists) throw new HttpsError("not-found", "Product not found");
  const p = prodSnap.data() as any;
  if (!p.active) throw new HttpsError("failed-precondition", "Product not active");

  // Get FX rate for currency conversion
  const selectedCurrency = (currency || "usd").toLowerCase();
  let fxRate = 1.0;
  let amountInCurrency = Number(p.priceUsd);

  // Check for pricing overrides first
  if (p.prices && p.prices[selectedCurrency.toUpperCase()]) {
    amountInCurrency = Number(p.prices[selectedCurrency.toUpperCase()]);
  } else if (selectedCurrency !== "usd") {
    // Fall back to FX conversion
    const fxSnap = await db.collection("fx_rates").doc("latest").get();
    if (fxSnap.exists) {
      const rates = (fxSnap.data() as any).rates || {};
      fxRate = rates[selectedCurrency.toUpperCase()] || 1.0;
      amountInCurrency = Number(p.priceUsd) * fxRate;
    }
  }

  const amount = Math.round(amountInCurrency * 100);
  const appUrl: string = (cfg as any).APP_URL || "http://localhost:3000";

  // Revenue sharing setup
  const creatorAcct = p.creatorStripeAccountId || null;
  const share = Number(p.creatorSharePct ?? 0.85); // default 85% to creator
  const platformFeeAmount = Math.round(amount * (1 - share));
  const transferData = creatorAcct ? { destination: creatorAcct } : undefined;

  // Pre-create order (pending)
  const orderRef = await db.collection("orders").add({
    uid: request.auth.uid,
    productId: prodSnap.id,
    amountUsd: p.priceUsd,
    currency: selectedCurrency,
    fxRate,
    amountCharged: amountInCurrency,
    status: "pending",
    createdAt: Date.now(),
    couponCode: couponCode ? String(couponCode).toUpperCase() : null,
    customerTaxId: customerTaxId || null
  });

  // Handle coupon if provided
  let discounts: any[] | undefined = undefined;
  if (couponCode) {
    try {
      // Check if coupon exists in Stripe or Firestore mapping
      const couponSnap = await db.collection("coupons").doc(couponCode).get();
      if (couponSnap.exists) {
        const stripeCouponId = (couponSnap.data() as any).stripeCouponId;
        discounts = [{ coupon: stripeCouponId }];
      } else {
        // Try direct Stripe coupon
        discounts = [{ coupon: couponCode }];
      }
    } catch (err) {
      console.warn("Coupon validation failed:", err);
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_creation: "always",
    customer_update: {
      address: "auto"
    },
    automatic_tax: {
      enabled: true
    },
    line_items: [
      {
        price_data: {
          currency: selectedCurrency,
          unit_amount: amount,
          product_data: { name: p.title, description: p.description?.slice(0, 200) || "" }
        },
        quantity: 1
      }
    ],
    // Revenue sharing: charge on platform + transfer to creator + platform fee
    payment_intent_data: creatorAcct ? {
      transfer_data: transferData,
      application_fee_amount: platformFeeAmount
    } : undefined,
    discounts,
    metadata: {
      orderId: orderRef.id,
      uid: request.auth.uid,
      productId: prodSnap.id,
      creatorAcct: creatorAcct || "",
      platformFee: String(platformFeeAmount),
      couponCode: couponCode ? String(couponCode).toUpperCase() : "",
      currency: selectedCurrency,
      fxRate: String(fxRate)
    },
    success_url: `${appUrl}/market/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/market/cancel`,
  });

  await orderRef.set({
    stripeSessionId: session.id,
    paymentIntentId: null // Will be updated by webhook after payment
  }, { merge: true });
  return { sessionId: session.id, url: session.url };
});
