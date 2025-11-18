/**
 * Usage Tracking & Quota Enforcement
 * Server-side utilities for recording usage and enforcing quotas
 */

import { assertAuth } from './auth';
import { db } from './firebase-admin';

export type UsageKind = 'llm' | 'api_call' | 'job' | 'task';
export type PlanTier = 'free' | 'pro' | 'enterprise';

/**
 * Get quota limit for a plan tier
 */
export function getQuotaLimit(tier: PlanTier): number {
  const limits: Record<PlanTier, number> = {
    free: parseInt(process.env.QUOTA_FREE_DAILY || '1000', 10),
    pro: parseInt(process.env.QUOTA_PRO_DAILY || '10000', 10),
    enterprise: parseInt(process.env.QUOTA_ENTERPRISE_DAILY || '100000', 10),
  };
  return limits[tier] || limits.free;
}

/**
 * Get current date string in YYYYMMDD format
 */
function getDateKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Record usage event
 * Writes to usage_events collection for later aggregation
 */
export async function recordUsage(
  uid: string,
  kind: UsageKind,
  amount: number = 1,
  wsId?: string
): Promise<void> {
  try {
    await db.collection('usage_events').add({
      uid,
      wsId: wsId || null,
      kind,
      amount,
      ts: new Date(),
    });
  } catch (error) {
    console.error('[recordUsage] Failed to record usage:', error);
    // Don't throw - usage recording should not block the main operation
  }
}

/**
 * Check if user has remaining quota
 * Returns true if usage is allowed, false if quota exceeded
 */
export async function checkQuota(
  uid: string,
  tier: PlanTier,
  amount: number = 1
): Promise<boolean> {
  try {
    const limit = getQuotaLimit(tier);
    const dateKey = getDateKey();

    // Get or create user quota document for today
    const quotaRef = db.collection('user_quotas').doc(uid);
    const quotaDoc = await quotaRef.get();
    const quotaData = quotaDoc.data();

    // Calculate reset time (start of next day UTC)
    const now = new Date();
    const tomorrow = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));

    // If quota doc doesn't exist or it's a new day, reset
    if (!quotaData || quotaData.dateKey !== dateKey) {
      await quotaRef.set({
        planTier: tier,
        limit,
        period: 'day',
        used: 0,
        dateKey,
        resetAt: tomorrow,
        updatedAt: new Date(),
      });
      return true; // Fresh quota, usage allowed
    }

    // Check if adding this amount would exceed quota
    const currentUsed = quotaData.used || 0;
    if (currentUsed + amount > limit) {
      console.log(`[checkQuota] Quota exceeded for ${uid}: ${currentUsed}/${limit}`);
      return false;
    }

    // Update used amount (optimistic - actual aggregation happens via Cloud Function)
    await quotaRef.update({
      used: currentUsed + amount,
      updatedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error('[checkQuota] Error checking quota:', error);
    // On error, allow usage (fail open)
    return true;
  }
}

/**
 * Usage guard middleware
 * Combines auth check, quota check, and usage recording
 * Use this at the start of API routes that consume quota
 */
export async function usageGuard(
  req: Request,
  opts: {
    kind: UsageKind;
    amount?: number;
    wsId?: string;
  }
): Promise<
  | { ok: true; uid: string; tier: PlanTier }
  | { ok: false; status: number; error: string }
> {
  // 1. Authenticate user
  const auth = await assertAuth(req, { requireActive: true });
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }

  // 2. Get user's subscription tier from custom claims
  const tier = (auth.claims.sub_tier || 'free').toLowerCase() as PlanTier;
  const amount = opts.amount ?? 1;

  // 3. Check quota
  const allowed = await checkQuota(auth.uid!, tier, amount);
  if (!allowed) {
    return {
      ok: false,
      status: 429,
      error: 'Daily quota exceeded. Please upgrade your plan.',
    };
  }

  // 4. Record usage (write-ahead)
  await recordUsage(auth.uid!, opts.kind, amount, opts.wsId);

  return { ok: true, uid: auth.uid!, tier };
}

/**
 * Get user's current usage stats for today
 */
export async function getUserUsageToday(uid: string): Promise<{
  used: number;
  limit: number;
  tier: PlanTier;
  resetAt: Date;
} | null> {
  try {
    const quotaDoc = await db.collection('user_quotas').doc(uid).get();
    if (!quotaDoc.exists) {
      return null;
    }

    const data = quotaDoc.data()!;
    return {
      used: data.used || 0,
      limit: data.limit || 0,
      tier: data.planTier || 'free',
      resetAt: data.resetAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('[getUserUsageToday] Error:', error);
    return null;
  }
}

/**
 * Get user's usage history (last 30 days)
 */
export async function getUserUsageHistory(
  uid: string,
  days: number = 30
): Promise<Array<{ date: string; total: number; byKind: Record<string, number> }>> {
  try {
    const snapshot = await db
      .collection(`usage_daily/${uid}`)
      .orderBy('date', 'desc')
      .limit(days)
      .get();

    const history: Array<{ date: string; total: number; byKind: Record<string, number> }> = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      history.push({
        date: doc.id,
        total: data.total || 0,
        byKind: data.byKind || {},
      });
    });

    return history.reverse(); // Return in chronological order
  } catch (error) {
    console.error('[getUserUsageHistory] Error:', error);
    return [];
  }
}
