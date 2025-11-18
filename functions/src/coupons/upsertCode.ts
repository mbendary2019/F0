import * as functions from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

function requireAdmin(request: functions.https.CallableRequest) {
  const t = (request.auth?.token || {}) as any;
  if (!request.auth || !t.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }
}

/**
 * Upsert coupon code mapping manually (for existing Stripe coupons)
 */
export const upsertCouponCode = onCall(async (request) => {
  requireAdmin(request);
  const payload = request.data;

  const { code, stripeCouponId, active = true } = payload || {};
  if (!code || !stripeCouponId) {
    throw new HttpsError(
      "invalid-argument",
      "code & stripeCouponId are required"
    );
  }

  const db = admin.firestore();
  await db
    .collection("coupons")
    .doc(String(code).toUpperCase())
    .set(
      {
        code: String(code).toUpperCase(),
        stripeCouponId,
        active,
        updatedAt: Date.now(),
        updatedBy: request.auth?.uid || "admin",
      },
      { merge: true }
    );

  return { ok: true };
});
