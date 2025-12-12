# PHASE 155 — MULTI-AGENT FEDERATION (V2)

Status: COMPLETE (Core Implementation)
Started: 2025-12-09
Completed: 2025-12-09

---

## Overview

Phase 155 implements a multi-agent federation system that enables coordinated task execution across specialized AI agents. This architecture provides:

- Centralized message bus for agent communication
- Task planning and decomposition
- Code generation with review gates
- Safety envelopes for all agent outputs
- Observable task graphs with real-time UI

---

## Agent Roles

| Role | Responsibility |
|------|----------------|
| `PlannerAgent` | Decomposes user intent into task graph |
| `CodeAgent` | Generates/modifies code |
| `TestAgent` | Writes and runs tests |
| `ShellAgent` | Executes shell commands |
| `BrowserAgent` | Web interactions (future) |
| `GitAgent` | Git operations |
| `ReviewAgent` | Reviews code before commit |

---

## Core Types

### AgentRole

```typescript
type AgentRole =
  | 'planner'
  | 'code'
  | 'test'
  | 'shell'
  | 'browser'
  | 'git'
  | 'review';
```

### AgentMessageKind

```typescript
type AgentMessageKind =
  | 'plan_request'
  | 'plan_result'
  | 'task_assign'
  | 'task_result'
  | 'review_request'
  | 'review_result'
  | 'error'
  | 'status_update';
```

### SafetyEnvelope

```typescript
type SafetyEnvelope = {
  approvedBy: 'auto' | 'human' | 'review_agent';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresHumanApproval: boolean;
  timestamp: number;
};
```

### AgentMessage

```typescript
type AgentMessage<T = unknown> = {
  id: string;
  from: AgentRole;
  to: AgentRole | 'broadcast';
  kind: AgentMessageKind;
  payload: T;
  envelope: SafetyEnvelope;
  parentMessageId?: string;
  timestamp: number;
};
```

### AgentContextHandle

```typescript
type AgentContextHandle = {
  projectId: string;
  sessionId: string;
  userId: string;
  bus: AgentBus;
  memory: ProjectMemoryClient;
};
```

---

## Task Graph Model

### TaskStatus

```typescript
type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled';
```

### AgentTask

```typescript
type AgentTask = {
  id: string;
  title: string;
  description: string;
  assignedTo: AgentRole;
  status: TaskStatus;
  dependencies: string[]; // Task IDs
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
};
```

### TaskPlan

```typescript
type TaskPlan = {
  id: string;
  projectId: string;
  sessionId: string;
  userIntent: string;
  tasks: AgentTask[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
};
```

---

## AgentBus Interface

```typescript
interface AgentBus {
  send(message: AgentMessage): Promise<void>;
  subscribe(role: AgentRole, handler: (msg: AgentMessage) => void): () => void;
  broadcast(message: Omit<AgentMessage, 'to'>): Promise<void>;
  getHistory(sessionId: string): AgentMessage[];
}
```

---

## Implementation Phases

### Phase 155.0 - Architecture Draft ✅
- This document

### Phase 155.1 - Core Types + AgentBus ✅
- `src/lib/agents/federation/types.ts` - All type definitions
- `src/lib/agents/federation/bus.ts` - AgentBus implementation
- `src/lib/agents/federation/safety.ts` - Safety envelope utilities

### Phase 155.2 - PlannerAgent + TaskGraph ✅
- `src/lib/agents/federation/taskGraph.ts` - TaskPlan store
- `src/lib/agents/federation/plannerAgent.ts` - PlannerAgent implementation

### Phase 155.3 - PlanStore + UI ✅
- `src/lib/agents/federation/planStore.ts` - Zustand store for task plans
- `src/components/agents/TaskPlanView.tsx` - Task graph visualization
- `src/components/agents/TaskCard.tsx` - Individual task card

### Phase 155.4 - ReviewAgent ✅
- `src/lib/agents/federation/reviewAgent.ts` - Code review agent
- Security, best practices, and performance checks
- Auto-approval threshold (80/100)

### Phase 155.5 - Agent Integration (Pending)
- Wire agents to existing chat pipeline
- Connect to IDE bridge

### Phase 155.6 - Testing + Polish (Pending)
- Unit tests for agents
- Integration tests for bus

### Phase 155.7 - Documentation + Lock (Pending)
- Final documentation
- Lock comments

---

## Console Log Prefixes

- `[155.1][AGENTS][BUS]` - AgentBus operations
- `[155.1][AGENTS][TYPES]` - Type validations
- `[155.2][AGENTS][PLANNER]` - PlannerAgent
- `[155.2][AGENTS][GRAPH]` - TaskGraph operations
- `[155.3][AGENTS][STORE]` - PlanStore updates
- `[155.4][AGENTS][REVIEW]` - ReviewAgent

---

## Security Considerations

1. **Safety Envelopes**: Every agent output wrapped with risk assessment
2. **Human Approval Gates**: High-risk operations require human confirmation
3. **Review Agent**: Code changes reviewed before commit
4. **Audit Trail**: All messages logged with timestamps

---

## Integration Points

- Phase 97: Orchestrator (PlannerAgent extends orchestrator)
- Phase 98: Agent Context (Shared context model)
- Phase 87: IDE Bridge (Agent outputs to IDE)
- Phase 153: Inline ACE (Quick fixes via CodeAgent)

---

