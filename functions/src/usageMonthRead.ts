import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const getUsageMonth = onCall(async (req) => {
  const uid = req.auth?.uid || 'demo';
  const mk = new Date().toISOString().slice(0,7);
  const sub = await db.doc(`users/${uid}/subscription`).get();
  const quota = sub.get('limits.monthlyQuota') ?? 10000;
  const mdoc = await db.doc(`usage_logs/${uid}/monthly/${mk}`).get();
  const used = mdoc.get('total') ?? 0;
  const overageEnabled = !!sub.get('limits.overage.enabled');
  return { used, quota, overageEnabled };
});
