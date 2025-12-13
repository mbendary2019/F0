// src/app/api/agent/generate-code/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runCodeGeneratorAgent } from '@/lib/agent/roles/codeGeneratorAgent';
import { ArchitectPlan } from '@/lib/agent/roles/architectAgent';
import { DecomposedTask } from '@/lib/agent/roles/taskDecomposerAgent';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/generate-code
 *
 * Runs the Code Generator Agent to generate production-ready code
 * for a specific task.
 *
 * Body:
 * {
 *   projectId: string;
 *   userId: string;
 *   userInput: string;         // Original user request (for context)
 *   task: DecomposedTask;
 *   architectPlan: ArchitectPlan;
 *   fileTree?: string[];       // Existing file paths
 *   existingFiles?: Record<string, string>;  // Path -> content map
 *   locale?: string;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      userId,
      userInput,
      task,
      architectPlan,
      fileTree = [],
      existingFiles = {},
      locale = 'en',
    } = body as {
      projectId: string;
      userId: string;
      userInput: string;
      task: DecomposedTask;
      architectPlan: ArchitectPlan;
      fileTree?: string[];
      existingFiles?: Record<string, string>;
      locale?: string;
    };

    // Validate required fields
    if (!projectId || !userId || !userInput || !task || !architectPlan) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Missing required fields: projectId, userId, userInput, task, architectPlan',
        },
        { status: 400 }
      );
    }

    console.log('[CODE_GENERATOR] Generating code:', {
      projectId,
      userId,
      taskId: task.id,
      taskTitle: task.title,
      taskType: task.type,
      locale,
      fileTreeSize: fileTree.length,
      existingFilesCount: Object.keys(existingFiles).length,
    });

    // Call the code generator agent
    const result = await runCodeGeneratorAgent({
      projectId,
      userId,
      userInput,
      task,
      architectPlan,
      fileTree,
      existingFiles,
      locale,
    });

    console.log('[CODE_GENERATOR] Code generated:', {
      projectId,
      taskId: task.id,
      actionsCount: result.plan.actions.length,
      diffsCount: result.plan.diffs.length,
      summary: result.plan.summary,
    });

    return NextResponse.json({
      ok: true,
      plan: result.plan,
      rawJson: result.rawJson,
    });
  } catch (err: any) {
    console.error('[CODE_GENERATOR] Error:', err);
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
