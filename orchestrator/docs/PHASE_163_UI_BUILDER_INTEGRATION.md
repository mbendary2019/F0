# Phase 163 – UI Builder Integration
## (ربط طبقة الميديا بـ UI Builder)

## 1. الهدف

ربط طبقة Media/PDF/Audio مع UI Builder/CodeAgent:
- Screenshot/Wireframe → Next.js page كامل
- PDF Specs → Layout + Components + Routes + Tasks
- في كلتا الحالتين: الـ Agent يقترح Tree من Components ثم تنفيذها (بموافقة المستخدم).

Phase 163 تبني فوق:
- Phase 162 (Media Conversation Layer)
- Phase 160 (MediaAgent)
- Phase 87 (CodeAgent)
- Planner Infrastructure

---

## 2. المكونات الأساسية

### 2.1 Data Models

```ts
// orchestrator/core/uiBuilder/types.ts

type UiGenerationMode = 'page' | 'component' | 'dashboard' | 'form';

type UiGenerationStatus =
  | 'pending'
  | 'analyzing'
  | 'generating'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'building'
  | 'completed'
  | 'failed';

interface UiGenerationRequest {
  id: string;
  projectId: string;
  attachmentIds: string[];
  mode: UiGenerationMode;
  targetPath?: string;
  framework?: 'nextjs' | 'react';
  styling?: 'tailwind' | 'shadcn' | 'plain';
  createdBy: string;
  createdAt: string;
  conversationId?: string;
  turnId?: string;
  instructions?: string;
  constraints?: string[];
}

interface UiComponentNode {
  id: string;
  name: string;
  type: 'page' | 'layout' | 'component' | 'section' | 'element';
  description?: string;
  props?: Record<string, unknown>;
  children?: UiComponentNode[];
  suggestedPath?: string;
  dependencies?: string[];
  imports?: string[];
  visualHints?: {
    layout?: 'flex' | 'grid' | 'block';
    spacing?: 'tight' | 'normal' | 'loose';
    colors?: string[];
    typography?: string[];
  };
}

interface UiGenerationProposal {
  id: string;
  requestId: string;
  projectId: string;
  status: UiGenerationStatus;
  createdAt: string;
  updatedAt: string;
  analysisNotes?: string;
  componentTree: UiComponentNode[];
  filePlan: UiFilePlan[];
  planId?: string;
  taskIds?: string[];
  errorMessage?: string;
}

interface UiFilePlan {
  componentId: string;
  path: string;
  action: 'create' | 'modify';
  estimatedLines?: number;
  dependencies?: string[];
}
```

---

## 3. Flow Overview

```
User uploads Screenshot
       │
       ▼
AttachmentViewer shows "Generate UI" button
       │
       ▼
POST /api/ui/generate
       │
       ▼
MediaAgent analyzes image → component tree
       │
       ▼
UiGenerationProposal created (awaiting_approval)
       │
       ▼
UiGenerationProposalPanel shows tree + file plan
       │
       ▼
User clicks "Approve & Run Plan"
       │
       ▼
PATCH /api/ui/generate/{proposalId} { action: 'approve' }
       │
       ▼
Planner creates tasks → CodeAgent writes files
       │
       ▼
Project updated with new UI components
```

---

## 4. Implementation Summary

### 4.1 Files Created

| File | Description |
|------|-------------|
| `orchestrator/core/uiBuilder/types.ts` | UiGeneration types |
| `orchestrator/core/uiBuilder/firestoreUiBuilderStore.ts` | Firestore persistence |
| `orchestrator/core/uiBuilder/index.ts` | Module exports |
| `src/app/api/ui/generate/route.ts` | POST/GET endpoints |
| `src/app/api/ui/generate/[proposalId]/route.ts` | GET/PATCH for single proposal |
| `src/components/ui-builder/UiGenerationProposalPanel.tsx` | Proposal UI with tree view |
| `src/components/attachments/AttachmentViewer.tsx` | Added "Generate UI" button |

### 4.2 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ui/generate` | Create UI generation request |
| GET | `/api/ui/generate?projectId=xxx` | List proposals |
| GET | `/api/ui/generate/{proposalId}` | Get single proposal |
| PATCH | `/api/ui/generate/{proposalId}` | Approve/reject proposal |

---

## 5. Sub-Phases

| Sub-Phase | Description | Status |
|-----------|-------------|--------|
| 163.0 | Architecture Draft | ✅ |
| 163.1 | Data Model (types.ts + firestoreStore) | ✅ |
| 163.2 | /api/ui/generate endpoints | ✅ |
| 163.3 | AttachmentViewer "Generate UI" button | ✅ |
| 163.4 | UiGenerationProposalPanel (Tree + Approve) | ✅ |

---

## 6. Usage Examples

### 6.1 Generate UI from Image

```tsx
// In AttachmentPreviewModal
<AttachmentPreviewModal
  attachment={selectedImage}
  open={showPreview}
  onClose={() => setShowPreview(false)}
  projectId="proj_123"  // Enables "Generate UI" button
/>
```

### 6.2 Show Proposals Panel

```tsx
import { UiGenerationProposalPanel, useUiProposals } from '@/components/ui-builder/UiGenerationProposalPanel';

function ProjectUiProposals({ projectId }: { projectId: string }) {
  const { proposals, loading, approveProposal, rejectProposal } = useUiProposals(projectId);

  return (
    <div>
      {proposals.map(proposal => (
        <UiGenerationProposalPanel
          key={proposal.id}
          proposal={proposal}
          onApprove={approveProposal}
          onReject={rejectProposal}
        />
      ))}
    </div>
  );
}
```

### 6.3 API Usage

```bash
# Create UI generation request
curl -X POST http://localhost:3030/api/ui/generate \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "attachmentIds": ["att_abc"],
    "mode": "page",
    "framework": "nextjs",
    "styling": "shadcn"
  }'

# Approve proposal
curl -X PATCH http://localhost:3030/api/ui/generate/uiprop_xxx \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "userId": "user_123"}'
```

---

## 7. Definition of Done

Phase 163 تعتبر مكتملة لما:

1. ✅ المستخدم يقدر يضغط "Generate UI" من AttachmentViewer
2. ✅ النظام ينشئ proposal مع component tree
3. ✅ UiGenerationProposalPanel يعرض Tree + Files
4. ✅ المستخدم يقدر يوافق/يرفض
5. ✅ لما يوافق، ينشئ Plan للتنفيذ

---

## 8. Future Enhancements (Phase 164+)

- [ ] MediaAgent Vision API integration for actual image analysis
- [ ] PDF page-by-page analysis
- [ ] Component library detection (detect shadcn/mui patterns)
- [ ] Code preview before approval
- [ ] Edit component tree before approval
- [ ] Multi-page generation from multi-page PDFs

---

*Phase 163: UI Builder Integration Complete*
