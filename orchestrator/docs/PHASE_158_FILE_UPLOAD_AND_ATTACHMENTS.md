# Phase 158 – File Upload + Attachments System

## 1. الهدف

توفير نظام موحّد لرفع الملفات وربطها بالمشروع + الشات + الـ Agents:

- رفع:
  - صور (PNG/JPEG/WebP)
  - PDF
  - Docs (DOCX, TXT)
  - Audio (m4a, mp3, wav)
- Attachments في:
  - Project Chat (Phase 157)
  - Tasks / Plans (Phase 155)
  - لاحقًا: MediaAgent (Phase 160) + AudioAgent (161)

## 2. النتيجة النهائية المتوقعة

بعد Phase 158:

- المستخدم يقدر:
  - يسحب ملف → يحطه في ProjectChatPanel
  - يشوفه كـ Attachment bubble
- السيستم:
  - يخزّن الملف في Storage (bucket)
  - يسجّل metadata في Firestore
  - يربط attachment بالـ:
    - projectId
    - conversationId / turnId (لو جاي من الشات)
    - planId (لو جاي من Autonomy / Plan)
- Media / Audio Agents في Phases 160–162 يقدروا يشتغلوا على نفس الـ attachments.

---

## 3. Data Model

### 3.1 Attachment Entity

Collection: `projectAttachments`

```ts
export type AttachmentKind =
  | 'image'
  | 'pdf'
  | 'document'
  | 'audio'
  | 'other';

export interface ProjectAttachment {
  id: string;
  projectId: string;
  storagePath: string;      // "projects/{projectId}/attachments/{id}"
  downloadUrl?: string;     // optional (signed or public)
  filename: string;
  mimeType: string;
  sizeBytes: number;

  kind: AttachmentKind;
  createdBy: string;
  createdAt: string;

  // optional links
  conversationId?: string;
  turnId?: string;
  planId?: string;

  // later use by Media/Audio Agent
  status?: 'raw' | 'processing' | 'ready' | 'error';
  metadata?: Record<string, unknown>;
}
```

### 3.2 ربطها بالشات (Phase 157)

في ConversationTurn نضيف:

```ts
attachments?: string[]; // array of attachment IDs
```

ده يسمح لـ ProjectChatPanel إنها:
- تعرض attachments تحت كل رسالة (صور/أيقونات)
- تبعت IDs بدل ما تبعت الملف نفسه.

## 4. Architecture Overview

### Upload API (Web)

Route: `POST /api/attachments/upload`

Inputs:
- projectId
- (optional) conversationId / turnId
- File (multipart/form-data)

Flow:
1. يتحقق من user auth + access للمشروع
2. يرفع الملف إلى Storage (bucket: `projects/{projectId}/attachments/{attachmentId}`)
3. يخلق Document في `projectAttachments`
4. يرجع: attachmentId + metadata

### Chat Integration (Phase 157)

ProjectChatPanel:
- يسمح بإضافة ملفات (drag & drop / attach button)
- يرفع الملفات أولاً → يحصل على IDs
- يرسل message → payload فيه `attachments: [ids...]`

ConversationAgent:
- يسجّل turn مع `attachments` array

UI:
- يظهر thumbnails / icons لكل attachment.

### Security Rules

Storage:
- `projects/{projectId}/attachments/**` → read/write فقط لأعضاء المشروع.

Firestore:
- `projectAttachments` → per-project access control.

### Future Consumption (Phase 160–162)

MediaAgent/AudioAgent تاخد:
- projectId + attachmentId

تقرأ:
- downloadUrl / storagePath
- metadata

تعمل:
- OCR / text extraction / embeddings / analysis.

## 5. Sub-Phases

| Sub-Phase | Description | Status |
|-----------|-------------|--------|
| 158.0 | Architecture & Data Model | ✅ |
| 158.1 | Firestore + Types + Storage Paths | ✅ |
| 158.2 | Upload API (Web) + Client Hook | ✅ |
| 158.3 | Chat Attachments Integration | ✅ |
| 158.4 | Basic Attachments Viewer | ✅ |
| 158.5 | Hooks for Media/Audio Agent | ✅ |

## 6. Definition of Done

Phase 158 تعتبر مكتملة لما:

1. المستخدم يقدر يرفع الملفات من داخل Web IDE (ProjectChatPanel أو Panel مستقل).
2. يتم إنشاء `projectAttachments` records في Firestore.
3. الملفات تتخزن في Storage تحت project-specific path.
4. ProjectChatPanel تعرض attachments كمصادر قابلة للفتح / المعاينة.
5. ConversationTurns تحتوي على attachment IDs المرتبطة بيها.
6. Media/Audio Agents يقدروا يطلبوا attachments بالـ ID (API بسيط).

---

## 7. Implementation Status - ✅ PHASE 158 COMPLETE

### All Sub-Phases Completed:

| Sub-Phase | Description | Status | File |
|-----------|-------------|--------|------|
| 158.0 | Architecture & Data Model | ✅ | This file |
| 158.1 | Types + AttachmentStore | ✅ | `orchestrator/core/attachments/` |
| 158.2 | Upload API + File Serving | ✅ | `src/app/api/attachments/` |
| 158.3 | Chat Attachments Integration | ✅ | `src/components/agents/ProjectChatPanel.tsx` |
| 158.4 | Attachments Viewer | ✅ | `src/components/attachments/AttachmentViewer.tsx` |
| 158.5 | Media/Audio Agent Hooks | ✅ | `orchestrator/core/attachments/mediaAgentHooks.ts` |

### Files Created:

| Component | File | Description |
|-----------|------|-------------|
| Types | `orchestrator/core/attachments/types.ts` | AttachmentKind, ProjectAttachment, limits |
| Store | `orchestrator/core/attachments/attachmentStore.ts` | In-memory store with global singleton |
| Upload API | `src/app/api/attachments/upload/route.ts` | File upload endpoint |
| File Serving | `src/app/api/attachments/file/[id]/route.ts` | Serve files by ID |
| List API | `src/app/api/attachments/route.ts` | List/Get attachments |
| Chat Update | `orchestrator/core/conversation/types.ts` | Added attachments to ConversationTurn |
| Chat Panel | `src/components/agents/ProjectChatPanel.tsx` | Attachment upload & display |
| Viewer | `src/components/attachments/AttachmentViewer.tsx` | Thumbnail, card, modal preview |
| Agent Hooks | `orchestrator/core/attachments/mediaAgentHooks.ts` | Processing queue for future agents |

### Key Features Implemented:

1. **File Upload**
   - Multipart form data upload
   - MIME type validation
   - File size limits (50MB max)
   - Storage path: `projects/{projectId}/attachments/{id}.{ext}`

2. **Attachment Types**
   - image (PNG, JPEG, GIF, WebP, SVG)
   - pdf
   - document (DOCX, TXT, MD)
   - audio (MP3, WAV, M4A, OGG)
   - other

3. **Chat Integration**
   - Attach button in ProjectChatPanel
   - Pending attachments display
   - Attachments sent with messages
   - Visual indicators for attachment types

4. **Attachment Viewer**
   - Thumbnail view for lists
   - Card view with details
   - Modal preview for images/PDF/audio
   - Download and open in new tab

5. **Agent Hooks (Phase 160/161)**
   - Processing queue for async processing
   - Status tracking (raw → processing → ready/error)
   - Metadata storage for extracted data
   - Auto-queue based on file type
