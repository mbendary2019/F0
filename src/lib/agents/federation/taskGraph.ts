// src/lib/agents/federation/taskGraph.ts
// =============================================================================
// Phase 155.2 – TaskGraph Management
// Manages task plans, dependencies, and execution order
// =============================================================================

import { nanoid } from 'nanoid';
import type { AgentTask, TaskPlan, TaskStatus, AgentRole, SafetyEnvelope } from './types';
import { createTaskEnvelope } from './safety';

// =============================================================================
// TaskGraph Class
// =============================================================================

/**
 * Manages a task plan and its execution graph
 */
export class TaskGraph {
  private plan: TaskPlan;
  private taskMap: Map<string, AgentTask>;

  constructor(plan: TaskPlan) {
    this.plan = plan;
    this.taskMap = new Map();

    // Index tasks by ID
    for (const task of plan.tasks) {
      this.taskMap.set(task.id, task);
    }

    console.log('[155.2][AGENTS][GRAPH] TaskGraph created:', {
      planId: plan.id,
      taskCount: plan.tasks.length,
    });
  }

  /**
   * Get the current plan
   */
  getPlan(): TaskPlan {
    return this.plan;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): AgentTask | undefined {
    return this.taskMap.get(taskId);
  }

  /**
   * Get all tasks
   */
  getTasks(): AgentTask[] {
    return this.plan.tasks;
  }

  /**
   * Get tasks that are ready to execute (dependencies satisfied)
   */
  getReadyTasks(): AgentTask[] {
    const ready: AgentTask[] = [];

    for (const task of this.plan.tasks) {
      if (task.status !== 'pending') continue;

      const depsCompleted = task.dependencies.every(depId => {
        const dep = this.taskMap.get(depId);
        return dep && dep.status === 'completed';
      });

      if (depsCompleted) {
        ready.push(task);
      }
    }

    console.log('[155.2][AGENTS][GRAPH] Ready tasks:', ready.length);
    return ready;
  }

  /**
   * Get tasks in a specific status
   */
  getTasksByStatus(status: TaskStatus): AgentTask[] {
    return this.plan.tasks.filter(t => t.status === status);
  }

  /**
   * Get tasks assigned to a specific agent
   */
  getTasksByAgent(role: AgentRole): AgentTask[] {
    return this.plan.tasks.filter(t => t.assignedTo === role);
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: TaskStatus, result?: unknown, error?: string): void {
    const task = this.taskMap.get(taskId);
    if (!task) {
      console.error('[155.2][AGENTS][GRAPH] Task not found:', taskId);
      return;
    }

    const previousStatus = task.status;
    task.status = status;
    task.result = result;
    task.error = error;

    if (status === 'in_progress' && !task.startedAt) {
      task.startedAt = Date.now();
    }

    if (status === 'completed' || status === 'failed') {
      task.completedAt = Date.now();
    }

    console.log('[155.2][AGENTS][GRAPH] Task status updated:', {
      taskId,
      previousStatus,
      newStatus: status,
    });

    // Update plan status
    this.updatePlanStatus();
  }

  /**
   * Add a new task to the plan
   */
  addTask(task: Omit<AgentTask, 'id' | 'status'>): AgentTask {
    const newTask: AgentTask = {
      ...task,
      id: nanoid(),
      status: 'pending',
    };

    this.plan.tasks.push(newTask);
    this.taskMap.set(newTask.id, newTask);
    this.plan.updatedAt = Date.now();

    console.log('[155.2][AGENTS][GRAPH] Task added:', newTask.id);
    return newTask;
  }

  /**
   * Remove a task from the plan
   */
  removeTask(taskId: string): boolean {
    const index = this.plan.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return false;

    this.plan.tasks.splice(index, 1);
    this.taskMap.delete(taskId);
    this.plan.updatedAt = Date.now();

    // Remove this task from other tasks' dependencies
    for (const task of this.plan.tasks) {
      task.dependencies = task.dependencies.filter(d => d !== taskId);
    }

    console.log('[155.2][AGENTS][GRAPH] Task removed:', taskId);
    return true;
  }

