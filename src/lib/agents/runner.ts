// src/lib/agents/runner.ts
import { doc, updateDoc, getDoc, collection, query, where, getDocs, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import capabilities from './capabilities.json';

export type TaskStatus = 'open' | 'running' | 'done' | 'failed' | 'retry';

export type Task = {
  id: string;
  phaseId: string;
  title: string;
  desc?: string;
  status: TaskStatus;
  assignee?: 'gpt' | 'claude' | 'gemini';
  tool?: string;
  tags?: string[];
  retries?: number;
  error?: string;
  result?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
};

export type RunnerConfig = {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  selfHealing: boolean;
};

const DEFAULT_CONFIG: RunnerConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
  selfHealing: true,
};

/**
 * Route task to appropriate provider based on tags
 */
export function routeTask(task: Task): 'gpt' | 'claude' | 'gemini' {
  if (!task.tags || task.tags.length === 0) {
    return capabilities.fallback.provider as 'gpt' | 'claude' | 'gemini';
  }

  // Find first matching routing rule
  for (const rule of capabilities.routing) {
    if (task.tags.some((tag) => rule.tags.includes(tag))) {
      return rule.provider as 'gpt' | 'claude' | 'gemini';
    }
  }

  return capabilities.fallback.provider as 'gpt' | 'claude' | 'gemini';
}

/**
 * Execute a single task with retry logic
 */
export async function executeTask(
  projectId: string,
  task: Task,
  config: RunnerConfig = DEFAULT_CONFIG
): Promise<boolean> {
  const taskRef = doc(db, `projects/${projectId}/tasks/${task.id}`);
  let attempt = 0;
  let backoff = config.backoffMs;

  while (attempt < config.maxRetries) {
    attempt++;

    try {
      // Update status to running
      await updateDoc(taskRef, {
        status: 'running',
        startedAt: Date.now(),
        updatedAt: Date.now(),
        retries: attempt - 1,
      });

      // Simulate task execution (replace with real provider call)
      await simulateTaskExecution(task);

      // Update status to done
      await updateDoc(taskRef, {
        status: 'done',
        completedAt: Date.now(),
        updatedAt: Date.now(),
        result: 'Task completed successfully',
      });

      return true;
    } catch (error: any) {
      console.error(`Task ${task.id} failed (attempt ${attempt}):`, error);

      if (attempt >= config.maxRetries) {
        // Max retries reached
        await updateDoc(taskRef, {
          status: 'failed',
          error: error.message || 'Unknown error',
          updatedAt: Date.now(),
        });

        if (config.selfHealing) {
          // Try to heal the task
          await attemptSelfHeal(projectId, task, error);
        }

        return false;
      } else {
        // Retry with backoff
        await updateDoc(taskRef, {
          status: 'retry',
          error: error.message || 'Unknown error',
          updatedAt: Date.now(),
          retries: attempt,
        });

        await new Promise((resolve) => setTimeout(resolve, backoff));
        backoff *= config.backoffMultiplier;
      }
    }
  }

  return false;
}

/**
 * Execute all tasks in a phase sequentially
 */
export async function executePhase(
  projectId: string,
  phaseId: string,
  config: RunnerConfig = DEFAULT_CONFIG
): Promise<{ success: number; failed: number }> {
  // Get all tasks for this phase
  const tasksSnapshot = await getDoc(doc(db, `projects/${projectId}/phases/${phaseId}`));

  if (!tasksSnapshot.exists()) {
    throw new Error(`Phase ${phaseId} not found`);
  }

  // TODO: Query tasks by phaseId
  // For now, we'll return placeholder stats
  return { success: 0, failed: 0 };
}

/**
 * Simulate task execution (replace with real provider calls)
 */
async function simulateTaskExecution(task: Task): Promise<void> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

  // Random failure for testing
  if (Math.random() < 0.1) {
    throw new Error('Simulated random failure');
  }
}

/**
 * Attempt to self-heal a failed task
 */
async function attemptSelfHeal(projectId: string, task: Task, error: any): Promise<void> {
  const taskRef = doc(db, `projects/${projectId}/tasks/${task.id}`);

  // Analyze error and try to fix
  let healingStrategy = 'none';

  if (error.message?.includes('API key')) {
    healingStrategy = 'check_api_keys';
  } else if (error.message?.includes('timeout')) {
    healingStrategy = 'retry_with_longer_timeout';
  } else if (error.message?.includes('rate limit')) {
    healingStrategy = 'switch_provider';
  }

  // Log healing attempt
  await updateDoc(taskRef, {
    healingStrategy,
    healingAttemptedAt: Date.now(),
    updatedAt: Date.now(),
  });

  // TODO: Implement actual healing logic based on strategy
}

