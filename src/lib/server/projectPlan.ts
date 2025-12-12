/**
 * Phase 93.5: Project Plan Persistence
 *
 * Saves and manages project phases and tasks in Firestore
 * Schema:
 *   ops_projects/{projectId}/phases/{phaseId}
 *   ops_projects/{projectId}/tasks/{taskId}
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { cleanFirestoreData } from '@/lib/server/actions';

const db = adminDb;

// Use the deep cleaner from actions.ts
const removeUndefined = cleanFirestoreData;

// ============================================
// Types
// ============================================

export type PhaseStatus = 'pending' | 'active' | 'completed';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type TaskMode = 'chat' | 'refactor' | 'deploy' | 'plan' | 'explain';
export type Priority = 'low' | 'medium' | 'high';
export type Difficulty = 'low' | 'medium' | 'high';

// Phase 96.1: QA Status types
export type QaStatus = 'not_run' | 'passed' | 'failed';

export interface AgentPhase {
  id: string;        // "phase-1"
  index: number;     // 1, 2, 3...
  title: string;
}

export interface AgentTask {
  id: string;        // "task-1"
  phaseId: string;   // "phase-1"
  title: string;
  description: string;
  mode: TaskMode;
  priority?: Priority;
  difficulty?: Difficulty;
}

export interface PhaseDoc {
  id: string;
  index: number;
  title: string;
  status: PhaseStatus;
  completion: number; // 0-100
}

export interface TaskDoc {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  mode: TaskMode;
  status: TaskStatus;
  priority: Priority;
  difficulty: Difficulty;
  createdAt: any;
  updatedAt: any;
  // Phase 96.1: QA fields
  lastQaStatus?: QaStatus;
  lastQaSummary?: string;
  lastQaAt?: any;
}

// ============================================
// Save Project Plan
// ============================================

/**
 * Save a complete project plan (phases + tasks) to Firestore
 * Called after agent generates F0_JSON with plan
 *
 * NEW BEHAVIOR (Smart Update):
 * - Uses stable IDs (phase-1, phase-2, etc.) to update existing docs instead of creating duplicates
 * - Preserves status/completion for phases/tasks that have started work (status != 'pending')
 * - Only updates title/description for in-progress tasks, never resets their status
 * - CLEANS UP old legacy IDs (mvp, phase1, etc.) that don't match stable pattern
 */
