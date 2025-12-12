// src/lib/agents/federation/types.ts
// =============================================================================
// Phase 155.1 – Multi-Agent Federation Core Types
// Defines the fundamental types for agent communication and task management
// =============================================================================

/**
 * Agent roles in the federation
 */
export type AgentRole =
  | 'planner'    // Decomposes user intent into task graph
  | 'code'       // Generates/modifies code
  | 'test'       // Writes and runs tests
  | 'shell'      // Executes shell commands
  | 'browser'    // Web interactions (future)
  | 'git'        // Git operations
  | 'review';    // Reviews code before commit

/**
 * Message types exchanged between agents
 */
export type AgentMessageKind =
  | 'plan_request'     // Request to create/update a plan
  | 'plan_result'      // Plan created/updated
  | 'task_assign'      // Assign a task to an agent
  | 'task_result'      // Task execution result
  | 'review_request'   // Request code review
  | 'review_result'    // Code review result
  | 'error'            // Error notification
  | 'status_update';   // Progress/status update

/**
 * Safety envelope wrapping all agent outputs
 * Ensures risk assessment and approval tracking
 */
export type SafetyEnvelope = {
  /** Who approved this action */
  approvedBy: 'auto' | 'human' | 'review_agent';
  /** Risk level assessment */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Whether human approval is required before execution */
  requiresHumanApproval: boolean;
  /** Timestamp of approval/assessment */
  timestamp: number;
  /** Optional reason for the risk assessment */
  reason?: string;
};

/**
 * Core message structure for agent communication
 */
export type AgentMessage<T = unknown> = {
  /** Unique message ID */
  id: string;
  /** Sending agent role */
  from: AgentRole;
  /** Target agent role or broadcast */
  to: AgentRole | 'broadcast';
  /** Message type */
  kind: AgentMessageKind;
  /** Message payload (type-safe based on kind) */
  payload: T;
  /** Safety envelope for risk assessment */
  envelope: SafetyEnvelope;
  /** Parent message ID for threading */
  parentMessageId?: string;
  /** Creation timestamp */
  timestamp: number;
  /** Session ID for grouping messages */
  sessionId: string;
  /** Project ID context */
  projectId: string;
};

/**
 * Task status in the execution graph
 */
export type TaskStatus =
  | 'pending'      // Not yet started
  | 'in_progress'  // Currently executing
  | 'blocked'      // Waiting for dependencies
  | 'completed'    // Successfully finished
  | 'failed'       // Execution failed
  | 'cancelled';   // Cancelled by user/system

/**
 * Individual task in the task graph
 */
export type AgentTask = {
  /** Unique task ID */
  id: string;
  /** Short task title */
  title: string;
  /** Detailed task description */
  description: string;
  /** Assigned agent role */
  assignedTo: AgentRole;
  /** Current status */
  status: TaskStatus;
  /** IDs of tasks this depends on */
  dependencies: string[];
  /** Execution result (type depends on task) */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution start timestamp */
  startedAt?: number;
  /** Completion timestamp */
  completedAt?: number;
  /** Priority (higher = more important) */
  priority?: number;
  /** Tags for categorization */
  tags?: string[];
  /** Retry count */
  retryCount?: number;
  /** Maximum retries allowed */
  maxRetries?: number;
};

/**
 * Complete task plan with all tasks
 */
export type TaskPlan = {
  /** Unique plan ID */
  id: string;
  /** Project ID */
  projectId: string;
  /** Session ID */
  sessionId: string;
  /** Original user intent/request */
  userIntent: string;
  /** All tasks in this plan */
  tasks: AgentTask[];
  /** Overall plan status */
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'paused';
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** User who created the plan */
  createdBy?: string;
  /** Current phase/step */
  currentPhase?: number;
  /** Total phases */
  totalPhases?: number;
  /** Plan metadata */
  metadata?: Record<string, unknown>;
};

// =============================================================================
// Payload Types for specific message kinds
// =============================================================================

/**
 * Payload for plan_request messages
 */
export type PlanRequestPayload = {
  userIntent: string;
  context?: {
    projectBrief?: string;
    techStack?: Record<string, unknown>;
    memory?: Record<string, unknown>;
  };
  constraints?: {
    maxTasks?: number;
    priorityTags?: string[];
    excludeAgents?: AgentRole[];
  };
};

