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
exports.createDashboardLink = exports.createAccountLink = exports.createConnectAccount = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(functions.config().stripe.secret_key, { apiVersion: "2024-06-20" });
exports.createConnectAccount = functions.https.onCall(async (_payload, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const uid = context.auth.uid;
    const db = admin.firestore();
    const ref = db.collection("creators").doc(uid);
    const snap = await ref.get();
    let acctId = null;
    if (snap.exists && snap.data().stripeAccountId) {
        acctId = snap.data().stripeAccountId;
    }
    else {
        const acct = await stripe.accounts.create({ type: "express", metadata: { uid } });
        acctId = acct.id;
        await ref.set({ uid, stripeAccountId: acctId, updatedAt: Date.now() }, { merge: true });
    }
    return { stripeAccountId: acctId };
});
exports.createAccountLink = functions.https.onCall(async (_payload, context) => {
    var _a;
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const uid = context.auth.uid;
    const db = admin.firestore();
    const doc = await db.collection("creators").doc(uid).get();
    if (!doc.exists)
        throw new functions.https.HttpsError("failed-precondition", "Creator not found. Create account first.");
    const acctId = doc.data().stripeAccountId;
    if (!acctId)
        throw new functions.https.HttpsError("failed-precondition", "No Stripe account ID");
    const appUrl = ((_a = functions.config().app) === null || _a === void 0 ? void 0 : _a.url) || "http://localhost:3000";
    const link = await stripe.accountLinks.create({
        account: acctId,
        refresh_url: `${appUrl}/creator/apply?refresh=1`,
        return_url: `${appUrl}/creator/dashboard`,
        type: "account_onboarding"
    });
    return { url: link.url };
});
exports.createDashboardLink = functions.https.onCall(async (_payload, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const uid = context.auth.uid;
    const db = admin.firestore();
    const doc = await db.collection("creators").doc(uid).get();
    if (!doc.exists)
        throw new functions.https.HttpsError("failed-precondition", "Creator not found.");
    const acctId = doc.data().stripeAccountId;
    if (!acctId)
        throw new functions.https.HttpsError("failed-precondition", "No Stripe account ID");
    const login = await stripe.accounts.createLoginLink(acctId);
    return { url: login.url };
});
//# sourceMappingURL=connect.js.map