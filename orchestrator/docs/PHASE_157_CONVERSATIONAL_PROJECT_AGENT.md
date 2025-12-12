# Phase 157 – Conversational Project Agent (Project Chat)

## 1. الهدف

تحويل F0 لبيئة "تحاور مع مشروعك":

- تتكلم مع المشروع (ملفات، Issues، Tests، Plans).
- تطلب Features / Fixes باللغة الطبيعية.
- الـ Agent:
  - يفهم الطلب.
  - يخلق/يحدّث TaskPlan (Phase 155).
  - يحترم Safety & Guardrails (Phase 156).
  - يربط الكلام بالـ planId و progress.

## 2. المكونات الرئيسية

1. **Conversation Data Model**
   - Threads per project
   - Turns (user / agent / system)
   - ربط مع planId (لو فيه Autonomy run)

2. **ConversationAgent**
   - AgentRole = `conversation`
   - يستقبل:
     - CHAT_MESSAGE
     - SYSTEM_MESSAGE
   - يقرر:
     - Reply فقط (Q&A / شرح / تحليل).
     - أو Trigger: TASK_PROPOSAL → PlannerAgent.

3. **Chat API**
   - `/api/agents/chat`
   - يأخذ:
     - projectId
     - message
   - يرجّع:
     - messages (thread)
     - آخر رد من agent
     - optional planId

4. **UI – ProjectChatPanel**
   - Chat UI في صفحة المشروع:
     - bubbles (user / agent)
     - رأبط مع AgentPlanPanel (لو فيه planId)
     - زر "Open Plan" يفتح Agent Plan Panel.

5. **Integration مع 155 + 156**
   - ConversationAgent يستخدم:
     - Project Index / Issues / Tests / Plans
   - Safety كالسابق:
     - أي Actions تنفيذية تمر عبر SafeAgentBus.

## 3. Sub-Phases

| Sub-Phase | Description | Status | File |
|-----------|-------------|--------|------|
| 157.0 | Architecture & Doc | ✅ | This file |
| 157.1 | Conversation Data Model + Firestore | ✅ | `orchestrator/core/conversation/` |
| 157.2 | ConversationAgent (core logic) | ✅ | `orchestrator/agents/conversationAgent.ts` |
| 157.3 | Chat API Endpoint | ✅ | `src/app/api/agents/chat/route.ts` |
| 157.4 | ProjectChatPanel (Web IDE) | ✅ | `src/components/agents/ProjectChatPanel.tsx` |
| 157.5 | Integration with Multi-Agent Plans + Safety | ✅ | `src/lib/agents/orchestratorBus.ts` |

## 4. Typical Flows

### 4.1 Q&A فقط

```
User: "إيه أكتر ملفات فيها مشاكل حالياً؟"

ConversationAgent:
- يقرأ Project Issues + CodeHealth.
- يجاوب من غير ما يخلق Plan.
```

### 4.2 Autonomy طلب من الشات

```
User: "Fix login bug and add tests"

ConversationAgent:
- يبني PlannerInput
- يرسل TASK_PROPOSAL → PlannerAgent
- يربط conversationId + planId
- يبعث رسالة للمستخدم:
  - "تمام، بدأت خطة لإصلاح login + إضافة tests. Plan ID: ..."
```

### 4.3 Multi-turn with context

```
User: "Show me the login component"
Agent: [shows file content]

User: "Now fix the validation bug"
Agent: [creates plan with context from previous turn]
```

## 5. Data Model

### ConversationThread
```typescript
interface ConversationThread {
  id: string;
  projectId: string;
  title?: string;
  createdBy: string;
  createdAt: string;
  lastMessageAt: string;
  activePlanId?: string;
  metadata?: Record<string, unknown>;
}
```

### ConversationTurn
```typescript
interface ConversationTurn {
  id: string;
  threadId: string;
  projectId: string;
  authorRole: 'user' | 'assistant' | 'system';
  authorId?: string;
  content: string;
  createdAt: string;
  planId?: string;
  metadata?: Record<string, unknown>;
}
```

## 6. Message Kinds (AgentBus)

New message kinds for Phase 157:

- `CHAT_MESSAGE` - User sends a message
- `CHAT_RESPONSE` - Agent responds to user

## 7. Definition of Done

Phase 157 مكتملة لما:

1. ProjectChatPanel موجودة في Web IDE.
2. المستخدم يقدر:
   - يسأل عن المشروع.
   - يطلب تعديلات / Features.
3. السيستم:
   - أحيانًا يجاوب فقط.
   - وأحيانًا يخلق Plans جديدة.
4. كل Plan يكون مربوط بـ chat thread.
5. كل Actions التنفيذية تلتزم Phase 156 Safety.

## 8. Files to Create

| File | Purpose |
|------|---------|
| `orchestrator/core/conversation/types.ts` | Conversation types |
| `orchestrator/core/conversation/conversationStore.ts` | In-memory + Firestore store |
| `orchestrator/agents/conversationAgent.ts` | Agent logic |
| `src/app/api/agents/chat/route.ts` | Chat API |
| `src/components/agents/ProjectChatPanel.tsx` | Chat UI |

---

## 9. Implementation Status - ✅ PHASE 157 COMPLETE

### All Sub-Phases Completed:

| Component | File | Description |
|-----------|------|-------------|
| Types | `orchestrator/core/conversation/types.ts` | ConversationThread, ConversationTurn, ConversationStore |
| Store | `orchestrator/core/conversation/conversationStore.ts` | InMemoryConversationStore with global singleton |
| Agent | `orchestrator/agents/conversationAgent.ts` | Intent detection, Q&A vs Plan trigger logic |
| API | `src/app/api/agents/chat/route.ts` | POST/GET for chat messages |
| UI | `src/components/agents/ProjectChatPanel.tsx` | Chat bubbles, quick actions, plan badges |
| Bus Integration | `src/lib/agents/orchestratorBus.ts` | ConversationAgent wired into SafeAgentBus |
| Types Update | `orchestrator/core/multiAgent/types.ts` | CHAT_MESSAGE, CHAT_RESPONSE kinds |

### Key Features Implemented:

1. **Intent Detection**
   - Question patterns (what, how, why, ?, etc.)
   - Command patterns (fix, add, create, implement, etc.)
   - Arabic language support (بتلج, ضيف, عدل, etc.)

2. **Q&A Flow**
   - Simple responses for questions
   - Help, status, and general queries
   - Placeholder for LLM integration

3. **Plan Triggering**
   - Commands automatically trigger TASK_PROPOSAL
   - planId linked to conversation turn
   - UI shows "Plan" badge for plan-related messages

4. **Chat UI**
   - Message bubbles with user/assistant avatars
   - Intent badges (question/command/feedback)
   - Quick action buttons (Help, Status, Add Feature, Fix Bug)
   - Real-time updates with optimistic UI

5. **Integration with Phase 155/156**
   - ConversationAgent uses SafeAgentBus
   - Plans go through PlannerAgent
   - All actions respect Safety & Guardrails

### Usage Example:

```tsx
import { ProjectChatPanel } from '@/components/agents/ProjectChatPanel';

<ProjectChatPanel
  projectId="proj_123"
  userId="user_456"
  userMode="pro"
  onPlanTriggered={(planId) => {
    console.log('Plan created:', planId);
  }}
/>
```
