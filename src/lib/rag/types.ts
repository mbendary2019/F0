// src/lib/rag/types.ts
// Phase 58: Adaptive RAG & Semantic Routing - Core Types

/**
 * Source type for retrieved items
 */
export type Source = "memory" | "doc" | "ops";

/**
 * Strategy for retrieval
 */
export type Strategy = "auto" | "dense" | "sparse" | "hybrid";

/**
 * Retrieved item from recall
 */
export interface RecallItem {
  id: string;
  source: Source;
  text: string;
  score: number; // raw retriever score
  meta?: Record<string, any>;
}

/**
 * Options for recall operation
 */
export interface RecallOpts {
  workspaceId: string;
  topK?: number; // default 8
  strategy?: Strategy; // default "auto"
  useMMR?: boolean; // default true
  mmrLambda?: number; // default 0.65
  budgetTokens?: number; // default 1200
  allowDocs?: boolean; // default true
  allowOps?: boolean; // default true
  minRelevance?: number; // minimum score threshold
}

/**
 * Component timing for diagnostics
 */
export interface ComponentTiming {
  name: string;
  tookMs: number;
}

/**
 * Diagnostics information for recall operation
 */
export interface RecallDiagnostics {
  strategy: Strategy;
  tookMs: number;
  cacheHit: boolean;
  components: ComponentTiming[];
  itemsBeforeMMR?: number;
  itemsAfterMMR?: number;
}

/**
 * Result from recall operation
 */
export interface RecallResult {
  items: RecallItem[];
  diagnostics: RecallDiagnostics;
}

/**
 * Cache entry for query results
 */
export interface QueryCacheEntry {
  workspaceId: string;
  queryHash: string;
  query: string;
  strategy: Strategy;
  value: RecallItem[];
  expire_at: Date;
  created_at: Date;
  hit_count?: number;
}

/**
 * Metrics entry for tracking
 */
export interface RecallMetricsEntry {
  workspaceId: string;
  strategy: Strategy;
  tookMs: number;
  cacheHit: boolean;
  topK: number;
  itemsRetrieved: number;
  timestamp: Date;
}

/**
 * Blended scoring weights
 */
export interface ScoringWeights {
  alpha: number; // similarity weight
  beta: number; // feedback weight
  gamma: number; // recency weight
  delta: number; // novelty weight
}

/**
 * Item with blended score components
 */
export interface ScoredItem {
  item: RecallItem;
  similarity: number;
  weight: number;
  recency: number;
  novelty: number;
  blendedScore: number;
}
