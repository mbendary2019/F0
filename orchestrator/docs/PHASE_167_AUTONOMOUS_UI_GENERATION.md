# Phase 167 – Autonomous UI Generation Pipeline

> من Screenshot/Prompt → Plan → Code → File Changes

## Overview

Phase 167 implements the full autonomous UI generation pipeline that takes a UI proposal and generates actual code files in the project.

```
Screenshot/Prompt → Preprocess (164) → MediaMemory (165) → NeuralContext (166)
                                              ↓
                                      UI Proposal (163)
                                              ↓
                                   Generation Plan (167.1)
                                              ↓
                                        Codegen (167.2)
                                              ↓
                                       Apply Files (167.3)
                                              ↓
                                    Updated Project ✅
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│              Autonomous UI Generation Pipeline (Phase 167)          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐                                               │
│  │  UI Proposal     │  ← From Phase 163                             │
│  │  (componentTree) │                                               │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────┐     ┌─────────────────┐                      │
│  │  UI PlannerAgent │ ←── │  MediaMemory    │  ← Phase 165         │
│  │     (167.1)      │     │  NeuralContext  │  ← Phase 166         │
│  └────────┬─────────┘     └─────────────────┘                      │
│           │                                                         │
│           │  UiGenerationPlan                                       │
│           ▼                                                         │
│  ┌──────────────────┐                                               │
│  │  UI CodegenAgent │                                               │
│  │     (167.2)      │                                               │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           │  UiCodegenResult (file changes)                         │
│           ▼                                                         │
│  ┌──────────────────┐                                               │
│  │  File Mutation   │                                               │
│  │  Engine (167.3)  │                                               │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           │  Write to VFS (Firestore)                               │
│           ▼                                                         │
│  ┌──────────────────┐                                               │
│  │  Project Files   │  → Updated codebase                           │
│  │     (VFS)        │                                               │
│  └──────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Generation Modes

```typescript
type UiGenerationMode =
  | 'create_page'      // Create new page from scratch
  | 'extend_page'      // Add components to existing page
  | 'inject_section'   // Insert section at specific location
  | 'replace_section'  // Replace existing section
  | 'create_component'; // Create standalone component
```

## Core Types

### UiGenerationPlan

```typescript
interface UiGenerationPlan {
  id: string;
  projectId: string;
  proposalId: string;
  mode: UiGenerationMode;
  routePath: string;           // '/dashboard/analytics'
  pageName: string;            // 'AnalyticsDashboardPage'
  layoutStyleHint?: string;    // 'dashboard', 'cards-grid', etc.
  styleHints?: UiStyleHints;
  files: UiFilePlan[];
  status: 'PLANNED' | 'RUNNING' | 'APPLIED' | 'FAILED';
  createdAt: number;
  updatedAt: number;
}
```

### UiFilePlan

```typescript
interface UiFilePlan {
  id: string;
  target: {
    path: string;              // 'src/app/dashboard/page.tsx'
    kind: 'page' | 'component' | 'hook' | 'layout';
  };
  action: 'create' | 'modify';
  description: string;
  components: UiComponentPlan[];
}
```

### UiFileChange

```typescript
interface UiFileChange {
  id: string;
  target: UiFileTarget;
  action: 'create' | 'modify' | 'delete';
  newContent?: string;
  patch?: string;              // Unified diff for modify
  summary: string;
}
```

## API Endpoints

### POST /api/ui/generate/execute

Execute full UI generation pipeline.

**Request:**
```json
{
  "projectId": "proj_123",
  "proposalId": "uig_456",
  "attachmentId": "att_789",
  "modeOverride": "create_page",
  "dryRun": false
}
```

**Response:**
```json
{
  "success": true,
  "plan": {
    "id": "plan_xxx",
    "mode": "create_page",
    "routePath": "/dashboard/analytics",
    "pageName": "AnalyticsPage",
    "files": [...]
  },
  "codegen": {
    "files": [...],
    "totalFiles": 1,
    "filesCreated": 1,
    "generationTimeMs": 150
  },
  "applySummary": {
    "success": true,
    "appliedFiles": [
      { "path": "src/app/dashboard/analytics/page.tsx", "kind": "page" }
    ],
    "rollbackAvailable": true,
    "rollbackId": "rollback_xxx"
  },
  "stage": "COMPLETE",
  "totalTimeMs": 500
}
```

### GET /api/ui/generate/execute

Get plans or specific plan status.

**Query params:**
- `projectId` (required)
- `planId` (optional - get specific plan)

## Files Created

```
orchestrator/core/uiBuilder/
├── uiGenerationPlanTypes.ts   # 167.0 - Type definitions
├── uiPlannerAgent.ts          # 167.1 - Plan builder
├── uiCodegenAgent.ts          # 167.2 - Code generator
├── uiFileMutationEngine.ts    # 167.3 - File writer
├── uiGenerationOrchestrator.ts # 167.4 - End-to-end orchestrator
└── index.ts                   # Module exports (updated)

