# ✅ Phase 96.3: Code Generator Agent — COMPLETE

**Status**: ✅ **FULLY IMPLEMENTED**
**Date**: 2025-11-25
**Completion**: 100%

---

## 🎯 Overall Goal

Build a **Code Generator Agent** that takes a `DecomposedTask` (from Phase 96.2) and generates **production-ready code** with:
1. Complete TypeScript implementation
2. Phase 95 actions (WRITE_FILE, UPDATE_FILE, etc.)
3. File diffs for IDE preview

---

## 📦 What Was Implemented

### Core Implementation

**File**: [src/lib/agent/roles/codeGeneratorAgent.ts](src/lib/agent/roles/codeGeneratorAgent.ts) (550+ lines)

**Main Function:**
```typescript
export async function runCodeGeneratorAgent(
  params: RunCodeGeneratorAgentParams
): Promise<RunCodeGeneratorAgentResult>
```

**Input:**
- `projectId`: Project identifier
- `userId`: User identifier
- `userInput`: Original user request (for context)
- `task`: DecomposedTask to implement
- `architectPlan`: Complete ArchitectPlan (APIs, data models, modules)
- `fileTree`: Optional array of existing file paths
- `existingFiles`: Optional map of path → content (for UPDATE operations)
- `locale`: Optional locale hint

**Output:**
```typescript
{
  plan: CodeGenerationPlan;
  rawJson: string;
}
```

---

## 📊 Type System

### 1. **FileDiff**

```typescript
export interface FileDiff {
  path: string;              // "src/app/api/auth/signup/route.ts"
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  oldContent?: string;       // For UPDATE operations
  newContent?: string;       // For CREATE/UPDATE operations
  language?: string;         // "typescript", "json", etc.
}
```

**Purpose**: Represents file changes for IDE preview/diff view.

---

### 2. **CodeGenerationPlan**

```typescript
export interface CodeGenerationPlan {
  role: 'CODE_GENERATOR';
  projectId: string;
  taskId: string;

  summary: string;           // What was generated

  actions: AnyAction[];      // Phase 95 actions (executable)
  diffs: FileDiff[];         // File diffs (for preview)

  notes?: string;            // Warnings/tips
}
```

**Key Features:**
- **Dual output**: Actions for execution + Diffs for preview
- **Actions** are ready to pass to Phase 95.3 (Action Runner)
- **Diffs** can be shown in IDE for user approval

---

## 🔄 Complete Flow

### Example Usage

```typescript
// Step 1: Get task from Phase 96.2
const { plan: taskPlan } = await runTaskDecomposerAgent({...});
const task = taskPlan.allTasks[0]; // Pick first task

// Step 2: Generate code (Phase 96.3)
const { plan: codePlan } = await runCodeGeneratorAgent({
  projectId: 'my-project',
  userId: 'user-123',
  userInput: 'عايز أعمل authentication',
  task,
  architectPlan,
  fileTree: ['src/lib/firebase.ts', 'src/app/page.tsx'],
  existingFiles: {},
  locale: 'ar'
});

// Step 3: Preview diffs in IDE
codePlan.diffs.forEach(diff => {
  showDiffInIDE({
    path: diff.path,
    operation: diff.operation,
    oldContent: diff.oldContent,
    newContent: diff.newContent
  });
});

// Step 4: User approves → Execute
if (await userApproves(codePlan)) {
  const actionPlan = {
    id: generateId(),
    projectId: 'my-project',
    summary: codePlan.summary,
    steps: codePlan.actions.map((action, idx) => ({
      index: idx,
      status: 'PENDING',
      action
    }))
  };

  await runActionPlan(actionPlan); // Phase 95.3
}
```

---

## 🎯 Sample Output

### Input (Task):
```typescript
{
  id: "auth_signup_api",
  title: "Implement signup API endpoint",
  description: "Create POST /api/auth/signup with email/password validation",
  type: "BACKEND",
  priority: "HIGH",
  moduleId: "auth",
  actionHints: ["WRITE_FILE"]
}
```

### Output (CodeGenerationPlan):
```json
{
  "role": "CODE_GENERATOR",
  "projectId": "my-project",
  "taskId": "auth_signup_api",
  "summary": "Created signup API endpoint with email/password validation",

  "actions": [
    {
      "action": "WRITE_FILE",
      "path": "src/app/api/auth/signup/route.ts",
      "content": "import { NextRequest, NextResponse } from 'next/server';\nimport { auth } from '@/lib/firebase';\n..."
    }
  ],

  "diffs": [
    {
      "path": "src/app/api/auth/signup/route.ts",
      "operation": "CREATE",
      "newContent": "import { NextRequest, NextResponse } from 'next/server';\n...",
      "language": "typescript"
    }
  ],

  "notes": "Uses Firebase Auth with email/password provider. Remember to enable this in Firebase Console."
}
```

