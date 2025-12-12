// orchestrator/agents/gitAgent.ts
// =============================================================================
// Phase 155.5 – GitAgent
// Wires to Auto Git Layer (Phase 141) - commit/branch/rollback
// =============================================================================

import {
  AgentBus,
  AgentMessage,
  AgentRole,
  ReviewDecisionPayload,
} from '../core/multiAgent/types';

function generateId(prefix = 'msg'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Engine interface - wire to your actual implementation
export interface GitEngine {
  autoCommit(input: {
    projectId: string;
    message: string;
    branchStrategy?: 'current' | 'feature-branch';
  }): Promise<{ commitHash: string; branch: string }>;

  autoRollback(input: {
    projectId: string;
  }): Promise<{ revertedTo: string }>;
}

// Dummy engine for testing
export class DummyGitEngine implements GitEngine {
  async autoCommit(input: {
    projectId: string;
    message: string;
    branchStrategy?: 'current' | 'feature-branch';
  }): Promise<{ commitHash: string; branch: string }> {
    console.log('[155.5][GIT_ENGINE] Auto commit:', input.message);
    await this.simulateWork();
    const hash = Math.random().toString(36).slice(2, 9);
    return {
      commitHash: hash,
      branch: input.branchStrategy === 'feature-branch' ? `feature/agent-${hash.slice(0, 4)}` : 'main',
    };
  }

  async autoRollback(input: {
    projectId: string;
  }): Promise<{ revertedTo: string }> {
    console.log('[155.5][GIT_ENGINE] Auto rollback for project:', input.projectId);
    await this.simulateWork();
    return { revertedTo: 'HEAD~1' };
  }

  private simulateWork(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export interface GitAgentDeps {
  bus: AgentBus;
  engine: GitEngine;
}

export class GitAgent {
  readonly role: AgentRole = 'git';

  constructor(private readonly deps: GitAgentDeps) {
    // GitAgent listens to broadcasts for REVIEW_DECISION
    this.deps.bus.subscribe(this.role, (msg) => this.handleMessage(msg));
    console.log('[155.5][GIT_AGENT] GitAgent wired');
  }

  private async handleMessage(message: AgentMessage): Promise<void> {
    // GitAgent responds to REVIEW_DECISION broadcasts
    if (message.kind !== 'REVIEW_DECISION') return;

    const payload = message.payload as ReviewDecisionPayload;
    const projectId = String(message.context.projectId);

    console.log('[155.5][GIT_AGENT] Received REVIEW_DECISION:', payload.decision);

    try {
      if (payload.decision === 'APPROVE') {
        console.log('[155.5][GIT_AGENT] Autocommit for approved plan:', payload.planId);
        const res = await this.deps.engine.autoCommit({
          projectId,
          message: `[Agent] Plan "${payload.planId}" approved\n\n${payload.summary}`,
          branchStrategy: 'feature-branch',
        });
        console.log('[155.5][GIT_AGENT] Commit done:', res.commitHash, 'on', res.branch);

        // Broadcast GIT_ACTION_COMPLETE
        await this.deps.bus.publish({
          id: generateId('git_action'),
          timestamp: new Date().toISOString(),
          from: this.role,
          to: 'broadcast',
          kind: 'INFO_RESPONSE',
          context: message.context,
          safety: { level: 'medium' },
          payload: {
            action: 'commit',
            result: res,
            planId: payload.planId,
          },
        });
      } else if (payload.decision === 'ROLLBACK') {
        console.log('[155.5][GIT_AGENT] Rollback requested for plan:', payload.planId);
        const res = await this.deps.engine.autoRollback({ projectId });
        console.log('[155.5][GIT_AGENT] Rollback done, reverted to:', res.revertedTo);

        // Broadcast GIT_ACTION_COMPLETE
        await this.deps.bus.publish({
          id: generateId('git_action'),
          timestamp: new Date().toISOString(),
          from: this.role,
          to: 'broadcast',
          kind: 'INFO_RESPONSE',
          context: message.context,
          safety: { level: 'high' },
          payload: {
            action: 'rollback',
            result: res,
            planId: payload.planId,
          },
        });
      } else {
        // REQUEST_CHANGES - no git action
        console.log('[155.5][GIT_AGENT] REQUEST_CHANGES - no git action (developer should review)');
      }
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[155.5][GIT_AGENT] Error:', err?.message);

      // Broadcast error
      await this.deps.bus.publish({
        id: generateId('git_error'),
        timestamp: new Date().toISOString(),
        from: this.role,
        to: 'broadcast',
        kind: 'TASK_ERROR',
        context: message.context,
        safety: { level: 'high' },
        payload: {
          error: err?.message ?? 'GitAgent error',
          planId: payload.planId,
        },
      });
    }
  }
}

console.log('[155.5][ORCHESTRATOR][GIT_AGENT] GitAgent module loaded');