export async function saveProjectPlan(params: {
  projectId: string;
  phases: AgentPhase[];
  tasks: AgentTask[];
  collectionName?: string; // Support both 'ops_projects' and 'projects'
}): Promise<void> {
  const { projectId, phases, tasks, collectionName = 'ops_projects' } = params;

  const projectRef = db.collection(collectionName).doc(projectId);

  // Ensure project doc exists
  await projectRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  const phasesCol = projectRef.collection('phases');
  const tasksCol = projectRef.collection('tasks');
  const now = Timestamp.now();

  // ============================================
  // STEP 0: Clean up old legacy phases/tasks that don't match stable ID pattern
  // ============================================
  const stablePhaseIds = new Set(phases.map((_, i) => `phase-${i + 1}`));
  const stableTaskIdPrefix = 'phase-'; // All stable task IDs start with "phase-X-task-Y"

  // Get all existing phases
  const existingPhasesSnap = await phasesCol.get();
  const legacyPhaseIds: string[] = [];

  existingPhasesSnap.forEach((doc) => {
    const docId = doc.id;
    // Check if it's NOT a stable ID (phase-1, phase-2, etc.) or if it's beyond our new phase count
    const isStableFormat = /^phase-\d+$/.test(docId);
    if (!isStableFormat || !stablePhaseIds.has(docId)) {
      legacyPhaseIds.push(docId);
    }
  });

  // Delete legacy phases (but preserve their work by logging)
  if (legacyPhaseIds.length > 0) {
    console.log(`[Project Plan] Cleaning up ${legacyPhaseIds.length} legacy phases:`, legacyPhaseIds);
    for (const legacyId of legacyPhaseIds) {
      const legacyDoc = existingPhasesSnap.docs.find((d) => d.id === legacyId);
      if (legacyDoc) {
        const data = legacyDoc.data();
        // Only delete if it has no significant work (pending with 0 completion)
        if (data.status === 'pending' && (data.completion === 0 || data.completion === undefined)) {
          await phasesCol.doc(legacyId).delete();
          console.log(`[Project Plan] Deleted legacy phase: ${legacyId} (no work done)`);
        } else {
          // Archive instead of delete - mark as archived
          await phasesCol.doc(legacyId).update({ archived: true, archivedAt: now });
          console.log(`[Project Plan] Archived legacy phase: ${legacyId} (has work: ${data.status}, ${data.completion}%)`);
        }
      }
    }
  }

  // Get all existing tasks and clean up legacy ones
  const existingTasksSnap = await tasksCol.get();
  const legacyTaskIds: string[] = [];

  existingTasksSnap.forEach((doc) => {
    const docId = doc.id;
    // Check if it's NOT a stable ID format (phase-X-task-Y)
    const isStableFormat = /^phase-\d+-task-\d+$/.test(docId);
    if (!isStableFormat) {
      legacyTaskIds.push(docId);
    }
  });

  // Delete legacy tasks
  if (legacyTaskIds.length > 0) {
    console.log(`[Project Plan] Cleaning up ${legacyTaskIds.length} legacy tasks:`, legacyTaskIds.slice(0, 5), '...');
    for (const legacyId of legacyTaskIds) {
      const legacyDoc = existingTasksSnap.docs.find((d) => d.id === legacyId);
      if (legacyDoc) {
        const data = legacyDoc.data();
        // Only delete if it has no significant work
        if (data.status === 'pending') {
          await tasksCol.doc(legacyId).delete();
        } else {
          // Archive instead of delete
          await tasksCol.doc(legacyId).update({ archived: true, archivedAt: now });
          console.log(`[Project Plan] Archived legacy task: ${legacyId} (status: ${data.status})`);
        }
      }
    }
  }

  // ============================================
  // Save Phases with Stable IDs + Status Protection
  // ============================================
  for (let i = 0; i < phases.length; i++) {
    const src = phases[i];

    // Use stable ID: phase-1, phase-2, etc.
    const phaseId = `phase-${i + 1}`;
    const ref = phasesCol.doc(phaseId);

    // Check existing phase
    const existing = await ref.get();
    const existingStatus = existing.exists ? existing.get('status') : null;
    const existingCompletion = existing.exists ? existing.get('completion') : null;

    // Determine status:
    // - If existing has work done (status != pending), preserve it
    // - Otherwise, first phase is 'active', rest are 'pending'
    let status: PhaseStatus;
    if (existingStatus && existingStatus !== 'pending') {
      status = existingStatus as PhaseStatus;
    } else {
      status = i === 0 ? 'active' : 'pending';
    }

    // Preserve completion if exists
    const completion = typeof existingCompletion === 'number' ? existingCompletion : 0;

    await ref.set(
      {
        index: i + 1,
        title: src.title,
        status,
        completion,
        updatedAt: now,
      },
      { merge: true }
    );

    console.log(`[Project Plan] Phase ${phaseId}: ${src.title} (status: ${status}, completion: ${completion}%)`);
  }

  // ============================================
  // Save Tasks with Stable IDs + Status Protection
  // ============================================
  // Group tasks by phase for stable indexing
  const tasksByPhase: Record<string, typeof tasks> = {};
  for (const task of tasks) {
    const phaseKey = task.phaseId || 'phase-1';
    if (!tasksByPhase[phaseKey]) {
      tasksByPhase[phaseKey] = [];
    }
    tasksByPhase[phaseKey].push(task);
  }

  for (const [phaseId, phaseTasks] of Object.entries(tasksByPhase)) {
    for (let i = 0; i < phaseTasks.length; i++) {
      const t = phaseTasks[i];

      // Use stable ID: phase-1-task-1, phase-1-task-2, etc.
      const taskId = `${phaseId}-task-${i + 1}`;
      const ref = tasksCol.doc(taskId);

      // Check existing task
      const existing = await ref.get();
      const existingStatus = existing.exists ? existing.get('status') : null;
      const existingCreatedAt = existing.exists ? existing.get('createdAt') : null;

      // Determine status:
      // - If existing has work done (status != pending), preserve it
      // - Otherwise, set to 'pending'
      let status: TaskStatus;
      if (existingStatus && existingStatus !== 'pending') {
        // Task already in_progress, completed, or blocked - don't reset!
        status = existingStatus as TaskStatus;
        console.log(`[Project Plan] Task ${taskId}: preserving status '${status}' (has work)`);
      } else {
        status = 'pending';
      }

      await ref.set(
        {
          phaseId,
          title: t.title,
          description: t.description,
          mode: t.mode || 'refactor',
          priority: t.priority ?? 'medium',
          difficulty: t.difficulty ?? 'medium',
          status,
          createdAt: existingCreatedAt ?? now,
          updatedAt: now,
        },
        { merge: true }
      );
    }
  }

  console.log(`[Project Plan] Saved ${phases.length} phases and ${tasks.length} tasks for project ${projectId} (smart update)`);
}

