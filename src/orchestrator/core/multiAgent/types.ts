// orchestrator/core/multiAgent/types.ts
// =============================================================================
// Phase 155 – Multi-Agent Federation Core Types
// =============================================================================

export type AgentRole =
  | 'planner'
  | 'code'
  | 'test'
  | 'shell'
  | 'browser'
  | 'git'
  | 'review'
  | 'media'
  | 'audio'
  | 'memory'
  | 'conversation';

export type AgentMessageKind =
  | 'TASK_PROPOSAL'
  | 'TASK_ASSIGNMENT'
  | 'TASK_RESULT'
  | 'TASK_ERROR'
  | 'INFO_REQUEST'
  | 'INFO_RESPONSE'
  | 'PLAN_UPDATE'
  | 'REVIEW_DECISION'
  | 'CHAT_MESSAGE'       // Phase 157: User chat message
  | 'CHAT_RESPONSE';     // Phase 157: Agent chat response

// Phase 156.1 – User Mode for safety policies
export type UserMode = 'beginner' | 'pro' | 'expert';

export interface AgentContextHandle {
  projectId: string;
  workspaceId?: string;
  userId?: string;
  conversationId?: string;
  planId?: string;
  taskId?: string;
  userMode?: UserMode; // Phase 156.1: Mode-aware safety
}

export interface SafetyEnvelope {
  level: 'low' | 'medium' | 'high';
  requiresApproval?: boolean;
  riskTags?: string[];
  guardrailPolicyId?: string; // Phase 156
}

export interface AgentMessage<TPayload = unknown> {
  id: string;
  timestamp: string;
  from: AgentRole;
  to: AgentRole | 'broadcast';
  kind: AgentMessageKind;
  context: AgentContextHandle;
  safety: SafetyEnvelope;
  payload: TPayload;
  meta?: Record<string, unknown>;
}

export interface AgentBus {
  publish<TPayload = unknown>(message: AgentMessage<TPayload>): Promise<void>;
  subscribe(
    role: AgentRole,
    handler: (message: AgentMessage) => Promise<void>
  ): void;
}

export type TaskStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

// ========== NEW: TaskKind & ReviewDecision ==========

export type TaskKind =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'tests'
  | 'infra'
  | 'chore';

export type ReviewDecisionType = 'APPROVE' | 'REQUEST_CHANGES' | 'ROLLBACK';

export type PlanStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface TaskResultPayload<TOutput = unknown> {
  planId: string;
  taskId: string;
  owner: AgentRole;
  status: TaskStatus;
  output?: TOutput;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface ReviewDecisionPayload {
  planId: string;
  summary: string;
  decision: ReviewDecisionType;
  reasons?: string[];
  followUpTasks?: AgentTask[];
}

// ==========

export interface AgentTask<TInput = unknown, TOutput = unknown> {
  id: string;
  planId: string;
  label: string;
  owner: AgentRole;
  status: TaskStatus;
  dependsOn: string[];
  input: TInput;
  output?: TOutput;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  kind?: TaskKind;   // NEW: task type classification
  tags?: string[];   // NEW: e.g. ['auth', 'login', 'api']
}

export interface TaskPlan {
  id: string;
  goal: string;
  createdBy: 'user' | 'agent';
  createdAt: string;
  tasks: AgentTask[];
  status?: PlanStatus; // NEW: overall plan status
  metadata?: {
    projectId?: string;
    inferredGoalType?: string;
    lastDecision?: ReviewDecisionType;
    [key: string]: unknown;
  };
}

export interface PlannerInput {
  goal: string;
  projectId: string;
  conversationId?: string;
  userId?: string;
  constraints?: {
    maxSteps?: number;
    preferSafeMode?: boolean;
    allowShell?: boolean;
    allowBrowser?: boolean;
  };
}

export interface SafetyChecker {
  evaluate(
    message: AgentMessage
  ): Promise<{
    allowed: boolean;
    requiresUserConfirm?: boolean;
    reason?: string;
  }>;
}

console.log('[155][ORCHESTRATOR][TYPES] Multi-Agent types loaded');
