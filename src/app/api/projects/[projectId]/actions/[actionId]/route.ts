/**
 * Phase 95.1: Single Action API
 * GET /api/projects/[projectId]/actions/[actionId] - Get action details
 * PATCH /api/projects/[projectId]/actions/[actionId] - Update action
 * DELETE /api/projects/[projectId]/actions/[actionId] - Cancel action
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import {
  getAction,
  updateActionStatus,
  cancelAction,
  retryAction,
  type ActionStatus,
} from '@/lib/server/actions';

export const dynamic = 'force-dynamic';

// Dev bypass helper
function isDevEnv() {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_F0_ENV === 'emulator' ||
    process.env.NEXT_PUBLIC_USE_EMULATORS === '1'
  );
}

/**
 * GET /api/projects/[projectId]/actions/[actionId]
 * Get action details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; actionId: string }> }
) {
  const { projectId, actionId } = await params;

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

    // 2. Get action
    const action = await getAction(actionId);

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // Verify project ownership
    if (action.projectId !== projectId) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // 3. Format response
    const formattedAction = {
      ...action,
      createdAt: action.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: action.updatedAt?.toDate?.()?.toISOString() || null,
      startedAt: action.startedAt?.toDate?.()?.toISOString() || null,
      finishedAt: action.finishedAt?.toDate?.()?.toISOString() || null,
    };

    return NextResponse.json({ action: formattedAction });
  } catch (error: any) {
    console.error('[Action API] GET Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get action' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[projectId]/actions/[actionId]
 * Update action status or retry
 *
 * Body:
 * {
 *   action: "retry" | "update",
 *   status?: ActionStatus,
 *   resultSummary?: string,
 *   errorMessage?: string
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; actionId: string }> }
) {
  const { projectId, actionId } = await params;

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

    // 2. Parse body
    const body = await req.json();
    const { action: actionType, status, resultSummary, errorMessage } = body;

    // 3. Get action
    const existingAction = await getAction(actionId);

    if (!existingAction) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // Verify project ownership
    if (existingAction.projectId !== projectId) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // 4. Handle action type
    if (actionType === 'retry') {
      const success = await retryAction(actionId);
      if (!success) {
        return NextResponse.json(
          { error: 'Cannot retry action - must be in failed status' },
          { status: 400 }
        );
      }

      const updatedAction = await getAction(actionId);
      return NextResponse.json({
        ok: true,
        message: 'Action queued for retry',
        action: {
          ...updatedAction,
          createdAt: updatedAction?.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: updatedAction?.updatedAt?.toDate?.()?.toISOString() || null,
        },
      });
    }

    // Regular status update
    if (!status) {
      return NextResponse.json(
        { error: 'status is required for update' },
        { status: 400 }
      );
    }

    const validStatuses: ActionStatus[] = ['pending', 'running', 'succeeded', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    await updateActionStatus({
      actionId,
      status,
      resultSummary,
      errorMessage,
    });

    const updatedAction = await getAction(actionId);

    console.log(`[Action API] Updated action ${actionId}: status=${status}`);

    return NextResponse.json({
      ok: true,
      action: {
        ...updatedAction,
        createdAt: updatedAction?.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: updatedAction?.updatedAt?.toDate?.()?.toISOString() || null,
        startedAt: updatedAction?.startedAt?.toDate?.()?.toISOString() || null,
        finishedAt: updatedAction?.finishedAt?.toDate?.()?.toISOString() || null,
      },
    });
  } catch (error: any) {
    console.error('[Action API] PATCH Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update action' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[projectId]/actions/[actionId]
 * Cancel action
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; actionId: string }> }
) {
  const { projectId, actionId } = await params;

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

    // 2. Get action
    const existingAction = await getAction(actionId);

    if (!existingAction) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // Verify project ownership
    if (existingAction.projectId !== projectId) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // 3. Cancel action
    const success = await cancelAction(actionId);

    if (!success) {
      return NextResponse.json(
        { error: 'Cannot cancel action - must be in pending or running status' },
        { status: 400 }
      );
    }

    console.log(`[Action API] Cancelled action ${actionId}`);

    return NextResponse.json({
      ok: true,
      message: 'Action cancelled',
    });
  } catch (error: any) {
    console.error('[Action API] DELETE Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to cancel action' },
      { status: 500 }
    );
  }
}
