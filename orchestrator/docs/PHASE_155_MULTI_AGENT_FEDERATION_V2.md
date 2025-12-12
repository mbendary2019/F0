# Phase 155 – Multi-Agent Federation (v2)

## 1. الهدف من v2

- تحويل الـ Orchestrator من "Agent واحد قوي" إلى "فريق Agents متعاونين".
- جعل:
  - **Planner** يفهم الهدف ويقسّمه لمهام (TaskGraph).
  - **Workers** متخصصين (Code, Test, Shell, Browser, Media…) ينفّذوا.
  - **Reviewer** يراجع ويقرّر: Merge / Retry / Rollback.
- كل ده يعمل على:
  - Web IDE
  - Desktop IDE
- مع ربط كامل بـ:
  - Project Index
  - Quality / Tests
  - Git Layer
  - ACE / Auto-Fix
  - (مستقبلاً) Media + Memory Engine.

---

## 2. أدوار الـ Agents الرسمية

### 2.1 Core Agents (اللي موجودين/مخططين الآن)

1. **PlannerAgent**
   - يحوّل user goal → TaskGraph.
   - يحدد أي Agent ينفّذ إيه.
   - يتعامل مع الأولويات والـ parallelism.

2. **CodeAgent (Implementation Agent)**
   - يكتب/يعدّل الكود.
   - يقدر يستدعي ACE / Auto-Fix Engine عند الحاجة.

3. **TestAgent**
   - يخلق/يعدّل Unit + Integration tests.
   - يشغّل Test Runner عبر ShellAgent.
   - يقرأ نتائج Test Lab / Coverage Engine.

4. **ShellAgent**
   - يشغّل أوامر آمنة (npm test, lint, build, …).
   - يطبق سياسات Security (Phase 146 + 156).

5. **BrowserAgent**
   - يجري Browser Checks (E2E smoke flows / UI checks).
   - يربط مع Browser-Aware Actions (Phase 139).

6. **GitAgent**
   - يطبّق Auto Git Layer (commit / branch / rollback).
   - يربط الـ Plan بالـ branches / PRs.

7. **ReviewAgent**
   - يراجع نتائج الـ Agents.
   - يقرر: Approve / Request Changes / Retry Task / Escalate.

---

### 2.2 Future Agents (Hooks جاهزة من دلوقتي)

8. **MediaAgent**
   - يحلل Images / PDFs / Docs.
   - يطلع Requirements + Components + Pages.

9. **AudioAgent**
   - يحلل Voice → Requirements / Features.

10. **MemoryAgent**
    - يقرأ ويكتب في Memory Graph (Phase 166+).
    - يحتفظ بحالة سناريوهات طويلة.

11. **ConversationAgent (Project Chat)**
    - واجهة الحوار الذكي مع المشروع.
    - يشغل Planner + باقي Agents من خلال الكلام.

---

## 3. Message Model (Unified Multi-Agent Bus)

هيكون فيه Bus واحد موحّد لرسائل الـ Agents.

### 3.1 TypeScript Types (Core)

```ts
export type AgentRole =
  | 'planner'
  | 'code'
  | 'test'
  | 'shell'
  | 'browser'
  | 'git'
  | 'review'
  | 'media'
  | 'audio'
  | 'memory'
  | 'conversation';

export type AgentMessageKind =
  | 'TASK_PROPOSAL'
  | 'TASK_ASSIGNMENT'
  | 'TASK_RESULT'
  | 'TASK_ERROR'
  | 'INFO_REQUEST'
  | 'INFO_RESPONSE'
  | 'PLAN_UPDATE'
  | 'REVIEW_DECISION';

export interface AgentContextHandle {
  projectId: string;
  workspaceId?: string;
  userId?: string;
  conversationId?: string;
  planId?: string;
  taskId?: string;
}

export interface SafetyEnvelope {
  level: 'low' | 'medium' | 'high';
  requiresApproval?: boolean;
  riskTags?: string[];
  guardrailPolicyId?: string; // Phase 156
}

export interface AgentMessage<TPayload = unknown> {
  id: string;
  timestamp: string;
  from: AgentRole;
  to: AgentRole | 'broadcast';
  kind: AgentMessageKind;
  context: AgentContextHandle;
  safety: SafetyEnvelope;
  payload: TPayload;
  meta?: Record<string, unknown>;
}
```

### 3.2 Message Bus Interface

```ts
export interface AgentBus {
  publish<TPayload = unknown>(message: AgentMessage<TPayload>): Promise<void>;
  subscribe(
    role: AgentRole,
    handler: (message: AgentMessage) => Promise<void>
  ): void;
}
```

التنفيذ ممكن يكون:
- In-memory (للـ Desktop / dev).
- فوق Firestore / Redis / PubSub (للـ SaaS لاحقاً).

---

## 4. Task Graph Model

Planner بيحوّل الهدف → TaskGraph:

```ts
export type TaskStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export interface AgentTask<TInput = unknown, TOutput = unknown> {
  id: string;
  planId: string;
  label: string;          // e.g. "Add login route + tests"
  owner: AgentRole;
  status: TaskStatus;
  dependsOn: string[];    // taskIds
  input: TInput;          // agent-specific
  output?: TOutput;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface TaskPlan {
  id: string;
  goal: string;
  createdBy: 'user' | 'agent';
  createdAt: string;
  tasks: AgentTask[];
  metadata?: Record<string, unknown>;
}
```

