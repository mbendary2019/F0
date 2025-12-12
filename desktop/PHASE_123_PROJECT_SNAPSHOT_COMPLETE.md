# Phase 123: Project Snapshot System Complete

## Summary
تم إنشاء نظام Project Snapshot الكامل. الآن يمكن للـ F0 Desktop IDE توليد ملخص ذكي للمشروع وحفظه في Firestore، ثم حقنه في كل استدعاء للـ Agent لجعل الردود أذكى وأكثر دقة.

## Files Created

### 1. Snapshot Prompt Builder
**File:** `desktop/src/lib/agent/prompts/snapshotPrompt.ts`

```typescript
export function buildSnapshotPrompt(
  files: Array<{ path: string; content: string }>,
  locale: 'ar' | 'en' = 'ar'
): SnapshotPromptMessages
```

- يبني prompt لتحليل المشروع
- يدعم العربية والإنجليزية
- يطلب JSON منظم بالبنية المحددة

### 2. Snapshot Generator Tool
**File:** `desktop/src/lib/agent/tools/generateProjectSnapshot.ts`

```typescript
export interface ProjectSnapshot {
  projectName: string;
  stack: string[];
  authFlow: string;
  billingFlow: string;
  routes: string[];
  apis: string[];
  stateManagement: string[];
  database: string;
  styling: string;
  importantFiles: string[];
  features: string[];
  notes: string[];
  generatedAt: string;
}

export async function generateProjectSnapshot(
  llm: SnapshotLLMClient,
  options: GenerateSnapshotOptions
): Promise<ProjectSnapshot | null>

export async function generateBasicSnapshot(
  options: GenerateSnapshotOptions
): Promise<Partial<ProjectSnapshot> | null>
```

Features:
- `selectImportantFiles()` - يختار الملفات المهمة من الـ index
- `generateProjectSnapshot()` - توليد كامل مع LLM
- `generateBasicSnapshot()` - توليد سريع بدون LLM
- يدعم Electron renderer عبر `window.f0Desktop.readFile`

### 3. Firestore Save API
**File:** `src/app/api/projects/[projectId]/snapshot/route.ts`

Endpoints:
- `GET /api/projects/[projectId]/snapshot` - تحميل الـ snapshot
- `POST /api/projects/[projectId]/snapshot` - حفظ الـ snapshot
- `DELETE /api/projects/[projectId]/snapshot` - حذف الـ snapshot

**File:** `desktop/src/lib/agent/saveSnapshot.ts`

```typescript
export async function saveSnapshotToFirestore(options: SaveSnapshotOptions): Promise<SaveSnapshotResult>
export async function loadSnapshotFromFirestore(projectId: string): Promise<ProjectSnapshot | null>
export function saveSnapshotLocally(projectRoot: string, snapshot: ProjectSnapshot): boolean
export function loadSnapshotLocally(projectRoot: string): ProjectSnapshot | null
```

### 4. Snapshot Button UI
**File:** `desktop/src/components/SnapshotButton.tsx`

```tsx
<SnapshotButton
  projectRoot="/path/to/project"
  projectId="abc123"
  userId="user123"
  locale="ar"
  onSnapshotGenerated={(snapshot) => console.log(snapshot)}
/>
```

Features:
- زر بنفسجي "📸 Generate Snapshot"
- حالات: idle, loading, success, error
- عرض preview للـ snapshot في modal
- إعادة التوليد

### 5. Agent Context Hook
**File:** `desktop/src/hooks/useAgentContext.ts`

```typescript
const {
  snapshot,
  isLoading,
  hasSnapshot,
  buildEnrichedMessage,
  getContextString,
  loadSnapshot,
  updateSnapshot,
} = useAgentContext({
  projectRoot: '/path/to/project',
  projectId: 'abc123',
  autoLoad: true,
});

// إضافة السياق للرسالة
const enrichedMessage = buildEnrichedMessage(userInput, 'ar');
sendToAgent(enrichedMessage);
```

## How It Works

```
1. User clicks "📸 Generate Snapshot"
         ↓
2. selectImportantFiles() finds key files from index
   - auth, billing, api, routes, config files
         ↓
3. generateBasicSnapshot() creates quick analysis
   OR generateProjectSnapshot() calls LLM for detailed analysis
         ↓
4. saveSnapshotToFirestore() saves to:
   projects/{projectId}/meta/snapshot
         ↓
5. useAgentContext() loads snapshot on component mount
         ↓
6. buildEnrichedMessage() injects context into agent calls:
   "لديك معلومات عن المشروع:
   === سياق المشروع ===
   الاسم: my-project
   Stack: Next.js, TypeScript, Firebase
   Database: Firebase
   المسارات: src/app/page.tsx, src/app/auth/page.tsx...
   ===================

   السؤال: {user's original question}"
```

## Firestore Structure

```
projects/
  {projectId}/
    meta/
      snapshot/
        snapshot: ProjectSnapshot
        userId: string
        version: number
        createdAt: string
        updatedAt: string
```

## Important File Patterns

Files prioritized for snapshot generation:
- Auth: `/auth|login|signup|session/i`
- Billing: `/billing|payment|checkout|stripe/i`
- API: `/api\/|route\.ts|endpoint/i`
- Core: `/page\.tsx|layout\.tsx|middleware\.ts/i`
- Config: `/config|\.env|firebase|next\.config/i`
- State: `/store|context|provider|zustand|redux/i`

## Integration with Agent

In `AgentPanelPane.tsx`, use the hook:

```tsx
import { useAgentContext } from '../hooks/useAgentContext';

function AgentPanelPane() {
  const { buildEnrichedMessage, hasSnapshot } = useAgentContext({
    projectRoot,
    projectId,
  });

  const handleSend = async () => {
    // Inject snapshot context
    const enrichedMessage = hasSnapshot
      ? buildEnrichedMessage(userInput, locale)
      : userInput;

    await sendChatToCloudAgent({
      message: enrichedMessage,
      // ...
    });
  };
}
```

## Testing

1. Open a project in F0 Desktop IDE
2. Make sure project is indexed
3. Click "📸 Generate Snapshot" button
4. View the generated snapshot preview
5. Ask the agent a question
6. Verify the response uses project context

## Next Steps

- [ ] Add LLM-powered detailed snapshot generation
- [ ] Auto-regenerate snapshot when files change significantly
- [ ] Show snapshot age indicator
- [ ] Add "Ask about project" quick action that uses snapshot

---
Completed: 2025-11-30
Phase: 123 - Project Snapshot System
