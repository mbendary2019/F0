# Phase 166 – Neural Memory Layer

> **"عقل موحَّد للمشروع كله"** – A unified brain for the entire project

## Overview

Phase 166 implements the Neural Memory Layer, providing semantic search across all project memory types (Code, Media, Project Docs, Tests, Chat History, Execution Logs).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Neural Memory Layer                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │    Code      │  │    Media     │  │   Project    │              │
│  │   Chunks     │  │   Memory     │  │    Docs      │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         └────────────────┼────────────────┘                        │
│                          │                                          │
│                          ▼                                          │
│         ┌─────────────────────────────────┐                        │
│         │      Neural Indexer (166.2)      │                        │
│         │   - indexMediaMemoryNode()       │                        │
│         │   - indexCodeFile()              │                        │
│         │   - indexProjectDoc()            │                        │
│         │   - batchIndex()                 │                        │
│         └─────────────────────────────────┘                        │
│                          │                                          │
│                          ▼                                          │
│         ┌─────────────────────────────────┐                        │
│         │    Embedding Provider (166.1)    │                        │
│         │   - MockEmbeddingProvider        │                        │
│         │   - FirestoreIndexAdapter        │                        │
│         │   - (OpenAI/Vertex ready)        │                        │
│         └─────────────────────────────────┘                        │
│                          │                                          │
│                          ▼                                          │
│         ┌─────────────────────────────────┐                        │
│         │     Neural Retriever (166.3)     │                        │
│         │   - neuralSearch()               │                        │
│         │   - searchCode/Media/Docs()      │                        │
│         │   - multiSourceSearch()          │                        │
│         │   - findSimilar()                │                        │
│         └─────────────────────────────────┘                        │
│                          │                                          │
│                          ▼                                          │
│         ┌─────────────────────────────────┐                        │
│         │    Context Composer (166.4)      │                        │
│         │   - buildAgentContext()          │                        │
│         │   - contextToXml/Markdown()      │                        │
│         │   - Agent-specific builders      │                        │
│         └─────────────────────────────────┘                        │
│                          │                                          │
│                          ▼                                          │
│         ┌─────────────────────────────────┐                        │
│         │         API Routes (166.6)       │                        │
│         │   - /api/neural/search           │                        │
│         │   - /api/neural/index            │                        │
│         └─────────────────────────────────┘                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Source Types

```typescript
type NeuralSourceType =
  | 'code'         // Code file chunks
  | 'project_doc'  // Project documentation/specs
  | 'media'        // Media memory from Phase 165
  | 'test'         // Test files
  | 'run_log'      // Execution logs
  | 'chat';        // Chat conversation history
```

## Core Types

### NeuralMemoryItem

```typescript
interface NeuralMemoryItem {
  id: string;               // nm_xxx
  projectId: string;
  sourceType: NeuralSourceType;
  sourceRef: NeuralSourceRef;
  title: string;
  snippet: string;          // 200-400 char summary
  fullContent?: string;     // Full content
  tags: string[];           // Auto-extracted + manual
  embeddingVector?: number[];
  embeddingModel?: string;
  language?: string;
  fileType?: string;
  tokenCount?: number;
  createdAt: number;
  updatedAt: number;
}
```

### NeuralSearchRequest

```typescript
interface NeuralSearchRequest {
  projectId: string;
  query: string;
  topK?: number;
  filters?: {
    sourceTypes?: NeuralSourceType[];
    tags?: string[];
    language?: string;
    minScore?: number;
    excludeIds?: string[];
  };
  includeEmbedding?: boolean;
}
```

### ComposedContext

```typescript
interface ComposedContext {
  query: string;
  chunks: ContextChunk[];
  systemHint: string;
  totalChunks: number;
  truncated: boolean;
}
```

## API Endpoints

### POST /api/neural/search

Search neural memory with semantic query.

**Request:**
```json
{
  "projectId": "proj_123",
  "query": "user authentication flow",
  "topK": 10,
  "filters": {
    "sourceTypes": ["code", "project_doc"],
    "minScore": 0.3
  },
  "includeContext": true,
  "agentType": "code",
  "format": "xml"
}
```

**Response:**
```json
{
  "success": true,
  "query": "user authentication flow",
  "results": [
    {
      "item": {
        "id": "nm_code_xxx",
        "sourceType": "code",
        "title": "src/auth/login.ts:25-50",
        "snippet": "export async function loginUser...",
        "tags": ["auth", "api", "typescript"]
      },
      "score": 0.85,
      "matchReason": "title contains 'auth'; tagged with auth, api"
    }
  ],
  "totalFound": 8,
  "searchTimeMs": 45,
  "context": "<neural_context>..."
}
```

### GET /api/neural/search?projectId=xxx&action=stats

