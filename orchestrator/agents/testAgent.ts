// orchestrator/agents/testAgent.ts
// =============================================================================
// Phase 155.5 – TestAgent
// Wires to Test Lab / Test Runner
// =============================================================================

import {
  AgentBus,
  AgentMessage,
  AgentRole,
  AgentTask,
  TaskResultPayload,
  TaskStatus,
} from '../core/multiAgent/types';

function generateId(prefix = 'msg'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Engine interface - wire to your actual implementation
export interface TestEngine {
  ensureTestsForGoal(input: {
    projectId: string;
    goal: string;
  }): Promise<{ created?: number; updated?: number }>;
}

// Dummy engine for testing
export class DummyTestEngine implements TestEngine {
  async ensureTestsForGoal(input: {
    projectId: string;
    goal: string;
  }): Promise<{ created?: number; updated?: number }> {
    console.log('[155.5][TEST_ENGINE] Ensuring tests for:', input.goal);
    await this.simulateWork();
    return { created: 2, updated: 1 };
  }

  private simulateWork(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export interface TestAgentDeps {
  bus: AgentBus;
  engine: TestEngine;
}

export class TestAgent {
  readonly role: AgentRole = 'test';

  constructor(private readonly deps: TestAgentDeps) {
    this.deps.bus.subscribe(this.role, (msg) => this.handleMessage(msg));
    console.log('[155.5][TEST_AGENT] TestAgent wired');
  }

  private async handleMessage(message: AgentMessage): Promise<void> {
    if (message.kind !== 'TASK_ASSIGNMENT') return;

    const { task } = message.payload as { task: AgentTask };
    console.log('[155.5][TEST_AGENT] Received task:', task.label);

    let status: TaskStatus = 'COMPLETED';
    let output: unknown = undefined;
    let error: { message: string; code?: string; details?: unknown } | undefined;

    try {
      const taskInput = task.input as { targetGoal?: string; targetArea?: string; bugDescription?: string };
      const goal = taskInput?.targetGoal ?? taskInput?.targetArea ?? taskInput?.bugDescription ?? task.label;

      output = await this.deps.engine.ensureTestsForGoal({
        projectId: String(message.context.projectId),
        goal,
      });
      console.log('[155.5][TEST_AGENT] Task completed successfully');
    } catch (e: unknown) {
      status = 'FAILED';
      const err = e as Error;
      error = { message: err?.message ?? 'TestAgent error', details: e };
      console.error('[155.5][TEST_AGENT] Error', e);
    }

    const result: TaskResultPayload = {
      planId: message.context.planId!,
      taskId: message.context.taskId!,
      owner: this.role,
      status,
      output,
      error,
    };

    await this.deps.bus.publish({
      id: generateId('res_test'),
      timestamp: new Date().toISOString(),
      from: this.role,
      to: 'review',
      kind: 'TASK_RESULT',
      context: message.context,
      safety: { level: 'medium' },
      payload: result,
    });
  }
}

console.log('[155.5][ORCHESTRATOR][TEST_AGENT] TestAgent module loaded');
