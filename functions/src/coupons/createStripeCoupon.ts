import * as functions from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { getConfig } from "../config";

const cfg = getConfig();
const stripe = new Stripe(cfg.STRIPE_SECRET_KEY);

function requireAdmin(request: functions.https.CallableRequest) {
  const t = (request.auth?.token || {}) as any;
  if (!request.auth || !t.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }
}

/**
 * Create a Stripe coupon and optional promotion code
 * Stores mapping in Firestore coupons collection
 */
export const createStripeCoupon = onCall(async (request) => {
  requireAdmin(request);
  const payload = request.data;

  const {
    code, // Optional: promo code
    percentOff,
    amountOff,
    currency,
    duration = "once",
    durationInMonths,
    maxRedemptions,
    redeemBy, // ms epoch
  } = payload || {};

  if (!percentOff && !amountOff) {
    throw new HttpsError(
      "invalid-argument",
      "percentOff or amountOff required"
    );
  }
  if (amountOff && !currency) {
    throw new HttpsError(
      "invalid-argument",
      "currency required when amountOff present"
    );
  }

  // Create Stripe coupon
  const coupon = await stripe.coupons.create({
    percent_off: percentOff || undefined,
    amount_off: amountOff ? Math.round(Number(amountOff) * 100) : undefined,
    currency: currency || undefined,
    duration: duration as any,
    duration_in_months:
      duration === "repeating" ? Number(durationInMonths || 1) : undefined,
    max_redemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
    redeem_by: redeemBy ? Math.floor(Number(redeemBy) / 1000) : undefined,
  });

  // Create promotion code if code provided
  let promo: Stripe.PromotionCode | null = null;
  if (code) {
    const promoParams: any = {
      code: String(code).toUpperCase(),
      coupon: coupon.id,
    };
    if (maxRedemptions) promoParams.max_redemptions = Number(maxRedemptions);
    if (redeemBy) promoParams.expires_at = Math.floor(Number(redeemBy) / 1000);
    promo = await stripe.promotionCodes.create(promoParams);
  }

  // Store in Firestore
  const db = admin.firestore();
  if (code) {
    await db
      .collection("coupons")
      .doc(String(code).toUpperCase())
      .set(
        {
          code: String(code).toUpperCase(),
          stripeCouponId: coupon.id,
          promotionCodeId: promo?.id || null,
          active: true,
          percentOff: percentOff ?? null,
          amountOff: amountOff ?? null,
          currency: currency ?? null,
          duration,
          durationInMonths: durationInMonths ?? null,
          maxRedemptions: maxRedemptions ?? null,
          redeemBy: redeemBy ?? null,
          createdAt: Date.now(),
          createdBy: request.auth?.uid || "admin",
        },
        { merge: true }
      );
  }

  return { couponId: coupon.id, promotionCodeId: promo?.id || null };
});
