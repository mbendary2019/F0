# Phase 64: Auto-Execution & Intent-Based Actions - Complete ✅

## Overview
تم تنفيذ نظام تنفيذ تلقائي كامل مع intent واضح و next_actions قابلة للتنفيذ الفوري.

## ✅ التحسينات الجديدة

### 1. Intent-Based Decision Making
**File**: [src/lib/agents/index.ts](src/lib/agents/index.ts)

الوكيل الآن يرجع intent واضح مع كل استجابة:

```typescript
type AgentPlan = {
  lang: 'ar' | 'en';
  ready: boolean;
  intent: 'clarify' | 'plan' | 'execute';  // ← جديد!
  clarity_score: number;
  missing?: string[];
  next_actions?: NextAction[];  // ← جديد!
  phases?: { ... }[];
};
```

**Intent Types:**
- `clarify`: طلب غامض، يحتاج توضيح
- `plan`: واضح لكن ليس عاجل
- `execute`: جاهز للتنفيذ الفوري!

### 2. Next Actions Array
كل استجابة تحتوي على خطوات تنفيذية:

```json
{
  "next_actions": [
    {
      "type": "preflight",
      "why": "تأكد من المفاتيح والخدمات"
    },
    {
      "type": "execute_task",
      "phase": 1,
      "taskTitle": "تهيئة Firebase",
      "why": "البداية الأساسية"
    }
  ]
}
```

**Action Types:**
- `preflight`: فحص الجاهزية
- `execute_task`: تنفيذ مهمة محددة
- `wait_for_info`: انتظار معلومات إضافية

### 3. Enhanced API Response
**File**: [src/app/api/chat/route.ts](src/app/api/chat/route.ts)

```typescript
return NextResponse.json({
  message: {
    text: reply.visible,
    id: crypto.randomUUID(),
    role: 'assistant',
    createdAt: Date.now()
  },
  meta: {
    intent: reply.intent,           // ← جديد!
    ready: reply.ready,
    clarity: reply.clarity_score,
    missing: reply.missing || [],
    next_actions: reply.next_actions || []  // ← جديد!
  },
  plan: responsePlan
});
```

### 4. Unified Runner API
**File**: [src/app/api/runner/route.ts](src/app/api/runner/route.ts)

نقطة نهاية واحدة لكل عمليات التنفيذ:

```typescript
POST /api/runner
{
  "projectId": "test-project",
  "action": "preflight" | "execute-first" | "execute-task",
  "taskId": "..." // optional for execute-task
}
```

### 5. Runner Functions
**File**: [src/lib/agents/runner.ts](src/lib/agents/runner.ts)

#### runPreflight(projectId)
- يفحص API keys (OPENAI_API_KEY)
- يفحص Firebase connection
- يسجل النتيجة في activity log
- يرجع رسالة مفيدة للمستخدم

```typescript
{
  ready: true | false,
  issues: ["Missing OPENAI_API_KEY", ...],
  message: "🚫 واقف بسبب:\n• Missing OPENAI_API_KEY\n\nحل المشاكل دي وجرب تاني"
}
```

#### startRun(projectId)
- يبحث عن أول phase مفتوحة
- يختار أول task في هذه المرحلة
- يعيّن assignee (GPT/Claude/Gemini) بناءً على tags
- يبدأ التنفيذ فوراً
- يحدّث status: open → running → done

```typescript
{
  started: true,
  taskId: "task-uuid",
  error?: "..."
}
```

#### runSingleTask(projectId, taskId)
- ينفذ مهمة محددة
- يعيّن assignee إذا لم يكن محدداً
- يستخدم retry logic مع exponential backoff

### 6. Auto-Execution في useChatAgent
**File**: [src/features/chat/useChatAgent.ts](src/features/chat/useChatAgent.ts)

```typescript
const AUTO_THRESHOLD = 0.8;

// بعد استقبال الرد من API...

// 1) كتابة الخطة في Firestore
if (meta?.ready && plan?.phases?.length) {
  await upsertPhasesAndTasks(...);
}

// 2) تنفيذ تلقائي إذا:
//    - intent="execute" OR
//    - (ready && clarity >= 0.8)
if (meta?.intent === 'execute' || (meta?.ready && (meta?.clarity ?? 0) >= AUTO_THRESHOLD)) {
  // Preflight check
  const preflightRes = await fetch('/api/runner', {
    method: 'POST',
    body: JSON.stringify({ projectId, action: 'preflight' }),
  });

  // إذا نجح الـ preflight، ابدأ التنفيذ
  if (preflightData.ready) {
    await fetch('/api/runner', {
      method: 'POST',
      body: JSON.stringify({ projectId, action: 'execute-first' }),
    });
  }
}
```

### 7. Manual Control Buttons
**File**: [src/features/chat/ChatPanel.tsx](src/features/chat/ChatPanel.tsx)

زرّان للتحكم اليدوي:

```typescript
<button onClick={handlePreflight}>
  ⚙️ Preflight
</button>

<button onClick={handleExecuteFirst}>
  ▶️ ابدأ التنفيذ
</button>
```

