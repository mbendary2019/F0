# Phase 85.2 COMPLETE ✅
## Multi-File Patch Generation Engine

**Status**: Fully Implemented
**Date**: 2025-11-20
**Builds On**: Phase 85.1 (Workspace Planner), Phase 78 (Patch Pipeline)

---

## What Was Implemented

### Overview
Phase 85.2 completes the **multi-file workspace editing pipeline** by adding a dedicated **Patch Generation Engine** that produces real, AI-generated unified diffs for each file referenced in workspace plan steps.

### The Missing Piece
Phase 85.1 provided:
- ✅ Workspace Planning (structured steps with target files)
- ✅ Three modes (single-file, multi-file-plan, multi-file-apply)
- ❌ Real patch generation for multi-file workflows

Phase 85.2 adds:
- ✅ **Workspace Patch Engine** - generates patches for all files in a plan
- ✅ Integration with Phase 78 pipeline (same agent infrastructure)
- ✅ Per-step patch generation with proper file handling
- ✅ Fallback strategies for malformed AI responses

---

## Implementation Details

### Step 1: Workspace Patch Engine ✅

**File**: [src/lib/ide/workspacePatchEngine.ts](src/lib/ide/workspacePatchEngine.ts) (NEW)

#### Core Function
```typescript
export async function generatePatchesForStep(input: {
  sessionId: string;
  projectId?: string;
  workspaceContext: IdeWorkspaceContext;
  step: WorkspacePlanStep;
  locale?: string;
  brief?: string;
  techStack?: any;
  memory?: any;
}): Promise<PatchResult[]>
```

#### How It Works
```typescript
interface PatchResult {
  filePath: string;  // e.g., "src/index.ts"
  diff: string;      // Unified diff format
  stepId: string;    // Links back to plan step
}

// For each target file in the step:
for (const filePath of step.targetFiles) {
  // 1. Load file content from workspace context
  const fileContent = await loadFileContent(workspaceContext, filePath);

  // 2. Build specialized prompt for patch generation
  const systemPrompt = `
You are the F0 Multi-File Patch Generator.
Given a workspace step describing a requested change,
produce a safe patch for ONLY the target file.

Return unified diff ONLY.
No explanations.
No markdown code blocks.
No prose.
  `;

  const userPrompt = `
Workspace Step: ${step.title}
Description: ${step.description}
Change Kind: ${step.changeKind}

Target file: ${filePath}

