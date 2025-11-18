/**
 * Phase 44 - Daily Quota System for Trial Users
 * Prevents abuse with token-based rate limiting
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError } from 'firebase-functions/v2/https';

const db = admin.firestore();

// Kuwait timezone for daily reset
const today = (tz = 'Asia/Kuwait') => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(now); // YYYY-MM-DD
};

/**
 * Check and consume tokens from user's daily quota
 * Throws if quota exceeded
 */
export async function checkAndConsume(uid: string, tokens: number, tz = 'Asia/Kuwait') {
  const ref = db.collection('ops_user_plans').doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists
      ? snap.data()!
      : { plan: 'trial', dailyQuota: 500, usedToday: 0, resetAt: today(tz) };

    // Reset if new day
    if (data.resetAt !== today(tz)) {
      data.usedToday = 0;
      data.resetAt = today(tz);
    }

    // Check quota
    if ((data.usedToday + tokens) > data.dailyQuota) {
      throw new HttpsError('resource-exhausted', 'TRIAL_QUOTA_EXCEEDED');
    }

    data.usedToday += tokens;
    tx.set(ref, data, { merge: true });
  });
}

/**
 * Scheduled function: Reset all daily quotas at midnight Kuwait time
 * Runs: every day at 00:00 Asia/Kuwait
 */
export const resetDailyQuotas = onSchedule(
  {
    schedule: '0 0 * * *',
    timeZone: 'Asia/Kuwait',
    retryCount: 2,
    memory: '256MiB',
  },
  async (event) => {
    console.log('[resetDailyQuotas] Starting daily quota reset...');

    const batch = db.batch();
    const snap = await db.collection('ops_user_plans').get();
    const todayStr = today('Asia/Kuwait');

    snap.docs.forEach((doc) => {
      batch.set(
        doc.ref,
        { usedToday: 0, resetAt: todayStr },
        { merge: true }
      );
    });

    await batch.commit();
    console.log(`[resetDailyQuotas] Reset ${snap.size} user quotas`);
  }
);
