import * as admin from 'firebase-admin';

const db = admin.firestore();

export async function getUserPlan(uid: string) {
  const s = await db.collection('ops_user_plans').doc(uid).get();
  const d = s.exists
    ? s.data()!
    : {
        plan: 'trial',
        dailyQuota: 500,
        entitlements: [],
      };
  return d;
}
