// desktop/src/lib/rag/index.ts
// Phase 122: RAG-Lite Module - Export all RAG utilities

export {
  getContextFilesFromIndex,
  getQuickContext,
  type ContextFile,
  type ContextStrategy,
  type GetContextOptions,
} from './projectContextFromIndex';

export {
  answerWithIndexedContext,
  buildContextMessages,
  type ChatMessage,
  type LLMClient,
  type AnswerWithContextOptions,
  type AnswerWithContextResult,
} from './answerWithIndexedContext';
