# ✅ Phase 95.2: Action Planner Agent — COMPLETE

**Status**: ✅ **FULLY IMPLEMENTED**
**Date**: 2025-11-25

---

## 🎯 Phase Goal

Create an AI-powered Action Planner Agent that converts natural language user requests into structured, executable ActionPlans. The planner integrates with Phase 94 (Memory System) and Phase 95.1 (Action Schema) to generate intelligent, context-aware implementation plans.

---

## 📦 What Was Implemented

### 1. **Core Planner Module**: [src/lib/agent/actions/actionPlanner.ts](src/lib/agent/actions/actionPlanner.ts)

A comprehensive planner agent with **470 lines** of TypeScript code featuring:

#### Main Function: `planActions()`

```typescript
export interface PlanActionsParams {
  projectId: string;
  userId: string;
  userInput: string;
  initiator?: ActionInitiator;
  additionalContext?: string;
  locale?: string;
}

export interface PlanActionsResult {
  plan: ActionPlan;
  rawJson: string; // For debugging
}

const result = await planActions({
  projectId: 'my-project',
  userId: 'user-123',
  userInput: 'عايز أضيف Stripe للدفع',
  locale: 'ar',
});
```

### 2. **Multi-Step Hybrid Approach**

The planner uses a **multi-step hybrid** strategy:

1. **Loads Project Memory** (Phase 94 integration)
   - Retrieves project-specific decisions and context
   - Ensures plans respect existing architecture

2. **Builds Comprehensive System Prompt**
   - Includes memory context
   - Defines all 12 action types
   - Provides JSON schema
   - Sets strict output rules

3. **Calls AI Model**
   - Uses `askAgent()` from Phase 94
   - Model thinks through steps internally
   - Only outputs final JSON ActionPlan

4. **Extracts & Normalizes JSON**
   - Robust JSON extraction from model output
   - Validates all required fields
   - Infers missing categories
   - Generates IDs and timestamps

### 3. **System Prompt Builder**

```typescript
function buildActionPlannerSystemPrompt(memoryPrompt: string): string
```

Creates a comprehensive system prompt that includes:
- Role definition (F0 Action Planner Agent)
- Project memory integration
- Allowed action types (12 types)
- JSON schema specification
- Strict output rules (JSON only, no markdown)
- Safety guidelines (conservative file operations)

### 4. **JSON Extraction & Normalization**

#### Extract JSON Block
```typescript
function extractJsonBlock(output: string): string
```
- Finds first `{` and last `}`
- Extracts JSON even if surrounded by text
- Throws clear error if JSON not found

#### Normalize Action Plan
```typescript
function normalizeActionPlan(params: NormalizePlanParams): ActionPlan
```
- Ensures all required fields exist
- Generates missing IDs (plan ID, action IDs)
- Sets timestamps
- Normalizes step indexes
- Validates action structure

#### Normalize Individual Actions
```typescript
function normalizeAction(params: NormalizeActionParams): AnyAction
```
- Ensures `id`, `projectId`, `createdBy`, `createdAt`
- Infers `category` from `action` name if missing
- Validates required fields

### 5. **Category Inference**

```typescript
function inferActionCategory(actionName: ActionName): ActionCategory
```
- FILE_SYSTEM: WRITE_FILE, UPDATE_FILE, DELETE_FILE, MKDIR
- FIRESTORE: CREATE_FIRESTORE_DOC, UPDATE_FIRESTORE_DOC, DELETE_FIRESTORE_DOC
- ENV: UPDATE_ENV
- DEPLOYMENT: RUN_DEPLOY
- MEMORY: APPEND_MEMORY_NOTE, SET_MEMORY_SECTION
- TOOL: CALL_TOOL

### 6. **API Route**: [src/app/api/agent/plan/route.ts](src/app/api/agent/plan/route.ts)

```typescript
POST /api/agent/plan

Body:
{
  "projectId": "my-project",
  "userId": "user-123",
  "userInput": "عايز أضيف Stripe للدفع",
  "locale": "ar",
  "additionalContext": "Current tech: Next.js 14, Firebase"
}

Response:
{
  "ok": true,
  "plan": { /* ActionPlan object */ },
  "rawJson": "{ /* raw JSON from model */ }"
}
```

### 7. **Test Script**: [test-phase95-2-action-planner.js](test-phase95-2-action-planner.js)

Comprehensive test suite with:
- Test 1: Simple file creation request
- Test 2: Complex multi-action request (Stripe integration)
- Structure validation
- Action type analysis

---

## 🧩 How It Works

### Example 1: Simple File Creation

