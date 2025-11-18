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
exports.createCheckoutSession = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(functions.config().stripe.secret_key, { apiVersion: "2024-06-20" });
exports.createCheckoutSession = functions.https.onCall(async (payload, context) => {
    var _a, _b, _c;
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const { productId, couponCode, currency, customerTaxId } = payload || {};
    if (!productId)
        throw new functions.https.HttpsError("invalid-argument", "productId required");
    const db = admin.firestore();
    const prodSnap = await db.collection("products").doc(productId).get();
    if (!prodSnap.exists)
        throw new functions.https.HttpsError("not-found", "Product not found");
    const p = prodSnap.data();
    if (!p.active)
        throw new functions.https.HttpsError("failed-precondition", "Product not active");
    // Get FX rate for currency conversion
    const selectedCurrency = (currency || "usd").toLowerCase();
    let fxRate = 1.0;
    let amountInCurrency = Number(p.priceUsd);
    // Check for pricing overrides first
    if (p.prices && p.prices[selectedCurrency.toUpperCase()]) {
        amountInCurrency = Number(p.prices[selectedCurrency.toUpperCase()]);
    }
    else if (selectedCurrency !== "usd") {
        // Fall back to FX conversion
        const fxSnap = await db.collection("fx_rates").doc("latest").get();
        if (fxSnap.exists) {
            const rates = fxSnap.data().rates || {};
            fxRate = rates[selectedCurrency.toUpperCase()] || 1.0;
            amountInCurrency = Number(p.priceUsd) * fxRate;
        }
    }
    const amount = Math.round(amountInCurrency * 100);
    const appUrl = ((_a = functions.config().app) === null || _a === void 0 ? void 0 : _a.url) || "http://localhost:3000";
    // Revenue sharing setup
    const creatorAcct = p.creatorStripeAccountId || null;
    const share = Number((_b = p.creatorSharePct) !== null && _b !== void 0 ? _b : 0.85); // default 85% to creator
    const platformFeeAmount = Math.round(amount * (1 - share));
    const transferData = creatorAcct ? { destination: creatorAcct } : undefined;
    // Pre-create order (pending)
    const orderRef = await db.collection("orders").add({
        uid: context.auth.uid,
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
    let discounts = undefined;
    if (couponCode) {
        try {
            // Check if coupon exists in Stripe or Firestore mapping
            const couponSnap = await db.collection("coupons").doc(couponCode).get();
            if (couponSnap.exists) {
                const stripeCouponId = couponSnap.data().stripeCouponId;
                discounts = [{ coupon: stripeCouponId }];
            }
            else {
                // Try direct Stripe coupon
                discounts = [{ coupon: couponCode }];
            }
        }
        catch (err) {
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
                    product_data: { name: p.title, description: ((_c = p.description) === null || _c === void 0 ? void 0 : _c.slice(0, 200)) || "" }
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
        customer_tax_ids: customerTaxId ? [customerTaxId] : undefined,
        metadata: {
            orderId: orderRef.id,
            uid: context.auth.uid,
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
//# sourceMappingURL=checkout.js.map