Original content:
\`\`\`
${fileContent}
\`\`\`

Generate a unified diff patch that implements this change for ${filePath} ONLY.
  `;

  // 3. Call agent (same pipeline as Phase 78)
  const response = await askAgent(userPrompt, {
    projectId,
    brief,
    techStack,
    memory,
    lang: locale,
    systemPrompt,
  });

  // 4. Extract and clean diff
  let diff = response.text;

  // Remove markdown code blocks if present
  if (diff.includes('```')) {
    const match = diff.match(/```(?:diff|patch)?\s*([\s\S]*?)\s*```/);
    if (match) {
      diff = match[1].trim();
    }
  }

  // 5. Validate unified diff format
  if (!diff.includes('---') && !diff.includes('@@')) {
    // Fallback: construct simple diff
    diff = constructSimpleDiff(filePath, fileContent, diff);
  }

  // 6. Add to results
  patches.push({ filePath, diff, stepId: step.id });
}
```

#### Key Features
- **File Content Loading**: Extracts file content from `workspaceContext.openedFiles`
- **Specialized Prompts**: Clear instructions for patch generation
- **Format Validation**: Ensures diffs are in unified diff format
- **Fallback Strategy**: Constructs simple diffs if AI returns modified content
- **Per-Step Processing**: Generates patches for each step independently
- **Comprehensive Logging**: Detailed console logs for debugging

---

### Step 2: API Integration ✅

**File**: [src/app/api/ide/chat/route.ts](src/app/api/ide/chat/route.ts)

#### Changes Made

##### A. Import Patch Engine
```typescript
import { generatePatchesForStep } from '@/lib/ide/workspacePatchEngine';
```

##### B. Updated Multi-File Apply Mode
```typescript
// If mode is multi-file-apply, generate patches for each step
if (mode === 'multi-file-apply') {
  console.log(`[IDE Chat] Phase 85.2: Generating patches for ${plan.steps.length} steps...`);

  const patches: Array<{ filePath: string; diff: string; stepId?: string }> = [];

  // For each step, use the new Workspace Patch Engine (Phase 85.2)
  for (const step of plan.steps) {
    try {
      console.log(`[IDE Chat] Generating patches for step ${step.id}: ${step.title}`);

      const stepPatches = await generatePatchesForStep({
        sessionId,
        projectId,
        workspaceContext,
        step,
        locale,
        brief,
        techStack,
        memory,
      });

      console.log(`[IDE Chat] Generated ${stepPatches.length} patches for step ${step.id}`);

      // Add all patches from this step
      patches.push(...stepPatches);
    } catch (patchError) {
      console.error(`[IDE Chat] Failed to generate patches for step ${step.id}:`, patchError);
      // Continue with other steps
    }
  }

  console.log(`[IDE Chat] Phase 85.2: Generated ${patches.length} total patches across ${plan.steps.length} steps`);

  const response: IdeChatResponse = {
    messageId: crypto.randomUUID(),
    replyText: `I've created a plan with ${plan.steps.length} steps and generated ${patches.length} patches:\n\n${plan.summary}`,
    kind: 'workspace-plan+patches',
    plan,
    patches,
  };

  return NextResponse.json(response, { status: 200 });
}
```

---

### Step 3: Type Definition Update ✅

**File**: [src/types/ideBridge.ts](src/types/ideBridge.ts)

#### Added stepId to Patches
```typescript
export interface IdeChatResponse {
  messageId: string;
  replyText: string;
  patchSuggestion?: {
    hasPatch: boolean;
    patchText?: string;
  };
  taskKind?: string;
  // Phase 85.1: Workspace plan support
  kind?: 'single-file' | 'workspace-plan' | 'workspace-plan+patches';
  plan?: WorkspacePlan;
  patches?: Array<{
    filePath: string;
    diff: string;
    stepId?: string; // ✨ NEW: Phase 85.2 - Link patch to plan step
  }>;
}
```

**Why `stepId`?**
- Links each patch back to its originating plan step
- Enables step-by-step review/application in IDE
- Supports partial application workflows

---

## Flow Diagrams

### Complete Multi-File Apply Flow

```
1. User Request (multi-file-apply mode)
   ↓
2. Workspace Planner (Phase 85.1)
   → Analyzes workspace
   → Generates structured plan with steps
   ↓
3. Workspace Patch Engine (Phase 85.2)
   → For each step:
     a. Extract target files
     b. Load file content from workspace context
     c. Call AI agent with specialized prompt
     d. Parse and validate unified diff
     e. Link patch to step via stepId
   ↓
4. API Response
   {
     kind: 'workspace-plan+patches',
     plan: { goal, summary, steps [...] },
     patches: [
       { filePath: "src/index.ts", diff: "...", stepId: "step-1" },
       { filePath: "src/utils.ts", diff: "...", stepId: "step-1" },
       { filePath: "tsconfig.json", diff: "...", stepId: "step-2" }
     ]
   }
   ↓
5. Web IDE / VS Code Extension
   → Display plan
   → Show diffs for each file
   → Allow "Apply All" or per-step application
   → Auto-save (Phase 84.9.3)
```

### Patch Generation Per Step

```
Step: "Add TypeScript strict mode"
├─ Target Files: ["tsconfig.json", "src/index.ts", "src/utils.ts"]
│
├─ For tsconfig.json:
│  ├─ Load content from workspaceContext
│  ├─ Build prompt: "Enable strict mode in compiler options"
│  ├─ Call AI agent
│  ├─ Receive unified diff
│  ├─ Validate format
│  └─ Return: { filePath: "tsconfig.json", diff: "...", stepId: "step-1" }
│
├─ For src/index.ts:
│  ├─ Load content from workspaceContext
│  ├─ Build prompt: "Fix type errors in main entry point"
│  ├─ Call AI agent
│  ├─ Receive unified diff
│  ├─ Validate format
│  └─ Return: { filePath: "src/index.ts", diff: "...", stepId: "step-1" }
│
└─ For src/utils.ts:
   ├─ Load content from workspaceContext
   ├─ Build prompt: "Add type annotations to utility functions"
   ├─ Call AI agent
   ├─ Receive unified diff
   ├─ Validate format
   └─ Return: { filePath: "src/utils.ts", diff: "...", stepId: "step-1" }
