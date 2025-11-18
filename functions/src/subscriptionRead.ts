import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const getSubscription = onCall(async (req) => {
  const uid = req.auth?.uid || 'demo';
  const doc = await db.doc(`users/${uid}/subscription`).get();
  if (!doc.exists) return { plan:'free', status:'active', limits:{ monthlyQuota:10000, ratePerMin:60 } };
  const data = doc.data()!;
  return { plan:data.plan, status:data.status, periodEnd:data.periodEnd, limits:data.limits, stripe:data.stripe };
});
