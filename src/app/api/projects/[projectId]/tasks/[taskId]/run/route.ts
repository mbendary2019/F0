/**
 * Phase 93.6: Run Task via Auto-Executor
 * POST /api/projects/[projectId]/tasks/[taskId]/run
 *
 * Queues a task for auto-execution by the agent
 * Supports both 'projects' and 'ops_projects' collections
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { updateTaskStatus, type TaskStatus } from '@/lib/server/projectPlan';
import { logAiOperation } from '@/lib/server/aiLogs';
import { enqueueTaskExecution, logTaskActivity } from '@/lib/server/taskRunner';

export const dynamic = 'force-dynamic';

const db = adminDb;

// Dev bypass helper
function isDevEnv() {
  return process.env.NODE_ENV === 'development' ||
         process.env.NEXT_PUBLIC_F0_ENV === 'emulator' ||
         process.env.NEXT_PUBLIC_USE_EMULATORS === '1';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const { projectId, taskId } = await params;

  try {
    // Auth check
    let userId = 'anonymous';
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

    // Get task details
    const taskRef = db.collection('ops_projects').doc(projectId)
      .collection('tasks').doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = taskSnap.data();

    // Check if task is already in progress
    if (task?.status === 'in_progress') {
      return NextResponse.json(
        { error: 'Task is already in progress' },
        { status: 400 }
      );
    }

    // Update task status to in_progress (using ops_projects collection)
    await updateTaskStatus({
      projectId,
      taskId,
      status: 'in_progress' as TaskStatus,
      collectionName: 'ops_projects',
    });

    // Create a queued action for the auto-executor
    const actionRef = db.collection('ops_projects').doc(projectId)
      .collection('queued_actions').doc();

    await actionRef.set({
      type: 'execute_task',
      taskId,
      taskTitle: task?.title || 'Unknown Task',
      phaseId: task?.phaseId,
      status: 'pending',
      mode: task?.mode || 'refactor',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: userId,
    });

    // Log the operation
    await logAiOperation({
      projectId,
      taskId,
      origin: 'auto-executor',
      mode: (task?.mode as 'chat' | 'refactor' | 'task' | 'plan' | 'explain') || 'task',
      success: true, // Queued successfully
      status: 'pending',
      userPromptPreview: `Running task: ${task?.title}`,
      metadata: {
        actionId: actionRef.id,
        queuedAt: Date.now(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Task queued for execution',
      actionId: actionRef.id,
      task: {
        id: taskId,
        title: task?.title,
        status: 'in_progress',
      },
    });

  } catch (error: any) {
    console.error('[Run Task API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to run task' },
      { status: 500 }
    );
  }
}
