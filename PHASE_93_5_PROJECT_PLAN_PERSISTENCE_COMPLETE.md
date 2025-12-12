# Phase 93.5: Project Plan Persistence & Task Execution Loop - Complete

## Summary
Implemented a complete system for persisting project plans (phases + tasks) to Firestore and managing task execution with automatic progress tracking.

## Firestore Schema

### Collection: `ops_projects/{projectId}/phases/{phaseId}`
```typescript
{
  index: number,        // 1, 2, 3...
  title: string,
  status: 'pending' | 'active' | 'completed',
  completion: number    // 0-100 (auto-calculated)
}
```

### Collection: `ops_projects/{projectId}/tasks/{taskId}`
```typescript
{
  phaseId: string,
  title: string,
  description: string,
  mode: 'chat' | 'refactor' | 'deploy' | 'plan' | 'explain',
  status: 'pending' | 'in_progress' | 'completed' | 'blocked',
  priority: 'low' | 'medium' | 'high',
  difficulty: 'low' | 'medium' | 'high',
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Files Created

### 1. Server Helper: `src/lib/server/projectPlan.ts`
- `saveProjectPlan()` - Save phases + tasks from agent
- `updateTaskStatus()` - Update task and recalculate phase completion
- `recalculatePhaseCompletion()` - Calculate phase % from tasks
- `getProjectPlan()` - Get full plan (phases + tasks)
- `getNextPendingTask()` - Get next task for auto-execution
- `activateFirstPendingPhase()` - Activate first pending phase
- `getProjectProgress()` - Get overall project progress stats

### 2. API Endpoint: `src/app/api/projects/[projectId]/plan/route.ts`
- `GET` - Get full plan (phases + tasks) with optional progress stats
- `GET ?next=true` - Get next pending task for auto-execution
- `POST` - Save plan from agent F0_JSON
- `PATCH` - Update task status

### 3. React Hook: `src/hooks/useProjectPlan.ts`
- `useProjectPlan()` - Fetch plan with polling support
- `getNextPendingTask()` - Utility to get next task

## Files Updated

### Continue with Agent Page
`src/app/[locale]/f0/projects/[id]/continue/page.tsx`
- Added collection toggle (projects vs ops_projects)
- Integrated `useProjectPlan` hook for ops_projects data
- Unified data source with `activePhases` and `activeTasks`

## API Usage

### Save Plan (from Agent)
```typescript
POST /api/projects/{projectId}/plan
{
  "phases": [
    { "id": "phase-1", "index": 1, "title": "MVP" }
  ],
  "tasks": [
    {
      "id": "task-1",
      "phaseId": "phase-1",
      "title": "Setup project",
      "description": "Initialize Next.js project",
      "mode": "refactor",
      "priority": "high",
      "difficulty": "low"
    }
  ]
}
```

### Get Plan
```typescript
GET /api/projects/{projectId}/plan?progress=true

Response:
{
  "phases": [...],
  "tasks": [...],
  "progress": {
    "totalPhases": 3,
    "completedPhases": 1,
    "totalTasks": 10,
    "completedTasks": 4,
    "overallCompletion": 40
  }
}
```

### Update Task Status
```typescript
PATCH /api/projects/{projectId}/plan
{
  "taskId": "task-1",
  "status": "completed"
}

Response:
{
  "success": true,
  "taskId": "task-1",
  "status": "completed",
  "progress": { ... }
}
```

### Get Next Pending Task
```typescript
GET /api/projects/{projectId}/plan?next=true

Response:
{
  "nextTask": {
    "id": "task-2",
    "title": "Implement auth",
    ...
  }
}
```

## Integration Points

### 1. Agent F0_JSON Processing
When agent outputs F0_JSON with plan:
```typescript
import { saveProjectPlan } from '@/lib/server/projectPlan';

if (parsed.plan) {
  await saveProjectPlan({
    projectId,
    phases: parsed.plan.phases,
    tasks: parsed.plan.tasks,
  });
}
```

### 2. Auto-Execute Queue
When executing a task:
```typescript
import { updateTaskStatus } from '@/lib/server/projectPlan';

// Before execution
await updateTaskStatus({ projectId, taskId, status: 'in_progress' });

// After success
await updateTaskStatus({ projectId, taskId, status: 'completed' });

// On error
await updateTaskStatus({ projectId, taskId, status: 'blocked' });
```

## UI Features

### Collection Toggle
The Continue with Agent page now has a toggle to switch between:
- `📁 projects` - Legacy collection (direct Firestore listener)
- `🗄️ ops_projects` - New collection (via API with polling)

### Auto-Completion Tracking
- Phase completion % auto-updates when tasks are marked complete
- Phase status changes: pending → active → completed

## Testing

### 1. Create a test plan
```bash
curl -X POST http://localhost:3030/api/projects/test-project/plan \
  -H "Content-Type: application/json" \
  -d '{
    "phases": [
      {"id": "phase-1", "index": 1, "title": "MVP Features"},
      {"id": "phase-2", "index": 2, "title": "Polish & Launch"}
    ],
    "tasks": [
      {"id": "task-1", "phaseId": "phase-1", "title": "Auth system", "description": "Implement login/signup", "mode": "refactor"},
      {"id": "task-2", "phaseId": "phase-1", "title": "Dashboard", "description": "Create main dashboard", "mode": "refactor"},
      {"id": "task-3", "phaseId": "phase-2", "title": "Testing", "description": "Add unit tests", "mode": "chat"}
    ]
  }'
```

### 2. View in UI
Navigate to: `/en/f0/projects/test-project/continue`
Toggle to `ops_projects` to see the plan.

### 3. Update task status
```bash
curl -X PATCH http://localhost:3030/api/projects/test-project/plan \
  -H "Content-Type: application/json" \
  -d '{"taskId": "task-1", "status": "completed"}'
```

## Next Steps
- Wire up `/api/f0/process-json` to call `saveProjectPlan()` when agent outputs plan
- Wire up `/api/f0/auto-execute-queue` to use `updateTaskStatus()` during execution
- Add real-time Firestore listeners for ops_projects collection
