// orchestrator/agents/plannerAgent.ts
// =============================================================================
// Phase 155.2 – PlannerAgent Implementation (v2 with PlannerEngine)
// =============================================================================

import {
  AgentBus,
  AgentMessage,
  AgentRole,
  PlannerInput,
} from '../core/multiAgent/types';
import { PlanStore } from '../core/multiAgent/planStore';
import { PlannerEngine } from '../core/multiAgent/plannerEngine';

function generateId(prefix = 'msg'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

interface PlannerDeps {
  bus: AgentBus;
  planStore: PlanStore;
  engine?: PlannerEngine;
}

export class PlannerAgent {
  private bus: AgentBus;
  private planStore: PlanStore;
  private engine: PlannerEngine;

  readonly role: AgentRole = 'planner';

  constructor(deps: PlannerDeps) {
    this.bus = deps.bus;
    this.planStore = deps.planStore;
    this.engine = deps.engine ?? new PlannerEngine();

    this.bus.subscribe(this.role, (msg) => this.handleMessage(msg));
    console.log('[155.2][PLANNER] PlannerAgent v2 initialized');
  }

  private async handleMessage(message: AgentMessage): Promise<void> {
    if (message.kind !== 'TASK_PROPOSAL') return;

    console.log('[155.2][PLANNER] Received TASK_PROPOSAL:', message.id);

    const input = message.payload as PlannerInput;

    // Use PlannerEngine v2 for smart plan building
    const plan = await this.engine.buildPlan(input);

    await this.planStore.save(plan);

    // Broadcast PLAN_UPDATE to UI + agents
    await this.bus.publish({
      id: generateId('msg'),
      timestamp: new Date().toISOString(),
      from: 'planner',
      to: 'broadcast',
      kind: 'PLAN_UPDATE',
      context: {
        ...message.context,
        planId: plan.id,
      },
      safety: { level: 'medium' },
      payload: { plan },
    });

    console.log(`[155.2][PLANNER] Plan created: ${plan.id} with ${plan.tasks.length} tasks (type: ${plan.metadata?.inferredGoalType})`);

    // Distribute TASK_ASSIGNMENT messages
    for (const task of plan.tasks) {
      await this.bus.publish({
        id: generateId('msg'),
        timestamp: new Date().toISOString(),
        from: 'planner',
        to: task.owner,
        kind: 'TASK_ASSIGNMENT',
        context: {
          ...message.context,
          planId: plan.id,
          taskId: task.id,
        },
        safety: { level: 'medium' },
        payload: { task },
      });
      console.log(`[155.2][PLANNER] Assigned task ${task.id} (${task.kind || 'unknown'}) to ${task.owner}`);
    }
  }
}

console.log('[155.2][ORCHESTRATOR][PLANNER] PlannerAgent v2 loaded');
