// orchestrator/core/neuralMemory/index.ts
// =============================================================================
// Phase 166 – Neural Memory Layer Module Exports
// Unified Neural Index over Code + Media + Project Docs
// =============================================================================

// Types
export * from './types';

// Embedding Provider
export {
  EmbeddingProvider,
  EmbeddingIndexAdapter,
  MockEmbeddingProvider,
  FirestoreIndexAdapter,
  getDefaultEmbeddingProvider,
  getEmbeddingIndexAdapter,
  getMockProvider,
  setEmbeddingProvider,
  setIndexAdapter,
} from './embeddingProvider';

// Neural Indexer
export {
  indexMediaMemoryNode,
  indexCodeFile,
  indexCodeFileChunk,
  indexProjectDoc,
  indexTestResult,
  indexChatTurn,
  indexRunLog,
  batchIndex,
  deleteFromIndex,
  deleteFileFromIndex,
  reindexCodeFile,
  createIndexingJob,
  updateJobProgress,
  getJobStatus,
  listActiveJobs,
} from './neuralIndexer';

// Neural Retriever
export {
  neuralSearch,
  searchCode,
  searchMedia,
  searchDocs,
  searchTests,
  searchChat,
  searchRunLogs,
  multiSourceSearch,
  findSimilar,
  findSimilarCode,
  getContextForTask,
  getContextForCodeGen,
  getIndexStats,
  listIndexedItems,
  getItem,
} from './neuralRetriever';

// Context Composer
export {
  composeContext,
  contextToMarkdown,
  contextToXml,
  contextToJson,
  buildPlannerContext,
  buildCodeAgentContext,
  buildMediaUIContext,
  buildChatContext,
  buildAgentContext,
  getQuickContext,
  getSystemContext,
  ComposeOptions,
  AgentContextOptions,
} from './contextComposer';

console.log('[166][NEURAL_MEMORY] Module exports loaded');
