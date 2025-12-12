# ✅ Phase 87.1: Code Agent Skeleton - COMPLETE

**التاريخ**: 2025-11-27
**الحالة**: ✅ **مكتمل**

---

## 🎯 الهدف

إنشاء **Code Agent Skeleton** - نسخة تجريبية من وكيل الكود اللي هيولد كود فعلي لاحقًا بناءً على المهام.

**دلوقتي**: بيولد كود placeholder مع رسائل في الشات
**لاحقًا**: هيتربط بـ LLM حقيقي لتوليد كود فعلي

---

## ✅ اللي اتعمل

### 1️⃣ Types للـ Code Agent

**الملف الجديد**: [src/types/codeAgent.ts](src/types/codeAgent.ts)

```typescript
export interface CodeAgentFileContext {
  path: string;
  content: string;
  languageId?: string; // "typescript", "javascript", "json"
  isTestFile?: boolean;
}

export interface CodeAgentTaskRequest {
  projectId: string;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  stack: {
    frontend: string; // "Next.js 14 + TypeScript"
    backend: string;  // "Firebase Functions v2"
    db: string;       // "Firestore"
  };
  files: CodeAgentFileContext[];
  mode: 'implement_task';
}

export type CodePatchAction = 'create' | 'modify' | 'delete';

export interface CodeAgentPatch {
  path: string;
  action: CodePatchAction;
  content?: string;
}

export interface CodeAgentResponse {
  summary: string;
  patches: CodeAgentPatch[];
  notes?: string;
}
```

---

### 2️⃣ API جديد: /api/f0/code-agent

**الملف الجديد**: [src/app/api/f0/code-agent/route.ts](src/app/api/f0/code-agent/route.ts)

**Endpoint**: `POST /api/f0/code-agent`

**Request Body**:
```json
{
  "projectId": "QNnGNj3QRLlaVwg9y8Lz",
  "taskId": "task-123"
}
```

**Response**:
```json
{
  "ok": true,
  "projectId": "QNnGNj3QRLlaVwg9y8Lz",
  "taskId": "task-123",
  "codeSummary": "تم إنشاء كود مبدئي لمهمة: ...",
  "patchesCount": 1
}
```

**اللي بيحصل جوه الـ API**:

1. **مصادقة المستخدم** عبر Firebase ID token
2. **التحقق من ملكية المشروع**
3. **علّم المهمة كـ `in_progress`**
4. **إرسال رسالة نظام للشات**: "🚀 Code Agent بدأ ينفّذ المهمة"
5. **بناء طلب للـ Code Agent** (dummy request payload)
6. **توليد كود placeholder**:
   ```typescript
   // TODO: Implement task: ${task.title}
   // Description: ${task.description}

   export function task_name() {
     console.log('Implementing: ${task.title}');
     throw new Error('Not implemented yet');
   }
   ```
7. **إرسال رسالة للشات** مع الكود المُولّد
8. **علّم المهمة كـ `completed`**
9. **علّم الـ `queued_action` كـ `completed`** (لو موجود)

---

### 3️⃣ تحديث الزر في Continue Page

**الملف**: [src/app/[locale]/f0/projects/[id]/continue/page.tsx](src/app/[locale]/f0/projects/[id]/continue/page.tsx)

**Handler مُحدّث** (الأسطر 126-165):
```typescript
// Phase 87.1: Ask Code Agent to implement this task
const handleRunTaskWithAgent = async (task: F0Task) => {
  setRunError(null);
  setRunningTaskId(task.id);

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();

    const res = await fetch('/api/f0/code-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        taskId: task.id,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Failed to run code agent');
    }

    console.log('[Code Agent] Task execution started:', data);
    // Firestore listeners will update the UI automatically
  } catch (error) {
    console.error('[Code Agent] Error running task:', error);
    setRunError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    setRunningTaskId(null);
  }
};
```

