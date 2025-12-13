/**
 * Phase 93.5: Project Plan API
 * GET /api/projects/[projectId]/plan - Get full plan (phases + tasks)
 * POST /api/projects/[projectId]/plan - Save plan from agent
 * PATCH /api/projects/[projectId]/plan - Update task status
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import {
  getProjectPlan,
  saveProjectPlan,
  updateTaskStatus,
  getProjectProgress,
  getNextPendingTask,
  activateFirstPendingPhase,
  type AgentPhase,
  type AgentTask,
  type TaskStatus,
} from '@/lib/server/projectPlan';

export const dynamic = 'force-dynamic';

// Dev bypass helper
function isDevEnv() {
  return process.env.NODE_ENV === 'development' ||
         process.env.NEXT_PUBLIC_F0_ENV === 'emulator' ||
         process.env.NEXT_PUBLIC_USE_EMULATORS === '1';
}

/**
 * GET - Get project plan (phases + tasks)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const includeProgress = searchParams.get('progress') === 'true';
  const getNext = searchParams.get('next') === 'true';

  try {
    // Auth check
    if (!isDevEnv()) {
      const authHeader = req.headers.get('authorization') || '';
      const [, token] = authHeader.split(' ');
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      try {
        await adminAuth.verifyIdToken(token);
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    // Get next pending task only
    if (getNext) {
      const nextTask = await getNextPendingTask(projectId);
      return NextResponse.json({ nextTask });
    }

    // Get full plan
    const { phases, tasks } = await getProjectPlan(projectId);

    const response: any = { phases, tasks };

    // Include progress stats
    if (includeProgress) {
      response.progress = await getProjectProgress(projectId);
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Plan API] GET Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get plan' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save project plan (from agent F0_JSON)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    // Auth check
    if (!isDevEnv()) {
      const authHeader = req.headers.get('authorization') || '';
      const [, token] = authHeader.split(' ');
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      try {
        await adminAuth.verifyIdToken(token);
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { phases, tasks } = body;

    if (!phases || !Array.isArray(phases)) {
      return NextResponse.json({ error: 'phases array required' }, { status: 400 });
    }

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json({ error: 'tasks array required' }, { status: 400 });
    }

    // Map to AgentPhase/AgentTask format
    const mappedPhases: AgentPhase[] = phases.map((p: any, idx: number) => ({
      id: p.id ?? `phase-${idx + 1}`,
      index: p.index ?? idx + 1,
      title: p.title || `Phase ${idx + 1}`,
    }));

    const mappedTasks: AgentTask[] = tasks.map((t: any, idx: number) => ({
      id: t.id ?? `task-${idx + 1}`,
      phaseId: t.phaseId || 'phase-1',
      title: t.title || `Task ${idx + 1}`,
      description: t.description || '',
      mode: t.mode ?? 'refactor',
      priority: t.priority ?? 'medium',
      difficulty: t.difficulty ?? 'medium',
    }));

    await saveProjectPlan({
      projectId,
      phases: mappedPhases,
      tasks: mappedTasks,
    });

    // Auto-activate first phase
    await activateFirstPendingPhase(projectId);

    return NextResponse.json({
      success: true,
      phasesCount: mappedPhases.length,
      tasksCount: mappedTasks.length,
    });

  } catch (error: any) {
    console.error('[Plan API] POST Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save plan' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update task status
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    // Auth check
    if (!isDevEnv()) {
      const authHeader = req.headers.get('authorization') || '';
      const [, token] = authHeader.split(' ');
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      try {
        await adminAuth.verifyIdToken(token);
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { taskId, status } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }

    if (!status || !['pending', 'in_progress', 'completed', 'blocked'].includes(status)) {
      return NextResponse.json({ error: 'Valid status required' }, { status: 400 });
    }

    await updateTaskStatus({
      projectId,
      taskId,
      status: status as TaskStatus,
      collectionName: 'ops_projects',
    });

    // Get updated progress
    const progress = await getProjectProgress(projectId);

    return NextResponse.json({
      success: true,
      taskId,
      status,
      progress,
    });

  } catch (error: any) {
    console.error('[Plan API] PATCH Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update task' },
      { status: 500 }
    );
  }
}
