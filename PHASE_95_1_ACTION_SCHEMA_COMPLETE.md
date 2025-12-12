# ✅ Phase 95.1: Action Schema — COMPLETE

**Status**: ✅ **FULLY IMPLEMENTED**
**Date**: 2025-11-25

---

## 🎯 Phase Goal

Create a comprehensive TypeScript schema for all actions that the F0 Agent can plan and execute. This schema serves as the foundation for:
- **Phase 95.2**: Action Planner Agent (generates ActionPlan)
- **Phase 95.3**: Action Runner (executes ActionPlan)
- **Phase 95.5**: Action Storage (saves to Firestore)

---

## 📦 What Was Implemented

### File Created: [src/lib/agent/actions/actionTypes.ts](src/lib/agent/actions/actionTypes.ts)

A comprehensive type system with **465 lines** of TypeScript definitions covering:

### 1. **Core Enums & Types**

```typescript
export type ActionCategory =
  | 'FILE_SYSTEM'
  | 'FIRESTORE'
  | 'ENV'
  | 'DEPLOYMENT'
  | 'MEMORY'
  | 'TOOL'
  | 'OTHER';

export type ActionName =
  | 'WRITE_FILE'
  | 'UPDATE_FILE'
  | 'DELETE_FILE'
  | 'MKDIR'
  | 'CREATE_FIRESTORE_DOC'
  | 'UPDATE_FIRESTORE_DOC'
  | 'DELETE_FIRESTORE_DOC'
  | 'UPDATE_ENV'
  | 'RUN_DEPLOY'
  | 'APPEND_MEMORY_NOTE'
  | 'SET_MEMORY_SECTION'
  | 'CALL_TOOL';

export type ActionStatus =
  | 'PENDING'
  | 'SKIPPED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'ERROR';

export type ActionInitiator = 'user' | 'agent' | 'system';
```

### 2. **File System Actions** (4 types)

#### WriteFileAction
```typescript
interface WriteFileAction extends ActionBase {
  action: 'WRITE_FILE';
  category: 'FILE_SYSTEM';
  path: string;
  content: string;
  encoding?: FileEncoding;
  overwriteExisting?: boolean;
}
```

#### UpdateFileAction
```typescript
interface UpdateFileAction extends ActionBase {
  action: 'UPDATE_FILE';
  category: 'FILE_SYSTEM';
  path: string;
  newContent: string;
  previousContentHint?: string;
  encoding?: FileEncoding;
}
```

#### DeleteFileAction
```typescript
interface DeleteFileAction extends ActionBase {
  action: 'DELETE_FILE';
  category: 'FILE_SYSTEM';
  path: string;
  requireExists?: boolean;
}
```

#### MkdirAction
```typescript
interface MkdirAction extends ActionBase {
  action: 'MKDIR';
  category: 'FILE_SYSTEM';
  path: string;
  recursive?: boolean;
}
```

### 3. **Firestore Actions** (3 types)

#### CreateFirestoreDocAction
```typescript
interface CreateFirestoreDocAction extends ActionBase {
  action: 'CREATE_FIRESTORE_DOC';
  category: 'FIRESTORE';
  collectionPath: FirestoreCollectionPath;
  docId?: FirestoreDocumentId;
  data: Record<string, unknown>;
}
```

#### UpdateFirestoreDocAction
```typescript
interface UpdateFirestoreDocAction extends ActionBase {
  action: 'UPDATE_FIRESTORE_DOC';
  category: 'FIRESTORE';
  docPath: FirestorePath;
  data: Record<string, unknown>;
  upsert?: boolean;
}
```

#### DeleteFirestoreDocAction
```typescript
interface DeleteFirestoreDocAction extends ActionBase {
  action: 'DELETE_FIRESTORE_DOC';
  category: 'FIRESTORE';
  docPath: FirestorePath;
  ignoreIfMissing?: boolean;
}
```

### 4. **Environment Actions**

```typescript
export type EnvScope = 'LOCAL' | 'PROJECT' | 'STAGING' | 'PRODUCTION_SIM';

interface UpdateEnvAction extends ActionBase {
  action: 'UPDATE_ENV';
  category: 'ENV';
  key: string;
  value: string | null; // null means "unset"
  scope: EnvScope;
  targetHint?: string;
}
```

### 5. **Deployment Actions**

