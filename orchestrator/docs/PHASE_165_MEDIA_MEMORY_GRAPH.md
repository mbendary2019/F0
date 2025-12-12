# Phase 165 – Media Memory Graph
## (تحويل الميديا المعالجة إلى Memory Nodes)

## 1. الهدف

تحويل نتائج Phase 164 (MediaPreprocessResult) إلى Memory Nodes قابلة للبحث والربط:
- **UI Builder** (Phase 163): يستخدم similar designs + suggested components
- **Media Chat** (Phase 162): يستخدم context retrieval للمحادثات
- **Agents**: يستخدم memory للسياق والقرارات

---

## 2. Data Model

### 2.1 MediaMemoryNode

```ts
interface MediaMemoryNode {
  id: string;
  projectId: string;
  attachmentId: string;
  preprocessJobId: string;
  kind: 'image' | 'pdf' | 'audio';

  // Content
  title?: string;
  summary: string;

  // Layout info
  layoutTypes: string[];  // ['navbar', 'sidebar', 'card', 'table', ...]

  // Style info
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColors: string[];
  styleHints: {
    borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
    shadowLevel?: 0 | 1 | 2 | 3;
    spacing?: 'tight' | 'normal' | 'roomy';
    theme?: 'light' | 'dark' | 'auto';
  };

  // Extracted entities and components
  entities: string[];     // ['Total Users', 'Revenue', ...]
  components: string[];   // ['UsersStatsCard', 'RevenueChart', ...]

  // Tags for search
  tags: MediaMemoryTag[];

  // Timestamps
  createdAt: number;
  updatedAt: number;

  // Optional metadata
  conversationId?: string;
  turnId?: string;
  createdBy?: string;
}
```

### 2.2 MediaMemoryEdge

```ts
type MediaMemoryEdgeType =
  | 'style_similar'      // Similar visual style
  | 'layout_similar'     // Similar layout structure
  | 'entity_overlap'     // Shared entities
  | 'same_project'       // Same project
  | 'same_conversation'  // Same conversation
  | 'derived_from'       // Derived relationship
  | 'user_linked';       // Manually linked

interface MediaMemoryEdge {
  id: string;
  projectId: string;
  fromMemoryId: string;
  toMemoryId: string;
  type: MediaMemoryEdgeType;
  score: number;  // 0.0 - 1.0
  createdAt: number;
}
```

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Media Memory Graph                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐      ┌─────────────────┐               │
│  │ MediaPreprocess │  →   │ Memory Builder  │               │
│  │ Result (164)    │      │ (165.2)         │               │
│  └─────────────────┘      └─────────────────┘               │
│                                   ↓                          │
│                          ┌─────────────────┐                │
│                          │ MediaMemoryNode │                │
│                          └─────────────────┘                │
│                                   ↓                          │
│                          ┌─────────────────┐                │
│                          │  Graph Engine   │                │
│                          │   (165.3)       │                │
│                          └─────────────────┘                │
│                                   ↓                          │
│                          ┌─────────────────┐                │
│                          │ Similarity Edges│                │
│                          └─────────────────┘                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
           ┌─────────────────┼─────────────────┐
           ↓                 ↓                 ↓
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  UI Builder  │  │  Media Chat  │  │    Agents    │
    │  (Phase 163) │  │  (Phase 162) │  │              │
    │              │  │              │  │              │
    │ • Similar    │  │ • Context    │  │ • Memory     │
    │   designs    │  │   retrieval  │  │   lookup     │
    │ • Suggested  │  │ • Prompt     │  │ • Insights   │
    │   components │  │   augment    │  │              │
    └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 4. API Endpoints

### 4.1 List/Search Memory Nodes

```
GET /api/media/memory
```

**Query Parameters:**
- `projectId` (required): Project ID
- `attachmentId`: Get specific node by attachment
- `kind`: Filter by 'image', 'pdf', 'audio'
- `layoutTypes`: Comma-separated layout types
- `entities`: Comma-separated entity names
- `components`: Comma-separated component names
- `limit`: Max results (default 50)

**Response:**
```json
{
  "success": true,
  "nodes": [...],
  "results": [
    { "node": {...}, "score": 0.85, "matchedOn": ["layout", "style"] }
  ],
  "total": 10
}
```

### 4.2 Create Memory Node

```
POST /api/media/memory
```

**Request:**
```json
{
  "projectId": "proj_123",
  "attachmentId": "att_abc",
  "kind": "image",
  "summary": "Dashboard with stats cards",
  "layoutTypes": ["navbar", "card", "chart"],
  "primaryColor": "#6366f1",
  "entities": ["Total Users", "Revenue"],
  "components": ["UsersStatsCard"]
}
```

### 4.3 Get Single Node (with graph/similar)

```
GET /api/media/memory/{nodeId}?graph=true&similar=true&similarLimit=5
```

**Response:**
```json
{
  "success": true,
  "node": {...},
  "edges": [...],
  "connectedNodes": [...],
  "similarNodes": [
    { "node": {...}, "score": 0.75, "matchedOn": ["style", "layout"] }
  ]
}
```

