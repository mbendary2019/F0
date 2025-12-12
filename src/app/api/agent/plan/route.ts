// src/app/api/agent/plan/route.ts
import { NextResponse } from 'next/server';
import { planActions } from '@/lib/agent/actions/actionPlanner';

/**
 * POST /api/agent/plan
 *
 * Generates an ActionPlan from user input using the Action Planner Agent.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      projectId,
      userId,
      userInput,
      initiator = 'user',
      additionalContext,
      locale = 'en',
    } = body;

    // Validate required fields
    if (!projectId || !userId || !userInput) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required fields: projectId, userId, userInput',
        },
        { status: 400 }
      );
    }

    console.log('[PLAN] Generating action plan:', {
      projectId,
      userId,
      userInput: userInput.substring(0, 100),
      locale,
    });

    // Call the planner
    const result = await planActions({
      projectId,
      userId,
      userInput,
      initiator,
      additionalContext,
      locale,
    });

    console.log('[PLAN] Plan generated:', {
      planId: result.plan.id,
      stepsCount: result.plan.steps.length,
    });

    return NextResponse.json({
      ok: true,
      plan: result.plan,
      rawJson: result.rawJson,
    });
  } catch (err: any) {
    console.error('[PLAN] Error generating plan:', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
