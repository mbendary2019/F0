// orchestrator/core/multiAgent/plannerEngine.ts
// =============================================================================
// Phase 155.2 – PlannerEngine v2
// Smart plan builder with goal-type inference
// =============================================================================

import {
  AgentTask,
  PlannerInput,
  TaskPlan,
  TaskStatus,
} from './types';

function generateId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// TODO: Inject real APIs later: index / quality / tests
export interface PlannerEngineDeps {
  // Example future integrations:
  // indexApi: ProjectIndexApi;
  // qualityApi: QualityApi;
  // testsApi: TestsApi;
}

type GoalType = 'feature' | 'bugfix' | 'tests' | 'refactor';

export class PlannerEngine {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private readonly deps?: PlannerEngineDeps) {
    console.log('[155.2][PLANNER_ENGINE] PlannerEngine v2 initialized');
  }

  async buildPlan(input: PlannerInput): Promise<TaskPlan> {
    const planId = generateId('plan');

    // v2: infer goal type from text
    const goalType = this.inferGoalType(input.goal);
    console.log(`[155.2][PLANNER_ENGINE] Inferred goal type: ${goalType} for "${input.goal}"`);

    const tasks: AgentTask[] = [];

    if (goalType === 'bugfix') {
      this.buildBugfixPlan(tasks, planId, input);
    } else if (goalType === 'tests') {
      this.buildTestsPlan(tasks, planId, input);
    } else if (goalType === 'refactor') {
      this.buildRefactorPlan(tasks, planId, input);
    } else {
      // default = feature
      this.buildFeaturePlan(tasks, planId, input);
    }

    const plan: TaskPlan = {
      id: planId,
      goal: input.goal,
      createdBy: 'user',
      createdAt: new Date().toISOString(),
      tasks,
      metadata: {
        projectId: input.projectId,
        source: 'planner_v2',
        inferredGoalType: goalType,
      },
    };

    console.log(`[155.2][PLANNER_ENGINE] Built plan ${planId} with ${tasks.length} tasks`);
    return plan;
  }

  private inferGoalType(goal: string): GoalType {
    const g = goal.toLowerCase();

    if (g.includes('bug') || g.includes('fix') || g.includes('issue') || g.includes('error')) {
      return 'bugfix';
    }

    if (g.includes('test') || g.includes('coverage') || g.includes('spec')) {
      return 'tests';
    }

    if (g.includes('refactor') || g.includes('cleanup') || g.includes('restructure') || g.includes('reorganize')) {
      return 'refactor';
    }

    return 'feature';
  }

  // ========== Feature Plan ==========
  private buildFeaturePlan(
    tasks: AgentTask[],
    planId: string,
    input: PlannerInput
  ) {
    // T1: implement feature
    tasks.push({
      id: 'T1',
      planId,
      label: `Implement feature: ${input.goal}`,
      owner: 'code',
      status: 'PENDING' as TaskStatus,
      dependsOn: [],
      input: { goal: input.goal, projectId: input.projectId },
      kind: 'feature',
      tags: this.extractTags(input.goal),
    });

    // T2: ensure tests
    tasks.push({
      id: 'T2',
      planId,
      label: `Ensure tests exist for: ${input.goal}`,
      owner: 'test',
      status: 'PENDING' as TaskStatus,
      dependsOn: ['T1'],
      input: { targetGoal: input.goal, projectId: input.projectId },
      kind: 'tests',
    });

    // T3: run tests
    tasks.push({
      id: 'T3',
      planId,
      label: 'Run test suite',
      owner: 'shell',
      status: 'PENDING' as TaskStatus,
      dependsOn: ['T2'],
      input: { command: 'npm test', projectId: input.projectId },
      kind: 'tests',
    });

    // T4: review
    tasks.push({
      id: 'T4',
      planId,
      label: 'Review feature results & quality',
      owner: 'review',
      status: 'PENDING' as TaskStatus,
      dependsOn: ['T3'],
      input: { planId },
    });
  }

  // ========== Bugfix Plan ==========
  private buildBugfixPlan(
    tasks: AgentTask[],
    planId: string,
    input: PlannerInput
  ) {
    tasks.push({
      id: 'T1',
      planId,
      label: `Investigate and fix bug: ${input.goal}`,
      owner: 'code',
      status: 'PENDING' as TaskStatus,
      dependsOn: [],
      input: { goal: input.goal, projectId: input.projectId },
      kind: 'bugfix',
      tags: this.extractTags(input.goal),
    });

    tasks.push({
      id: 'T2',
      planId,
      label: `Ensure regression tests for bug: ${input.goal}`,
      owner: 'test',
      status: 'PENDING' as TaskStatus,
      dependsOn: ['T1'],
      input: { bugDescription: input.goal, projectId: input.projectId },
      kind: 'tests',
    });

    tasks.push({
      id: 'T3',
      planId,
      label: 'Run regression test suite',
      owner: 'shell',
      status: 'PENDING' as TaskStatus,
      dependsOn: ['T2'],
      input: { command: 'npm test', projectId: input.projectId },
      kind: 'tests',
    });

    tasks.push({
      id: 'T4',
      planId,
      label: 'Review bugfix results & quality',
      owner: 'review',
      status: 'PENDING' as TaskStatus,
      dependsOn: ['T3'],
      input: { planId },
    });
  }

  // ========== Tests Plan ==========
  private buildTestsPlan(
    tasks: AgentTask[],
    planId: string,
    input: PlannerInput
  ) {
    tasks.push({
      id: 'T1',
      planId,
      label: `Add/Improve tests for: ${input.goal}`,
      owner: 'test',
      status: 'PENDING' as TaskStatus,
      dependsOn: [],
      input: { targetArea: input.goal, projectId: input.projectId },
      kind: 'tests',
      tags: this.extractTags(input.goal),
    });

    tasks.push({
      id: 'T2',
      planId,
      label: 'Run test suite',
      owner: 'shell',
      status: 'PENDING' as TaskStatus,
      dependsOn: ['T1'],
      input: { command: 'npm test', projectId: input.projectId },
      kind: 'tests',
    });

    tasks.push({
      id: 'T3',
      planId,
      label: 'Review test coverage & quality',
      owner: 'review',
      status: 'PENDING' as TaskStatus,
      dependsOn: ['T2'],
      input: { planId },
    });
  }

  // ========== Refactor Plan ==========
  private buildRefactorPlan(
    tasks: AgentTask[],
    planId: string,
    input: PlannerInput
  ) {
    tasks.push({
      id: 'T1',
      planId,
      label: `Refactor: ${input.goal}`,
      owner: 'code',
      status: 'PENDING' as TaskStatus,
      dependsOn: [],
      input: { goal: input.goal, projectId: input.projectId },
      kind: 'refactor',
      tags: this.extractTags(input.goal),
    });

    tasks.push({
      id: 'T2',
      planId,
      label: 'Run tests after refactor',
      owner: 'shell',
      status: 'PENDING' as TaskStatus,
      dependsOn: ['T1'],
      input: { command: 'npm test', projectId: input.projectId },
      kind: 'tests',
    });

    tasks.push({
      id: 'T3',
      planId,
      label: 'Review refactor impact & quality',
      owner: 'review',
      status: 'PENDING' as TaskStatus,
      dependsOn: ['T2'],
      input: { planId },
    });
  }

  // ========== Helpers ==========
  private extractTags(goal: string): string[] {
    const tags: string[] = [];
    const g = goal.toLowerCase();

    // Extract common domain tags
    const domainKeywords = [
      'auth', 'login', 'signup', 'register', 'password',
      'api', 'endpoint', 'route',
      'database', 'db', 'query', 'sql',
      'ui', 'component', 'page', 'form',
      'payment', 'billing', 'subscription',
      'email', 'notification', 'message',
      'file', 'upload', 'download',
      'user', 'profile', 'account',
      'admin', 'dashboard',
      'search', 'filter', 'sort',
    ];

    for (const keyword of domainKeywords) {
      if (g.includes(keyword)) {
        tags.push(keyword);
      }
    }

    return tags;
  }
}

console.log('[155.2][ORCHESTRATOR][PLANNER_ENGINE] PlannerEngine v2 loaded');