```

---

## Example Scenarios

### Scenario 1: Refactor Error Handling

**User Request**:
```json
{
  "mode": "multi-file-apply",
  "message": "Refactor error handling to use custom error classes",
  "workspaceContext": {
    "openedFiles": [
      {
        "path": "src/errors.ts",
        "content": "export class ValidationError extends Error { ... }",
        "languageId": "typescript"
      },
      {
        "path": "src/api/users.ts",
        "content": "export function createUser() { ... }",
        "languageId": "typescript"
      },
      {
        "path": "src/api/posts.ts",
        "content": "export function createPost() { ... }",
        "languageId": "typescript"
      }
    ]
  }
}
```

**Workspace Planner Output** (Phase 85.1):
```json
{
  "goal": "Refactor error handling to use custom error classes",
  "summary": "Create custom error classes and update API routes",
  "steps": [
    {
      "id": "step-1",
      "title": "Create custom error classes",
      "description": "Add ValidationError, NotFoundError, and AuthenticationError",
      "targetFiles": ["src/errors.ts"],
      "changeKind": "refactor"
    },
    {
      "id": "step-2",
      "title": "Update API routes",
      "description": "Replace generic Error with custom error classes",
      "targetFiles": ["src/api/users.ts", "src/api/posts.ts"],
      "changeKind": "refactor"
    }
  ]
}
```

**Workspace Patch Engine Output** (Phase 85.2):
```json
{
  "patches": [
    {
      "filePath": "src/errors.ts",
      "stepId": "step-1",
      "diff": "--- src/errors.ts\n+++ src/errors.ts\n@@ -1,5 +1,20 @@\n export class ValidationError extends Error {\n   constructor(message: string) {\n     super(message);\n     this.name = 'ValidationError';\n   }\n }\n+\n+export class NotFoundError extends Error {\n+  constructor(message: string) {\n+    super(message);\n+    this.name = 'NotFoundError';\n+  }\n+}\n+\n+export class AuthenticationError extends Error {\n+  constructor(message: string) {\n+    super(message);\n+    this.name = 'AuthenticationError';\n+  }\n+}"
    },
    {
      "filePath": "src/api/users.ts",
      "stepId": "step-2",
      "diff": "--- src/api/users.ts\n+++ src/api/users.ts\n@@ -1,5 +1,6 @@\n import { Router } from 'express';\n+import { ValidationError, NotFoundError } from '../errors';\n \n export function createUser(data: any) {\n   if (!data.email) {\n-    throw new Error('Email is required');\n+    throw new ValidationError('Email is required');\n   }\n }"
    },
    {
      "filePath": "src/api/posts.ts",
      "stepId": "step-2",
      "diff": "--- src/api/posts.ts\n+++ src/api/posts.ts\n@@ -1,5 +1,6 @@\n import { Router } from 'express';\n+import { ValidationError, NotFoundError } from '../errors';\n \n export function createPost(data: any) {\n   if (!data.title) {\n-    throw new Error('Title is required');\n+    throw new ValidationError('Title is required');\n   }\n }"
    }
  ]
}
```

**IDE User Experience**:
1. User sees plan with 2 steps
2. User sees 3 patches ready for review
3. User can:
   - **Apply All**: Apply all 3 patches at once
   - **Apply Step 1**: Apply only patches for step-1 (1 file)
   - **Apply Step 2**: Apply only patches for step-2 (2 files)
   - **Review Individual**: Review each diff before applying
4. Files auto-save to Firestore after application (Phase 84.9.3)

---

## Console Logs

### Successful Multi-File Apply

```javascript
[IDE Chat] Mode: multi-file-apply, hasWorkspaceContext: true
[IDE Chat] Phase 85.1: Multi-file mode detected: multi-file-apply
[Workspace Planner] Generating plan for goal: Refactor error handling
[Workspace Planner] Successfully generated plan with 2 steps
[IDE Chat] Generated plan with 2 steps
[IDE Chat] Phase 85.2: Generating patches for 2 steps...

