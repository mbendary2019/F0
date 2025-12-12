/**
 * Phase 93.5.3: Task Runner
 *
 * Handles task execution queueing and management
 * - enqueueTaskExecution: Adds a task to the execution queue
 * - Deduplication: Prevents duplicate pending actions for same task
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

const db = adminDb;

export type TaskExecutionSource = 'panel' | 'desktop' | 'web' | 'auto' | 'agent';

export interface EnqueueTaskParams {
  projectId: string;
  taskId: string;
  source?: TaskExecutionSource;
  priority?: number; // Higher = more urgent
  metadata?: Record<string, any>;
}

export interface EnqueueResult {
  id: string;
  deduped: boolean;
  message: string;
}

/**
 * Add a task to the execution queue
 * Checks for existing pending actions to prevent duplicates
 */
export async function enqueueTaskExecution(params: EnqueueTaskParams): Promise<EnqueueResult> {
  const {
    projectId,
    taskId,
    source = 'panel',
    priority = 0,
    metadata = {},
  } = params;

  const actionsCol = db.collection('ops_actions');

  // Check for existing pending action for this task
  const existingSnap = await actionsCol
    .where('projectId', '==', projectId)
    .where('taskId', '==', taskId)
    .where('type', '==', 'execute_task')
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const existingId = existingSnap.docs[0].id;
    console.log(`[TaskRunner] Task ${taskId} already queued (action: ${existingId})`);
    return {
      id: existingId,
      deduped: true,
      message: 'Task already queued for execution',
    };
  }

  // Create new action
  const ref = actionsCol.doc();
  const now = Timestamp.now();

  await ref.set({
    projectId,
    taskId,
    type: 'execute_task',
    status: 'pending',
    source,
    priority,
    metadata,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[TaskRunner] Queued task ${taskId} for execution (action: ${ref.id})`);

  return {
    id: ref.id,
    deduped: false,
    message: 'Task queued for execution',
  };
}

/**
 * Get pending actions for a project
 */
export async function getPendingActions(projectId: string): Promise<any[]> {
  const actionsCol = db.collection('ops_actions');

  const snap = await actionsCol
    .where('projectId', '==', projectId)
    .where('status', '==', 'pending')
    .orderBy('priority', 'desc')
    .orderBy('createdAt', 'asc')
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Update action status
 */
export async function updateActionStatus(
  actionId: string,
  status: 'pending' | 'running' | 'completed' | 'failed',
  result?: any
): Promise<void> {
  const actionRef = db.collection('ops_actions').doc(actionId);

  const updateData: any = {
    status,
    updatedAt: Timestamp.now(),
  };

  if (status === 'running') {
    updateData.startedAt = Timestamp.now();
  }

  if (status === 'completed' || status === 'failed') {
    updateData.completedAt = Timestamp.now();
    if (result) {
      updateData.result = result;
    }
  }

  await actionRef.update(updateData);
  console.log(`[TaskRunner] Action ${actionId} status: ${status}`);
}

/**
 * Log AI activity for a task execution
 */
export async function logTaskActivity(params: {
  projectId: string;
  taskId: string;
  actionId: string;
  status: 'started' | 'completed' | 'failed';
  details?: string;
  tokensUsed?: number;
}): Promise<void> {
  const { projectId, taskId, actionId, status, details, tokensUsed } = params;

  const logsCol = db.collection('ops_projects').doc(projectId).collection('ai_logs');

  await logsCol.add({
    type: 'task_execution',
    taskId,
    actionId,
    status,
    details: details || `Task ${status}`,
    tokensUsed: tokensUsed || 0,
    createdAt: Timestamp.now(),
  });

  console.log(`[TaskRunner] Logged activity: task ${taskId} ${status}`);
}