src/app/api/ui/generate/
└── execute/route.ts           # 167.5 - API endpoint
```

## Usage Example

### From API

```typescript
// Execute UI generation
const response = await fetch('/api/ui/generate/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'proj_123',
    proposalId: 'uig_456',
    dryRun: false,
  }),
});

const result = await response.json();

if (result.success) {
  console.log('Created files:', result.applySummary.appliedFiles);
  console.log('Rollback ID:', result.applySummary.rollbackId);
}
```

### From Orchestrator

```typescript
import { executeUiGeneration } from '@/orchestrator/core/uiBuilder';

const result = await executeUiGeneration({
  projectId: 'proj_123',
  proposalId: 'uig_456',
  dryRun: false,
});

console.log('Plan:', result.plan);
console.log('Codegen:', result.codegen);
console.log('Applied:', result.applySummary);
```

### Step-by-step Execution

```typescript
import {
  buildPlanOnly,
  executeCodegenOnly,
  executeApplyOnly,
} from '@/orchestrator/core/uiBuilder';

// Step 1: Build plan
const plan = await buildPlanOnly({
  projectId: 'proj_123',
  proposalId: 'uig_456',
});

// Step 2: Generate code
const codegen = await executeCodegenOnly(plan.id);

// Step 3: Apply (with dry run first)
const dryRunResult = await executeApplyOnly(codegen, true);
console.log('Would apply:', dryRunResult.appliedFiles);

// Step 4: Actually apply
const applyResult = await executeApplyOnly(codegen, false);
```

## Safety Features

### Protected Paths
The following paths cannot be modified:
- `.env`, `.env.local`, `.env.production`
- `firebase.json`, `firestore.rules`, `storage.rules`
- `package.json`, `tsconfig.json`, `next.config.js`

### Validation
- Content validation (non-empty, size limits)
- Syntax validation (balanced braces/parentheses)
- Path validation (only `src/` and `public/` allowed)

### Rollback
- Automatic rollback records created for all changes
- 7-day retention period
- Execute rollback: `executeRollback(rollbackId)`

## Generated Code Templates

The CodegenAgent generates React/TypeScript code with:

- `'use client'` directive for client components
- Tailwind CSS styling
- Common UI patterns:
  - Stats Card Grids
  - Data Tables
  - Charts (placeholders)
  - Forms
  - Hero sections
  - Sidebars
  - Tab panels

## Integration Points

### Phase 163 (UI Proposal)
- Input: `UiGenerationProposal` with `componentTree`
- Status update: `COMPLETED` on success

### Phase 165 (Media Memory)
- Style hints extracted from `MediaMemoryNode`
- Layout types inform layout selection

### Phase 166 (Neural Memory)
- Context informs code generation
- Related files/patterns referenced

## UI Integration (167.6)

The `UiGenerationProposalPanel` component should be updated to include:

1. "Generate & Apply" button after approval
2. Progress timeline showing stages:
   - Plan ✅
   - Codegen ✅
   - Apply ✅/❌
3. File list showing created/modified files
4. Links to:
   - "View Diff"
   - "Open in Web IDE"
   - "Open in Desktop IDE"

---

**Phase 167 Complete** ✅