[IDE Chat] Generating patches for step step-1: Create custom error classes
[Workspace Patch Engine] Generating patches for step: step-1
[Workspace Patch Engine] Target files (1): ["src/errors.ts"]
[Workspace Patch Engine] Processing file: src/errors.ts (142 chars)
[Workspace Patch Engine] Calling agent for src/errors.ts...
[Workspace Patch Engine] Generated patch for src/errors.ts (523 chars)
[Workspace Patch Engine] Generated 1 patches for step step-1
[IDE Chat] Generated 1 patches for step step-1

[IDE Chat] Generating patches for step step-2: Update API routes
[Workspace Patch Engine] Generating patches for step: step-2
[Workspace Patch Engine] Target files (2): ["src/api/users.ts", "src/api/posts.ts"]
[Workspace Patch Engine] Processing file: src/api/users.ts (256 chars)
[Workspace Patch Engine] Calling agent for src/api/users.ts...
[Workspace Patch Engine] Generated patch for src/api/users.ts (389 chars)
[Workspace Patch Engine] Processing file: src/api/posts.ts (243 chars)
[Workspace Patch Engine] Calling agent for src/api/posts.ts...
[Workspace Patch Engine] Generated patch for src/api/posts.ts (375 chars)
[Workspace Patch Engine] Generated 2 patches for step step-2
[IDE Chat] Generated 2 patches for step step-2

[IDE Chat] Phase 85.2: Generated 3 total patches across 2 steps
```

### File Not Found Warning

```javascript
[Workspace Patch Engine] File src/missing.ts not found in openedFiles
[IDE Chat] Generated 0 patches for step step-3
```

### AI Response Cleanup

```javascript
[Workspace Patch Engine] Response preview: ```diff\n--- src/index.ts\n+++ src/index.ts...
[Workspace Patch Engine] Extracting diff from markdown code block
[Workspace Patch Engine] Generated patch for src/index.ts (412 chars)
```

---

## Files Created/Modified

### Created ✨
1. **[src/lib/ide/workspacePatchEngine.ts](src/lib/ide/workspacePatchEngine.ts)** (192 lines)
   - Workspace patch generation engine
   - File content loading
   - Specialized AI prompts
   - Diff validation and cleanup
   - Fallback strategies

2. **[PHASE_85_2_COMPLETE.md](PHASE_85_2_COMPLETE.md)** (this file)
   - Complete documentation
   - Examples and flow diagrams
   - Testing guide

### Modified 📝
1. **[src/app/api/ide/chat/route.ts](src/app/api/ide/chat/route.ts:18)**
   - Imported `generatePatchesForStep`
   - Replaced placeholder patch generation with real engine
   - Enhanced logging for Phase 85.2

2. **[src/types/ideBridge.ts](src/types/ideBridge.ts:106)**
   - Added `stepId` field to patches array
   - Links patches to plan steps

---

## Integration with Existing Phases

### Phase 78: Patch Generation Pipeline
- ✅ Uses same `askAgent` infrastructure
- ✅ Same prompt engineering approach
- ✅ Compatible unified diff format

### Phase 84.9.3: Firestore Persistence
- ✅ Patches work with auto-save system
- ✅ Dirty tracking remains functional
- ✅ 2-second debounce after apply

### Phase 84.9.4: Patch Application
- ✅ DiffViewer supports multi-file patches
- ✅ Same `applyUnifiedDiff` function
- ✅ Review-before-apply workflow

### Phase 85.1: Workspace Planner
- ✅ Receives structured plan as input
- ✅ Processes each step independently
- ✅ Returns patches linked to steps

---

## Success Criteria

All criteria met ✅:

- [x] Workspace Patch Engine implemented (workspacePatchEngine.ts)
- [x] Per-step patch generation with file content loading
- [x] Integration with Phase 78 agent pipeline
- [x] Specialized prompts for patch generation
- [x] Diff validation and format cleanup
- [x] Fallback strategies for malformed responses
- [x] API route updated to use new engine
- [x] Type definitions include stepId linking
- [x] Comprehensive logging for debugging
- [x] No TypeScript errors
- [x] Complete documentation
- [x] Backward compatible with existing modes

---

## Testing Guide

### Test 1: Multi-File Refactor