Get index statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "projectId": "proj_123",
    "totalItems": 250,
    "bySourceType": {
      "code": 180,
      "project_doc": 15,
      "media": 25,
      "test": 20,
      "chat": 10,
      "run_log": 0
    },
    "byLanguage": {
      "typescript": 150,
      "javascript": 30
    },
    "lastIndexedAt": 1702123456789
  }
}
```

### POST /api/neural/index

Index new items.

**Request:**
```json
{
  "projectId": "proj_123",
  "sourceType": "code",
  "items": [
    {
      "title": "src/utils/helpers.ts:1-50",
      "content": "export function formatDate...",
      "filePath": "src/utils/helpers.ts",
      "lineStart": 1,
      "lineEnd": 50,
      "tags": ["utility"]
    }
  ]
}
```

### DELETE /api/neural/index

Remove items from index.

**Request:**
```json
{
  "projectId": "proj_123",
  "filePath": "src/utils/helpers.ts"
}
```

## Orchestrator Usage

### Indexing

```typescript
import {
  indexCodeFile,
  indexMediaMemoryNode,
  indexProjectDoc,
  batchIndex,
} from '@/orchestrator/core/neuralMemory';

// Index a code file
await indexCodeFile('proj_123', 'src/auth/login.ts', fileContent);

// Index media memory node (from Phase 165)
await indexMediaMemoryNode(mediaNode);

// Index project doc
await indexProjectDoc('proj_123', 'doc_456', 'API Design', docContent);

// Batch index
await batchIndex({
  projectId: 'proj_123',
  sourceType: 'code',
  items: [/* ... */],
});
```

### Searching

```typescript
import {
  neuralSearch,
  searchCode,
  searchMedia,
  multiSourceSearch,
  getContextForTask,
} from '@/orchestrator/core/neuralMemory';

// Basic search
const results = await neuralSearch({
  projectId: 'proj_123',
  query: 'user authentication',
  topK: 10,
});

// Specialized search
const codeResults = await searchCode('proj_123', 'login function');
const mediaResults = await searchMedia('proj_123', 'dashboard layout');

// Multi-source with weights
const mixedResults = await multiSourceSearch('proj_123', 'billing flow', {
  sourceWeights: {
    code: 1.0,
    project_doc: 1.2,
    media: 0.8,
  },
});

// Get context for agent
const { items, summary } = await getContextForTask(
  'proj_123',
  'Add user profile page',
  { includeCode: true, includeMedia: true }
);
```

### Context Composition

```typescript
import {
  buildAgentContext,
  buildCodeAgentContext,
  getSystemContext,
  contextToXml,
} from '@/orchestrator/core/neuralMemory';

// Build context for any agent
const { context, formatted } = await buildAgentContext('proj_123', {
  agentType: 'code',
  taskDescription: 'Add login form validation',
  currentFilePath: 'src/auth/login.tsx',
  format: 'xml',
});

// Quick system context
const systemContext = await getSystemContext(
  'proj_123',
  'Implement checkout flow',
  'planner'
);
```

## Agent Integration

### PlannerAgent

```typescript
const context = await buildPlannerContext(projectId, taskDescription);
// Returns: project docs + code overview + media references
```

### CodeAgent

```typescript
const context = await buildCodeAgentContext(
  projectId,
  prompt,
  currentFilePath
);
// Returns: relevant code + media styles + docs
```

### Media/UI Builder Agent

```typescript
const context = await buildMediaUIContext(projectId, designPrompt);
// Returns: media references + code components + style patterns
```

### Chat Agent

```typescript
const context = await buildChatContext(projectId, userMessage);
// Returns: chat history + docs + relevant code
```

## Files Created

```
orchestrator/core/neuralMemory/
├── types.ts              # 166.0 - Type definitions
├── embeddingProvider.ts  # 166.1 - Embedding abstraction
├── neuralIndexer.ts      # 166.2 - Indexing pipeline
├── neuralRetriever.ts    # 166.3 - Search & retrieval
├── contextComposer.ts    # 166.4 - Context building
└── index.ts              # Module exports

src/app/api/neural/
├── search/route.ts       # 166.6 - Search API
└── index/route.ts        # 166.6 - Index API
```

## Firestore Collections

- `neuralMemoryItems` - Indexed items with embeddings

## Future Enhancements

1. **166.7 - Neural Context Inspector** - Debug UI for viewing indexed items
2. **166.8 - Background Sync** - Auto-sync file changes to index
3. **OpenAI/Vertex Embeddings** - Replace mock with real embeddings
4. **Vector DB Integration** - Pinecone/Qdrant for production scale

## Usage Example

```typescript
// Full flow: Index → Search → Context → Agent
import {
  indexCodeFile,
  neuralSearch,
  buildCodeAgentContext,
  contextToXml,
} from '@/orchestrator/core/neuralMemory';

// 1. Index files (on file change)
await indexCodeFile('proj_123', 'src/auth/login.ts', fileContent);

// 2. User asks: "Add password reset"
const searchResults = await neuralSearch({
  projectId: 'proj_123',
  query: 'password reset authentication',
  topK: 10,
});

// 3. Build context for code agent
const { context, formatted } = await buildCodeAgentContext(
  'proj_123',
  'Add password reset functionality',
  'src/auth/password.ts'
);

// 4. Send to LLM
const llmPrompt = `
${formatted}

User request: Add password reset functionality
`;
```

---

**Phase 166 Complete** ✅
