# Phase 64 - Plan Execution Without Duplication ✅

## Overview

Implemented complete plan execution system with deterministic IDs to prevent duplication.

---

## 🎯 Features Implemented

### 1. Language Detection from Pathname ✅

**File:** [src/features/chat/useChatAgent.ts](src/features/chat/useChatAgent.ts)

```typescript
import { usePathname } from 'next/navigation';

export function useChatAgent(projectId: string) {
  const pathname = usePathname();
  const locale = pathname?.startsWith('/en') ? 'en' : 'ar';

  // locale is sent with every message
  const body = { projectId, text, locale };
}
```

**Benefits:**
- ✅ Extracts language from URL (`/ar/studio` → `ar`, `/en/studio` → `en`)
- ✅ More reliable than params
- ✅ Works across all route structures

---

### 2. Plan Execution Function (onRunPlan) ✅

**File:** [functions/src/agents/runPlan.ts](functions/src/agents/runPlan.ts)

**Key Features:**
- ✅ **Deterministic IDs** using SHA1 hash of titles
- ✅ **Idempotent execution** with `{ merge: true }`
- ✅ **No duplication** - same plan = same IDs = update instead of create
- ✅ **Bilingual support** - Arabic and English responses
- ✅ **Activity logging** - tracks execution history
- ✅ **Metadata tracking** - stores plan version and execution time

**ID Generation Logic:**
```typescript
const mkId = (str: string): string => {
  return crypto.createHash('sha1').update(str).digest('hex').slice(0, 24);
};

// Phase ID example: "phase-a3f8b9c1e2d4f5g6h7i8"
const phaseId = `phase-${mkId(ph.title)}`;

// Task ID example: "task-x1y2z3a4b5c6d7e8f9g0"
const taskId = `task-${mkId(phaseId + ':' + tk.title)}`;
```

**Why This Works:**
1. Same title → Same hash → Same ID
2. `setDoc({merge: true})` updates existing doc instead of creating new
3. Re-running same plan = safe upsert operation

**Example Response:**
```json
{
  "ok": true,
  "message": "✅ تم التنفيذ بنجاح: 7 مراحل و 42 مهام",
  "stats": {
    "phases": 7,
    "tasks": 42
  }
}
```

---

### 3. RunPlanButton Component ✅

**File:** [src/components/RunPlanButton.tsx](src/components/RunPlanButton.tsx)

**Usage Example:**
```tsx
import RunPlanButton from '@/components/RunPlanButton';

<RunPlanButton
  projectId="my-project-123"
  plan={planFromAgent}
  onSuccess={() => console.log('Plan executed!')}
/>
```

**Features:**
- ✅ Bilingual UI (Arabic/English based on URL)
- ✅ Loading states
- ✅ Error handling
- ✅ Success callbacks
- ✅ Beautiful gradient design

---

### 4. Development Auth Helper ✅

**File:** [src/lib/firebaseAuthDev.ts](src/lib/firebaseAuthDev.ts)

**Purpose:** Auto sign-in anonymously in development to prevent AUTH_USER_MISSING errors.

**Features:**
- ✅ Auto-connects to Auth emulator
- ✅ Signs in anonymously if no user
- ✅ Only runs in development/localhost
- ✅ Initializes on page load

**Integration:** Import in root layout or anywhere auth is needed:
```typescript
import '@/lib/firebaseAuthDev'; // Side-effect import
```

---

## 📊 How Execution Works

### Step-by-Step Flow:

1. **User Creates Plan**
   - User chats with agent: "عايز تطبيق محادثة"
   - Agent generates plan with 7 phases
   - Plan stored in chat messages

2. **User Clicks "نفّذ الخطة" Button**
   - `RunPlanButton` calls `onRunPlan` function
   - Passes: `projectId`, `plan`, `locale`

3. **Function Processes Plan**
   - Generates deterministic IDs for each phase/task
   - Creates/updates documents in Firestore:
     - `projects/{id}/phases/{phaseId}`
     - `projects/{id}/tasks/{taskId}`
   - Logs activity
   - Updates project metadata

4. **Result**
   - Phases and tasks now exist in Firestore
   - Ready for execution by task runner
   - No duplicates even if button clicked multiple times

---

## 🔒 Preventing Duplication

### The Problem:
If user clicks "نفّذ الخطة" multiple times, we don't want 10 copies of the same phases.

### The Solution:

**1. Deterministic IDs:**
```typescript
"Setup Firebase Authentication"
  → SHA1 hash
  → "a3f8b9c1e2d4f5g6h7i8"
  → phaseId: "phase-a3f8b9c1e2d4f5g6h7i8"
```

Same title always produces same ID.

**2. Merge Strategy:**
```typescript
batch.set(phaseRef, data, { merge: true });
```

If document exists, update it. If not, create it.

**3. Result:**
- First click: Creates phases/tasks
- Second click: Updates same phases/tasks
- Third click: Updates again (no new docs)

---

## 🧪 Testing

### Test Plan Execution:

**1. Prepare Test Plan:**
```typescript
const testPlan = {
  phases: [
    {
      title: "مرحلة اختبار 1",
      tasks: [
        { title: "مهمة 1", desc: "وصف المهمة", tags: ["test"] },
        { title: "مهمة 2", desc: "وصف المهمة", tags: ["test"] }
      ]
    }
  ]
};
```