  /**
   * Get the topological order of tasks
   */
  getExecutionOrder(): AgentTask[] {
    const visited = new Set<string>();
    const result: AgentTask[] = [];
    const visiting = new Set<string>();

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected at task: ${taskId}`);
      }

      const task = this.taskMap.get(taskId);
      if (!task) return;

      visiting.add(taskId);

      for (const depId of task.dependencies) {
        visit(depId);
      }

      visiting.delete(taskId);
      visited.add(taskId);
      result.push(task);
    };

    for (const task of this.plan.tasks) {
      visit(task.id);
    }

    return result;
  }

  /**
   * Check if the plan is complete
   */
  isComplete(): boolean {
    return this.plan.tasks.every(t =>
      t.status === 'completed' || t.status === 'cancelled'
    );
  }

  /**
   * Check if the plan has failed
   */
  hasFailed(): boolean {
    return this.plan.tasks.some(t => t.status === 'failed');
  }

  /**
   * Get progress percentage
   */
  getProgress(): number {
    if (this.plan.tasks.length === 0) return 100;

    const completed = this.plan.tasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / this.plan.tasks.length) * 100);
  }

  /**
   * Get statistics about the plan
   */
  getStats(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    blocked: number;
    cancelled: number;
    progress: number;
  } {
    const stats = {
      total: this.plan.tasks.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      cancelled: 0,
      progress: 0,
    };

    for (const task of this.plan.tasks) {
      switch (task.status) {
        case 'pending': stats.pending++; break;
        case 'in_progress': stats.inProgress++; break;
        case 'completed': stats.completed++; break;
        case 'failed': stats.failed++; break;
        case 'blocked': stats.blocked++; break;
        case 'cancelled': stats.cancelled++; break;
      }
    }

    stats.progress = this.getProgress();
    return stats;
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private updatePlanStatus(): void {
    if (this.isComplete()) {
      this.plan.status = this.hasFailed() ? 'failed' : 'completed';
    } else if (this.plan.tasks.some(t => t.status === 'in_progress')) {
      this.plan.status = 'executing';
    }
    this.plan.updatedAt = Date.now();
  }
}

// =============================================================================
// Plan Creation Utilities
// =============================================================================

/**
 * Create an empty task plan
 */
export function createEmptyPlan(
  projectId: string,
  sessionId: string,
  userIntent: string,
  createdBy?: string
): TaskPlan {
  return {
    id: nanoid(),
    projectId,
    sessionId,
    userIntent,
    tasks: [],
    status: 'planning',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy,
  };
}

/**
 * Create a task
 */
export function createTask(
  title: string,
  description: string,
  assignedTo: AgentRole,
  options?: {
    dependencies?: string[];
    priority?: number;
    tags?: string[];
    maxRetries?: number;
  }
): AgentTask {
  return {
    id: nanoid(),
    title,
    description,
    assignedTo,
    status: 'pending',
    dependencies: options?.dependencies || [],
    priority: options?.priority ?? 0,
    tags: options?.tags,
    maxRetries: options?.maxRetries ?? 3,
    retryCount: 0,
  };
}

/**
 * Create a plan from a list of tasks
 */
export function createPlanFromTasks(
  projectId: string,
  sessionId: string,
  userIntent: string,
  tasks: Array<Omit<AgentTask, 'id' | 'status'>>,
  createdBy?: string
): TaskPlan {
  const plan = createEmptyPlan(projectId, sessionId, userIntent, createdBy);

  for (const taskInput of tasks) {
    const task: AgentTask = {
      ...taskInput,
      id: nanoid(),
      status: 'pending',
    };
    plan.tasks.push(task);
  }

  return plan;
}

// =============================================================================
// Dependency Resolution
// =============================================================================

/**
 * Auto-wire dependencies based on task order and tags
 */
export function autoWireDependencies(tasks: AgentTask[]): void {
  // Group tasks by tags
  const tagGroups = new Map<string, AgentTask[]>();

  for (const task of tasks) {
    for (const tag of task.tags || []) {
      let group = tagGroups.get(tag);
      if (!group) {
        group = [];
        tagGroups.set(tag, group);
      }
      group.push(task);
    }
  }

  // Wire dependencies: tasks in same group depend on previous tasks
  const tagEntries = Array.from(tagGroups.entries());
  for (const [tag, group] of tagEntries) {
    for (let i = 1; i < group.length; i++) {
      const current = group[i];
      const previous = group[i - 1];

      if (!current.dependencies.includes(previous.id)) {
        current.dependencies.push(previous.id);
        console.log('[155.2][AGENTS][GRAPH] Auto-wired dependency:', {
          from: previous.id,
          to: current.id,
          tag,
        });
      }
    }
  }
}

/**
 * Validate that a plan has no circular dependencies
 */
export function validateNoCycles(tasks: AgentTask[]): boolean {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const hasCycle = (taskId: string): boolean => {
    if (visited.has(taskId)) return false;
    if (visiting.has(taskId)) return true;

    visiting.add(taskId);
    const task = taskMap.get(taskId);

    if (task) {
      for (const depId of task.dependencies) {
        if (hasCycle(depId)) return true;
      }
    }

    visiting.delete(taskId);
    visited.add(taskId);
    return false;
  };

  for (const task of tasks) {
    if (hasCycle(task.id)) {
      console.error('[155.2][AGENTS][GRAPH] Circular dependency detected');
      return false;
    }
  }

  return true;
}

console.log('[155.2][AGENTS][GRAPH] TaskGraph module loaded');
