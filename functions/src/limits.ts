import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export type GateDecision = {
  allow: boolean;
  reason?: string;
  hard?: boolean;
  remainingQuota?: number;
};

export async function enforceGate(uid: string): Promise<{
  decision: GateDecision;
  subscription: any;
}> {
  // Get user subscription
  const subSnap = await db.doc(`users/${uid}/subscription`).get();
  const sub = subSnap.exists
    ? subSnap.data()!
    : {
        plan: 'free',
        limits: {
          ratePerMin: 60,
          monthlyQuota: 10000,
          overage: { enabled: false }
        },
        status: 'active'
      };

  // Check if subscription is active
  if (sub.status !== 'active') {
    return {
      decision: { allow: false, hard: true, reason: 'subscription_inactive' },
      subscription: sub
    };
  }

  // Get monthly usage
  const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlyDoc = await db.doc(`usage_logs/${uid}/monthly/${monthKey}`).get();
  const used = monthlyDoc.get('total') || 0;
  const quota = sub.limits?.monthlyQuota ?? 10000;

  // Check quota
  if (used >= quota) {
    if (sub.limits?.overage?.enabled) {
      // Allow with overage billing
      return {
        decision: { allow: true, reason: 'overage', remainingQuota: 0 },
        subscription: sub
      };
    } else {
      // Hard block
      return {
        decision: { allow: false, hard: true, reason: 'quota_exceeded' },
        subscription: sub
      };
    }
  }

  // Allow with remaining quota
  return {
    decision: { allow: true, remainingQuota: quota - used },
    subscription: sub
  };
}

/** Track usage after request completes */
export async function trackUsage(
  uid: string,
  endpoint: string,
  success: boolean,
  costCents: number = 0,
  durationMs: number = 0
) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM

  const dailyRef = db.doc(`usage_logs/${uid}/daily/${today}`);
  const monthlyRef = db.doc(`usage_logs/${uid}/monthly/${monthKey}`);

  const increment = admin.firestore.FieldValue.increment(1);
  const costIncrement = admin.firestore.FieldValue.increment(costCents);

  // Update daily
  await dailyRef.set({
    total: increment,
    [success ? 'success' : 'errors']: increment,
    [`${endpoint}`]: increment,
    cost: costIncrement,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // Update monthly (real-time for gate checks)
  await monthlyRef.set({
    total: increment,
    [`byEndpoint.${endpoint}`]: increment,
    cost: costIncrement,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}