**UI Button** (الأسطر 414-455):
```tsx
{/* Phase 87.1: Code Agent Button */}
<div className="mt-3 pt-3 border-t border-[#2c1466]">
  <button
    onClick={(e) => {
      e.stopPropagation();
      handleRunTaskWithAgent(activeTask);
    }}
    disabled={runningTaskId === activeTask.id}
    className={/* purple gradient */}
  >
    {runningTaskId === activeTask.id ? (
      <>
        {locale === 'ar'
          ? '⏳ جاري تنفيذ المهمة بواسطة Code Agent...'
          : '⏳ Running task with Code Agent...'}
      </>
    ) : (
      <>
        🤖 Ask Agent to implement this task
      </>
    )}
  </button>

  {runError && (
    <div className="mt-2 text-red-400 bg-red-500/10">
      {locale === 'ar' ? 'خطأ:' : 'Error:'} {runError}
    </div>
  )}

  <div className="mt-2 text-gray-500 text-center">
    {locale === 'ar'
      ? '(Code Agent Skeleton - سيتم إنشاء كود تجريبي)'
      : '(Code Agent Skeleton - will generate placeholder code)'}
  </div>
</div>
```

---

## 🔄 سير العمل (User Flow)

### لما المستخدم يضغط الزر:

1. **الزر يتحول لـ loading state**: "⏳ جاري تنفيذ المهمة بواسطة Code Agent..."
2. **API call يتنفذ**: `POST /api/f0/code-agent`
3. **Firestore updates تحصل**:
   - `tasks/{taskId}.status` → `in_progress`
   - رسالة نظام في `messages`: "🚀 Code Agent بدأ ينفّذ المهمة"
4. **Code Agent يولد placeholder code**
5. **رسالة assistant في الشات** مع الكود:
   ```
   🤖 **Code Agent**

   **ملخص:**
   تم إنشاء كود مبدئي لمهمة: ...

   **الكود المُولّد:**
   ```typescript
   // TODO: Implement task: ...
   export function task_name() {
     console.log('Implementing: ...');
     throw new Error('Not implemented yet');
   }
   ```

   _هذا رد تجريبي (Skeleton). لاحقًا سيتم استبداله برد فعلي من الـ LLM._
   ```
6. **Firestore updates تحصل مرة تانية**:
   - `tasks/{taskId}.status` → `completed`
   - `queued_actions/{actionId}.status` → `completed`
7. **UI تتحدث تلقائيًا** (real-time listeners):
   - Task card تتحول لأخضر ("مكتمل")
   - Progress bar يزيد
   - Chat panel يعرض الرسائل الجديدة

---

## 📁 الملفات المُنشأة/المُعدلة

### ملفات جديدة:
1. ✅ [src/types/codeAgent.ts](src/types/codeAgent.ts) - TypeScript types
2. ✅ [src/app/api/f0/code-agent/route.ts](src/app/api/f0/code-agent/route.ts) - API endpoint

### ملفات مُعدلة:
1. ✅ [src/app/[locale]/f0/projects/[id]/continue/page.tsx](src/app/[locale]/f0/projects/[id]/continue/page.tsx)
   - Updated handler to call `/api/f0/code-agent` instead of `/api/f0/run-next-task`
   - Updated button text

---

## 🎨 مثال على الكود المُولّد

لو المهمة هي: **"Implement user authentication"**

**الكود اللي هيظهر في الشات**:
```typescript
// TODO: Implement task: Implement user authentication
// Description: Add login/signup functionality using Firebase Auth

export function implement_user_authentication() {
  console.log('Implementing: Implement user authentication');

  // Implementation will be generated by Code Agent
  throw new Error('Not implemented yet');
}

// Example usage:
// implement_user_authentication();
```

**المسار المقترح**: `src/tasks/implement_user_authentication.ts`

---

## 🔐 الأمان

**Authentication**:
- ✅ يتطلب Firebase ID token
- ✅ يتحقق من ملكية المشروع
- ✅ في emulator mode: يتخطى فحص الملكية (dev-user bypass)

**Authorization**:
- ✅ يرفض 401 للمستخدمين الغير مصادقين
- ✅ يرفض 403 للمستخدمين الغير مخولين (في production)
- ✅ يرفض 404 للمشروع/المهمة المفقودة

---

## 🚀 الخطوة التالية: ربط LLM حقيقي

### دلوقتي:
```typescript
const fakeCode = `// TODO: Implement task: ${task.title}
export function ${taskName}() {
  throw new Error('Not implemented yet');
}`;
```

