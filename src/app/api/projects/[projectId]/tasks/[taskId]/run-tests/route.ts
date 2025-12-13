/**
 * Phase 96.2: Re-run QA Endpoint
 * POST /api/projects/[projectId]/tasks/[taskId]/run-tests
 *
 * Allows manually triggering QA checks for a specific task.
 * Used by the "Re-run QA" button in the Task detail modal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { enqueueTests, type QaMode } from '@/lib/server/actions';

export const dynamic = 'force-dynamic';

// Dev bypass helper
function isDevEnv() {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_F0_ENV === 'emulator' ||
    process.env.NEXT_PUBLIC_USE_EMULATORS === '1'
  );
}

interface RouteContext {
  params: Promise<{ projectId: string; taskId: string }>;
}

interface RunTestsBody {
  qaMode?: QaMode;
}

export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // 1. Authenticate
    let uid = 'dev-user';

    if (isDevEnv()) {
      console.log('[Run Tests] Dev bypass enabled');
    } else {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      }

      const token = authHeader.split('Bearer ')[1];
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        uid = decodedToken.uid;
      } catch {
        return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
      }
    }

    // 2. Get params
    const { projectId, taskId } = await context.params;

    if (!projectId || !taskId) {
      return NextResponse.json(
        { ok: false, error: 'projectId and taskId are required' },
        { status: 400 }
      );
    }

    // 3. Parse body
    let body: RunTestsBody = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional, use defaults
    }

    const qaMode: QaMode = body.qaMode || 'static';

    console.log('[Run Tests] Enqueueing QA for task:', {
      projectId,
      taskId,
      qaMode,
      uid,
    });

    // 4. Enqueue run_tests action
    const action = await enqueueTests({
      projectId,
      taskId,
      qaMode,
      reason: 'manual',
      source: 'panel',
      createdBy: uid,
    });

    console.log('[Run Tests] Action enqueued:', action.id);

    return NextResponse.json({
      ok: true,
      actionId: action.id,
      message: `QA check (${qaMode}) enqueued for task ${taskId}`,
    });
  } catch (error: any) {
    console.error('[Run Tests] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to enqueue QA' },
      { status: 500 }
    );
  }
}
