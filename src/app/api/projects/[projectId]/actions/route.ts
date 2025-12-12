/**
 * Phase 95.1: Actions API
 * GET /api/projects/[projectId]/actions - List actions
 * POST /api/projects/[projectId]/actions - Create new action
 *
 * Unified actions system for all F0 operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import {
  listActions,
  enqueueAction,
  getActionStats,
  type ActionType,
  type ActionSource,
  type ActionStatus,
} from '@/lib/server/actions';

// Dev bypass helper
function isDevEnv() {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_F0_ENV === 'emulator' ||
    process.env.NEXT_PUBLIC_USE_EMULATORS === '1'
  );
}

/**
 * GET /api/projects/[projectId]/actions
 * List actions with filters
 *
 * Query params:
 * - type: ActionType
 * - status: ActionStatus (comma-separated for multiple)
 * - source: ActionSource
 * - taskId: string
 * - limit: number (default 50)
 * - startAfter: action ID for pagination
 * - stats: "true" to include stats
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);

  try {
    // 1. Authenticate (with dev bypass)
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

    // 2. Parse query params
    const type = searchParams.get('type') as ActionType | null;
    const statusParam = searchParams.get('status');
    const source = searchParams.get('source') as ActionSource | null;
    const taskId = searchParams.get('taskId');
    const limitParam = searchParams.get('limit');
    const startAfter = searchParams.get('startAfter');
    const includeStats = searchParams.get('stats') === 'true';

    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;

    // Parse status (can be comma-separated)
    let status: ActionStatus | ActionStatus[] | undefined;
    if (statusParam) {
      const statuses = statusParam.split(',') as ActionStatus[];
      status = statuses.length === 1 ? statuses[0] : statuses;
    }

    // 3. Get actions
    const actions = await listActions({
      projectId,
      type: type || undefined,
      status,
      source: source || undefined,
      taskId: taskId || undefined,
      limit,
      startAfter: startAfter || undefined,
    });

    // 4. Optionally get stats
    let stats;
    if (includeStats) {
      stats = await getActionStats(projectId);
    }

    // 5. Format response
    const formattedActions = actions.map((action) => ({
      ...action,
      createdAt: action.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: action.updatedAt?.toDate?.()?.toISOString() || null,
      startedAt: action.startedAt?.toDate?.()?.toISOString() || null,
      finishedAt: action.finishedAt?.toDate?.()?.toISOString() || null,
    }));

    console.log(`[Actions API] Listed ${actions.length} actions for project ${projectId}`);

    return NextResponse.json({
      actions: formattedActions,
      hasMore: actions.length === limit,
      nextCursor: actions.length > 0 ? actions[actions.length - 1].id : null,
      ...(stats && { stats }),
    });
  } catch (error: any) {
    console.error('[Actions API] GET Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to list actions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[projectId]/actions
 * Create a new action
 *
 * Body:
 * {
 *   type: ActionType,
 *   source?: ActionSource,
 *   taskId?: string,
 *   phaseId?: string,
 *   payload?: object,
 *   maxAttempts?: number
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    // 1. Authenticate (with dev bypass)
    let userId = 'dev-user';

    if (!isDevEnv()) {
      const authHeader = req.headers.get('authorization') || '';
      const [, token] = authHeader.split(' ');

      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      try {
        const decoded = await adminAuth.verifyIdToken(token);
        userId = decoded.uid;
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    // 2. Parse body
    const body = await req.json();
    const { type, source, taskId, phaseId, payload, maxAttempts } = body;

    // Validate type
    const validTypes: ActionType[] = [
      'execute_task',
      'run_tests',
      'deploy',
      'analyze_logs',
      'open_pr',
      'send_notification',
      'git_commit',
      'git_push',
    ];

    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 3. Create action
    const action = await enqueueAction({
      projectId,
      type,
      source: source || 'panel',
      taskId,
      phaseId,
      payload,
      createdBy: userId,
      maxAttempts,
    });

    // 4. Format response
    const formattedAction = {
      ...action,
      createdAt: action.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: action.updatedAt?.toDate?.()?.toISOString() || null,
    };

    console.log(`[Actions API] Created action ${action.id} (${type}) for project ${projectId}`);

    return NextResponse.json({
      ok: true,
      action: formattedAction,
    });
  } catch (error: any) {
    console.error('[Actions API] POST Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create action' },
      { status: 500 }
    );
  }
}
