// orchestrator/core/neuralMemory/types.ts
// =============================================================================
// Phase 166.0 – Neural Memory Layer Types
// Unified Neural Index over Code + Media + Project Docs
// =============================================================================

/**
 * Source types for neural memory items
 */
export type NeuralSourceType =
  | 'code'         // Code file chunks
  | 'project_doc'  // Project documentation/specs
  | 'media'        // Media memory from Phase 165
  | 'test'         // Test files
  | 'run_log'      // Execution logs
  | 'chat';        // Chat conversation history

/**
 * Reference to the original source of a neural memory item
 */
export interface NeuralSourceRef {
  projectId: string;
  filePath?: string;        // For code files
  docId?: string;           // For project docs
  mediaMemoryId?: string;   // From Phase 165
  testId?: string;          // For test results
  chatId?: string;          // For chat history
  segmentId?: string;       // Chunk ID within the source
  lineStart?: number;       // For code: start line
  lineEnd?: number;         // For code: end line
}

/**
 * Main neural memory item stored in the index
 */
export interface NeuralMemoryItem {
  id: string;               // nm_xxx
  projectId: string;
  sourceType: NeuralSourceType;
  sourceRef: NeuralSourceRef;

  // Content
  title: string;
  snippet: string;          // 200-400 char summary
  fullContent?: string;     // Full content (optional, for debugging)

  // Categorization
  tags: string[];           // ['dashboard', 'billing', 'analytics', 'auth', ...]

  // Embedding (flexible storage)
  embeddingVector?: number[];       // Optional: in-memory / debug
  embeddingProviderId?: string;     // ID in external provider (Pinecone/Qdrant/etc)
  embeddingModel?: string;          // Model used for embedding

  // Metadata
  language?: string;        // For code: 'typescript', 'python', etc.
  fileType?: string;        // File extension or MIME type
  tokenCount?: number;      // Approximate token count

  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
}

/**
 * Filter options for neural search
 */
export interface NeuralSearchFilter {
  projectId: string;
  sourceTypes?: NeuralSourceType[];
  tags?: string[];
  language?: string;
  minScore?: number;
  maxResults?: number;
  excludeIds?: string[];
}

/**
 * Neural search request
 */
export interface NeuralSearchRequest {
  projectId: string;
  query: string;
  topK?: number;
  filters?: Partial<NeuralSearchFilter>;
  includeEmbedding?: boolean;
}

/**
 * Single search result item
 */
export interface NeuralSearchResultItem {
  item: NeuralMemoryItem;
  score: number;            // Similarity score 0.0 - 1.0
  matchReason?: string;     // Why this item matched
}

/**
 * Neural search response
 */
export interface NeuralSearchResponse {
  query: string;
  results: NeuralSearchResultItem[];
  totalFound: number;
  searchTimeMs: number;
}

/**
 * Context chunk for LLM consumption
 */
export interface ContextChunk {
  id: string;
  sourceType: NeuralSourceType;
  sourceRef: NeuralSourceRef;
  title: string;
  snippet: string;
  score: number;
  tags?: string[];
}

/**
 * Composed context ready for LLM
 */
export interface ComposedContext {
  query: string;
  chunks: ContextChunk[];
  systemHint: string;
  totalChunks: number;
  truncated: boolean;
}

/**
 * Index statistics
 */
export interface NeuralIndexStats {
  projectId: string;
  totalItems: number;
  bySourceType: Record<NeuralSourceType, number>;
  byLanguage: Record<string, number>;
  lastIndexedAt: number;
  lastQueryAt?: number;
}

/**
 * Indexing job status
 */
export type IndexingJobStatus = 'pending' | 'running' | 'done' | 'error';

export interface IndexingJob {
  id: string;
  projectId: string;
  sourceType: NeuralSourceType;
  status: IndexingJobStatus;
  itemsProcessed: number;
  totalItems: number;
  errorMessage?: string;
  startedAt: number;
  completedAt?: number;
}

/**
 * Batch indexing request
 */
export interface BatchIndexRequest {
  projectId: string;
  sourceType: NeuralSourceType;
  items: Array<{
    title: string;
    content: string;
    sourceRef: Partial<NeuralSourceRef>;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Batch indexing result
 */
export interface BatchIndexResult {
  indexed: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
  itemIds: string[];
}

console.log('[166.0][NEURAL_MEMORY] Types loaded');
