// src/app/api/agent/architect/route.ts

import { NextResponse } from 'next/server';
import { runArchitectAgent } from '@/lib/agent/roles/architectAgent';

/**
 * POST /api/agent/architect
 *
 * Runs the Architect Agent to generate a comprehensive technical architecture
 * and implementation roadmap for a project.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      projectId,
      userId,
      userInput,
      locale = 'en',
      intentType = 'UNKNOWN',
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

    console.log('[ARCHITECT] Generating architecture plan:', {
      projectId,
      userId,
      userInput: userInput.substring(0, 100),
      locale,
      intentType,
    });

    // Call the architect agent
    const result = await runArchitectAgent({
      projectId,
      userId,
      userInput,
      locale,
      intentType,
    });

    console.log('[ARCHITECT] Plan generated:', {
      projectId,
      modulesCount: result.plan.modules.length,
      apisCount: result.plan.apis.length,
      dataModelsCount: result.plan.dataModels.length,
      phasesCount: result.plan.phases.length,
      complexity: result.plan.complexity,
    });

    return NextResponse.json({
      ok: true,
      plan: result.plan,
      rawJson: result.rawJson,
    });
  } catch (err: any) {
    console.error('[ARCHITECT] Error generating plan:', err);

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
