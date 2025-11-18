import { adminDb } from "@/lib/firebaseAdmin";

export type QuotaSpec = {
  key: string;
  dailyLimit: number;
};

/**
 * Ensure user exists in the system
 * @throws Error if user not found (except for anon in dev)
 */
export async function ensureUser(uid: string): Promise<void> {
  // Allow anon in development
  if (uid === "anon" || uid === "dev-user") {
    return;
  }

  try {
    const ref = adminDb.collection("users").doc(uid);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new Error("user_not_found");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "user_not_found") {
      throw err;
    }
    console.error("[rbac] error checking user:", err);
    throw new Error("user_check_failed");
  }
}

/**
 * Ensure feature flag is enabled for user
 * @throws Error if feature is disabled
 */
export async function ensureFeature(uid: string, flag: string): Promise<void> {
  // Allow all features for anon/dev-user in development
  if (uid === "anon" || uid === "dev-user") {
    console.log(`[rbac] allowing feature ${flag} for dev user`);
    return;
  }

  try {
    const ref = adminDb.collection("users").doc(uid).collection("features").doc(flag);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new Error(`feature_not_found:${flag}`);
    }

    const data = doc.data();
    if (data?.enabled !== true) {
      throw new Error(`feature_disabled:${flag}`);
    }

    console.log(`[rbac] feature ${flag} enabled for user ${uid}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("feature_")) {
      throw err;
    }
    console.error("[rbac] error checking feature:", err);
    throw new Error(`feature_check_failed:${flag}`);
  }
}

/**
 * Ensure user has not exceeded quota
 * @throws Error if quota exceeded
 */
export async function ensureQuota(uid: string, spec: QuotaSpec): Promise<void> {
  // Skip quota checks for anon/dev-user
  if (uid === "anon" || uid === "dev-user") {
    return;
  }

  try {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const counterKey = `${spec.key}:${dateKey}`;

    const ref = adminDb.collection("usage_daily").doc(uid).collection("counters").doc(counterKey);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const currentCount = snap.exists ? (snap.data()?.count ?? 0) : 0;

      if (currentCount >= spec.dailyLimit) {
        throw new Error(`quota_exceeded:${spec.key} (${currentCount}/${spec.dailyLimit})`);
      }

      tx.set(
        ref,
        {
          count: currentCount + 1,
          ts: Date.now(),
          lastUpdated: new Date(),
        },
        { merge: true }
      );
    });

    console.log(`[rbac] quota check passed for ${uid} on ${spec.key}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("quota_exceeded")) {
      throw err;
    }
    console.error("[rbac] error checking quota:", err);
    throw new Error(`quota_check_failed:${spec.key}`);
  }
}

/**
 * Get current usage for a quota key
 */
export async function getQuotaUsage(
  uid: string,
  key: string
): Promise<{ count: number; limit: number; remaining: number }> {
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const counterKey = `${key}:${dateKey}`;

  try {
    const ref = adminDb.collection("usage_daily").doc(uid).collection("counters").doc(counterKey);
    const snap = await ref.get();

    const count = snap.exists ? (snap.data()?.count ?? 0) : 0;
    const limit = 200; // Default limit, should be fetched from user config

    return {
      count,
      limit,
      remaining: Math.max(0, limit - count),
    };
  } catch (err) {
    console.error("[rbac] error fetching quota usage:", err);
    return { count: 0, limit: 200, remaining: 200 };
  }
}

/**
 * Reset quota for a user (admin function)
 */
export async function resetQuota(uid: string, key?: string): Promise<void> {
  try {
    const ref = adminDb.collection("usage_daily").doc(uid).collection("counters");

    if (key) {
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const counterKey = `${key}:${dateKey}`;
      await ref.doc(counterKey).delete();
      console.log(`[rbac] reset quota ${counterKey} for user ${uid}`);
    } else {
      const snap = await ref.get();
      const batch = adminDb.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`[rbac] reset all quotas for user ${uid}`);
    }
  } catch (err) {
    console.error("[rbac] error resetting quota:", err);
    throw new Error("quota_reset_failed");
  }
}