**متى تظهر:**
- عندما `ready=true` AND `clarity < 0.8` AND `intent != "execute"`
- تحت زر "توليد الخطة"
- في قسم "التحكم اليدوي"

## 🎯 سيناريوهات الاستخدام

### السيناريو 1: محادثة عادية
```
المستخدم: مرحبا
الوكيل: {
  "intent": "clarify",
  "ready": false,
  "clarity_score": 0.1,
  "next_actions": [
    { "type": "wait_for_info", "why": "ماذا تريد أن تبني؟" }
  ]
}
```
**النتيجة**: لا يظهر أي زر، رد طبيعي فقط

### السيناريو 2: طلب واضح متوسط
```
المستخدم: أريد تطبيق Next.js
الوكيل: {
  "intent": "plan",
  "ready": true,
  "clarity_score": 0.6,
  "next_actions": [
    { "type": "preflight", "why": "تأكد من الجاهزية" }
  ],
  "phases": [...]
}
```
**النتيجة**:
- يكتب الخطة في Firestore
- يظهر زر "✨ توليد الخطة والمهام (60%)"
- يظهر زرّا "⚙️ Preflight" و "▶️ ابدأ التنفيذ"

### السيناريو 3: طلب واضح جداً
```
المستخدم: تطبيق Next.js 14 + TypeScript + Firebase
الوكيل: {
  "intent": "execute",
  "ready": true,
  "clarity_score": 0.9,
  "next_actions": [
    { "type": "preflight", "why": "تأكد من المفاتيح" },
    { "type": "execute_task", "phase": 1, "taskTitle": "تهيئة Next.js" }
  ],
  "phases": [...]
}
```
**النتيجة**:
- يكتب الخطة في Firestore تلقائياً
- يشغّل preflight تلقائياً
- يبدأ تنفيذ أول مهمة تلقائياً!
- المهام تظهر في الـ TasksPanel مع status: running

### السيناريو 4: أمر تنفيذ صريح
```
المستخدم: نفّذ
الوكيل: {
  "intent": "execute",
  "ready": true,
  "clarity_score": 0.5,  // حتى لو منخفض!
  "phases": [...]
}
```
**النتيجة**: تنفيذ فوري رغم clarity منخفض

## 🔧 توزيع المهام بين AI Providers

### كيف يعمل التوزيع:

1. **Agent يضيف tags للمهام:**
```json
{
  "tasks": [
    {
      "title": "تهيئة Firebase",
      "tags": ["firebase", "setup"]
    },
    {
      "title": "بناء API",
      "tags": ["typescript", "api", "nextjs"]
    },
    {
      "title": "تحسين الكود",
      "tags": ["refactor", "cleanup"]
    }
  ]
}
```

2. **startRun يطابق Tags مع Capabilities:**
```typescript
// من capabilities.json
{
  "routing": [
    { "tags": ["firebase","setup"], "provider": "gpt" },
    { "tags": ["typescript","api"], "provider": "gpt" },
    { "tags": ["refactor","cleanup"], "provider": "claude" }
  ]
}
```

3. **تعيين تلقائي:**
```typescript
const assignee = routeTask(task);
// task.tags = ["firebase","setup"] → assignee = "gpt"
// task.tags = ["refactor"] → assignee = "claude"
```

4. **التحديث في Firestore:**
```typescript
await updateDoc(taskRef, {
  assignee: "gpt",
  tool: "simulate",  // TODO: cursor/vscode/xcode
  status: "running"
});
```

## 📊 تدفق التنفيذ الكامل

```
1. المستخدم: "بناء تطبيق Next.js + Firebase"
   ↓
2. askAgent يحلل → intent:"execute", clarity:0.85
   ↓
3. API يرجع meta + plan
   ↓
4. useChatAgent يكتب phases/tasks في Firestore
   ↓
5. useChatAgent يشغّل preflight
   ↓
6. Preflight يفحص:
   - ✅ OPENAI_API_KEY موجود
   - ✅ Firebase متصل
   - ✅ جاهز للتنفيذ
   ↓
7. useChatAgent يشغّل execute-first
   ↓
8. startRun:
   - يجد أول phase: "Phase 1 — الإعداد"
   - يجد أول task: "تهيئة Next.js"
   - يعيّن assignee: "gpt" (بناءً على tags)
   - يحدّث status: "running"
   ↓
9. executeTask:
   - ينفذ المهمة (حالياً simulation)
   - يحاول 3 مرات مع backoff
   - يحدّث status: "done"
   ↓
10. TasksPanel يعرض:
    ✅ تهيئة Next.js (Done)
    🔵 GPT | Simulate
```

## 🚀 الميزات الجديدة

### ✅ تنفيذ تلقائي ذكي
- لا تنفيذ للمحادثات العادية
- تنفيذ تلقائي عند clarity >= 80%
- تنفيذ فوري عند قول "نفّذ"