### 4.4 Update Node

```
PATCH /api/media/memory/{nodeId}
```

### 4.5 Delete Node

```
DELETE /api/media/memory/{nodeId}
```

---

## 5. Integration Points

### 5.1 Auto-Memory from Preprocessing (165.4)

When `/api/media/preprocess` is called, it automatically creates a memory node:

```ts
// In POST /api/media/preprocess
const result = await runPreprocess(job);
await db.collection('mediaPreprocessResults').doc(jobId).set(result);

// Auto-create memory node
const memoryNode = await createMemoryNodeFromResult(result, {
  conversationId,
  turnId,
  createdBy,
});

return { ...result, memoryNodeId: memoryNode.id };
```

### 5.2 UI Builder Recommendations (165.6)

When `/api/ui/generate` is called, it fetches memory recommendations:

```ts
// In POST /api/ui/generate
const memoryNode = await getMemoryNode(projectId, attachmentIds[0]);
if (memoryNode) {
  const recommendations = await getMemoryRecommendations(projectId, memoryNode);
  // Returns: similarDesigns, suggestedComponents, colorPalette
}
```

### 5.3 Chat/Agent Retrieval (165.7)

```ts
import { retrieveMediaMemoryContext } from '@/orchestrator/core/mediaMemory';

const context = await retrieveMediaMemoryContext({
  projectId: 'proj_123',
  attachmentId: 'att_abc',  // Optional
  layoutTypes: ['dashboard', 'card'],  // Optional filters
  maxRelated: 5,
});

// Use context.contextText for LLM prompt augmentation
// Use context.entities/components for quick reference
```

---

## 6. Similarity Algorithms

### 6.1 Style Similarity

```ts
function calculateStyleSimilarity(n1, n2): number {
  // Color similarity (RGB distance)
  // Border radius match
  // Theme match
  // Shadow level match
  // Returns 0.0 - 1.0
}
```

### 6.2 Layout Similarity

```ts
function calculateLayoutSimilarity(n1, n2): number {
  // Jaccard similarity of layoutTypes
  // Returns 0.0 - 1.0
}
```

### 6.3 Entity Overlap

```ts
function calculateEntityOverlap(n1, n2): number {
  // Partial string matching of entities
  // Returns 0.0 - 1.0
}
```

---

## 7. Files Created

| File | Description |
|------|-------------|
| `orchestrator/core/mediaMemory/types.ts` | Type definitions |
| `orchestrator/core/mediaMemory/firestoreMediaMemoryStore.ts` | Firestore persistence |
| `orchestrator/core/mediaMemory/mediaMemoryBuilder.ts` | Build memory from preprocess |
| `orchestrator/core/mediaMemory/mediaMemoryGraphEngine.ts` | Graph edges + similarity |
| `orchestrator/core/mediaMemory/mediaMemoryRetriever.ts` | Context retrieval for chat/agents |
| `orchestrator/core/mediaMemory/index.ts` | Module exports |
| `src/app/api/media/memory/route.ts` | POST/GET endpoints |
| `src/app/api/media/memory/[nodeId]/route.ts` | Single node operations |
| `src/app/api/media/preprocess/route.ts` | Updated with auto-memory |
| `src/app/api/ui/generate/route.ts` | Updated with recommendations |

---

## 8. Sub-Phases

| Sub-Phase | Description | Status |
|-----------|-------------|--------|
| 165.0 | Types + Schema | ✅ |
| 165.1 | Firestore Store | ✅ |
| 165.2 | Memory Builder from Phase 164 | ✅ |
| 165.3 | Graph Engine (Edges + Similarity) | ✅ |
| 165.4 | Auto-Memory integration with Phase 164 | ✅ |
| 165.5 | Media Memory API endpoints | ✅ |
| 165.6 | UI Builder integration | ✅ |
| 165.7 | Media Chat / Agents retrieval | ✅ |
| 165.9 | Documentation | ✅ |

---

## 9. Usage Examples

### 9.1 Preprocess with Auto-Memory

```bash
curl -X POST http://localhost:3030/api/media/preprocess \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "attachmentId": "att_dashboard",
    "kind": "image"
  }'

# Response includes memoryNodeId
```

### 9.2 Search Memory

```bash
curl "http://localhost:3030/api/media/memory?projectId=proj_123&layoutTypes=card,chart"
```

### 9.3 Get Similar Designs

```bash
curl "http://localhost:3030/api/media/memory/mem_xxx?similar=true&similarLimit=5"
```

### 9.4 Generate UI with Memory Recommendations

```bash
curl -X POST http://localhost:3030/api/ui/generate \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "attachmentIds": ["att_dashboard"],
    "mode": "dashboard"
  }'

# Response includes memoryRecommendations
```

---

## 10. Future Enhancements

- [ ] Vector embeddings for semantic similarity
- [ ] Cross-project memory sharing
- [ ] Memory versioning and history
- [ ] User-defined similarity weights
- [ ] Memory cleanup and archival
- [ ] Export/import memory graphs

---

*Phase 165: Media Memory Graph Complete*