- Planner يبني TaskPlan.
- يبعته على الـ Bus كـ PLAN_UPDATE.
- Agents يسمعوا tasks اللي تخصّهم ويشتغلوا عليها.

---

## 5. Storage & Context (Context Engine v0.5)

قبل Phase 166–180 (Neural Memory)، نحتاج نسخة خفيفة من الـ Context Engine.

### 5.1 Context Store

- **plans collection** (Firestore أو local JSON):
  - TaskPlan + history.
- **messages collection** (اختياري):
  - AgentMessage history per conversation/plan.

### 5.2 Project Bridges

APIs موحّدة للـ Agents:

- **Index API**
  - searchFiles(query)
  - getFile(path)
  - findComponents(...)
- **Quality API**
  - getCurrentHealth()
  - getIssuesForFile(path)
- **Tests API**
  - getSuites()
  - getCoverageSummary()
- **Git API**
  - getCurrentBranch()
  - getDirtyFiles()

### 5.3 Conversation Bridge

conversationId يربط بين:
- user chat
- current plan
- memory snapshot (لاحقاً مع Memory Graph).

---

## 6. Safety + Guardrails Integration (Phase 156 Hook)

كل رسالة تمر عبر طبقة Safety:

```ts
export interface SafetyChecker {
  evaluate(
    message: AgentMessage
  ): Promise<{
    allowed: boolean;
    requiresUserConfirm?: boolean;
    reason?: string;
  }>;
}
```

- رسائل shell / browser / git:
  - دائماً `safety.level = 'high'`.
  - ممكن تحتاج user confirmation من UI.
- في v2 نحط الـ Hook، التنفيذ الكامل (policies, UI prompts) في Phase 156.

---

## 7. Typical Flows

### 7.1 Simple Fix Flow (Goal صغير)

1. **ConversationAgent → Planner:**
   - goal: "Fix login bug + add test".

2. **Planner:**
   - يبني plan مثلاً:
     - T1 (code): Fix bug في auth/login.ts
     - T2 (test): Add unit test
     - T3 (shell): Run tests via ShellAgent
     - T4 (review): Review results

3. **CodeAgent** ينفّذ T1 → TASK_RESULT.

4. **TestAgent** ينفّذ T2 + T3 (يستدعي ShellAgent).

5. **ReviewAgent** يستقبل T4 → يقرّر:
   - OK → Plan ناجح.
   - Request Changes → يخلق Tasks إضافية أو يطلب تعديل.

### 7.2 Project Feature Flow (Goal كبير)

- Planner يبني 6–10 Tasks.
- بعض الـ tasks parallel (UI + API + tests).
- بعض الـ tasks dependent (deploy بعد passing tests + code review).
- GitAgent يدخل في البداية والنهاية:
  - create branch → commit(s) → optional PR.

---

## 8. Integration Points مع F0 الحالي

### 8.1 Orchestrator Manifest

- Phase 138/140 شغّالة بالفعل.
- نضيف section جديد:
  - `agents`
  - routes للـ multi-agent federation.

### 8.2 Desktop & Web IDE

Panel جديد:
- **Agent Plan**
  - يعرض TaskGraph (List/Timeline).
- **Agent Messages**
  - Logs مبسّطة لقرارات الـ Agents.

### 8.3 ACE / Auto-Fix

CodeAgent يقدر يطلب:
- ACE Fix task.
- أو Auto-Fix Engine (v1) داخلياً.

### 8.4 Quality Gate

ReviewAgent يستخدم:
- Quality Watchdog
- Quality Profiles

قبل ما يعلّم الـ Plan كـ "ناجح" أو يسمح بـ Git commit/merge.

---

## 9. تفكيك Phase 155 إلى Sub-Phases

- **155.0** – Architecture Draft (هذا الملف + الـ types). ✅
- **155.1** – Core Types + AgentBus (in-memory). ✅
- **155.2** – PlannerAgent (v2) – plan builder. ✅
- **155.3** – ReviewAgent (v2) – decision logic.
- **155.4** – TaskPlan Store + basic UI hooks.
- **155.5** – Wiring existing agents (Code/Test/Shell/Browser/Git).
- **155.6** – Safety hooks (تكامل مبدأي مع Phase 156).
- **155.7** – End-to-End scenario: "Build feature + tests + commit".

---

## 10. Implementation Files

### Core Types
- `/orchestrator/core/multiAgent/types.ts`

### Message Bus
- `/orchestrator/core/multiAgent/agentBus.ts`

### Plan Store
- `/orchestrator/core/multiAgent/planStore.ts`

### Agents
- `/orchestrator/agents/plannerAgent.ts`

### Demo Script
- `/orchestrator/dev-multiAgentDemo.ts`

---

## Status

- **Phase 155.0**: ✅ DONE (Architecture Draft)
- **Phase 155.1**: ✅ DONE (Core Types + AgentBus)
- **Phase 155.2**: ✅ DONE (PlannerAgent skeleton)
- **Phase 155.3-155.7**: 🔄 In Progress
