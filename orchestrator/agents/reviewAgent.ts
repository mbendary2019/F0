// orchestrator/agents/reviewAgent.ts
// =============================================================================
// Phase 155.3 – ReviewAgent v2
// Quality gate that evaluates plan results and makes decisions
// =============================================================================

import {
  AgentBus,
  AgentMessage,
  AgentRole,
  ReviewDecisionPayload,
  ReviewDecisionType,
  TaskPlan,
  TaskResultPayload,
} from '../core/multiAgent/types';
import { PlanStore } from '../core/multiAgent/planStore';

function generateId(prefix = 'msg'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Future API integrations
interface QualityApi {
  getCurrentHealth(projectId: string): Promise<{
    score: number;
    issuesCount: number;
    hasBlockingSecurity: boolean;
  }>;
}

interface TestsApi {
  getLastRunSummary(projectId: string): Promise<{
    passed: number;
    failed: number;
    total: number;
    coverage?: number;
  }>;
}

interface GitApi {
  suggestGitAction(args: {
    projectId: string;
    decision: ReviewDecisionType;
  }): Promise<void>;
}

interface ReviewAgentDeps {
  bus: AgentBus;
  planStore: PlanStore;
  qualityApi?: QualityApi;
  testsApi?: TestsApi;
  gitApi?: GitApi;
}

export class ReviewAgent {
  readonly role: AgentRole = 'review';

  constructor(private readonly deps: ReviewAgentDeps) {
    this.deps.bus.subscribe(this.role, (msg) => this.handleMessage(msg));
    console.log('[155.3][REVIEW] ReviewAgent v2 initialized');
  }

  private async handleMessage(message: AgentMessage): Promise<void> {
    // ReviewAgent handles:
    // - TASK_RESULT (from code/test/shell)
    // - PLAN_UPDATE (optional, for early tracking)

    if (message.kind === 'TASK_RESULT') {
      await this.handleTaskResult(message as AgentMessage<TaskResultPayload>);
    }
  }

  private async handleTaskResult(message: AgentMessage<TaskResultPayload>): Promise<void> {
    const { payload } = message;
    const { planId, taskId, status, output, error } = payload;

    console.log(`[155.3][REVIEW] Received TASK_RESULT: task=${taskId}, status=${status}`);

    const plan = await this.deps.planStore.get(planId);
    if (!plan) {
      console.warn('[155.3][REVIEW] Plan not found for TASK_RESULT:', planId);
      return;
    }

    // Update task status in PlanStore
    await this.deps.planStore.updateTaskStatus(planId, taskId, {
      status,
      output,
      error,
    });

    const updatedPlan = await this.deps.planStore.get(planId);
    if (!updatedPlan) return;

    // Check if there are still pending/running tasks
    const stillRunning = updatedPlan.tasks.some((t) =>
      ['PENDING', 'RUNNING', 'BLOCKED'].includes(t.status)
    );

    if (stillRunning) {
      console.log(`[155.3][REVIEW] Plan ${planId} still has pending tasks, waiting...`);
      return;
    }

    // All tasks completed/failed - make final decision
    await this.evaluateFinalDecision(updatedPlan, message);
  }

  private async evaluateFinalDecision(
    plan: TaskPlan,
    message: AgentMessage<TaskResultPayload>
  ): Promise<void> {
    const projectId = String(plan.metadata?.projectId ?? message.context.projectId);

    console.log(`[155.3][REVIEW] Evaluating final decision for plan ${plan.id}`);

    // 1) Check if any task failed
    const hasFailed = plan.tasks.some((t) => t.status === 'FAILED');
    const failedTasks = plan.tasks.filter((t) => t.status === 'FAILED');

    // 2) Get quality metrics (if API available)
    let qualityScore: number | undefined;
    let issuesCount: number | undefined;
    let hasBlockingSecurity = false;

    if (this.deps.qualityApi) {
      try {
        const q = await this.deps.qualityApi.getCurrentHealth(projectId);
        qualityScore = q.score;
        issuesCount = q.issuesCount;
        hasBlockingSecurity = q.hasBlockingSecurity;
      } catch (err) {
        console.warn('[155.3][REVIEW] qualityApi error:', err);
      }
    }

    // 3) Get test results (if API available)
    let testsFailed = 0;
    let testsTotal = 0;
    let coverage: number | undefined;

    if (this.deps.testsApi) {
      try {
        const t = await this.deps.testsApi.getLastRunSummary(projectId);
        testsFailed = t.failed;
        testsTotal = t.total;
        coverage = t.coverage;
      } catch (err) {
        console.warn('[155.3][REVIEW] testsApi error:', err);
      }
    }

    // 4) Decision heuristics v1
    let decision: ReviewDecisionType = 'APPROVE';
    const reasons: string[] = [];

    if (hasFailed) {
      decision = 'REQUEST_CHANGES';
      reasons.push(`${failedTasks.length} task(s) failed.`);
    }

    if (testsFailed > 0) {
      decision = 'REQUEST_CHANGES';
      reasons.push(`Tests failed: ${testsFailed}/${testsTotal}.`);
    }

    if (typeof qualityScore === 'number' && qualityScore < 70) {
      decision = 'REQUEST_CHANGES';
      reasons.push(`Code quality score is low (${qualityScore}/100).`);
    }

    if (hasBlockingSecurity) {
      decision = 'ROLLBACK';
      reasons.push('Blocking security issues detected.');
    }

    if (typeof coverage === 'number' && coverage < 60) {
      reasons.push(`Test coverage is low (${coverage}%).`);
      if (decision === 'APPROVE') {
        decision = 'REQUEST_CHANGES';
      }
    }

    // If no issues found
    if (reasons.length === 0) {
      reasons.push('All tasks completed successfully.');
    }

    const payload: ReviewDecisionPayload = {
      planId: plan.id,
      decision,
      summary: this.buildSummary(decision, plan, {
        qualityScore,
        issuesCount,
        hasBlockingSecurity,
        testsFailed,
        testsTotal,
        coverage,
      }),
      reasons,
      // TODO: Could create followUpTasks for auto-fix
    };

    // Publish REVIEW_DECISION
    await this.deps.bus.publish({
      id: generateId('review'),
      timestamp: new Date().toISOString(),
      from: 'review',
      to: 'broadcast',
      kind: 'REVIEW_DECISION',
      context: {
        ...message.context,
        planId: plan.id,
      },
      safety: { level: 'medium' },
      payload,
    });

    console.log(`[155.3][REVIEW] Decision for plan ${plan.id}: ${decision}`);
    console.log(`[155.3][REVIEW] Reasons: ${reasons.join(' ')}`);

    // Git hook (future integration)
    if (this.deps.gitApi) {
      try {
        await this.deps.gitApi.suggestGitAction({
          projectId,
          decision,
        });
      } catch (err) {
        console.warn('[155.3][REVIEW] gitApi error:', err);
      }
    }
  }

  private buildSummary(
    decision: ReviewDecisionType,
    plan: TaskPlan,
    metrics: {
      qualityScore?: number;
      issuesCount?: number;
      hasBlockingSecurity: boolean;
      testsFailed: number;
      testsTotal: number;
      coverage?: number;
    }
  ): string {
    const parts: string[] = [];

    const decisionEmoji = {
      APPROVE: '✅',
      REQUEST_CHANGES: '⚠️',
      ROLLBACK: '🚨',
    }[decision];

    parts.push(
      `${decisionEmoji} Decision: ${decision} for plan "${plan.goal}" (${plan.tasks.length} tasks).`
    );

    if (typeof metrics.qualityScore === 'number') {
      parts.push(`Quality: ${metrics.qualityScore}/100.`);
    }

    if (typeof metrics.issuesCount === 'number') {
      parts.push(`Issues: ${metrics.issuesCount}.`);
    }

    if (metrics.testsTotal > 0) {
      const passed = metrics.testsTotal - metrics.testsFailed;
      parts.push(`Tests: ${passed}/${metrics.testsTotal} passed.`);
    }

    if (typeof metrics.coverage === 'number') {
      parts.push(`Coverage: ${metrics.coverage}%.`);
    }

    if (metrics.hasBlockingSecurity) {
      parts.push('⛔ Blocking security issues present.');
    }

    return parts.join(' ');
  }
}

console.log('[155.3][ORCHESTRATOR][REVIEW] ReviewAgent v2 loaded');
