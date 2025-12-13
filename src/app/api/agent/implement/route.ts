import { NextRequest, NextResponse } from 'next/server';
import {

export const dynamic = 'force-dynamic';
  runImplementationPipeline,
  OrchestratorMode,
  TaskSelectionStrategy,
} from '@/lib/agent/orchestrator/implementationPipeline';

/**
 * POST /api/agent/implement
 *
 * High-level endpoint to:
 * 1) Generate architecture
 * 2) Decompose into tasks
 * 3) Generate code
 * 4) Optionally execute actions
 *
 * Body:
 * {
 *   projectId: string;
 *   userId: string;
 *   userInput: string;
 *   locale?: string;
 *   mode?: "PLAN_ONLY" | "PLAN_AND_CODE" | "FULL_AUTO";
 *   maxTasks?: number;
 *   taskSelectionStrategy?: "HIGH_PRIORITY_FIRST" | "ALL";
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      projectId,
      userId,
      userInput,
      locale = 'en',
      mode = 'PLAN_AND_CODE',
      maxTasks = 3,
      taskSelectionStrategy = 'HIGH_PRIORITY_FIRST',
    } = body as {
      projectId: string;
      userId: string;
      userInput: string;
      locale?: string;
      mode?: OrchestratorMode;
      maxTasks?: number;
      taskSelectionStrategy?: TaskSelectionStrategy;
    };

    if (!projectId || !userId || !userInput) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Missing required fields: projectId, userId, userInput',
        },
        { status: 400 }
      );
    }

    console.log('[ORCHESTRATOR API] Running implementation pipeline:', {
      projectId,
      userId,
      mode,
      maxTasks,
      taskSelectionStrategy,
    });

    const result = await runImplementationPipeline({
      projectId,
      userId,
      userInput,
      locale,
      mode,
      maxTasks,
      taskSelectionStrategy,
    });

    console.log('[ORCHESTRATOR API] Pipeline completed:', {
      projectId,
      mode: result.mode,
      selectedTasks: result.selectedTasks.length,
      codeGenPlans: result.codeGenPlans.length,
      actionPlans: result.actionPlans.length,
      executedPlans: result.executedPlans.length,
    });

    return NextResponse.json({
      ok: true,
      pipeline: result,
    });
  } catch (err: any) {
    console.error('[ORCHESTRATOR API] Error:', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? 'Unknown error',
        details:
          process.env.NODE_ENV === 'development'
            ? err?.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}
