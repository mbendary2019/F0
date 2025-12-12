// src/lib/agents/federation/plannerAgent.ts
// =============================================================================
// Phase 155.2 – PlannerAgent Implementation
// Decomposes user intent into executable task graphs
// =============================================================================

import { nanoid } from 'nanoid';
import type {
  AgentRole,
  AgentMessage,
  AgentBus,
  TaskPlan,
  AgentTask,
  PlanRequestPayload,
  PlanResultPayload,
  AgentContextHandle,
} from './types';
import { createMessage, getAgentBus } from './bus';
import { createEmptyPlan, createTask, TaskGraph, validateNoCycles } from './taskGraph';
import { createLowRiskEnvelope, assessTaskRisk } from './safety';

// =============================================================================
// Types
// =============================================================================

export type PlannerConfig = {
  /** OpenAI API key */
  openaiApiKey?: string;
  /** Model to use for planning */
  model?: string;
  /** Maximum tasks per plan */
  maxTasks?: number;
  /** Temperature for generation */
  temperature?: number;
};

export type PlannerResult = {
  plan: TaskPlan;
  graph: TaskGraph;
  reasoning?: string;
};

// =============================================================================
// Task Inference Rules
// =============================================================================

/**
 * Keywords that map to specific agent roles
 */
const ROLE_KEYWORDS: Record<AgentRole, string[]> = {
  code: ['create', 'write', 'implement', 'add', 'modify', 'refactor', 'fix'],
  test: ['test', 'spec', 'assert', 'verify', 'validate', 'check'],
  shell: ['run', 'execute', 'build', 'install', 'deploy', 'npm', 'pnpm', 'yarn'],
  git: ['commit', 'push', 'merge', 'branch', 'revert', 'git'],
  review: ['review', 'audit', 'inspect', 'check quality'],
  browser: ['fetch', 'scrape', 'navigate', 'browse'],
  planner: ['plan', 'design', 'architect', 'structure'],
};

/**
 * Infer agent role from task description
 */
function inferRole(description: string): AgentRole {
  const lower = description.toLowerCase();

  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return role as AgentRole;
      }
    }
  }

  // Default to code agent
  return 'code';
}

/**
 * Extract tags from task description
 */
function extractTags(description: string): string[] {
  const tags: string[] = [];
  const lower = description.toLowerCase();

  // Technology tags
  const techPatterns: Record<string, RegExp> = {
    typescript: /typescript|\.tsx?/i,
    javascript: /javascript|\.jsx?/i,
    react: /react|component|hook/i,
    nextjs: /next\.?js|app router|page router/i,
    firebase: /firebase|firestore|auth/i,
    tailwind: /tailwind|className/i,
    api: /api|endpoint|route|fetch/i,
    ui: /ui|interface|button|form|modal/i,
    database: /database|db|query|schema/i,
    auth: /auth|login|signup|session/i,
  };

  for (const [tag, pattern] of Object.entries(techPatterns)) {
    if (pattern.test(lower)) {
      tags.push(tag);
    }
  }

  return tags;
}

// =============================================================================
// PlannerAgent Class
// =============================================================================

/**
 * Agent responsible for decomposing user requests into task graphs
 */
export class PlannerAgent {
  private config: PlannerConfig;
  private bus: AgentBus;

  constructor(config?: PlannerConfig) {
    this.config = {
      model: config?.model ?? 'gpt-4o-mini',
      maxTasks: config?.maxTasks ?? 20,
      temperature: config?.temperature ?? 0.7,
      openaiApiKey: config?.openaiApiKey,
    };
    this.bus = getAgentBus();

    console.log('[155.2][AGENTS][PLANNER] PlannerAgent initialized');
  }

