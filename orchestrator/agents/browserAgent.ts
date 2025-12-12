// orchestrator/agents/browserAgent.ts
// =============================================================================
// Phase 155.5 – BrowserAgent
// Wires to Browser Agent v1 / Smoke Flow Runner
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
export interface BrowserEngine {
  runSmokeFlow(input: {
    projectId: string;
    url: string;
    flowId?: string;
  }): Promise<{ success: boolean; details?: unknown }>;
}

// Dummy engine for testing
export class DummyBrowserEngine implements BrowserEngine {
  async runSmokeFlow(input: {
    projectId: string;
    url: string;
    flowId?: string;
  }): Promise<{ success: boolean; details?: unknown }> {
    console.log('[155.5][BROWSER_ENGINE] Running smoke flow:', input.flowId, 'on', input.url);
    await this.simulateWork();
    return {
      success: true,
      details: {
        stepsRun: 5,
        assertions: 3,
        screenshotsTaken: 2,
        duration: '1.5s',
      },
    };
  }

  private simulateWork(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 150));
  }
}

export interface BrowserAgentDeps {
  bus: AgentBus;
  engine: BrowserEngine;
}

export class BrowserAgent {
  readonly role: AgentRole = 'browser';

  constructor(private readonly deps: BrowserAgentDeps) {
    this.deps.bus.subscribe(this.role, (msg) => this.handleMessage(msg));
    console.log('[155.5][BROWSER_AGENT] BrowserAgent wired');
  }

  private async handleMessage(message: AgentMessage): Promise<void> {
    if (message.kind !== 'TASK_ASSIGNMENT') return;

    const { task } = message.payload as { task: AgentTask };
    const taskInput = task.input as { url?: string; flowId?: string };
    const url = taskInput?.url ?? 'http://localhost:3000';
    const flowId = taskInput?.flowId ?? 'basic-smoke';

    console.log('[155.5][BROWSER_AGENT] Running flow:', flowId, 'on', url);

    let status: TaskStatus = 'COMPLETED';
    let output: unknown = undefined;
    let error: { message: string; code?: string; details?: unknown } | undefined;

    try {
      const res = await this.deps.engine.runSmokeFlow({
        projectId: String(message.context.projectId),
        url,
        flowId,
      });
      output = res;
      if (!res.success) {
        status = 'FAILED';
        error = { message: 'Browser flow failed', details: res.details };
      }
      console.log('[155.5][BROWSER_AGENT] Flow finished, success:', res.success);
    } catch (e: unknown) {
      status = 'FAILED';
      const err = e as Error;
      error = { message: err?.message ?? 'BrowserAgent error', details: e };
      console.error('[155.5][BROWSER_AGENT] Error', e);
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
      id: generateId('res_browser'),
      timestamp: new Date().toISOString(),
      from: this.role,
      to: 'review',
      kind: 'TASK_RESULT',
      context: message.context,
      safety: { level: 'high' }, // browser = high risk (external access)
      payload: result,
    });
  }
}

console.log('[155.5][ORCHESTRATOR][BROWSER_AGENT] BrowserAgent module loaded');