```typescript
export type DeployTarget = 'VERCEL' | 'FIREBASE' | 'CUSTOM';
export type DeployMode = 'PREVIEW' | 'PRODUCTION';

interface RunDeployAction extends ActionBase {
  action: 'RUN_DEPLOY';
  category: 'DEPLOYMENT';
  target: DeployTarget;
  mode: DeployMode;
  message?: string;
  config?: Record<string, unknown>;
}
```

### 6. **Memory Actions** (Bridge to Phase 94)

```typescript
interface AppendMemoryNoteAction extends ActionBase {
  action: 'APPEND_MEMORY_NOTE';
  category: 'MEMORY';
  sectionId: string;
  note: string;
}

interface SetMemorySectionAction extends ActionBase {
  action: 'SET_MEMORY_SECTION';
  category: 'MEMORY';
  sectionId: string;
  content: string;
}
```

### 7. **Tool Actions** (Future-proof)

```typescript
interface CallToolAction extends ActionBase {
  action: 'CALL_TOOL';
  category: 'TOOL';
  toolName: string;
  args: Record<string, unknown>;
}
```

### 8. **Union Types**

```typescript
export type FileSystemAction =
  | WriteFileAction
  | UpdateFileAction
  | DeleteFileAction
  | MkdirAction;

export type FirestoreAction =
  | CreateFirestoreDocAction
  | UpdateFirestoreDocAction
  | DeleteFirestoreDocAction;

export type AnyAction =
  | FileSystemAction
  | FirestoreAction
  | EnvAction
  | DeploymentAction
  | MemoryAction
  | ToolAction;
```

### 9. **Plan & Execution Types**

```typescript
interface ActionExecutionResult {
  status: ActionStatus;
  startedAt: number;
  finishedAt: number;
  logs?: string[];
  output?: unknown;
  error?: ActionError;
}

interface PlannedAction<TAction extends AnyAction = AnyAction> {
  index: number;
  action: TAction;
  status: ActionStatus;
  result?: ActionExecutionResult;
}

interface ActionPlan<TAction extends AnyAction = AnyAction> {
  id: string;
  projectId: string;
  summary: string;
  createdBy: ActionInitiator;
  createdAt: number;
  userIntent?: string;
  steps: PlannedAction<TAction>[];
  autoExecuted?: boolean;
}
```

---

## 🧩 How This Integrates with Future Phases

### Phase 95.2: Action Planner Agent
The AI agent will return `ActionPlan<AnyAction>` with structured steps:

```typescript
const plan: ActionPlan = {
  id: 'plan-123',
  projectId: 'my-project',
  summary: 'Add Stripe payment integration',
  createdBy: 'agent',
  createdAt: Date.now(),
  userIntent: 'عايز أضيف Stripe للدفع',
  steps: [
    {
      index: 0,
      status: 'PENDING',
      action: {
        id: 'action-1',
        projectId: 'my-project',
        action: 'WRITE_FILE',
        category: 'FILE_SYSTEM',
        path: 'src/lib/stripe.ts',
        content: '// Stripe client code...',
        createdBy: 'agent',
        createdAt: Date.now(),
      }
    },
    {
      index: 1,
      status: 'PENDING',
      action: {
        id: 'action-2',
        projectId: 'my-project',
        action: 'UPDATE_ENV',
        category: 'ENV',
        key: 'STRIPE_SECRET_KEY',
        value: 'sk_test_...',
        scope: 'LOCAL',
        createdBy: 'agent',
        createdAt: Date.now(),
      }
    }
  ],
  autoExecuted: false,
};
```

### Phase 95.3: Action Runner
The runner will loop through `plan.steps` and execute each action:

```typescript
for (const step of plan.steps) {
  step.status = 'RUNNING';

  const executor = getExecutorForAction(step.action.action);
  const result = await executor.execute(step.action);

  step.status = result.status;
  step.result = result;

  if (result.status === 'ERROR' && !step.action.skipOnError) {
    break; // Stop plan execution
  }
}
```

### Phase 95.5: Action Storage
Plans will be stored in Firestore:

```typescript
// Firestore structure:
// projects/{projectId}/actionPlans/{planId}

await db.collection('projects').doc(projectId)
  .collection('actionPlans').doc(plan.id)
  .set(plan);
```

---

## 🎯 Design Decisions

### 1. **Stable String Values**
All `ActionName` values are stable strings that will be stored in Firestore/logs. Never change these values once in production.