  /**
   * Start listening for plan requests
   */
  start(): () => void {
    console.log('[155.2][AGENTS][PLANNER] Starting listener');

    return this.bus.subscribe<PlanRequestPayload>('planner', async (message) => {
      if (message.kind !== 'plan_request') return;

      console.log('[155.2][AGENTS][PLANNER] Received plan request:', message.id);

      try {
        const result = await this.createPlan(
          message.projectId,
          message.sessionId,
          message.payload
        );

        // Send plan result
        const response = createMessage<PlanResultPayload>({
          from: 'planner',
          to: 'broadcast',
          kind: 'plan_result',
          payload: {
            plan: result.plan,
            reasoning: result.reasoning,
          },
          projectId: message.projectId,
          sessionId: message.sessionId,
          parentMessageId: message.id,
        });

        await this.bus.send(response);

      } catch (error) {
        console.error('[155.2][AGENTS][PLANNER] Error creating plan:', error);

        // Send error message
        const errorMsg = createMessage({
          from: 'planner',
          to: 'broadcast',
          kind: 'error',
          payload: {
            code: 'PLAN_CREATION_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            recoverable: true,
          },
          projectId: message.projectId,
          sessionId: message.sessionId,
          parentMessageId: message.id,
        });

        await this.bus.send(errorMsg);
      }
    });
  }

  /**
   * Create a plan from user intent
   */
  async createPlan(
    projectId: string,
    sessionId: string,
    request: PlanRequestPayload
  ): Promise<PlannerResult> {
    console.log('[155.2][AGENTS][PLANNER] Creating plan for:', request.userIntent);

    // For now, use rule-based planning
    // Can be upgraded to LLM-based planning later
    const tasks = this.decomposeIntent(request.userIntent, request.context);

    // Create the plan
    const plan = createEmptyPlan(projectId, sessionId, request.userIntent);
    plan.tasks = tasks;
    plan.status = 'planning';
    plan.updatedAt = Date.now();

    // Validate no cycles
    if (!validateNoCycles(tasks)) {
      throw new Error('Plan contains circular dependencies');
    }

    // Create task graph
    const graph = new TaskGraph(plan);

    console.log('[155.2][AGENTS][PLANNER] Plan created:', {
      planId: plan.id,
      taskCount: tasks.length,
    });

    return {
      plan,
      graph,
      reasoning: `Decomposed "${request.userIntent}" into ${tasks.length} tasks`,
    };
  }

  /**
   * Decompose user intent into tasks (rule-based)
   */
  private decomposeIntent(
    intent: string,
    context?: PlanRequestPayload['context']
  ): AgentTask[] {
    const tasks: AgentTask[] = [];
    const lower = intent.toLowerCase();

    // Detect common patterns and create appropriate tasks

    // Pattern: Create a new component/feature
    if (/create|add|implement|build/i.test(lower)) {
      // Planning task
      tasks.push(createTask(
        'Analyze requirements',
        `Analyze the user request: "${intent}" and identify required changes`,
        'planner',
        { priority: 100, tags: ['planning'] }
      ));

      // Code generation task
      tasks.push(createTask(
        'Implement feature',
        `Implement the requested feature: ${intent}`,
        'code',
        {
          priority: 80,
          tags: extractTags(intent),
          dependencies: [tasks[0].id],
        }
      ));

      // Test task
      if (!/no test|skip test/i.test(lower)) {
        tasks.push(createTask(
          'Write tests',
          `Write tests for the implemented feature`,
          'test',
          {
            priority: 60,
            tags: ['test'],
            dependencies: [tasks[1].id],
          }
        ));
      }

      // Review task
      tasks.push(createTask(
        'Code review',
        `Review the implemented code for quality and best practices`,
        'review',
        {
          priority: 40,
          tags: ['review'],
          dependencies: [tasks[tasks.length - 1].id],
        }
      ));
    }

    // Pattern: Fix a bug
    else if (/fix|debug|repair|resolve/i.test(lower)) {
      tasks.push(createTask(
        'Investigate issue',
        `Investigate and understand the bug: ${intent}`,
        'planner',
        { priority: 100, tags: ['debugging'] }
      ));

      tasks.push(createTask(
        'Apply fix',
        `Apply the bug fix for: ${intent}`,
        'code',
        {
          priority: 80,
          tags: ['bugfix', ...extractTags(intent)],
          dependencies: [tasks[0].id],
        }
      ));

      tasks.push(createTask(
        'Verify fix',
        `Verify the bug is fixed and no regressions introduced`,
        'test',
        {
          priority: 60,
          tags: ['test', 'verification'],
          dependencies: [tasks[1].id],
        }
      ));
    }

    // Pattern: Refactor
    else if (/refactor|restructure|reorganize|clean/i.test(lower)) {
      tasks.push(createTask(
        'Plan refactoring',
        `Plan the refactoring approach for: ${intent}`,
        'planner',
        { priority: 100, tags: ['planning', 'refactor'] }
      ));

      tasks.push(createTask(
        'Execute refactoring',
        `Execute the refactoring: ${intent}`,
        'code',
        {
          priority: 80,
          tags: ['refactor', ...extractTags(intent)],
          dependencies: [tasks[0].id],
        }
      ));

      tasks.push(createTask(
        'Run tests',
        `Run all tests to ensure refactoring didn't break anything`,
        'test',
        {
          priority: 60,
          tags: ['test'],
          dependencies: [tasks[1].id],
        }
      ));

      tasks.push(createTask(
        'Review changes',
        `Review refactored code for improvements`,
        'review',
        {
          priority: 40,
          tags: ['review'],
          dependencies: [tasks[2].id],
        }
      ));
    }

    // Pattern: Deploy
    else if (/deploy|publish|release/i.test(lower)) {
      tasks.push(createTask(
        'Pre-deploy checks',
        `Run pre-deployment checks and tests`,
        'test',
        { priority: 100, tags: ['deploy', 'test'] }
      ));

      tasks.push(createTask(
        'Build project',
        `Build the project for production`,
        'shell',
        {
          priority: 80,
          tags: ['build', 'deploy'],
          dependencies: [tasks[0].id],
        }
      ));

      tasks.push(createTask(
        'Deploy',
        `Deploy to production: ${intent}`,
        'shell',
        {
          priority: 60,
          tags: ['deploy'],
          dependencies: [tasks[1].id],
        }
      ));
    }

    // Default pattern: Generic task
    else {
      const role = inferRole(intent);

      tasks.push(createTask(
        'Execute request',
        intent,
        role,
        {
          priority: 100,
          tags: extractTags(intent),
        }
      ));

      // Add review for code changes
      if (role === 'code') {
        tasks.push(createTask(
          'Review changes',
          `Review the changes made`,
          'review',
          {
            priority: 40,
            tags: ['review'],
            dependencies: [tasks[0].id],
          }
        ));
      }
    }

    // Limit tasks
    if (tasks.length > (this.config.maxTasks ?? 20)) {
      console.warn('[155.2][AGENTS][PLANNER] Task limit exceeded, truncating');
      tasks.length = this.config.maxTasks ?? 20;
    }

    return tasks;
  }