// ============================================
// Update Task Status
// ============================================

/**
 * Update task status and recalculate phase completion
 */
export async function updateTaskStatus(params: {
  projectId: string;
  taskId: string;
  status: TaskStatus;
  collectionName?: string; // Support both 'ops_projects' and 'projects'
}): Promise<void> {
  const { projectId, taskId, status, collectionName = 'ops_projects' } = params;

  const projectRef = db.collection(collectionName).doc(projectId);
  const taskRef = projectRef.collection('tasks').doc(taskId);

  // Update task (remove undefined values)
  await taskRef.update(removeUndefined({
    status,
    updatedAt: Timestamp.now(),
  }));

  // Get phase ID from task
  const taskSnap = await taskRef.get();
  const phaseId = taskSnap.get('phaseId');

  if (!phaseId) {
    console.warn(`[Project Plan] Task ${taskId} has no phaseId`);
    return;
  }

  // Recalculate phase completion
  await recalculatePhaseCompletion(projectId, phaseId, collectionName);
}

/**
 * Recalculate phase completion percentage based on tasks
 */
export async function recalculatePhaseCompletion(
  projectId: string,
  phaseId: string,
  collectionName: string = 'ops_projects'
): Promise<number> {
  const projectRef = db.collection(collectionName).doc(projectId);

  // Get all tasks for this phase
  const tasksSnap = await projectRef
    .collection('tasks')
    .where('phaseId', '==', phaseId)
    .get();

  const total = tasksSnap.size;
  if (!total) return 0;

  let completed = 0;
  tasksSnap.forEach((doc) => {
    if (doc.get('status') === 'completed') {
      completed += 1;
    }
  });

  const completion = Math.round((completed / total) * 100);

  // Update phase
  const phaseRef = projectRef.collection('phases').doc(phaseId);
  await phaseRef.update({
    completion,
    status: completion === 100 ? 'completed' : (completion > 0 ? 'active' : 'pending'),
  });

  console.log(`[Project Plan] Phase ${phaseId} completion: ${completion}% (${completed}/${total})`);

  return completion;
}

// ============================================
// Get Project Plan
// ============================================

/**
 * Get full project plan (phases + tasks)
 * Excludes archived phases/tasks
 */
export async function getProjectPlan(projectId: string, collectionName: string = 'ops_projects'): Promise<{
  phases: PhaseDoc[];
  tasks: TaskDoc[];
}> {
  const projectRef = db.collection(collectionName).doc(projectId);

  const [phasesSnap, tasksSnap] = await Promise.all([
    projectRef.collection('phases').orderBy('index', 'asc').get(),
    projectRef.collection('tasks').get(),
  ]);

  // Filter out archived phases
  const phases = phasesSnap.docs
    .filter((doc) => !doc.data().archived)
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PhaseDoc[];

  // Filter out archived tasks
  const tasks = tasksSnap.docs
    .filter((doc) => !doc.data().archived)
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
    })) as TaskDoc[];

  return { phases, tasks };
}

// ============================================
// Get Next Pending Task
// ============================================

/**
 * Get the next pending task to execute (by phase order, then priority)
 */
