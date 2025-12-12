// orchestrator/agents/shellAgent.ts
// =============================================================================
// Phase 155.5 – ShellAgent
// Wires to Shell Engine v1
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
export interface ShellEngine {
  runCommand(input: {
    projectId: string;
    command: string;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

// Dummy engine for testing
export class DummyShellEngine implements ShellEngine {
  async runCommand(input: {
    projectId: string;
    command: string;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    console.log('[155.5][SHELL_ENGINE] Running command:', input.command);
    await this.simulateWork();

    // Simulate npm test success
    if (input.command.includes('test')) {
      return {
        stdout: 'All tests passed!\n  12 passing (1.2s)',
        stderr: '',
        exitCode: 0,
      };
    }

    // Simulate npm install
    if (input.command.includes('install')) {
      return {
        stdout: 'added 42 packages in 3.5s',
        stderr: '',
        exitCode: 0,
      };
    }

    // Default success
    return {
      stdout: 'Command executed successfully',
      stderr: '',
      exitCode: 0,
    };
  }

  private simulateWork(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export interface ShellAgentDeps {
  bus: AgentBus;
  engine: ShellEngine;
}

export class ShellAgent {
  readonly role: AgentRole = 'shell';

  constructor(private readonly deps: ShellAgentDeps) {
    this.deps.bus.subscribe(this.role, (msg) => this.handleMessage(msg));
    console.log('[155.5][SHELL_AGENT] ShellAgent wired');
  }

  private async handleMessage(message: AgentMessage): Promise<void> {
    if (message.kind !== 'TASK_ASSIGNMENT') return;

    const { task } = message.payload as { task: AgentTask };
    const taskInput = task.input as { command?: string };
    const command = taskInput?.command ?? 'npm test';

    console.log('[155.5][SHELL_AGENT] Running command:', command);

    let status: TaskStatus = 'COMPLETED';
    let output: unknown = undefined;
    let error: { message: string; code?: string; details?: unknown } | undefined;

    try {
      const res = await this.deps.engine.runCommand({
        projectId: String(message.context.projectId),
        command,
      });
      output = res;
      if (res.exitCode !== 0) {
        status = 'FAILED';
        error = {
          message: `Command exited with code ${res.exitCode}`,
          code: `EXIT_${res.exitCode}`,
          details: res.stderr,
        };
      }
      console.log('[155.5][SHELL_AGENT] Command finished with exit code:', res.exitCode);
    } catch (e: unknown) {
      status = 'FAILED';
      const err = e as Error;
      error = { message: err?.message ?? 'ShellAgent error', details: e };
      console.error('[155.5][SHELL_AGENT] Error', e);
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
      id: generateId('res_shell'),
      timestamp: new Date().toISOString(),
      from: this.role,
      to: 'review',
      kind: 'TASK_RESULT',
      context: message.context,
      safety: { level: 'high' }, // shell = high risk
      payload: result,
    });
  }
}

console.log('[155.5][ORCHESTRATOR][SHELL_AGENT] ShellAgent module loaded');
