export * from '@/app/api/dynamic';
/**
 * GET /api/usage/stats
 * Get current user's usage statistics
 */

import { NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { getUserUsageToday, getUserUsageHistory } from '@/server/usage';
import { rateLimitGuard } from '@/server/rate-limit';

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitResult = await rateLimitGuard(req);
  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { error: rateLimitResult.error },
      { status: rateLimitResult.status }
    );
  }

  // Authentication
  const auth = await assertAuth(req, { requireActive: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Get today's usage
    const today = await getUserUsageToday(auth.uid!);

    // Get historical usage
    const history = await getUserUsageHistory(auth.uid!, Math.min(days, 90));

    return NextResponse.json({
      today: today || {
        used: 0,
        limit: 1000,
        tier: 'free',
        resetAt: new Date(),
      },
      history,
    });
  } catch (error: any) {
    console.error('[GET /api/usage/stats] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