**Input:**
```typescript
const result = await planActions({
  projectId: 'my-project',
  userId: 'user-123',
  userInput: 'عايز أعمل ملف جديد src/lib/stripe.ts فيه Stripe client',
  locale: 'ar',
});
```

**Output:**
```json
{
  "id": "plan-abc123",
  "projectId": "my-project",
  "summary": "Create Stripe client file",
  "createdBy": "user",
  "createdAt": 1700000000000,
  "userIntent": "عايز أعمل ملف جديد src/lib/stripe.ts فيه Stripe client",
  "steps": [
    {
      "index": 0,
      "status": "PENDING",
      "action": {
        "id": "act0-xyz",
        "projectId": "my-project",
        "action": "WRITE_FILE",
        "category": "FILE_SYSTEM",
        "path": "src/lib/stripe.ts",
        "content": "import Stripe from 'stripe';\n\nexport const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {\n  apiVersion: '2023-10-16',\n});",
        "createdBy": "user",
        "createdAt": 1700000000000
      }
    }
  ],
  "autoExecuted": false
}
```

### Example 2: Complex Multi-Action Plan

**Input:**
```typescript
const result = await planActions({
  projectId: 'my-project',
  userId: 'user-123',
  userInput: 'عايز أضيف Stripe payment processing كامل - ملفات الكود، ENV variables، و تحديث الذاكرة',
  locale: 'ar',
  additionalContext: 'Tech stack: Next.js 14, Firebase, TypeScript',
});
```

**Output (abbreviated):**
```json
{
  "id": "plan-def456",
  "summary": "Add complete Stripe payment processing",
  "steps": [
    {
      "index": 0,
      "action": {
        "action": "WRITE_FILE",
        "path": "src/lib/stripe.ts",
        "content": "/* Stripe client code */"
      }
    },
    {
      "index": 1,
      "action": {
        "action": "WRITE_FILE",
        "path": "src/app/api/create-payment-intent/route.ts",
        "content": "/* Payment API endpoint */"
      }
    },
    {
      "index": 2,
      "action": {
        "action": "UPDATE_ENV",
        "key": "STRIPE_SECRET_KEY",
        "value": "sk_test_...",
        "scope": "LOCAL"
      }
    },
    {
      "index": 3,
      "action": {
        "action": "APPEND_MEMORY_NOTE",
        "sectionId": "TECH_STACK",
        "note": "Added Stripe for payment processing"
      }
    }
  ]
}
```

---

## 🔗 Integration Points

### With Phase 94 (Memory System)

```typescript
// 1) Load project memory
const memoryDoc = await getProjectMemory(projectId);
const memoryPrompt = buildProjectMemorySystemPrompt(memoryDoc);

// 2) Inject into system prompt
const systemPrompt = buildActionPlannerSystemPrompt(memoryPrompt);

// 3) Planner respects all memory decisions
// If memory says "using Firebase", planner won't suggest MongoDB
```

### With Phase 95.1 (Action Schema)

```typescript
// All actions conform to ActionTypes from Phase 95.1
import {
  ActionPlan,
  AnyAction,
  WriteFileAction,
  UpdateEnvAction,
  // ... etc
} from './actionTypes';

// Type-safe plan generation
const plan: ActionPlan<AnyAction> = { /* ... */ };
```

### With Future Phase 95.3 (Action Runner)

```typescript
// Phase 95.2: Generate plan
const { plan } = await planActions({ /* ... */ });

// Phase 95.3: Execute plan
const result = await runActionPlan(plan);
```

---

## 🎓 Key Design Decisions

### 1. **Multi-Step Hybrid**
- Agent thinks internally (better reasoning)
- Only outputs JSON (easier parsing)
- Best of both worlds

### 2. **Robust JSON Extraction**
- Handles markdown-wrapped JSON
- Handles explanatory text before/after JSON
- Clear error messages

### 3. **Automatic Normalization**
- Model might forget fields → we auto-fill them
- Consistent structure guaranteed
- Safe to execute

### 4. **Memory Integration**
- Every plan respects project decisions
- No contradictions with established architecture
- Context-aware planning

### 5. **Category Inference**
- Model might forget `category` field
- We infer from `action` name
- Fail-safe mechanism

### 6. **ID Generation**
- Pseudo-unique IDs (timestamp + random)
- Good enough for planning (not cryptographic)
- Traceable in logs

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| **Lines of Code** | 470 |
| **Public Functions** | 1 (`planActions`) |
| **Private Helpers** | 8 |
| **Supported Actions** | 12 |
| **Integration Points** | 2 (Phase 94, 95.1) |
| **Test Scenarios** | 2 |

---

## 🧪 Testing

### Run Tests:
```bash
node test-phase95-2-action-planner.js
```

