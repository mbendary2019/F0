/**
 * Phase 45 - Plan Management
 * Retrieve plan information from Firestore
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

export interface Plan {
  id: string;
  title: string;
  price: number;
  interval: string;
  stripePriceId: string;
  limits: {
    dailyQuota: number;
    marketplacePaid: boolean;
  };
  entitlements: string[];
}

/**
 * Get plan configuration by Stripe price ID
 */
export async function getPlanByPriceId(priceId: string): Promise<Plan | null> {
  const snap = await db
    .collection('ops_plans')
    .where('stripePriceId', '==', priceId)
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }

  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Plan;
}

/**
 * Get plan configuration by plan ID
 */
export async function getPlanById(planId: string): Promise<Plan | null> {
  const doc = await db.collection('ops_plans').doc(planId).get();

  if (!doc.exists) {
    return null;
  }

  return { id: doc.id, ...doc.data() } as Plan;
}

/**
 * List all available plans
 */
export async function listPlans(): Promise<Plan[]> {
  const snap = await db.collection('ops_plans').orderBy('price').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Plan));
}
