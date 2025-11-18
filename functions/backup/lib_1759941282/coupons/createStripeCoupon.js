"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStripeCoupon = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(functions.config().stripe.secret_key, { apiVersion: "2024-06-20" });
function requireAdmin(ctx) {
    var _a;
    const t = (((_a = ctx.auth) === null || _a === void 0 ? void 0 : _a.token) || {});
    if (!ctx.auth || !t.admin) {
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    }
}
/**
 * Create a Stripe coupon and optional promotion code
 * Stores mapping in Firestore coupons collection
 */
exports.createStripeCoupon = functions.https.onCall(async (payload, ctx) => {
    var _a;
    requireAdmin(ctx);
    const { code, // Optional: promo code
    percentOff, amountOff, currency, duration = "once", durationInMonths, maxRedemptions, redeemBy, // ms epoch
     } = payload || {};
    if (!percentOff && !amountOff) {
        throw new functions.https.HttpsError("invalid-argument", "percentOff or amountOff required");
    }
    if (amountOff && !currency) {
        throw new functions.https.HttpsError("invalid-argument", "currency required when amountOff present");
    }
    // Create Stripe coupon
    const coupon = await stripe.coupons.create({
        percent_off: percentOff || undefined,
        amount_off: amountOff ? Math.round(Number(amountOff) * 100) : undefined,
        currency: currency || undefined,
        duration: duration,
        duration_in_months: duration === "repeating" ? Number(durationInMonths || 1) : undefined,
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
        redeem_by: redeemBy ? Math.floor(Number(redeemBy) / 1000) : undefined,
    });
    // Create promotion code if code provided
    let promo = null;
    if (code) {
        promo = await stripe.promotionCodes.create({
            code: String(code).toUpperCase(),
            coupon: coupon.id,
            max_redemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
            expires_at: redeemBy ? Math.floor(Number(redeemBy) / 1000) : undefined,
        });
    }
    // Store in Firestore
    const db = admin.firestore();
    if (code) {
        await db
            .collection("coupons")
            .doc(String(code).toUpperCase())
            .set({
            code: String(code).toUpperCase(),
            stripeCouponId: coupon.id,
            promotionCodeId: (promo === null || promo === void 0 ? void 0 : promo.id) || null,
            active: true,
            percentOff: percentOff !== null && percentOff !== void 0 ? percentOff : null,
            amountOff: amountOff !== null && amountOff !== void 0 ? amountOff : null,
            currency: currency !== null && currency !== void 0 ? currency : null,
            duration,
            durationInMonths: durationInMonths !== null && durationInMonths !== void 0 ? durationInMonths : null,
            maxRedemptions: maxRedemptions !== null && maxRedemptions !== void 0 ? maxRedemptions : null,
            redeemBy: redeemBy !== null && redeemBy !== void 0 ? redeemBy : null,
            createdAt: Date.now(),
            createdBy: ((_a = ctx.auth) === null || _a === void 0 ? void 0 : _a.uid) || "admin",
        }, { merge: true });
    }
    return { couponId: coupon.id, promotionCodeId: (promo === null || promo === void 0 ? void 0 : promo.id) || null };
});
//# sourceMappingURL=createStripeCoupon.js.map