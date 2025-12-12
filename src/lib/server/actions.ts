/**
 * Phase 95.1: Unified Action System
 *
 * Central schema and helpers for all F0 actions:
 * - execute_task: Execute a project task
 * - run_tests: Run QA/tests
 * - deploy: Deploy to hosting
 * - analyze_logs: Analyze error logs
 * - open_pr: Open a GitHub PR
 * - send_notification: Send notifications
 *
 * Schema:
 *   ops_actions/{actionId}
 */

import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

const db = adminDb;

// ============================================
// Helper: Deep clean undefined values from objects
// Firestore doesn't accept undefined values anywhere in the object tree
// ============================================

/**
 * Recursively removes undefined values from any data structure
 * Works on nested objects and arrays
 */
function deepCleanFirestoreValue(value: any): any {
  if (value === undefined) return undefined;

  // Arrays: clean each element and filter out undefined
  if (Array.isArray(value)) {
    return value
      .map((v) => deepCleanFirestoreValue(v))
      .filter((v) => v !== undefined);
  }

  // Plain objects: recursively clean each key
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const cleanedV = deepCleanFirestoreValue(v);
      if (cleanedV !== undefined) {
        cleaned[k] = cleanedV;
      }
    }
    return cleaned;
  }

  // Other types (string, number, boolean, Timestamp, null, etc.)
  return value;
}

/**
 * Clean an object for Firestore - removes all undefined values recursively
 */
export function cleanFirestoreData<T extends Record<string, any>>(data: T): T {
  return deepCleanFirestoreValue(data) as T;
}

// Legacy helper - kept for backwards compatibility
function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return cleanFirestoreData(obj);
}

// ============================================
// Types
// ============================================

export type ActionType =
  | 'execute_task'
  | 'run_tests'
  | 'deploy'
  | 'analyze_logs'
  | 'open_pr'
  | 'send_notification'
  | 'git_commit'
  | 'git_push';

export type ActionStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type ActionSource =
  | 'panel'       // From web panel UI
  | 'auto'        // From auto-executor
  | 'desktop'     // From desktop IDE
  | 'web'         // From web IDE
  | 'agent'       // From F0 agent
  | 'scheduler';  // From scheduled job

export interface F0Action {
  id: string;
  projectId: string;
  type: ActionType;
  status: ActionStatus;

  // Links (optional based on action type)
  taskId?: string;
  phaseId?: string;
  deploymentId?: string;
  prNumber?: number;

  // Source tracking
  source: ActionSource;
  createdBy?: string; // User ID or 'system'

  // Type-specific payload
  payload?: Record<string, any>;

  // Results
  resultSummary?: string;
  errorMessage?: string;
  output?: any;

  // Retry tracking
  attempts: number;
  maxAttempts: number;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startedAt?: Timestamp;
  finishedAt?: Timestamp;
}

// ============================================
// QA Mode Types (Phase 96.2)
// ============================================

export type QaMode = 'static' | 'ai' | 'both';

// Payload types for different action types
export interface ExecuteTaskPayload {
  taskTitle?: string;
  mode?: 'chat' | 'refactor' | 'deploy' | 'plan' | 'explain';
}

export interface RunTestsPayload {
  // Phase 96.2: Enhanced QA payload
  qaMode: QaMode;
  reason?: 'post_task_execution' | 'manual' | 'scheduled';
  filesChanged?: string[];
  executedActionId?: string;
  patchesCount?: number;
  // Legacy fields (kept for backward compatibility)
  testPath?: string;
  testType?: 'unit' | 'integration' | 'e2e';
}

export interface DeployPayload {
  environment?: 'preview' | 'staging' | 'production';
  target?: 'vercel' | 'firebase' | 'cloudrun';
}

export interface OpenPrPayload {
  branch?: string;
  baseBranch?: string;
  title?: string;
  body?: string;
}

export interface AnalyzeLogsPayload {
  logSource?: 'firebase' | 'vercel' | 'cloudrun';
  timeRange?: 'hour' | 'day' | 'week';
  errorId?: string;
}

