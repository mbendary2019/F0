// orchestrator/core/multiAgent/firestorePlanStore.ts
// =============================================================================
// Phase 155.4 – FirestorePlanStore
// Persistent storage for TaskPlans in Firestore
// =============================================================================

import type { Firestore } from 'firebase-admin/firestore';
import type { PlanStore } from './planStore';
import type { TaskPlan, AgentTask, PlanStatus } from './types';

export class FirestorePlanStore implements PlanStore {
  private collectionName: string;

  constructor(
    private readonly db: Firestore,
    collectionName = 'agentPlans'
  ) {
    this.collectionName = collectionName;
    console.log(`[155.4][FIRESTORE_STORE] FirestorePlanStore initialized (collection: ${collectionName})`);
  }

  private collection() {
    return this.db.collection(this.collectionName);
  }

  async save(plan: TaskPlan): Promise<void> {
    // Calculate status if not set
    const status: PlanStatus =
      plan.status ??
      (plan.tasks.every((t) => t.status === 'COMPLETED' || t.status === 'SKIPPED')
        ? 'COMPLETED'
        : plan.tasks.some((t) => t.status === 'FAILED')
        ? 'FAILED'
        : 'IN_PROGRESS');

    const docData: TaskPlan = {
      ...plan,
      status,
    };

    await this.collection().doc(plan.id).set(docData, { merge: true });
    console.log(`[155.4][FIRESTORE_STORE] Saved plan: ${plan.id} (status: ${status})`);
  }

  async get(planId: string): Promise<TaskPlan | null> {
    const doc = await this.collection().doc(planId).get();
    if (!doc.exists) {
      console.log(`[155.4][FIRESTORE_STORE] Plan not found: ${planId}`);
      return null;
    }
    return doc.data() as TaskPlan;
  }

  async updateTaskStatus(
    planId: string,
    taskId: string,
    patch: Partial<Pick<AgentTask, 'status' | 'output' | 'error'>>
  ): Promise<void> {
    const plan = await this.get(planId);
    if (!plan) {
      console.warn(`[155.4][FIRESTORE_STORE] Cannot update task - plan not found: ${planId}`);
      return;
    }

    const idx = plan.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) {
      console.warn(`[155.4][FIRESTORE_STORE] Task not found: ${taskId} in plan ${planId}`);
      return;
    }

    const existing = plan.tasks[idx];
    const updated: AgentTask = {
      ...existing,
      ...patch,
      status: patch.status ?? existing.status,
    };

    const updatedTasks = [...plan.tasks];
    updatedTasks[idx] = updated;

    // Calculate new plan status
    const allCompleted = updatedTasks.every(
      (t) => t.status === 'COMPLETED' || t.status === 'SKIPPED'
    );
    const anyFailed = updatedTasks.some((t) => t.status === 'FAILED');

    let newStatus: PlanStatus = plan.status ?? 'IN_PROGRESS';
    if (anyFailed) newStatus = 'FAILED';
    else if (allCompleted) newStatus = 'COMPLETED';

    const updatedPlan: TaskPlan = {
      ...plan,
      tasks: updatedTasks,
      status: newStatus,
    };

    await this.save(updatedPlan);
    console.log(`[155.4][FIRESTORE_STORE] Updated task ${taskId} to ${updated.status}, plan status: ${newStatus}`);
  }

  async listForProject(projectId: string): Promise<TaskPlan[]> {
    const snap = await this.collection()
      .where('metadata.projectId', '==', projectId)
      .orderBy('createdAt', 'desc')
      .get();

    console.log(`[155.4][FIRESTORE_STORE] Found ${snap.docs.length} plans for project ${projectId}`);
    return snap.docs.map((d) => d.data() as TaskPlan);
  }

  async getAll(): Promise<TaskPlan[]> {
    const snap = await this.collection()
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    return snap.docs.map((d) => d.data() as TaskPlan);
  }

  async delete(planId: string): Promise<void> {
    await this.collection().doc(planId).delete();
    console.log(`[155.4][FIRESTORE_STORE] Deleted plan: ${planId}`);
  }

  async updatePlanDecision(
    planId: string,
    decision: 'APPROVE' | 'REQUEST_CHANGES' | 'ROLLBACK'
  ): Promise<void> {
    const plan = await this.get(planId);
    if (!plan) return;

    const updatedPlan: TaskPlan = {
      ...plan,
      metadata: {
        ...plan.metadata,
        lastDecision: decision,
      },
    };

    await this.save(updatedPlan);
    console.log(`[155.4][FIRESTORE_STORE] Updated plan ${planId} decision: ${decision}`);
  }
}

console.log('[155.4][ORCHESTRATOR][FIRESTORE_STORE] FirestorePlanStore module loaded');
