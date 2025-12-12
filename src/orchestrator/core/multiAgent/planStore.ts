// orchestrator/core/multiAgent/planStore.ts
// =============================================================================
// Phase 155 – Plan Store Implementation
// =============================================================================

import { TaskPlan, AgentTask } from './types';

export interface PlanStore {
  save(plan: TaskPlan): Promise<void>;
  get(planId: string): Promise<TaskPlan | null>;
  updateTaskStatus(
    planId: string,
    taskId: string,
    patch: Partial<Pick<AgentTask, 'status' | 'output' | 'error'>>
  ): Promise<void>;
  listForProject(projectId: string): Promise<TaskPlan[]>;
}

// v1 in-memory implementation for desktop/dev
export class InMemoryPlanStore implements PlanStore {
  private plans = new Map<string, TaskPlan>();

  async save(plan: TaskPlan): Promise<void> {
    this.plans.set(plan.id, plan);
    console.log(`[155][STORE] Saved plan: ${plan.id} with ${plan.tasks.length} tasks`);
  }

  async get(planId: string): Promise<TaskPlan | null> {
    return this.plans.get(planId) ?? null;
  }

  async updateTaskStatus(
    planId: string,
    taskId: string,
    patch: Partial<Pick<AgentTask, 'status' | 'output' | 'error'>>
  ): Promise<void> {
    const plan = this.plans.get(planId);
    if (!plan) {
      console.log(`[155][STORE] Plan not found: ${planId}`);
      return;
    }

    const idx = plan.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) {
      console.log(`[155][STORE] Task not found: ${taskId} in plan ${planId}`);
      return;
    }

    const existing = plan.tasks[idx];
    const updated: AgentTask = {
      ...existing,
      ...patch,
      status: patch.status ?? existing.status,
    };

    plan.tasks[idx] = updated;
    this.plans.set(planId, { ...plan });
    console.log(`[155][STORE] Updated task ${taskId} status to ${updated.status}`);
  }

  async listForProject(projectId: string): Promise<TaskPlan[]> {
    const all = Array.from(this.plans.values());
    return all.filter((p) => p.metadata?.projectId === projectId);
  }

  // Helper to get all plans (for debugging)
  async getAll(): Promise<TaskPlan[]> {
    return Array.from(this.plans.values());
  }

  // Helper to clear all plans (for testing)
  clear(): void {
    this.plans.clear();
    console.log('[155][STORE] All plans cleared');
  }
}

console.log('[155][ORCHESTRATOR][STORE] PlanStore loaded');