// ============================================
// Collection Reference
// ============================================

function getActionsRef() {
  return db.collection('ops_actions');
}

// ============================================
// Enqueue Action (Create)
// ============================================

/**
 * Create and enqueue a new action
 *
 * @param params Action parameters
 * @returns The created action
 */
export async function enqueueAction(params: {
  projectId: string;
  type: ActionType;
  source: ActionSource;
  taskId?: string;
  phaseId?: string;
  payload?: Record<string, any>;
  createdBy?: string;
  dedupeKey?: string; // Optional key to prevent duplicate pending actions
  maxAttempts?: number;
}): Promise<F0Action> {
  const {
    projectId,
    type,
    source,
    taskId,
    phaseId,
    payload,
    createdBy,
    dedupeKey,
    maxAttempts = 3,
  } = params;

  const actionsRef = getActionsRef();

  // Check for duplicate if dedupeKey provided
  if (dedupeKey) {
    const existingQuery = await actionsRef
      .where('projectId', '==', projectId)
      .where('type', '==', type)
      .where('status', 'in', ['pending', 'running'])
      .where('payload.dedupeKey', '==', dedupeKey)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      console.log(`[Actions] Duplicate action found for dedupeKey: ${dedupeKey}`);
      const existingDoc = existingQuery.docs[0];
      return { id: existingDoc.id, ...existingDoc.data() } as F0Action;
    }
  }

  const now = Timestamp.now();
  const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const action: F0Action = {
    id: actionId,
    projectId,
    type,
    status: 'pending',
    taskId,
    phaseId,
    source,
    createdBy: createdBy || 'system',
    payload: dedupeKey ? { ...payload, dedupeKey } : payload,
    attempts: 0,
    maxAttempts,
    createdAt: now,
    updatedAt: now,
  };

  // Remove undefined values before saving to Firestore
  await actionsRef.doc(actionId).set(removeUndefined(action));

  console.log(`[Actions] Enqueued action: ${actionId} (${type}) for project ${projectId}`);

  return action;
}

// ============================================
// Update Action Status
// ============================================

/**
 * Update action status with proper state tracking
 */
export async function updateActionStatus(params: {
  actionId: string;
  status: ActionStatus;
  resultSummary?: string;
  errorMessage?: string;
  output?: any;
}): Promise<void> {
  const { actionId, status, resultSummary, errorMessage, output } = params;

  const actionRef = getActionsRef().doc(actionId);
  const now = Timestamp.now();

  const updates: Record<string, any> = {
    status,
    updatedAt: now,
  };

  // Add timing based on status
  if (status === 'running') {
    updates.startedAt = now;
  } else if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
    updates.finishedAt = now;
  }

  // Add results (only if defined)
  if (resultSummary !== undefined) {
    updates.resultSummary = resultSummary;
  }
  if (errorMessage !== undefined) {
    updates.errorMessage = errorMessage;
  }
  if (output !== undefined) {
    // Deep clean output to remove any nested undefined values
    updates.output = cleanFirestoreData(output);
  }

  // Deep clean entire update object before sending to Firestore
  await actionRef.update(cleanFirestoreData(updates));

  console.log(`[Actions] Updated action ${actionId}: status=${status}`);
}

// ============================================
// Increment Attempts
// ============================================

/**
 * Increment attempt count and optionally set error
 */
export async function incrementActionAttempts(params: {
  actionId: string;
  errorMessage?: string;
}): Promise<{ attempts: number; maxAttempts: number; shouldRetry: boolean }> {
  const { actionId, errorMessage } = params;

  const actionRef = getActionsRef().doc(actionId);

  // Use transaction to safely increment
  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(actionRef);
    if (!doc.exists) {
      throw new Error(`Action ${actionId} not found`);
    }

    const data = doc.data() as F0Action;
    const newAttempts = data.attempts + 1;
    const shouldRetry = newAttempts < data.maxAttempts;

    const updates: Record<string, any> = {
      attempts: newAttempts,
      updatedAt: Timestamp.now(),
    };

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    // If no more retries, mark as failed
    if (!shouldRetry) {
      updates.status = 'failed';
      updates.finishedAt = Timestamp.now();
    } else {
      // Reset to pending for retry
      updates.status = 'pending';
    }

    tx.update(actionRef, updates);

    return {
      attempts: newAttempts,
      maxAttempts: data.maxAttempts,
      shouldRetry,
    };
  });

  console.log(
    `[Actions] Attempt ${result.attempts}/${result.maxAttempts} for action ${actionId}. ` +
      `Retry: ${result.shouldRetry}`
  );

  return result;
}