/**
 * Preflight checks before execution
 */
export async function preflightCheck(): Promise<{
  ready: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // Check API keys
  if (!process.env.OPENAI_API_KEY) {
    issues.push('Missing OPENAI_API_KEY');
  }

  // Check Firebase connection
  try {
    await getDoc(doc(db, '_health/check'));
  } catch (error) {
    issues.push('Firebase connection failed');
  }

  // Check emulators (if in development)
  if (process.env.NODE_ENV === 'development') {
    // TODO: Check if emulators are running
  }

  return {
    ready: issues.length === 0,
    issues,
  };
}

/**
 * Run preflight checks and log to project activity
 */
export async function runPreflight(projectId: string): Promise<{
  ready: boolean;
  issues: string[];
  message?: string;
}> {
  const check = await preflightCheck();

  // Log activity
  const activityRef = collection(db, `projects/${projectId}/activity`);
  await addDoc(activityRef, {
    type: 'preflight',
    ready: check.ready,
    issues: check.issues,
    timestamp: Date.now(),
  });

  // If issues found, prepare user-friendly message
  let message = '';
  if (!check.ready) {
    const lang = 'ar'; // TODO: detect from project settings
    message = lang === 'ar'
      ? `🚫 واقف بسبب:\n${check.issues.map(i => `• ${i}`).join('\n')}\n\nحل المشاكل دي وجرب تاني`
      : `🚫 Blocked by:\n${check.issues.map(i => `• ${i}`).join('\n')}\n\nFix these issues and try again`;
  }

  return {
    ready: check.ready,
    issues: check.issues,
    message,
  };
}

/**
 * Start execution by running first open task
 */
export async function startRun(projectId: string): Promise<{
  started: boolean;
  taskId?: string;
  error?: string;
}> {
  try {
    // Get first open phase
    const phasesQuery = query(
      collection(db, `projects/${projectId}/phases`),
      where('status', '==', 'open'),
      orderBy('order', 'asc'),
      limit(1)
    );

    const phasesSnapshot = await getDocs(phasesQuery);

    if (phasesSnapshot.empty) {
      return {
        started: false,
        error: 'No open phases found',
      };
    }

    const firstPhase = phasesSnapshot.docs[0];
    const phaseId = firstPhase.id;

    // Get first open task in this phase
    const tasksQuery = query(
      collection(db, `projects/${projectId}/tasks`),
      where('phaseId', '==', phaseId),
      where('status', '==', 'open'),
      limit(1)
    );

    const tasksSnapshot = await getDocs(tasksQuery);

    if (tasksSnapshot.empty) {
      return {
        started: false,
        error: 'No open tasks found in first phase',
      };
    }

    const firstTask = tasksSnapshot.docs[0];
    const taskData = firstTask.data() as Task;
    const taskId = firstTask.id;

    // Assign provider and tool based on tags
    const assignee = routeTask(taskData);
    const tool = 'simulate'; // TODO: select based on capabilities

    // Update task with assignee
    await updateDoc(doc(db, `projects/${projectId}/tasks/${taskId}`), {
      assignee,
      tool,
      updatedAt: Date.now(),
    });

    // Execute the task
    const success = await executeTask(projectId, { ...taskData, id: taskId, assignee, tool });

    return {
      started: true,
      taskId,
    };
  } catch (error: any) {
    return {
      started: false,
      error: error.message || 'Failed to start run',
    };
  }
}

/**
 * Run a single specific task
 */
export async function runSingleTask(
  projectId: string,
  taskId: string
): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const taskDoc = await getDoc(doc(db, `projects/${projectId}/tasks/${taskId}`));

    if (!taskDoc.exists()) {
      return {
        ok: false,
        error: 'Task not found',
      };
    }

    const taskData = taskDoc.data() as Task;

    // Assign if not already assigned
    if (!taskData.assignee) {
      const assignee = routeTask(taskData);
      await updateDoc(doc(db, `projects/${projectId}/tasks/${taskId}`), {
        assignee,
        updatedAt: Date.now(),
      });
      taskData.assignee = assignee;
    }

    const success = await executeTask(projectId, { ...taskData, id: taskId });

    return {
      ok: success,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error.message || 'Failed to run task',
    };
  }
}
