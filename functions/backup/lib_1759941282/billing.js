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
exports.stripeWebhook = exports.createBillingPortalLink = void 0;
const stripe_1 = __importDefault(require("stripe"));
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("./config");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
/** Map price ID to our plan key */
function mapPrice(priceId) {
    if (priceId === "price_free")
        return "free";
    if (priceId === "price_pro")
        return "pro";
    return "enterprise";
}
function planLimits(plan) {
    if (plan === "free")
        return { ratePerMin: 60, monthlyQuota: 10000, webhooksEnabled: false, maxKeys: 2, maxWebhooks: 0 };
    if (plan === "pro")
        return { ratePerMin: 600, monthlyQuota: 250000, webhooksEnabled: true, maxKeys: 10, maxWebhooks: 5 };
    return { ratePerMin: 3000, monthlyQuota: 2000000, webhooksEnabled: true, maxKeys: 50, maxWebhooks: 20 };
}
/** Callable: create Stripe Billing Portal session for current user */
exports.createBillingPortalLink = (0, https_1.onCall)(async (req) => {
    var _a, _b;
    const uid = (_a = req.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "UNAUTH");
    const cfg = (0, config_1.getConfig)();
    const stripe = new stripe_1.default(cfg.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    const userDoc = await db.doc(`users/${uid}`).get();
    const customerId = userDoc.get("stripeCustomerId");
    if (!customerId)
        throw new https_1.HttpsError("failed-precondition", "No Stripe customer for user.");
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: ((_b = req.data) === null || _b === void 0 ? void 0 : _b.return_url) || cfg.PORTAL_RETURN_URL,
    });
    return { url: session.url };
});
/** Stripe webhook: sync subscription -> Firestore */
exports.stripeWebhook = (0, https_1.onRequest)(async (req, res) => {
    var _a, _b;
    const cfg = (0, config_1.getConfig)();
    const stripe = new stripe_1.default(cfg.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], cfg.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type.startsWith("customer.subscription.")) {
        const sub = event.data.object;
        const customerId = sub.customer;
        // find user by stripeCustomerId
        const q = await db.collection("users").where("stripeCustomerId", "==", customerId).limit(1).get();
        if (q.empty)
            return res.json({ ok: true, note: "no-user" });
        const uid = q.docs[0].id;
        const priceId = ((_b = (_a = sub.items.data[0]) === null || _a === void 0 ? void 0 : _a.price) === null || _b === void 0 ? void 0 : _b.id) || "price_free";
        const plan = mapPrice(priceId);
        const limits = planLimits(plan);
        await db.doc(`users/${uid}/subscription`).set({
            plan, status: sub.status, periodEnd: new Date(sub.current_period_end * 1000), limits
        }, { merge: true });
    }
    res.json({ received: true });
});
//# sourceMappingURL=billing.js.map