// ============================================
// Get Action
// ============================================

/**
 * Get a single action by ID
 */
export async function getAction(actionId: string): Promise<F0Action | null> {
  const doc = await getActionsRef().doc(actionId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as F0Action;
}

// ============================================
// Get Next Pending Action
// ============================================

/**
 * Get the next pending action for a project (optionally filtered by type)
 */
export async function getNextPendingAction(params: {
  projectId: string;
  type?: ActionType;
}): Promise<F0Action | null> {
  const { projectId, type } = params;

  let query = getActionsRef()
    .where('projectId', '==', projectId)
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'asc')
    .limit(1);

  if (type) {
    query = query.where('type', '==', type);
  }

  const snapshot = await query.get();
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as F0Action;
}

// ============================================
// List Actions
// ============================================

export interface ListActionsParams {
  projectId?: string;
  type?: ActionType;
  status?: ActionStatus | ActionStatus[];
  source?: ActionSource;
  taskId?: string;
  limit?: number;
  startAfter?: string; // action ID for pagination
}

/**
 * List actions with flexible filters
 */
export async function listActions(params: ListActionsParams): Promise<F0Action[]> {
  const { projectId, type, status, source, taskId, limit = 50, startAfter } = params;

  let query = getActionsRef().orderBy('createdAt', 'desc').limit(limit) as FirebaseFirestore.Query;

  if (projectId) {
    query = query.where('projectId', '==', projectId);
  }
  if (type) {
    query = query.where('type', '==', type);
  }
  if (status) {
    if (Array.isArray(status)) {
      query = query.where('status', 'in', status);
    } else {
      query = query.where('status', '==', status);
    }
  }
  if (source) {
    query = query.where('source', '==', source);
  }
  if (taskId) {
    query = query.where('taskId', '==', taskId);
  }

  if (startAfter) {
    const startAfterDoc = await getActionsRef().doc(startAfter).get();
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc);
    }
  }

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as F0Action[];
}

// ============================================
// Cancel Action
// ============================================

/**
 * Cancel a pending or running action
 */
export async function cancelAction(actionId: string): Promise<boolean> {
  const actionRef = getActionsRef().doc(actionId);
  const doc = await actionRef.get();

  if (!doc.exists) {
    console.warn(`[Actions] Cannot cancel: action ${actionId} not found`);
    return false;
  }

  const data = doc.data() as F0Action;

  if (data.status !== 'pending' && data.status !== 'running') {
    console.warn(`[Actions] Cannot cancel: action ${actionId} is ${data.status}`);
    return false;
  }

  await actionRef.update({
    status: 'cancelled',
    updatedAt: Timestamp.now(),
    finishedAt: Timestamp.now(),
  });

  console.log(`[Actions] Cancelled action ${actionId}`);
  return true;
}

// ============================================
// Retry Action
// ============================================

/**
 * Retry a failed action
 */
export async function retryAction(actionId: string): Promise<boolean> {
  const actionRef = getActionsRef().doc(actionId);
  const doc = await actionRef.get();

  if (!doc.exists) {
    console.warn(`[Actions] Cannot retry: action ${actionId} not found`);
    return false;
  }

  const data = doc.data() as F0Action;

  if (data.status !== 'failed') {
    console.warn(`[Actions] Cannot retry: action ${actionId} is ${data.status}`);
    return false;
  }

  await actionRef.update({
    status: 'pending',
    updatedAt: Timestamp.now(),
    errorMessage: FieldValue.delete(),
    startedAt: FieldValue.delete(),
    finishedAt: FieldValue.delete(),
    // Note: we don't reset attempts - it keeps counting
  });

  console.log(`[Actions] Queued retry for action ${actionId}`);
  return true;
}

