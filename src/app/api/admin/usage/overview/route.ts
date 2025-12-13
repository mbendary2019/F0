export * from '@/app/api/dynamic';
/**
 * GET /api/admin/usage/overview
 * Get usage analytics overview (admin only)
 */

import { NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { db } from '@/server/firebase-admin';
import { rateLimitGuard } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitResult = await rateLimitGuard(req);
  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { error: rateLimitResult.error },
      { status: rateLimitResult.status }
    );
  }

  // Authentication with admin check
  const auth = await assertAuth(req, { requireActive: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Check if user has admin claim
  if (!auth.claims.admin) {
    return NextResponse.json(
      { error: 'Forbidden. Admin access required.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Get daily stats for the last N days
    const dailyStats: Array<{
      date: string;
      total: number;
      byKind: Record<string, number>;
      byPlan: { free: number; pro: number; enterprise: number };
    }> = [];

    // Calculate date keys for the last N days
    const dateKeys: string[] = [];
    for (let i = 0; i < Math.min(days, 90); i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      dateKeys.push(`${year}${month}${day}`);
    }

    // Fetch stats for each day
    for (const dateKey of dateKeys) {
      const doc = await db.doc(`admin_usage_stats/days/${dateKey}`).get();
      if (doc.exists) {
        const data = doc.data()!;
        dailyStats.push({
          date: dateKey,
          total: data.total || 0,
          byKind: data.byKind || {},
          byPlan: data.byPlan || { free: 0, pro: 0, enterprise: 0 },
        });
      } else {
        dailyStats.push({
          date: dateKey,
          total: 0,
          byKind: {},
          byPlan: { free: 0, pro: 0, enterprise: 0 },
        });
      }
    }

    // Reverse to chronological order
    dailyStats.reverse();

    // Calculate totals
    const totals = dailyStats.reduce(
      (acc, day) => {
        acc.total += day.total;
        acc.byPlan.free += day.byPlan.free || 0;
        acc.byPlan.pro += day.byPlan.pro || 0;
        acc.byPlan.enterprise += day.byPlan.enterprise || 0;

        Object.entries(day.byKind).forEach(([kind, count]) => {
          acc.byKind[kind] = (acc.byKind[kind] || 0) + count;
        });

        return acc;
      },
      {
        total: 0,
        byKind: {} as Record<string, number>,
        byPlan: { free: 0, pro: 0, enterprise: 0 },
      }
    );

    // Get total user counts by plan
    const userCounts = await getUserCountsByPlan();

    return NextResponse.json({
      dailyStats,
      totals,
      userCounts,
      period: {
        days,
        from: dateKeys[dateKeys.length - 1],
        to: dateKeys[0],
      },
    });
  } catch (error: any) {
    console.error('[GET /api/admin/usage/overview] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get user counts by plan tier
 */
async function getUserCountsByPlan(): Promise<{
  free: number;
  pro: number;
  enterprise: number;
  total: number;
}> {
  try {
    // Query user_quotas to count users by plan
    const quotasSnapshot = await db.collection('user_quotas').get();

    const counts = {
      free: 0,
      pro: 0,
      enterprise: 0,
      total: quotasSnapshot.size,
    };

    quotasSnapshot.forEach((doc) => {
      const data = doc.data();
      const tier = data.planTier || 'free';
      if (tier === 'free') counts.free++;
      else if (tier === 'pro') counts.pro++;
      else if (tier === 'enterprise') counts.enterprise++;
    });

    return counts;
  } catch (error) {
    console.error('[getUserCountsByPlan] Error:', error);
    return { free: 0, pro: 0, enterprise: 0, total: 0 };
  }
}
