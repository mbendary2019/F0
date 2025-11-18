/**
 * Server-side quota utilities for Next.js API routes
 * Re-exports Cloud Function logic for SSR usage
 */

import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from './firebase';

initAdmin();
const db = getFirestore();

const today = (tz = 'Asia/Kuwait') => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // YYYY-MM-DD
};

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export async function checkAndConsume(
  uid: string,
  tokens: number,
  tz = 'Asia/Kuwait'
) {
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
    if (data.usedToday + tokens > data.dailyQuota) {
      throw new QuotaExceededError('TRIAL_QUOTA_EXCEEDED');
    }

    data.usedToday += tokens;
    tx.set(ref, data, { merge: true });
  });
}

export async function getUsage(uid: string) {
  const doc = await db.collection('ops_user_plans').doc(uid).get();
  const data = doc.exists ? doc.data()! : { dailyQuota: 500, usedToday: 0 };
  return {
    dailyQuota: data.dailyQuota || 500,
    usedToday: data.usedToday || 0,
    remaining: (data.dailyQuota || 500) - (data.usedToday || 0),
  };
}
