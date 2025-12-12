# Phase 162 – Media Conversation Layer
## (تحدث مع الصور، PDF، الصوت)

## 1. الهدف

بناء طبقة حوار تسمح للمستخدم أن:

- يتحدث مع:
  - صورة مرفوعة (wireframe, UI screenshot, diagram…)
  - PDF (specs, BRD, proposal…)
  - صوت (تسجيل اجتماع، ملاحظات عميل…)
- مع سياق حيّ:
  - "في صفحة 3 في الـ PDF… وضحلي الجزء ده"
  - "السكرين دي محتاجة spacing أحسن، اقترح تحسينات"
  - "في التسجيل ده، إيه أهم الـ action items؟"

Phase 162 تبني فوق:

- Phase 157 (Project Chat)
- Phase 158–159 (Attachments + Viewer)
- Phase 160 (MediaAgent)
- Phase 161 (AudioAgent)

---

## 2. المكونات الأساسية

1. **Media-Focused Conversations**
   - Thread/Mode خاص لكل Attachment أو مجموعة Attachments.
   - كل رسالة في الشات لها:
     - `focusAttachmentId?: string`
     - `focusSpan?: { page?: number; region?: string }` (للـ PDF/Images لاحقاً).

2. **Media Conversation Message Types**
   - رسائل جديدة للـ Agents:
     - `MEDIA_CHAT_MESSAGE`
     - `MEDIA_CHAT_RESPONSE`
   - نفس ConversationAgent، لكن:
     - يمرّر attachmentId للـ MediaAgent/AudioAgent.
     - يدمج transcript/analysis السابقة في الـ context.

3. **UI Mode**
   - من داخل AttachmentViewer:
     - زر: "Open Media Chat"
   - يفتح panel شات جانبي:
     - يظهر الـ Attachment على اليمين
     - والـ chat على الشمال (أو العكس).

---

## 3. Data Model Extensions

### 3.1 ConversationTurn

إضافة حقول خاصة بالميديا:

```ts
export interface ConversationTurn {
  id: string;
  threadId: string;
  projectId: string;
  authorRole: 'user' | 'assistant' | 'system';
  authorId?: string;
  content: string;
  createdAt: string;
  planId?: string;

  attachments?: string[];          // موجودة من Phase 158
  focusAttachmentId?: string;      // NEW: ميديا مركز عليها الحوار
  focusPage?: number;              // PDFs
  focusRegionHint?: string;        // "header", "login-form", "chart-1"...
}
```

### 3.2 Thread Metadata

```ts
export interface ConversationThread {
  id: string;
  projectId: string;
  title?: string;
  createdBy: string;
  createdAt: string;
  lastMessageAt: string;
  activePlanId?: string;

  mediaMode?: boolean;             // NEW
  defaultAttachmentId?: string;    // NEW
}
```

---

## 4. Agent Flows

### 4.1 Media Chat مع صورة

المستخدم:
1. يفتح صورة في AttachmentViewer
2. يضغط: "Open Media Chat"

النظام:
1. ينشئ thread جديد:
   - `mediaMode = true`
   - `defaultAttachmentId = {imageAttachmentId}`
2. ProjectChatPanel (media mode) يرسل كل رسالة مع:
   - `focusAttachmentId = defaultAttachmentId`

ConversationAgent:
1. لما يستقبل CHAT_MESSAGE مع focusAttachmentId:
   - يبني prompt للـ MediaAgent:
     - attachment + history + user question
   - يرسل task للـ MediaAgent (mode = 'ui' أو 'general')

MediaAgent:
1. يستخدم التحليل/الملخص الموجود سابقًا (من Phase 160) أو يعيد التحليل.
2. يرجّع:
   - جواب نصي
   - SuggestedTasks (لو مناسب)

ConversationAgent:
1. يسجل turn جديد (assistant)
2. يرجّعه للـ UI.

### 4.2 Media Chat مع PDF

نفس الفكرة لكن:
- `focusPage` ممكن يتعبّى (لو المستقبل يدعم page selection).
- MediaAgent يأخذ:
  - attachmentId
  - page hints
  - question

### 4.3 Media Chat مع Audio

AudioAgent يكون هو الـ backend:
- يقرأ transcript (Phase 161)
- يجاوب على أسئلة مثل:
  - "إيه أهم النقاط اللي اتقالت في الدقيقة الأولى؟"
  - "طلعلي action items من الاجتماع ده."

---

## 5. Integration Points

### AttachmentViewer
- زر "Media Chat" لكل Attachment.
- يفتح ProjectChatPanel في وضع:
  - `mediaOnly` + `focusAttachment`.

### ProjectChatPanel
- لو `mediaMode = true`:
  - يعرض اسم/نوع الملف أعلى الـ chat.
  - يبعت `focusAttachmentId` في كل رسالة.

### ConversationAgent
- لو `focusAttachmentId` موجود:
  - يحوّل الرسالة لـ MediaAgent/AudioAgent أولاً.
  - بعد كده يبني الرد ويبعته للمستخدم.

---

## 6. Sub-Phases

| Sub-Phase | Description | Status |
|-----------|-------------|--------|
| 162.0 | Architecture Draft | ✅ |
| 162.1 | Data Model Extensions (focusAttachmentId, mediaMode) | ✅ |
| 162.2 | Media Chat Mode in ProjectChatPanel + AttachmentViewer | ✅ |
| 162.3 | ConversationAgent + MediaAgent/AudioAgent integration | ✅ |
| 162.4 | UX Polishing (labels, icons, breadcrumbs) | ✅ |

---

## 7. Implementation Complete

### Files Created/Modified:

| File | Description |
|------|-------------|
| `orchestrator/docs/PHASE_162_MEDIA_CONVERSATION_LAYER.md` | Architecture documentation |
| `orchestrator/core/conversation/types.ts` | Added focusAttachmentId, focusPage, mediaMode fields |
| `src/components/attachments/AttachmentViewer.tsx` | Added "Chat about this" button |
| `src/components/agents/ProjectChatPanel.tsx` | Added mediaMode support |
| `orchestrator/agents/conversationAgent.ts` | Integrated media agent forwarding |

---

## 8. Definition of Done

Phase 162 تعتبر مكتملة لما:

1. المستخدم يقدر يفتح "Media Chat" من AttachmentViewer.
2. كل رسالة في هذا الشات مربوطة بـ attachment معيّن.
3. MediaAgent/AudioAgent ترد بجواب منطقي مبني على ملف:
   - صورة / PDF / صوت.
4. الشات يحسّسك فعليًا إنك "بتتكلم مع الملف" مش بس مع المشروع عمومًا.

---

*Phase 162: Media Conversation Layer*