// ============================================
// Get Action Stats
// ============================================

/**
 * Get action statistics for a project
 */
export async function getActionStats(projectId: string): Promise<{
  total: number;
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
}> {
  const [pending, running, succeeded, failed, cancelled] = await Promise.all([
    getActionsRef().where('projectId', '==', projectId).where('status', '==', 'pending').count().get(),
    getActionsRef().where('projectId', '==', projectId).where('status', '==', 'running').count().get(),
    getActionsRef().where('projectId', '==', projectId).where('status', '==', 'succeeded').count().get(),
    getActionsRef().where('projectId', '==', projectId).where('status', '==', 'failed').count().get(),
    getActionsRef().where('projectId', '==', projectId).where('status', '==', 'cancelled').count().get(),
  ]);

  const stats = {
    pending: pending.data().count,
    running: running.data().count,
    succeeded: succeeded.data().count,
    failed: failed.data().count,
    cancelled: cancelled.data().count,
    total: 0,
  };

  stats.total = stats.pending + stats.running + stats.succeeded + stats.failed + stats.cancelled;

  return stats;
}

// ============================================
// Helper: Create Task Execution Action
// ============================================

/**
 * Convenience function to enqueue an execute_task action
 */
export async function enqueueTaskExecution(params: {
  projectId: string;
  taskId: string;
  taskTitle?: string;
  phaseId?: string;
  mode?: 'chat' | 'refactor' | 'deploy' | 'plan' | 'explain';
  source?: ActionSource;
  createdBy?: string;
}): Promise<F0Action> {
  const { projectId, taskId, taskTitle, phaseId, mode, source = 'auto', createdBy } = params;

  return enqueueAction({
    projectId,
    type: 'execute_task',
    source,
    taskId,
    phaseId,
    createdBy,
    payload: {
      taskTitle,
      mode: mode || 'refactor',
    } as ExecuteTaskPayload,
    dedupeKey: `task_${taskId}`, // Prevent duplicate executions
  });
}

// ============================================
// Helper: Create Deploy Action
// ============================================

/**
 * Convenience function to enqueue a deploy action
 */
export async function enqueueDeployment(params: {
  projectId: string;
  environment?: 'preview' | 'staging' | 'production';
  target?: 'vercel' | 'firebase' | 'cloudrun';
  source?: ActionSource;
  createdBy?: string;
}): Promise<F0Action> {
  const { projectId, environment = 'preview', target = 'vercel', source = 'panel', createdBy } = params;

  return enqueueAction({
    projectId,
    type: 'deploy',
    source,
    createdBy,
    payload: {
      environment,
      target,
    } as DeployPayload,
    dedupeKey: `deploy_${environment}_${target}`,
  });
}

// ============================================
// Helper: Create Run Tests Action (Phase 96.2 Enhanced)
// ============================================

/**
 * Convenience function to enqueue a run_tests action
 * Phase 96.2: Enhanced with QA mode support
 */
export async function enqueueTests(params: {
  projectId: string;
  taskId?: string;
  qaMode?: QaMode;
  reason?: 'post_task_execution' | 'manual' | 'scheduled';
  filesChanged?: string[];
  executedActionId?: string;
  patchesCount?: number;
  source?: ActionSource;
  createdBy?: string;
  // Legacy fields
  testPath?: string;
  testType?: 'unit' | 'integration' | 'e2e';
}): Promise<F0Action> {
  const {
    projectId,
    taskId,
    qaMode = 'static',
    reason = 'manual',
    filesChanged,
    executedActionId,
    patchesCount,
    source = 'panel',
    createdBy,
    testPath,
    testType,
  } = params;

  return enqueueAction({
    projectId,
    type: 'run_tests',
    source,
    taskId,
    createdBy,
    payload: {
      qaMode,
      reason,
      filesChanged,
      executedActionId,
      patchesCount,
      testPath,
      testType,
    } as RunTestsPayload,
  });
}
