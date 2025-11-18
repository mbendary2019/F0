import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export const validateTaxId = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

  const { taxId, taxIdType } = request.data || {};
  if (!taxId || !taxIdType) {
    throw new HttpsError("invalid-argument", "taxId and taxIdType required");
  }

  const db = admin.firestore();
  const uid = request.auth.uid;

  try {
    // Get or create Stripe customer for user
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();
    let customerId = userData?.stripeCustomerId;

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
      type: taxIdType as any, // e.g., "eu_vat", "au_abn", "gb_vat"
      value: taxId
    });

    // Map verification status
    let verificationStatus = "pending";
    if (taxIdObj.verification) {
      if (taxIdObj.verification.status === "verified") {
        verificationStatus = "accepted";
      } else if (taxIdObj.verification.status === "unverified") {
        verificationStatus = "rejected";
      }
    }

    // Determine tax exemption status
    let taxExempt = "none";
    if (verificationStatus === "accepted") {
      // For EU VAT B2B, this would be reverse charge
      if (taxIdType.startsWith("eu_") || taxIdType === "gb_vat") {
        taxExempt = "reverse";
      } else {
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
  } catch (err: any) {
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

    throw new HttpsError("internal", `Tax ID validation failed: ${err.message}`);
  }
});