**Generated Code Preview:**
```typescript
// src/app/api/auth/signup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'Email and password required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Create user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    return NextResponse.json({
      ok: true,
      user: {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
      },
    });
  } catch (err: any) {
    console.error('Signup error:', err);

    return NextResponse.json(
      {
        ok: false,
        error: err.code === 'auth/email-already-in-use'
          ? 'Email already registered'
          : 'Signup failed',
      },
      { status: 500 }
    );
  }
}
```

---

## 🔌 API Endpoint

**File**: [src/app/api/agent/generate-code/route.ts](src/app/api/agent/generate-code/route.ts)

**Endpoint**: `POST /api/agent/generate-code`

**Request Body:**
```typescript
{
  projectId: string;
  userId: string;
  userInput: string;
  task: DecomposedTask;
  architectPlan: ArchitectPlan;
  fileTree?: string[];
  existingFiles?: Record<string, string>;
  locale?: string;
}
```

**Response:**
```typescript
{
  ok: boolean;
  plan?: CodeGenerationPlan;
  rawJson?: string;
  error?: string;
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3030/api/agent/generate-code \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project",
    "userId": "user-123",
    "userInput": "عايز أعمل authentication",
    "task": { ... },
    "architectPlan": { ... },
    "fileTree": ["src/lib/firebase.ts"],
    "locale": "ar"
  }'
```

---

## 🧪 Testing

**Test Script**: [test-phase96-3-code-generator.js](test-phase96-3-code-generator.js)

**Run Test:**
```bash
node test-phase96-3-code-generator.js
```

**Test Flow:**
1. ✅ Generate ArchitectPlan (Phase 96.1)
2. ✅ Decompose into tasks (Phase 96.2)
3. ✅ Pick HIGH priority task
4. ✅ Generate code (Phase 96.3)
5. ✅ Validate actions and diffs
6. ✅ Check code quality

**Expected Output:**
```
============================================================
STEP 1: Generating ArchitectPlan (Architect Agent)
============================================================
✅ ArchitectPlan generated!
   • Modules: 3
   • APIs: 5

============================================================
STEP 2: Decomposing into Tasks (Task Decomposer)
============================================================
✅ TaskDecompositionPlan generated!
   • Total Tasks: 18

============================================================
STEP 3: Selecting Task to Implement
============================================================
Selected Task:
   • ID: auth_signup_api
   • Title: Implement signup API endpoint
   • Type: BACKEND
   • Priority: HIGH

============================================================
STEP 4: Generating Code (Code Generator Agent)
============================================================
This may take 10-30 seconds...
✅ CodeGenerationPlan generated!
   • Summary: Created signup API endpoint
   • Actions: 1
   • Diffs: 1

============================================================
STEP 5: Analyzing Generated Code
============================================================
Actions:
   1. WRITE_FILE
      Path: src/app/api/auth/signup/route.ts

File Diffs:
   1. CREATE - src/app/api/auth/signup/route.ts
      Language: typescript
      Lines: 45

============================================================
STEP 6: Sample Generated Code
============================================================
File: src/app/api/auth/signup/route.ts
Operation: CREATE
Language: typescript

First 30 lines:
  1 | import { NextRequest, NextResponse } from 'next/server';
  2 | import { auth } from '@/lib/firebase';
  3 | import { createUserWithEmailAndPassword } from 'firebase/auth';
  4 |
  5 | export async function POST(req: NextRequest) {
  ... (showing first 30 lines)

============================================================
STEP 7: Validation Checks
============================================================
✅ Number of actions matches diffs
✅ All diffs have valid paths
✅ All CREATE/UPDATE diffs have content
✅ Generated code has reasonable length (45 lines total)
✅ Generated code uses TypeScript
✅ No placeholder code (// TODO, etc.)

============================================================
FINAL RESULT
============================================================
🎉 All tests PASSED!
✅ Phase 96.3 (Code Generator Agent) is working correctly!

Generated 1 actions with 45 lines of code for task: Implement signup API endpoint
```

---

## 🎓 Key Design Decisions

### 1. **Dual Output (Actions + Diffs)**
- **Actions**: Executable by Phase 95.3 (runActionPlan)
- **Diffs**: Previewable in IDE before execution
- Both kept in sync automatically

### 2. **Context-Aware Generation**
- Injects relevant APIs from ArchitectPlan
- Injects relevant data models
- Shows existing file tree
- Can read existing files for UPDATE operations

