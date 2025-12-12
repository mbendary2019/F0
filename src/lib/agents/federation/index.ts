// src/lib/agents/federation/index.ts
// =============================================================================
// Phase 155 – Multi-Agent Federation Module
// Central export for all federation types and utilities
// =============================================================================

// Types
export type {
  AgentRole,
  AgentMessageKind,
  SafetyEnvelope,
  AgentMessage,
  TaskStatus,
  AgentTask,
  TaskPlan,
  PlanRequestPayload,
  PlanResultPayload,
  TaskAssignPayload,
  TaskResultPayload,
  ReviewRequestPayload,
  ReviewResultPayload,
  ErrorPayload,
  StatusUpdatePayload,
  AgentMessageHandler,
  Unsubscribe,
  AgentContextHandle,
  AgentConfig,
  ProjectMemoryClient,
  AgentBus,
} from './types';

// Type guards
export {
  isAgentRole,
  isAgentMessageKind,
  isTaskStatus,
} from './types';

// Safety utilities
export {
  assessTaskRisk,
  assessFileRisk,
  assessAgentRoleRisk,
  createTaskEnvelope,
  createFileEnvelope,
  createLowRiskEnvelope,
  createHumanApprovalEnvelope,
  createReviewApprovedEnvelope,
  canExecute,
  approveByHuman,
  getRiskDisplay,
} from './safety';

// AgentBus
export {
  InMemoryAgentBus,
  createMessage,
  createPlanRequest,
  createTaskAssignment,
  createStatusUpdate,
  createErrorMessage,
  getAgentBus,
  resetAgentBus,
} from './bus';

// TaskGraph
export {
  TaskGraph,
  createEmptyPlan,
  createTask,
  createPlanFromTasks,
  autoWireDependencies,
  validateNoCycles,
} from './taskGraph';

// PlannerAgent
export {
  PlannerAgent,
  getPlannerAgent,
  resetPlannerAgent,
} from './plannerAgent';
export type { PlannerConfig, PlannerResult } from './plannerAgent';

// ReviewAgent
export {
  ReviewAgent,
  getReviewAgent,
  resetReviewAgent,
} from './reviewAgent';
export type { ReviewConfig, ReviewResult, CodeIssue } from './reviewAgent';

// PlanStore
export {
  usePlanStore,
  useTasksByStatus,
  useReadyTasks,
  usePlanProgress,
  usePlanStats,
  useFocusedTask,
} from './planStore';
export type { PlanStoreState, PlanStoreActions, PlanStore } from './planStore';

console.log('[155][AGENTS][FEDERATION] Federation module loaded');
