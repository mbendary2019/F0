import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from "firebase-admin";

/**
 * Sync Entitlements to Custom Claims
 *
 * Automatically updates Firebase Auth custom claims when user entitlements change.
 * This allows for fast authorization checks without Firestore reads.
 *
 * Claims added:
 * - sub_active: boolean - Whether subscription is active
 * - sub_tier: string - Subscription tier (free, pro, etc.)
 * - sub_exp: number | null - Subscription expiry timestamp (seconds)
 */
export const syncClaimsOnEntitlementsWrite = onDocumentWritten("users/{uid}", async (event) => {
  const uid = event.params.uid as string;

  // Get the new document data
  const after = event.data?.after?.exists ? event.data?.after?.data() : null;

  if (!after) {
    // User document deleted - clear claims
    await admin.auth().setCustomUserClaims(uid, {
      sub_active: false,
      sub_tier: "free",
      sub_exp: null,
    });
    console.log(`✅ Cleared claims for deleted user ${uid}`);
    return;
  }

  const ent = after.entitlements;

  // Extract subscription data
  const sub_active = !!ent?.active;
  const sub_tier = (ent?.tier || "free").toLowerCase();

  // Handle both Firestore Timestamp and plain objects
  let sub_exp: number | null = null;
  if (ent?.periodEnd) {
    if (typeof ent.periodEnd._seconds === "number") {
      // Firestore Timestamp format
      sub_exp = ent.periodEnd._seconds;
    } else if (ent.periodEnd.seconds) {
      // Alternative Timestamp format
      sub_exp = ent.periodEnd.seconds;
    } else if (typeof ent.periodEnd === "number") {
      // Already a number
      sub_exp = ent.periodEnd;
    }
  }

  // Set custom claims
  try {
    await admin.auth().setCustomUserClaims(uid, {
      sub_active,
      sub_tier,
      sub_exp,
    });

    console.log(`✅ Updated claims for user ${uid}:`, {
      sub_active,
      sub_tier,
      sub_exp: sub_exp ? new Date(sub_exp * 1000).toISOString() : null,
    });
  } catch (error: any) {
    console.error(`❌ Error updating claims for user ${uid}:`, error.message);
    throw error;
  }
});
