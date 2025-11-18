// =============================================================
// Phase 59 — Cognitive Memory Mesh - Stats API
// REST endpoint for graph statistics
// =============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceGraphStats, getEdgeCountByType } from '@/lib/memory/linkBuilder';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId query parameter is required' }, { status: 400 });
    }

    const [stats, edgeCounts] = await Promise.all([
      getWorkspaceGraphStats(workspaceId),
      getEdgeCountByType(workspaceId),
    ]);

    return NextResponse.json({
      success: true,
      workspaceId,
      stats,
      edgeCounts,
    });
  } catch (error: any) {
    console.error('[memory/stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
