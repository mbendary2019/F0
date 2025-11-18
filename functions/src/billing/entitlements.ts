/**
 * Phase 45 - Entitlements Management
 * Grant/revoke user entitlements based on subscription
 */

import * as admin from 'firebase-admin';
import { Plan } from './plans';

const db = admin.firestore();

export interface StripeState {
  customerId: string;
  subscriptionId?: string;
  priceId?: string;
  status?: string;
}

/**
 * Grant plan to user and set entitlements
 */
export async function grantPlan(uid: string, plan: Plan) {
  const data = {
    plan: plan.id,
    dailyQuota: plan.limits?.dailyQuota ?? 500,
    entitlements: plan.entitlements ?? [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('ops_user_plans').doc(uid).set(data, { merge: true });
  console.log(`[entitlements] Granted plan ${plan.id} to user ${uid}`);
}

/**
 * Set Stripe state for user
 */
export async function setStripeState(uid: string, stripeState: StripeState) {
  await db
    .collection('ops_user_plans')
    .doc(uid)
    .set(
      {
        stripe: stripeState,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  console.log(`[entitlements] Updated Stripe state for user ${uid}`);
}

/**
 * Check if user has specific entitlement
 */
export async function hasEntitlement(
  uid: string,
  key: string
): Promise<boolean> {
  const doc = await db.collection('ops_user_plans').doc(uid).get();
  const ents: string[] = doc.data()?.entitlements || [];
  return ents.includes(key);
}

/**
 * Revoke plan and downgrade to trial
 */
export async function revokeSubscription(uid: string) {
  await db
    .collection('ops_user_plans')
    .doc(uid)
    .set(
      {
        plan: 'trial',
        dailyQuota: 500,
        entitlements: [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  console.log(`[entitlements] Revoked subscription for user ${uid}`);
}

/**
 * Get user's current entitlements
 */
export async function getUserEntitlements(uid: string): Promise<string[]> {
  const doc = await db.collection('ops_user_plans').doc(uid).get();
  return doc.data()?.entitlements || [];
}
