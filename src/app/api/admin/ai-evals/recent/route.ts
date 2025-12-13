export * from '@/app/api/dynamic';
/**
 * GET /api/admin/ai-evals/recent
 * Returns recent AI evaluations for charting (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromHeaders } from '@/lib/admin-auth';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication
    await requireAdminFromHeaders(req);

    // Get limit from query params
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 30), 100);

    // Get recent evaluation runs
    const snaps = await db
      .collectionGroup('runs')
      .orderBy('meta.ts', 'desc')
      .limit(limit)
      .get();

    const data = snaps.docs.map((d) => {
      const doc: any = d.data();
      return {
        date: doc.meta?.ts ? new Date(doc.meta.ts).toLocaleDateString() : 'unknown',
        quality: doc.quality || 0,
        bias: doc.bias || 0,
        toxicity: doc.toxicity || 0,
        flagged: doc.flagged === true,
        model: doc.model || 'unknown',
        piiLeak: doc.piiLeak === true,
      };
    });

    // Reverse to show oldest first (for time-series charts)
    data.reverse();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching recent AI evals:', error);

    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch recent AI evals' }, { status: 500 });
  }
}