export async function getNextPendingTask(projectId: string): Promise<TaskDoc | null> {
  const projectRef = db.collection('ops_projects').doc(projectId);

  // Get phases in order
  const phasesSnap = await projectRef
    .collection('phases')
    .where('status', 'in', ['pending', 'active'])
    .orderBy('index', 'asc')
    .limit(1)
    .get();

  if (phasesSnap.empty) {
    console.log(`[Project Plan] No active phases for project ${projectId}`);
    return null;
  }

  const currentPhase = phasesSnap.docs[0];
  const phaseId = currentPhase.id;

  // Get pending tasks for this phase
  const tasksSnap = await projectRef
    .collection('tasks')
    .where('phaseId', '==', phaseId)
    .where('status', '==', 'pending')
    .get();

  if (tasksSnap.empty) {
    console.log(`[Project Plan] No pending tasks in phase ${phaseId}`);
    return null;
  }

  // Sort by priority (high > medium > low)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const tasks = tasksSnap.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .sort((a: any, b: any) => {
      const aPriority = priorityOrder[a.priority as Priority] ?? 1;
      const bPriority = priorityOrder[b.priority as Priority] ?? 1;
      return aPriority - bPriority;
    });

  return tasks[0] as TaskDoc;
}

// ============================================
// Activate Phase
// ============================================

/**
 * Activate the first pending phase
 */
export async function activateFirstPendingPhase(projectId: string): Promise<string | null> {
  const projectRef = db.collection('ops_projects').doc(projectId);

  const phasesSnap = await projectRef
    .collection('phases')
    .where('status', '==', 'pending')
    .orderBy('index', 'asc')
    .limit(1)
    .get();

  if (phasesSnap.empty) {
    return null;
  }

  const phaseDoc = phasesSnap.docs[0];
  await phaseDoc.ref.update({ status: 'active' });

  console.log(`[Project Plan] Activated phase ${phaseDoc.id}`);
  return phaseDoc.id;
}

// ============================================
// Project Progress
// ============================================

/**
 * Get overall project progress
 */
export async function getProjectProgress(projectId: string): Promise<{
  totalPhases: number;
  completedPhases: number;
  totalTasks: number;
  completedTasks: number;
  overallCompletion: number;
}> {
  const projectRef = db.collection('ops_projects').doc(projectId);

  const [phasesSnap, tasksSnap] = await Promise.all([
    projectRef.collection('phases').get(),
    projectRef.collection('tasks').get(),
  ]);

  const totalPhases = phasesSnap.size;
  let completedPhases = 0;
  phasesSnap.forEach((doc) => {
    if (doc.get('status') === 'completed') completedPhases++;
  });

  const totalTasks = tasksSnap.size;
  let completedTasks = 0;
  tasksSnap.forEach((doc) => {
    if (doc.get('status') === 'completed') completedTasks++;
  });

  const overallCompletion = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  return {
    totalPhases,
    completedPhases,
    totalTasks,
    completedTasks,
    overallCompletion,
  };
}

// ============================================
// Phase 96.1: Update Task QA Status
// ============================================

/**
 * Update task QA status after running tests
 * Phase 96.3: Added qaDetails and qaScore for AI code review
 */
export async function updateTaskQaStatus(params: {
  projectId: string;
  taskId: string;
  qaStatus: QaStatus;
  qaSummary?: string;
  qaDetails?: string; // Phase 96.3: Detailed AI report (markdown)
  qaScore?: number; // Phase 96.3: Overall QA score (0-100)
  collectionName?: string;
}): Promise<void> {
  const { projectId, taskId, qaStatus, qaSummary, qaDetails, qaScore, collectionName = 'ops_projects' } = params;

  const projectRef = db.collection(collectionName).doc(projectId);
  const taskRef = projectRef.collection('tasks').doc(taskId);

  // Remove undefined values before updating
  await taskRef.update(removeUndefined({
    lastQaStatus: qaStatus,
    lastQaSummary: qaSummary ?? null,
    lastQaDetails: qaDetails ?? null, // Phase 96.3
    lastQaScore: qaScore ?? null, // Phase 96.3
    lastQaAt: Timestamp.now(),
  }));

  console.log(`[Project Plan] Updated QA status for task ${taskId}: ${qaStatus} (score: ${qaScore ?? 'N/A'})`);
}

/**
 * Get tasks with failed QA status
 */
export async function getTasksWithFailedQa(
  projectId: string,
  collectionName: string = 'ops_projects'
): Promise<TaskDoc[]> {
  const projectRef = db.collection(collectionName).doc(projectId);

  const tasksSnap = await projectRef
    .collection('tasks')
    .where('lastQaStatus', '==', 'failed')
    .get();

  return tasksSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
    lastQaAt: doc.data().lastQaAt?.toDate?.()?.toISOString() || null,
  })) as TaskDoc[];
}