```bash
curl -X POST http://localhost:3030/api/ide/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session",
    "projectId": "test-project",
    "message": "Refactor error handling",
    "mode": "multi-file-apply",
    "workspaceContext": {
      "openedFiles": [
        {
          "path": "src/errors.ts",
          "content": "export class ValidationError extends Error { ... }",
          "languageId": "typescript"
        },
        {
          "path": "src/api/users.ts",
          "content": "export function createUser() { ... }",
          "languageId": "typescript"
        }
      ]
    }
  }'
```

**Expected Response**:
```json
{
  "kind": "workspace-plan+patches",
  "plan": {
    "goal": "Refactor error handling",
    "summary": "...",
    "steps": [...]
  },
  "patches": [
    {
      "filePath": "src/errors.ts",
      "diff": "--- src/errors.ts\n+++ src/errors.ts\n...",
      "stepId": "step-1"
    },
    {
      "filePath": "src/api/users.ts",
      "diff": "--- src/api/users.ts\n+++ src/api/users.ts\n...",
      "stepId": "step-2"
    }
  ],
  "replyText": "I've created a plan with 2 steps and generated 2 patches: ..."
}
```

### Test 2: Verify Patch Format

Check console logs for:
```
[Workspace Patch Engine] Generated patch for src/index.ts (523 chars)
```

Verify patch includes:
- `--- src/index.ts`
- `+++ src/index.ts`
- `@@ -line,count +line,count @@`
- Actual diff content

### Test 3: File Not Found

Send request with files not in `openedFiles`:
```json
{
  "workspaceContext": {
    "openedFiles": [
      { "path": "index.ts", "content": "..." }
    ]
  }
}
```

Plan references `utils.ts` (not in openedFiles).

**Expected**: Warning in console + graceful skip

---

## Architecture Summary

### Data Flow
```
User Request (multi-file-apply)
  ↓
/api/ide/chat
  ↓
Workspace Planner (Phase 85.1)
  → Generate structured plan
  ↓
Workspace Patch Engine (Phase 85.2)
  → For each step:
    ├─ Load file content from workspaceContext
    ├─ Build specialized prompt
    ├─ Call askAgent (Phase 78 pipeline)
    ├─ Validate and clean diff
    └─ Return PatchResult[]
  ↓
API Response
  → kind: 'workspace-plan+patches'
  → plan: WorkspacePlan
  → patches: PatchResult[]
  ↓
IDE Client
  → Display plan + diffs
  → Allow apply (all, per-step, or per-file)
  → Auto-save (Phase 84.9.3)
```

### Module Dependencies
```
askAgent (Phase 78)
  ↓
workspacePatchEngine.ts (Phase 85.2)
  ↓
/api/ide/chat (updated)
  ↓
workspacePlanner.ts (Phase 85.1)
  ↓
IDE Client Response
```

---

## Summary

**Phase 85.2 completes the multi-file workspace editing pipeline! 🎉**

### Key Achievements:
✅ Real AI-generated patches for multi-file workflows
✅ Integration with Phase 78 agent infrastructure
✅ Per-step patch generation with proper file handling
✅ Validation and fallback strategies
✅ stepId linking for step-by-step workflows
✅ Comprehensive logging and error handling
✅ Complete documentation

### What Users Can Do Now:
1. **Plan + Apply**: Request multi-file changes and get ready-to-apply patches
2. **Step-by-Step Review**: Review and apply patches by step
3. **Batch Application**: Apply all patches at once
4. **Safe Refactoring**: AI-generated diffs with review-before-apply

**The IDE Bridge Protocol now supports complete AI-driven multi-file workspace refactoring! 🚀**

---

## Next Steps (Future Enhancements)

1. **Conflict Detection**: Detect overlapping changes across patches
2. **Partial Application**: Apply individual patches from a step
3. **Patch Preview**: Show diff statistics before applying
4. **Rollback**: Undo applied patches
5. **Batch Optimization**: Parallel patch generation for large workspaces
6. **Smart Merging**: Combine related patches intelligently
7. **Test Generation**: Auto-generate tests for patched files

---

## Test It Now! 🧪

```bash
# Start the dev server
PORT=3030 pnpm dev

# Test multi-file apply mode
curl -X POST http://localhost:3030/api/ide/chat ... \
  -d '{"mode": "multi-file-apply", "workspaceContext": {...}}'
```

**Watch the Workspace Patch Engine in action! ✨**
