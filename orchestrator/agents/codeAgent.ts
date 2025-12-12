// orchestrator/agents/codeAgent.ts
// =============================================================================
// Phase 155.5 – CodeAgent
// Wires to Execution Engine / ACE / Auto-Fix
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
export interface CodeEngine {
  applyFeatureTask(input: { goal: string; projectId: string }): Promise<unknown>;
  applyBugfixTask(input: { goal: string; projectId: string }): Promise<unknown>;
  applyRefactorTask(input: { goal: string; projectId: string }): Promise<unknown>;
}

// Dummy engine for testing
export class DummyCodeEngine implements CodeEngine {
  async applyFeatureTask(input: { goal: string; projectId: string }): Promise<unknown> {
    console.log('[155.5][CODE_ENGINE] Applying feature:', input.goal);
    await this.simulateWork();
    return { success: true, filesModified: 3, note: 'Feature implemented (simulated)' };
  }

  async applyBugfixTask(input: { goal: string; projectId: string }): Promise<unknown> {
    console.log('[155.5][CODE_ENGINE] Applying bugfix:', input.goal);
    await this.simulateWork();
    return { success: true, filesModified: 1, note: 'Bug fixed (simulated)' };
  }

  async applyRefactorTask(input: { goal: string; projectId: string }): Promise<unknown> {
    console.log('[155.5][CODE_ENGINE] Applying refactor:', input.goal);
    await this.simulateWork();
    return { success: true, filesModified: 5, note: 'Refactor complete (simulated)' };
  }

  private simulateWork(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export interface CodeAgentDeps {
  bus: AgentBus;
  engine: CodeEngine;
}

export class CodeAgent {
  readonly role: AgentRole = 'code';

  constructor(private readonly deps: CodeAgentDeps) {
    this.deps.bus.subscribe(this.role, (msg) => this.handleMessage(msg));
    console.log('[155.5][CODE_AGENT] CodeAgent wired');
  }

  private async handleMessage(message: AgentMessage): Promise<void> {
    if (message.kind !== 'TASK_ASSIGNMENT') return;

    const { task } = message.payload as { task: AgentTask };
    console.log('[155.5][CODE_AGENT] Received task:', task.label, task.kind);

    let status: TaskStatus = 'COMPLETED';
    let output: unknown = undefined;
    let error: { message: string; code?: string; details?: unknown } | undefined;

    try {
      const taskInput = task.input as { goal?: string; projectId?: string };
      const goal = taskInput?.goal ?? task.label;
      const projectId = String(message.context.projectId);

      if (task.kind === 'bugfix') {
        output = await this.deps.engine.applyBugfixTask({ goal, projectId });
      } else if (task.kind === 'refactor') {
        output = await this.deps.engine.applyRefactorTask({ goal, projectId });
      } else {
        // default: feature
        output = await this.deps.engine.applyFeatureTask({ goal, projectId });
      }
      console.log('[155.5][CODE_AGENT] Task completed successfully');
    } catch (e: unknown) {
      status = 'FAILED';
      const err = e as Error;
      error = {
        message: err?.message ?? 'Unknown error in CodeAgent',
        details: e,
      };
      console.error('[155.5][CODE_AGENT] Error executing code task', e);
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
      id: generateId('res_code'),
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

console.log('[155.5][ORCHESTRATOR][CODE_AGENT] CodeAgent module loaded');