### 3. **Production-Ready Code**
- No placeholders (// TODO, etc.)
- Complete error handling
- TypeScript with proper types
- Follows Next.js 14+ conventions

### 4. **Smart Filtering**
- Only shows relevant files from tree (saves tokens)
- Truncates long file contents (2000 chars)
- Infers language from file extension

### 5. **Memory Integration**
- Uses Phase 94 memory system
- Respects all project constraints
- Consistent with other agents

---

## 🔗 Integration Points

```
User Request (NL)
      ↓
┌─────────────────┐
│ Architect Agent │ ← Phase 96.1
└─────────────────┘
      ↓
  ArchitectPlan
      ↓
┌─────────────────┐
│Task Decomposer  │ ← Phase 96.2
└─────────────────┘
      ↓
TaskDecompositionPlan
      ↓
┌─────────────────┐
│ Code Generator  │ ← Phase 96.3 ✅ YOU ARE HERE
└─────────────────┘
      ↓
CodeGenerationPlan
(actions + diffs)
      ↓
  ┌──────────┐
  │   IDE    │ ← Show diffs for approval
  │ Preview  │
  └──────────┘
      ↓
  User Approves?
      ↓ YES
┌─────────────────┐
│ Action Runner   │ ← Phase 95.3
└─────────────────┘
      ↓
  Real Changes
```

---

## 📊 Statistics

| Component | Files | Lines of Code | Status |
|-----------|-------|---------------|--------|
| **Code Generator Agent** | 1 | 550+ | ✅ 100% |
| **API Route** | 1 | 100 | ✅ 100% |
| **Test Script** | 1 | 300 | ✅ 100% |
| **Documentation** | 2 | - | ✅ Complete |
| **Total** | **5** | **~950** | **✅ Complete** |

---

## 🚀 Complete Phase 96 Summary

All three specialized agents are now complete:

| Phase | Agent | Status | Purpose |
|-------|-------|--------|---------|
| **96.1** | Architect | ✅ 100% | Designs system architecture |
| **96.2** | Task Decomposer | ✅ 100% | Breaks arch into tasks |
| **96.3** | Code Generator | ✅ 100% | Generates production code |

**Total Implementation**:
- **3 Agents**: 1,470+ lines
- **3 API Routes**: ~250 lines
- **3 Test Scripts**: ~750 lines
- **6 Documentation Files**
- **Grand Total**: ~2,470 lines of production code

---

## 🎯 Use Cases

### 1. **AI-Powered Development**
```typescript
// Full pipeline: Request → Architecture → Tasks → Code
const { plan: arch } = await runArchitectAgent({...});
const { plan: tasks } = await runTaskDecomposerAgent({...});

for (const task of tasks.allTasks) {
  const { plan: code } = await runCodeGeneratorAgent({ task, architectPlan: arch });

  // Show in IDE
  await showDiffPreview(code.diffs);

  // User approves
  if (await userApproves()) {
    await runActionPlan({ steps: code.actions });
  }
}
```

### 2. **IDE Integration**
```typescript
// VSCode extension calls code generator
const task = getCurrentTask();
const { plan } = await fetch('/api/agent/generate-code', {
  method: 'POST',
  body: JSON.stringify({ task, architectPlan, fileTree })
});

// Show diff in editor
plan.diffs.forEach(diff => {
  vscode.window.showDiff(diff.oldContent, diff.newContent, diff.path);
});
```

### 3. **Batch Implementation**
```typescript
// Implement all HIGH priority tasks
const highPriorityTasks = taskPlan.allTasks.filter(t => t.priority === 'HIGH');

for (const task of highPriorityTasks) {
  const { plan } = await runCodeGeneratorAgent({ task, architectPlan });
  await runActionPlan({ steps: plan.actions });
  console.log(`✅ Implemented: ${task.title}`);
}
```

### 4. **Code Review Before Execution**
```typescript
const { plan } = await runCodeGeneratorAgent({...});

// Save for manual review
fs.writeFileSync('review.json', JSON.stringify(plan.diffs, null, 2));

// Human reviews, then approves
if (manualReviewPassed) {
  await runActionPlan({ steps: plan.actions });
}
```

---

## 🔗 Related Documentation

- **Phase 96.1**: [PHASE_96_1_ARCHITECT_COMPLETE.md](PHASE_96_1_ARCHITECT_COMPLETE.md)
- **Phase 96.2**: [PHASE_96_2_TASK_DECOMPOSER_COMPLETE.md](PHASE_96_2_TASK_DECOMPOSER_COMPLETE.md)
- **Phase 95**: [PHASE_95_ACTION_SYSTEM_COMPLETE.md](PHASE_95_ACTION_SYSTEM_COMPLETE.md)
- **Phase 94**: [PHASE_94_2_AGENT_DRIVEN_MEMORY_COMPLETE.md](PHASE_94_2_AGENT_DRIVEN_MEMORY_COMPLETE.md)

---

**Phase 96.3 Status: ✅ FULLY COMPLETE**

The Code Generator Agent is now operational and ready to generate production-ready TypeScript code. It seamlessly integrates with:
- ✅ Phase 96.1 (Architect Agent)
- ✅ Phase 96.2 (Task Decomposer Agent)
- ✅ Phase 95 (Action System)
- ✅ Phase 94 (Memory System)

**The complete Phase 96 (Multi-Agent System) is now 100% implemented!**