/**
 * Payload for plan_result messages
 */
export type PlanResultPayload = {
  plan: TaskPlan;
  reasoning?: string;
};

/**
 * Payload for task_assign messages
 */
export type TaskAssignPayload = {
  task: AgentTask;
  context?: Record<string, unknown>;
  deadline?: number;
};

/**
 * Payload for task_result messages
 */
export type TaskResultPayload = {
  taskId: string;
  status: 'completed' | 'failed';
  result?: unknown;
  error?: string;
  duration?: number;
  artifacts?: Array<{
    type: 'file' | 'patch' | 'log' | 'other';
    path?: string;
    content?: string;
  }>;
};

/**
 * Payload for review_request messages
 */
export type ReviewRequestPayload = {
  taskId: string;
  files: Array<{
    path: string;
    content: string;
    diff?: string;
  }>;
  context?: string;
};

/**
 * Payload for review_result messages
 */
export type ReviewResultPayload = {
  taskId: string;
  approved: boolean;
  score: number; // 0-100
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    file: string;
    line?: number;
    message: string;
    suggestion?: string;
  }>;
  summary?: string;
};

/**
 * Payload for error messages
 */
export type ErrorPayload = {
  code: string;
  message: string;
  taskId?: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
};

/**
 * Payload for status_update messages
 */
export type StatusUpdatePayload = {
  taskId?: string;
  progress?: number; // 0-100
  phase?: string;
  message: string;
  level: 'info' | 'warning' | 'success' | 'error';
};

// =============================================================================
// Type Guards
// =============================================================================

export function isAgentRole(value: string): value is AgentRole {
  return ['planner', 'code', 'test', 'shell', 'browser', 'git', 'review'].includes(value);
}

export function isAgentMessageKind(value: string): value is AgentMessageKind {
  return [
    'plan_request', 'plan_result', 'task_assign', 'task_result',
    'review_request', 'review_result', 'error', 'status_update'
  ].includes(value);
}

export function isTaskStatus(value: string): value is TaskStatus {
  return ['pending', 'in_progress', 'blocked', 'completed', 'failed', 'cancelled'].includes(value);
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Handler for processing agent messages
 */
export type AgentMessageHandler<T = unknown> = (message: AgentMessage<T>) => void | Promise<void>;

/**
 * Unsubscribe function returned by subscriptions
 */
export type Unsubscribe = () => void;

/**
 * Agent context handle for accessing shared resources
 */
export type AgentContextHandle = {
  projectId: string;
  sessionId: string;
  userId: string;
  bus: AgentBus;
  memory?: ProjectMemoryClient;
  config?: AgentConfig;
};

/**
 * Agent configuration options
 */
export type AgentConfig = {
  /** Maximum retries for failed tasks */
  maxRetries: number;
  /** Timeout for task execution (ms) */
  taskTimeout: number;
  /** Whether to auto-approve low-risk actions */
  autoApproveLowRisk: boolean;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
};

/**
 * Placeholder for project memory client
 * Will be integrated with existing memory system
 */
export type ProjectMemoryClient = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
};

// =============================================================================
// AgentBus Interface
// =============================================================================

/**
 * Central message bus for agent communication
 */
export interface AgentBus {
  /**
   * Send a message to a specific agent or broadcast
   */
  send<T>(message: AgentMessage<T>): Promise<void>;

  /**
   * Subscribe to messages for a specific role
   */
  subscribe<T>(role: AgentRole, handler: AgentMessageHandler<T>): Unsubscribe;

  /**
   * Broadcast a message to all agents
   */
  broadcast<T>(message: Omit<AgentMessage<T>, 'to'>): Promise<void>;

  /**
   * Get message history for a session
   */
  getHistory(sessionId: string): AgentMessage[];

  /**
   * Clear message history for a session
   */
  clearHistory(sessionId: string): void;

  /**
   * Get pending messages for a role
   */
  getPending(role: AgentRole): AgentMessage[];
}

console.log('[155.1][AGENTS][TYPES] Federation types loaded');
