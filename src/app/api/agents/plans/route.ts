// src/app/api/agents/plans/route.ts
// =============================================================================
// Phase 155.4 – Plans API Route
// GET: Get latest plan for a project from in-memory store
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getPlanStore } from '@/lib/agents/orchestratorBus';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('[155.4][API] GET /api/agents/plans');

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId is required' },
        { status: 400 }
      );
    }

    const planStore = getPlanStore();
    const allPlans = await planStore.getAll();

    // Filter by projectId and get the latest
    const projectPlans = allPlans
      .filter((p) => p.metadata?.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const latestPlan = projectPlans[0] || null;

    return NextResponse.json({
      success: true,
      plan: latestPlan,
      totalPlans: projectPlans.length,
    });
  } catch (error) {
    console.error('[155.4][API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

console.log('[155.4][API] plans route loaded');
