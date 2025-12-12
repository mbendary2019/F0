/**
 * Phase 91.3: Orchestrator Start - Auto Task Execution Loop
 * POST /api/orchestrator/start
 *
 * Starts automatic task execution pipeline:
 * 1. Fetches next NEW task
 * 2. Executes task with specialized agent
 * 3. Repeats until no more tasks
 * 4. Returns execution summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';

const db = getFirestore(adminApp);

// Maximum tasks to execute in a single request (prevent timeout)
const MAX_TASKS_PER_RUN = 10;

// Task execution timeout (ms)
const TASK_TIMEOUT = 30000; // 30 seconds

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const user = await requireUser(req);

    // 2. Parse request
    const body = await req.json();
    const { projectId, maxTasks = MAX_TASKS_PER_RUN } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing required field: projectId' },
        { status: 400 }
      );
    }

    // 3. Verify project ownership
    await requireProjectOwner(user, projectId);

    console.log(`[Orchestrator Start] Starting execution for project ${projectId}`);

    // 4. Update project status
    const projectRef = db.collection('projects').doc(projectId);
    await projectRef.update({
      planStatus: 'IN_PROGRESS',
      orchestratorStartedAt: FieldValue.serverTimestamp(),
    });

    // 5. Execution loop
    let tasksExecuted = 0;
    let tasksSucceeded = 0;
    let tasksFailed = 0;
    const executionLog: any[] = [];

    let keepRunning = true;

    while (keepRunning && tasksExecuted < maxTasks) {
      console.log(`[Orchestrator] Loop iteration ${tasksExecuted + 1}`);

      // 6. Fetch next task
      let nextTask = null;
      try {
        const nextTaskResponse = await fetchNextTask(projectId);
        nextTask = nextTaskResponse.task;
      } catch (error: any) {
        console.error('[Orchestrator] Error fetching next task:', error);
        executionLog.push({
          error: 'Failed to fetch next task',
          details: error.message,
        });
        break;
      }

      // 7. No more tasks - execution complete
      if (!nextTask) {
        console.log('[Orchestrator] No more tasks to execute');
        keepRunning = false;
        break;
      }

      console.log(`[Orchestrator] Executing task: ${nextTask.id} (${nextTask.title})`);

      // 8. Execute task
      const taskStartTime = Date.now();
      try {
        await executeTask(projectId, nextTask.id, TASK_TIMEOUT);

        const executionTime = Date.now() - taskStartTime;
        tasksExecuted++;
        tasksSucceeded++;

        executionLog.push({
          taskId: nextTask.id,
          title: nextTask.title,
          agent: nextTask.agent,
          status: 'success',
          executionTime: `${executionTime}ms`,
        });

        console.log(`[Orchestrator] Task ${nextTask.id} completed in ${executionTime}ms`);

      } catch (error: any) {
        const executionTime = Date.now() - taskStartTime;
        tasksExecuted++;
        tasksFailed++;

        executionLog.push({
          taskId: nextTask.id,
          title: nextTask.title,
          agent: nextTask.agent,
          status: 'failed',
          error: error.message,
          executionTime: `${executionTime}ms`,
        });

        console.error(`[Orchestrator] Task ${nextTask.id} failed:`, error.message);

        // Continue to next task (don't stop on failure)
      }
    }

    // 9. Check if all tasks completed
    const remainingTasksSnapshot = await db
      .collection('projects')
      .doc(projectId)
      .collection('tasks')
      .where('status', '==', 'NEW')
      .limit(1)
      .get();

    const allTasksCompleted = remainingTasksSnapshot.empty;

    // 10. Update project status
    if (allTasksCompleted) {
      await projectRef.update({
        planStatus: 'COMPLETED',
        orchestratorCompletedAt: FieldValue.serverTimestamp(),
      });
      console.log(`[Orchestrator] All tasks completed for project ${projectId}`);
    }

    // 11. Return execution summary
    return NextResponse.json({
      ok: true,
      projectId,
      summary: {
        tasksExecuted,
        tasksSucceeded,
        tasksFailed,
        allTasksCompleted,
        maxTasksReached: tasksExecuted >= maxTasks,
      },
      executionLog,
    });

  } catch (error: any) {
    console.error('[Orchestrator Start] Error:', error);

    // Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    if (error.message === 'NOT_OWNER') {
      return NextResponse.json(
        { error: 'Access denied - Not project owner' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Orchestrator execution failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Helper: Fetch next NEW task and mark as IN_PROGRESS
 */
async function fetchNextTask(projectId: string): Promise<{ task: any | null }> {
  const tasksRef = db
    .collection('projects')
    .doc(projectId)
    .collection('tasks');

  const snapshot = await tasksRef
    .where('status', '==', 'NEW')
    .orderBy('createdAt', 'asc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { task: null };
  }

  const taskDoc = snapshot.docs[0];
  const task = taskDoc.data();

  // Mark as IN_PROGRESS
  await taskDoc.ref.update({
    status: 'IN_PROGRESS',
    startedAt: FieldValue.serverTimestamp(),
    logs: FieldValue.arrayUnion(
      `[${new Date().toISOString()}] Task started by orchestrator`
    ),
  });

  // Update phase status if needed
  if (task.phaseId) {
    const phaseRef = db
      .collection('projects')
      .doc(projectId)
      .collection('phases')
      .doc(task.phaseId);

    const phaseDoc = await phaseRef.get();
    if (phaseDoc.exists && phaseDoc.data()?.status === 'PENDING') {
      await phaseRef.update({
        status: 'IN_PROGRESS',
        startedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  return {
    task: {
      ...task,
      projectId,
    },
  };
}

/**
 * Helper: Execute task by calling run-task endpoint internally
 */
async function executeTask(
  projectId: string,
  taskId: string,
  timeout: number
): Promise<void> {
  // Import the run-task route handler
  const { POST: runTaskHandler } = await import('../run-task/route');

  // Create a mock request
  const mockRequest = {
    json: async () => ({ projectId, taskId }),
    headers: new Headers(),
  } as unknown as NextRequest;

  // Execute with timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Task execution timeout')), timeout);
  });

  const executionPromise = runTaskHandler(mockRequest);

  const response = await Promise.race([executionPromise, timeoutPromise]);

  // Check if execution was successful
  const result = await (response as Response).json();
  if (!result.ok) {
    throw new Error(result.error || 'Task execution failed');
  }
}