### ✅ Preflight Checks
- فحص API keys قبل التنفيذ
- رسائل خطأ واضحة ومفيدة
- اقتراحات للحل

### ✅ توزيع ذكي للمهام
- GPT للـ TypeScript و Next.js و APIs
- Claude للـ refactoring و debugging
- Gemini للـ UI و translation

### ✅ Retry & Self-Healing
- 3 محاولات مع exponential backoff
- تحليل الخطأ واقتراح حل
- switch provider عند rate limiting

### ✅ واجهة محسّنة
- زر "توليد الخطة" مع نسبة clarity
- أزرار يدوية للـ preflight والتنفيذ
- حالة التنفيذ في الوقت الفعلي

## 📁 الملفات المعدّلة/الجديدة

### Core Logic
- ✅ [src/lib/agents/index.ts](src/lib/agents/index.ts) - Added intent + next_actions
- ✅ [src/lib/agents/runner.ts](src/lib/agents/runner.ts) - Added runPreflight, startRun, runSingleTask

### API Routes
- ✅ [src/app/api/chat/route.ts](src/app/api/chat/route.ts) - Enhanced metadata response
- ✅ [src/app/api/runner/route.ts](src/app/api/runner/route.ts) - **NEW** Unified runner endpoint

### Client
- ✅ [src/features/chat/useChatAgent.ts](src/features/chat/useChatAgent.ts) - Auto-execution logic
- ✅ [src/features/chat/ChatPanel.tsx](src/features/chat/ChatPanel.tsx) - Manual control buttons

## 🧪 الاختبار

### Test 1: Casual Chat (No Execution)
```bash
curl -X POST http://localhost:3030/api/chat \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","text":"مرحبا"}'
```
Expected: `intent:"clarify"`, no plan, no auto-execution

### Test 2: Medium Clarity (Manual Buttons)
```bash
curl -X POST http://localhost:3030/api/chat \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","text":"أريد تطبيق Next.js"}'
```
Expected: `intent:"plan"`, `clarity:0.6`, shows buttons

### Test 3: High Clarity (Auto-Execute)
```bash
curl -X POST http://localhost:3030/api/chat \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","text":"تطبيق Next.js 14 + TypeScript + Firebase"}'
```
Expected: `intent:"execute"`, `clarity:0.9`, auto-runs preflight + execute-first

### Test 4: Preflight Check
```bash
curl -X POST http://localhost:3030/api/runner \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","action":"preflight"}'
```
Expected:
```json
{
  "ready": true,
  "issues": []
}
```

### Test 5: Execute First Task
```bash
curl -X POST http://localhost:3030/api/runner \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","action":"execute-first"}'
```
Expected:
```json
{
  "started": true,
  "taskId": "task-uuid"
}
```

## 🎨 UI Examples

### Generate Plan Button
```
┌─────────────────────────────────────┐
│  ✨ توليد الخطة والمهام (65%)      │
└─────────────────────────────────────┘

معلومات مطلوبة:
• ما هي قاعدة البيانات المفضلة؟
• هل تحتاج مصادقة؟
```

### Manual Controls
```
التحكم اليدوي:
┌───────────────┬───────────────────┐
│ ⚙️ Preflight │ ▶️ ابدأ التنفيذ │
└───────────────┴───────────────────┘

✅ All checks passed!
```

### Running Status
```
Agent Chat

┌─────────────────────────────────────┐
│ 🔵 Running: تهيئة Firebase          │
│ Assignee: GPT | Tool: Simulate      │
│ Retries: 0/3                        │
└─────────────────────────────────────┘
```

## 🔮 الخطوات التالية (Phase 65)

### 1. Real Provider Integration
- استبدال `simulateTaskExecution()` بـ calls حقيقية
- OpenAI API calls للـ GPT tasks
- Anthropic API calls للـ Claude tasks
- Google AI API calls للـ Gemini tasks

### 2. Tool Bridges
- **Cursor Integration**: استخدام Cursor API للتعديل المباشر
- **VSCode Extension**: بناء extension للتحكم من VS Code
- **Xcode Bridge**: integration مع Xcode للـ iOS tasks

### 3. Live Status Updates
- Real-time task status في TasksPanel
- Progress bars لكل مهمة
- Logs stream مباشر

### 4. Advanced Self-Healing
- API key rotation تلقائي
- Provider fallback ذكي
- Context preservation عند الـ retry

## ✨ الملخص

Phase 64 الآن جاهز بالكامل مع:
- ✅ Intent-based decision making
- ✅ Next actions array
- ✅ Auto-execution (clarity >= 80%)
- ✅ Preflight checks
- ✅ Smart task routing (GPT/Claude/Gemini)
- ✅ Manual control buttons
- ✅ Retry logic with self-healing
- ✅ Enhanced UI with status feedback

**الوكيل الآن يحاول فعلاً - وليس فقط يتكلم!**

---

**التاريخ**: 2025-11-13
**الحالة**: مكتمل ✅
**المرحلة**: Phase 64 - Auto-Execution & Intent-Based Actions
