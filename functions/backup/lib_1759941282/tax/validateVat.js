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
exports.validateTaxId = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(functions.config().stripe.secret_key, { apiVersion: "2024-06-20" });
exports.validateTaxId = functions.https.onCall(async (payload, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const { taxId, taxIdType } = payload || {};
    if (!taxId || !taxIdType) {
        throw new functions.https.HttpsError("invalid-argument", "taxId and taxIdType required");
    }
    const db = admin.firestore();
    const uid = context.auth.uid;
    try {
        // Get or create Stripe customer for user
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.data();
        let customerId = userData === null || userData === void 0 ? void 0 : userData.stripeCustomerId;
        if (!customerId) {
            // Create customer if doesn't exist
            const userRecord = await admin.auth().getUser(uid);
            const customer = await stripe.customers.create({
                email: userRecord.email,
                metadata: { uid }
            });
            customerId = customer.id;
            await db.collection("users").doc(uid).set({
                stripeCustomerId: customerId
            }, { merge: true });
        }
        // Create Tax ID on Stripe customer
        const taxIdObj = await stripe.customers.createTaxId(customerId, {
            type: taxIdType, // e.g., "eu_vat", "au_abn", "gb_vat"
            value: taxId
        });
        // Map verification status
        let verificationStatus = "pending";
        if (taxIdObj.verification) {
            if (taxIdObj.verification.status === "verified") {
                verificationStatus = "accepted";
            }
            else if (taxIdObj.verification.status === "unverified") {
                verificationStatus = "rejected";
            }
        }
        // Determine tax exemption status
        let taxExempt = "none";
        if (verificationStatus === "accepted") {
            // For EU VAT B2B, this would be reverse charge
            if (taxIdType.startsWith("eu_") || taxIdType === "gb_vat") {
                taxExempt = "reverse";
            }
            else {
                taxExempt = "exempt";
            }
        }
        // Update user profile with tax ID info
        await db.collection("users").doc(uid).set({
            taxId: {
                id: taxIdObj.id,
                type: taxIdType,
                value: taxId,
                verificationStatus,
                taxExempt,
                verifiedAt: verificationStatus === "accepted" ? Date.now() : null
            }
        }, { merge: true });
        // Audit log
        await db.collection("audit_logs").add({
            ts: Date.now(),
            kind: "tax_id_validated",
            actor: uid,
            meta: {
                taxIdType,
                verificationStatus,
                taxExempt,
                stripeTaxIdId: taxIdObj.id
            }
        });
        return {
            success: true,
            verificationStatus,
            taxExempt,
            stripeTaxIdId: taxIdObj.id
        };
    }
    catch (err) {
        console.error("Tax ID validation error:", err);
        // Store failed attempt
        await db.collection("users").doc(uid).set({
            taxId: {
                type: taxIdType,
                value: taxId,
                verificationStatus: "rejected",
                taxExempt: "none",
                errorMessage: err.message
            }
        }, { merge: true });
        throw new functions.https.HttpsError("internal", `Tax ID validation failed: ${err.message}`);
    }
});
//# sourceMappingURL=validateVat.js.map