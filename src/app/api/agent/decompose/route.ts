// src/app/api/agent/decompose/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runTaskDecomposerAgent } from '@/lib/agent/roles/taskDecomposerAgent';
import { ArchitectPlan } from '@/lib/agent/roles/architectAgent';

/**
 * POST /api/agent/decompose
 *
 * Runs the Task Decomposer Agent to break down an ArchitectPlan
 * into actionable, implementation-ready tasks.
 *
 * Body:
 * {
 *   projectId: string;
 *   userId: string;
 *   userInput: string;         // Original user request or summary
 *   architectPlan: ArchitectPlan;
 *   locale?: string;
 *   maxTasks?: number;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      userId,
      userInput,
      architectPlan,
      locale = 'en',
      maxTasks,
    } = body as {
      projectId: string;
      userId: string;
      userInput: string;
      architectPlan: ArchitectPlan;
      locale?: string;
      maxTasks?: number;
    };

    // Validate required fields
    if (!projectId || !userId || !userInput || !architectPlan) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Missing required fields: projectId, userId, userInput, architectPlan',
        },
        { status: 400 }
      );
    }

    console.log('[TASK_DECOMPOSER] Generating task breakdown:', {
      projectId,
      userId,
      locale,
      maxTasks,
      modulesCount: architectPlan.modules.length,
      phasesCount: architectPlan.phases.length,
    });

    // Call the task decomposer agent
    const result = await runTaskDecomposerAgent({
      projectId,
      userId,
      userInput,
      architectPlan,
      locale,
      maxTasks,
    });

    console.log('[TASK_DECOMPOSER] Tasks generated:', {
      projectId,
      groups: result.plan.groups.length,
      totalTasks: result.plan.allTasks.length,
      highPriority: result.plan.allTasks.filter((t) => t.priority === 'HIGH')
        .length,
    });

    return NextResponse.json({
      ok: true,
      plan: result.plan,
      rawJson: result.rawJson,
    });
  } catch (err: any) {
    console.error('[TASK_DECOMPOSER] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? 'Unknown error',
        details:
          process.env.NODE_ENV === 'development' ? err?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