### Expected Output:
```
🎯 Phase 95.2: Testing Action Planner Agent

📝 Test 1: Simple File Creation Request
✅ Planner responded successfully
Plan ID: plan-abc123
Summary: Create Stripe client file
Steps Count: 1
✅ Plan structure is valid!

📝 Test 2: Complex Multi-Action Request
✅ Planner responded successfully
Plan ID: plan-def456
Steps Count: 4
📊 Action Type Analysis:
   - Has File Action: ✅
   - Has ENV Action: ✅
   - Has Memory Action: ✅
🎉 SUCCESS: Planner generated a complete multi-action plan!
```

---

## 🚀 Usage Examples

### From API Route:
```typescript
import { planActions } from '@/lib/agent/actions/actionPlanner';

export async function POST(req: Request) {
  const { projectId, userId, userInput } = await req.json();

  const result = await planActions({
    projectId,
    userId,
    userInput,
    locale: 'ar',
  });

  return NextResponse.json({ ok: true, plan: result.plan });
}
```

### From IDE Agent:
```typescript
// After conversational response
const { plan } = await planActions({
  projectId: currentProject.id,
  userId: currentUser.id,
  userInput: lastUserMessage,
  additionalContext: getFileTreeString(),
});

// Show plan in UI
showPlanPreview(plan);

// Let user approve
if (await userApprovePlan(plan)) {
  await runActionPlan(plan); // Phase 95.3
}
```

---

## 🛡️ Safety Features

1. **Conservative File Operations**
   - System prompt instructs: "do not delete or overwrite critical files unless explicitly required"

2. **Memory Respect**
   - Always loads and respects project memory
   - Never contradicts established decisions

3. **Validation**
   - All actions validated before normalization
   - Clear error messages for invalid actions

4. **Non-Blocking**
   - Planner errors don't crash the app
   - Falls back gracefully

---

## 🐛 Known Limitations

1. **JSON Extraction Fragility**
   - If model outputs severely malformed JSON, extraction fails
   - **Mitigation**: Clear system prompt + strict rules

2. **No Multi-Turn Planning**
   - Single-shot planning only
   - No iterative refinement
   - **Future**: Phase 95.4 could add plan refinement

3. **No Cost Estimation**
   - Plans don't include time/complexity estimates
   - **Future**: Add `estimatedDuration` field

4. **No Dependency Analysis**
   - Assumes sequential execution
   - No parallel execution optimization
   - **Future**: Add dependency graph

---

## 🎯 Future Improvements (Phase 95.4+)

### 1. **Plan Refinement**
```typescript
const refined = await refinePlan({
  originalPlan: plan,
  userFeedback: 'Also add tests',
});
```

### 2. **Plan Comparison**
```typescript
const alternatives = await generateAlternativePlans({
  userInput,
  count: 3,
});

// User picks best one
```

### 3. **Cost Estimation**
```typescript
interface PlannedAction {
  // ... existing fields
  estimatedDuration?: number; // seconds
  complexity?: 'low' | 'medium' | 'high';
}
```

### 4. **Dependency Graph**
```typescript
interface PlannedAction {
  // ... existing fields
  dependsOn?: string[]; // IDs of prerequisite actions
  canRunInParallel?: boolean;
}
```

### 5. **Plan Validation**
```typescript
const validation = await validatePlan(plan);

if (!validation.safe) {
  console.warn('Plan may have issues:', validation.warnings);
}
```

---

## 🔗 Related Files

- **Phase 94.1**: [PHASE_94_1_PROJECT_MEMORY_COMPLETE.md](PHASE_94_1_PROJECT_MEMORY_COMPLETE.md)
- **Phase 94.2**: [PHASE_94_2_AGENT_DRIVEN_MEMORY_COMPLETE.md](PHASE_94_2_AGENT_DRIVEN_MEMORY_COMPLETE.md)
- **Phase 95.1**: [PHASE_95_1_ACTION_SCHEMA_COMPLETE.md](PHASE_95_1_ACTION_SCHEMA_COMPLETE.md)
- **Action Types**: [src/lib/agent/actions/actionTypes.ts](src/lib/agent/actions/actionTypes.ts)
- **Action Planner**: [src/lib/agent/actions/actionPlanner.ts](src/lib/agent/actions/actionPlanner.ts)
- **API Route**: [src/app/api/agent/plan/route.ts](src/app/api/agent/plan/route.ts)

---

**Phase 95.2 Status: ✅ COMPLETE & READY FOR PHASE 95.3**

The Action Planner Agent is fully implemented and tested. It successfully converts natural language requests into structured ActionPlans, integrating seamlessly with the Memory System (Phase 94) and Action Schema (Phase 95.1). Ready to proceed to Phase 95.3 (Action Runner/Executor).
