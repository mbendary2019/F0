import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getUserPlan } from '../utils/plan';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();

function today(tzOffsetMinutes: number) {
  const now = new Date(Date.now() + tzOffsetMinutes * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export const recordUsage = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');

  const { tokens = 0, requests = 1, costUsd = 0 } = req.data || {};
  if (tokens < 0 || requests < 0) {
    throw new HttpsError('invalid-argument', 'negative values not allowed');
  }

  const plan = await getUserPlan(uid);
  const date = today(0); // backend UTC; totals are logical-day based
  const dailyId = `${uid}_${date}`;

  // Daily usage update
  await db.runTransaction(async (tx) => {
    const dref = db.collection('ops_usage_daily').doc(dailyId);
    const snap = await tx.get(dref);
    const cur = snap.exists
      ? snap.data()!
      : { uid, date, tokens: 0, requests: 0, costUsd: 0, planAtUse: plan.plan };

    const next = {
      uid,
      date,
      tokens: (cur.tokens || 0) + tokens,
      requests: (cur.requests || 0) + requests,
      costUsd: +((cur.costUsd || 0) + costUsd).toFixed(6),
      planAtUse: plan.plan,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Fail fast if quota exceeded (Phase 44/45 gate still primary)
    if (plan.dailyQuota && next.tokens > plan.dailyQuota) {
      throw new HttpsError('resource-exhausted', 'DAILY_QUOTA_EXCEEDED');
    }

    tx.set(dref, next, { merge: true });
  });

  // Monthly rollup (id: uid_yyyyMM)
  const month = date.slice(0, 7);
  const mref = db.collection('ops_usage_monthly').doc(`${uid}_${month}`);
  await db.runTransaction(async (tx) => {
    const ms = await tx.get(mref);
    const cur = ms.exists
      ? ms.data()!
      : { uid, month, tokens: 0, requests: 0, costUsd: 0 };

    tx.set(
      mref,
      {
        uid,
        month,
        tokens: (cur.tokens || 0) + tokens,
        requests: (cur.requests || 0) + requests,
        costUsd: +((cur.costUsd || 0) + costUsd).toFixed(6),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  logger.info('[usage] recorded', { uid, tokens, requests, plan: plan.plan });
  return { ok: true };
});