### 2. **ActionBase for Common Fields**
All actions extend `ActionBase`, ensuring consistency:
- `id`: Unique identifier
- `projectId`: Owner project
- `action`: Action type
- `category`: High-level grouping
- `description`: Human-readable text
- `createdBy`: Who initiated it
- `createdAt`: Timestamp
- `skipOnError`: Continue plan if this fails
- `metadata`: Arbitrary debug data

### 3. **TypeScript Discriminated Unions**
Using `action` as the discriminator enables type-safe exhaustive matching:

```typescript
function executeAction(action: AnyAction) {
  switch (action.action) {
    case 'WRITE_FILE':
      // TypeScript knows this is WriteFileAction
      return executeWriteFile(action);
    case 'UPDATE_ENV':
      // TypeScript knows this is UpdateEnvAction
      return executeUpdateEnv(action);
    // ... compiler ensures all cases are handled
  }
}
```

### 4. **Generic ActionPlan**
`ActionPlan<TAction>` is generic, allowing type-safe specialization:

```typescript
// File-only plan
const filePlan: ActionPlan<FileSystemAction> = { ... };

// Any action plan
const mixedPlan: ActionPlan<AnyAction> = { ... };
```

### 5. **Flexible Output**
`ActionExecutionResult.output` is intentionally `unknown` - each executor decides its structure.

### 6. **Memory Bridge**
Memory actions (`APPEND_MEMORY_NOTE`, `SET_MEMORY_SECTION`) bridge to Phase 94's memory system, allowing agent to update memory as part of action plans.

---

## 📊 Schema Statistics

| Category | Action Types | Total |
|----------|-------------|-------|
| File System | WRITE_FILE, UPDATE_FILE, DELETE_FILE, MKDIR | 4 |
| Firestore | CREATE_FIRESTORE_DOC, UPDATE_FIRESTORE_DOC, DELETE_FIRESTORE_DOC | 3 |
| Environment | UPDATE_ENV | 1 |
| Deployment | RUN_DEPLOY | 1 |
| Memory | APPEND_MEMORY_NOTE, SET_MEMORY_SECTION | 2 |
| Tool | CALL_TOOL | 1 |
| **Total** | | **12** |

---

## 🚀 Next Steps

### Immediate (Phase 95.2):
1. **Create Action Planner Agent**
   - AI agent that converts user intent → ActionPlan
   - Outputs structured JSON following this schema
   - Validates all actions against types

### Phase 95.3:
2. **Create Action Runner/Executor**
   - Implement executor for each action type
   - Handle errors, logging, status updates
   - Support plan pause/resume

### Phase 95.5:
3. **Action Storage in Firestore**
   - Save plans to `projects/{projectId}/actionPlans/{planId}`
   - Support plan history, replay, rollback

---

## 🎓 Key Benefits

1. **Type Safety**: Full TypeScript support prevents runtime errors
2. **Extensibility**: Easy to add new action types
3. **Traceability**: Every action has ID, timestamps, initiator
4. **Flexibility**: Generic types allow specialized use cases
5. **Future-Proof**: CALL_TOOL allows plugin system
6. **Integration**: Memory actions bridge to Phase 94

---

## 🔗 Related Files

- **Phase 94.1**: [PHASE_94_1_PROJECT_MEMORY_COMPLETE.md](PHASE_94_1_PROJECT_MEMORY_COMPLETE.md)
- **Phase 94.2**: [PHASE_94_2_AGENT_DRIVEN_MEMORY_COMPLETE.md](PHASE_94_2_AGENT_DRIVEN_MEMORY_COMPLETE.md)
- **Action Types**: [src/lib/agent/actions/actionTypes.ts](src/lib/agent/actions/actionTypes.ts)

---

## 📝 Example Usage (Future)

```typescript
import { ActionPlan, WriteFileAction, UpdateEnvAction } from '@/lib/agent/actions/actionTypes';

// Agent generates plan
const plan: ActionPlan = await actionPlannerAgent({
  projectId: 'my-project',
  userIntent: 'Add Stripe payment processing',
});

console.log(`Generated plan with ${plan.steps.length} steps`);

// Runner executes plan
const result = await executeActionPlan(plan);

console.log(`Plan completed: ${result.successCount}/${result.totalCount} steps succeeded`);
```

---

**Phase 95.1 Status: ✅ COMPLETE**

The comprehensive action schema is now ready. All 12 action types are defined with full TypeScript support. Ready to proceed to Phase 95.2 (Action Planner Agent).