  /**
   * Re-plan after a task failure
   */
  async replanOnFailure(
    graph: TaskGraph,
    failedTaskId: string,
    error: string
  ): Promise<TaskGraph> {
    console.log('[155.2][AGENTS][PLANNER] Re-planning after failure:', failedTaskId);

    const failedTask = graph.getTask(failedTaskId);
    if (!failedTask) {
      throw new Error(`Task not found: ${failedTaskId}`);
    }

    // Check retry count
    const retryCount = (failedTask.retryCount ?? 0) + 1;
    const maxRetries = failedTask.maxRetries ?? 3;

    if (retryCount <= maxRetries) {
      // Retry the task
      failedTask.retryCount = retryCount;
      failedTask.status = 'pending';
      failedTask.error = undefined;

      console.log('[155.2][AGENTS][PLANNER] Retrying task:', {
        taskId: failedTaskId,
        attempt: retryCount,
        maxRetries,
      });
    } else {
      // Mark as permanently failed
      console.log('[155.2][AGENTS][PLANNER] Task max retries exceeded:', failedTaskId);

      // Cancel dependent tasks
      for (const task of graph.getTasks()) {
        if (task.dependencies.includes(failedTaskId) && task.status === 'pending') {
          task.status = 'cancelled';
          console.log('[155.2][AGENTS][PLANNER] Cancelled dependent task:', task.id);
        }
      }
    }

    return graph;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalPlannerAgent: PlannerAgent | null = null;

/**
 * Get the global PlannerAgent instance
 */
export function getPlannerAgent(config?: PlannerConfig): PlannerAgent {
  if (!globalPlannerAgent) {
    globalPlannerAgent = new PlannerAgent(config);
  }
  return globalPlannerAgent;
}

/**
 * Reset the global planner agent (for testing)
 */
export function resetPlannerAgent(): void {
  globalPlannerAgent = null;
}

console.log('[155.2][AGENTS][PLANNER] PlannerAgent module loaded');