### لاحقًا (Phase 87.2):
```typescript
// Import LLM client
import { askAgent } from '@/lib/agent/askAgent';

// Call LLM to generate real code
const response = await askAgent({
  mode: 'CODE_GENERATION',
  projectId,
  taskTitle: task.title,
  taskDescription: task.description,
  stack: {
    frontend: 'Next.js 14 + TypeScript',
    backend: 'Firebase Functions v2',
    db: 'Firestore',
  },
  files: projectFiles, // TODO: Get real project files
});

const codeResponse: CodeAgentResponse = {
  summary: response.summary,
  patches: response.patches,
  notes: response.notes,
};
```

**اللي محتاجينه**:
1. ✅ Types جاهزة (`CodeAgentTaskRequest`, `CodeAgentResponse`)
2. ⏳ ربط مع LLM (askAgent function)
3. ⏳ جلب الملفات الحقيقية للمشروع
4. ⏳ تطبيق الـ patches على VFS أو GitHub

---

## 🧪 الاختبار

### Manual Testing:

1. **افتح Continue workspace**:
   ```
   http://localhost:3030/ar/f0/projects/YOUR_PROJECT_ID/continue
   ```

2. **اضغط على مهمة** → Task Details panel يظهر

3. **اضغط "Ask Agent to implement this task"**:
   - ✅ الزر يتحول لـ loading
   - ✅ Console يطبع: `[Code Agent] Task execution started`

4. **شوف الشات**:
   - ✅ رسالة نظام: "🚀 Code Agent بدأ ينفّذ المهمة"
   - ✅ رسالة assistant مع الكود المُولّد

5. **شوف Task List**:
   - ✅ المهمة تتحول لـ "مكتمل" (أخضر)
   - ✅ Progress bar يزيد

6. **شوف Firestore Console**:
   - ✅ `tasks/{taskId}.status` = `'completed'`
   - ✅ `messages` فيها رسالتين جداد

---

## 📊 مقارنة: Before vs After

### Before (Phase 104.4):
- Endpoint: `/api/f0/run-next-task`
- السلوك: setTimeout لمدة 2 ثانية → mark as completed
- الناتج: لا شيء (بس تغيير status)

### After (Phase 87.1):
- Endpoint: `/api/f0/code-agent`
- السلوك: توليد كود placeholder فورًا
- الناتج: رسالتين في الشات + كود TypeScript

---

## 🎉 الحالة: مكتمل

**Phase 87.1** دلوقتي شغالة كاملة:
- ✅ Types للـ Code Agent جاهزة
- ✅ API endpoint شغال
- ✅ UI button مربوط صح
- ✅ Real-time updates شغالة
- ✅ رسائل الشات بتظهر
- ✅ الكود المُولّد بيظهر في الشات

**الـ Pipeline كامل**:
```
فكرة → Agent Plan + JSON → Phases + Tasks → "Ask Agent" → Code Agent → كود يظهر في الشات ✅
```

**الخطوة التالية**: Phase 87.2 - ربط LLM حقيقي بدل placeholder code

---

## 📝 مرجع سريع

### Test URL:
```
http://localhost:3030/ar/f0/projects/YOUR_PROJECT_ID/continue
```

### Console Logs اللي هتشوفها:
```
[Code Agent] Auth check passed: { uid: 'dev-user', projectId: '...', isEmulatorMode: true }
[Code Agent] Task marked as in_progress: Implement user authentication
[Code Agent] Request payload: { projectId, taskId, taskTitle, ... }
[Code Agent] Generated code sent to chat
[Code Agent] Task marked as completed
[Code Agent] Queued action marked as completed
```

### Firestore Collections المُستخدمة:
- `projects/{projectId}/tasks/{taskId}` - Task status updates
- `projects/{projectId}/messages` - Chat messages
- `projects/{projectId}/queued_actions` - Queue tracking

---

**تاريخ الإكمال**: 2025-11-27
**المرحلة**: 87.1 - Code Agent Skeleton
**الحالة**: ✅ مكتمل
**الخطوة التالية**: 87.2 - ربط LLM حقيقي