**2. Execute via Button:**
```tsx
<RunPlanButton projectId="test-123" plan={testPlan} />
```

**3. Verify in Firestore:**
```bash
# Check phases collection
firebase firestore:get projects/test-123/phases --emulator

# Check tasks collection
firebase firestore:get projects/test-123/tasks --emulator
```

**4. Test Idempotency:**
- Click button 3 times
- Check Firestore: Should have SAME number of docs
- Verify `updatedAt` timestamp changes but no duplicates

---

## 📁 Firestore Structure

After execution, your project will have:

```
projects/
  {projectId}/
    meta: {
      planExecuted: true,
      planVersion: 1,
      lastExecutedAt: Timestamp
    }
    phases/
      phase-{hash}/
        title: "Phase Title"
        locale: "ar"
        status: "pending"
        order: 0
        createdAt: Timestamp
        updatedAt: Timestamp
    tasks/
      task-{hash}/
        phaseId: "phase-{hash}"
        title: "Task Title"
        desc: "Task description"
        tags: ["firebase", "setup"]
        status: "todo"
        locale: "ar"
        createdAt: Timestamp
        updatedAt: Timestamp
    activity/
      {autoId}/
        type: "system"
        action: "run_plan"
        title: "تم تنفيذ الخطة: 7 مراحل، 42 مهام"
        user: "user-uid-or-anonymous"
        createdAt: Timestamp
```

---

## 🎨 UI Integration Examples

### Example 1: Studio Page with Plan

```tsx
'use client';
import { useState } from 'react';
import { useChatAgent } from '@/features/chat/useChatAgent';
import RunPlanButton from '@/components/RunPlanButton';

export default function StudioPage({ projectId }) {
  const { send, loading } = useChatAgent(projectId);
  const [plan, setPlan] = useState(null);

  const handlePlanReceived = (agentReply) => {
    if (agentReply.plan && agentReply.ready) {
      setPlan(agentReply.plan);
    }
  };

  return (
    <div>
      {/* Chat UI */}
      <ChatBox onMessage={handlePlanReceived} />

      {/* Show Run Plan button when plan is ready */}
      {plan && (
        <RunPlanButton
          projectId={projectId}
          plan={plan}
          onSuccess={() => alert('تم التنفيذ!')}
        />
      )}
    </div>
  );
}
```

### Example 2: Prevent Regeneration

```tsx
// Check if plan already executed before generating new one
const checkPlanExists = async (projectId: string): Promise<boolean> => {
  const projectRef = doc(db, `projects/${projectId}`);
  const projectSnap = await getDoc(projectRef);
  return projectSnap.data()?.meta?.planExecuted === true;
};

// In chat handler:
const handleUserMessage = async (text: string) => {
  // If user asks for new plan, check if one exists
  if (text.includes('خطة') || text.includes('plan')) {
    const exists = await checkPlanExists(projectId);
    if (exists) {
      return "لديك خطة موجودة بالفعل. هل تريد إنشاء خطة جديدة؟";
    }
  }

  // Continue with normal flow
  const reply = await send(text);
};
```

---

## 🔧 Exported Functions

**functions/src/index.ts:**
```typescript
// Preflight checks
export { onPreflightCheck } from './agents/preflight';

// Run plan without duplication
export { onRunPlan } from './agents/runPlan';
```

Both functions are now available as Cloud Functions:
- `http://localhost:5001/{projectId}/us-central1/onPreflightCheck`
- `http://localhost:5001/{projectId}/us-central1/onRunPlan`

---

## ✅ Checklist

- [x] Language detection from pathname
- [x] Created `onRunPlan` Cloud Function
- [x] Implemented deterministic ID generation
- [x] Exported function in index.ts
- [x] Created `RunPlanButton` component
- [x] Bilingual support (Arabic/English)
- [x] Error handling and loading states
- [x] Activity logging
- [x] Metadata tracking
- [x] Created development auth helper
- [x] Rebuilt functions
- [x] Documentation complete

---

## 🚀 Next Steps

1. **Integrate RunPlanButton** in studio page
2. **Test full workflow:**
   - User creates plan via chat
   - User clicks "نفّذ الخطة"
   - Verify phases/tasks in Firestore
   - Test idempotency (click multiple times)
3. **Implement task execution** (Phase 65)
   - Read tasks from Firestore
   - Execute using runner.ts
   - Update task status
   - Track progress

---

## 📚 Related Files

- [functions/src/agents/runPlan.ts](functions/src/agents/runPlan.ts) - Plan execution function
- [functions/src/index.ts](functions/src/index.ts) - Function exports
- [src/components/RunPlanButton.tsx](src/components/RunPlanButton.tsx) - UI button
- [src/features/chat/useChatAgent.ts](src/features/chat/useChatAgent.ts) - Chat hook with locale
- [src/lib/firebaseAuthDev.ts](src/lib/firebaseAuthDev.ts) - Dev auth helper
- [src/lib/agents/index.ts](src/lib/agents/index.ts) - Agent with lang support

---

**Status:** ✅ Complete - Ready for integration and testing

**Date:** 2025-11-14
