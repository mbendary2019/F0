// orchestrator/core/neuralMemory/neuralRetriever.ts
// =============================================================================
// Phase 166.3 – Neural Retriever
// Semantic search across Code + Media + Project Docs + Tests + Chat
// =============================================================================

import {
  NeuralMemoryItem,
  NeuralSourceType,
  NeuralSearchFilter,
  NeuralSearchRequest,
  NeuralSearchResponse,
  NeuralSearchResultItem,
  NeuralIndexStats,
} from './types';

import {
  getDefaultEmbeddingProvider,
  getEmbeddingIndexAdapter,
} from './embeddingProvider';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TOP_K = 10;
const DEFAULT_MIN_SCORE = 0.3;
const MAX_RESULTS = 50;

// =============================================================================
// Main Neural Search Function
// =============================================================================

/**
 * Search the neural memory index
 */
export async function neuralSearch(
  request: NeuralSearchRequest,
): Promise<NeuralSearchResponse> {
  const startTime = Date.now();
  console.log('[166.3][RETRIEVER] Neural search:', request.query, 'in project:', request.projectId);

  const provider = getDefaultEmbeddingProvider();

  // Generate query embedding
  const [queryEmbedding] = await provider.embedTexts([request.query]);

  // Build filter
  const filter: Partial<NeuralSearchFilter> = {
    ...request.filters,
    minScore: request.filters?.minScore ?? DEFAULT_MIN_SCORE,
  };

  // Search
  const topK = Math.min(request.topK ?? DEFAULT_TOP_K, MAX_RESULTS);
  const results = await provider.search(request.projectId, queryEmbedding, topK, filter);

  // Add match reason to results
  const enhancedResults = results.map(r => ({
    ...r,
    matchReason: generateMatchReason(request.query, r.item),
  }));

  const searchTimeMs = Date.now() - startTime;

  console.log(
    '[166.3][RETRIEVER] Search complete:',
    enhancedResults.length,
    'results in',
    searchTimeMs,
    'ms',
  );

  return {
    query: request.query,
    results: enhancedResults,
    totalFound: enhancedResults.length,
    searchTimeMs,
  };
}

/**
 * Generate a human-readable match reason
 */
function generateMatchReason(query: string, item: NeuralMemoryItem): string {
  const queryWords = query.toLowerCase().split(/\s+/);
  const titleWords = item.title.toLowerCase().split(/\s+/);
  const snippetWords = item.snippet.toLowerCase().split(/\s+/);

  const matchedInTitle = queryWords.filter(w => titleWords.some(tw => tw.includes(w)));
  const matchedInSnippet = queryWords.filter(w => snippetWords.some(sw => sw.includes(w)));
  const matchedTags = queryWords.filter(w => item.tags.some(t => t.toLowerCase().includes(w)));

  const reasons: string[] = [];

  if (matchedInTitle.length > 0) {
    reasons.push(`title contains "${matchedInTitle.join(', ')}"`);
  }
  if (matchedInSnippet.length > 0) {
    reasons.push(`content matches "${matchedInSnippet.slice(0, 3).join(', ')}"`);
  }
  if (matchedTags.length > 0) {
    reasons.push(`tagged with ${matchedTags.join(', ')}`);
  }
  if (item.sourceType === 'code' && item.language) {
    reasons.push(`${item.language} code`);
  }

  return reasons.length > 0 ? reasons.join('; ') : 'semantic similarity';
}

// =============================================================================
// Specialized Search Functions
// =============================================================================

/**
 * Search only code files
 */
export async function searchCode(
  projectId: string,
  query: string,
  options: {
    language?: string;
    topK?: number;
    minScore?: number;
  } = {},
): Promise<NeuralSearchResultItem[]> {
  console.log('[166.3][RETRIEVER] Search code:', query);

  const result = await neuralSearch({
    projectId,
    query,
    topK: options.topK ?? 10,
    filters: {
      sourceTypes: ['code'],
      language: options.language,
      minScore: options.minScore ?? 0.25,
    },
  });

  return result.results;
}

/**
 * Search only media memory
 */
export async function searchMedia(
  projectId: string,
  query: string,
  options: {
    topK?: number;
    minScore?: number;
    tags?: string[];
  } = {},
): Promise<NeuralSearchResultItem[]> {
  console.log('[166.3][RETRIEVER] Search media:', query);

  const result = await neuralSearch({
    projectId,
    query,
    topK: options.topK ?? 10,
    filters: {
      sourceTypes: ['media'],
      tags: options.tags,
      minScore: options.minScore ?? 0.3,
    },
  });

  return result.results;
}

/**
 * Search project documentation
 */
export async function searchDocs(
  projectId: string,
  query: string,
  options: {
    topK?: number;
    minScore?: number;
  } = {},
): Promise<NeuralSearchResultItem[]> {
  console.log('[166.3][RETRIEVER] Search docs:', query);

  const result = await neuralSearch({
    projectId,
    query,
    topK: options.topK ?? 5,
    filters: {
      sourceTypes: ['project_doc'],
      minScore: options.minScore ?? 0.25,
    },
  });

  return result.results;
}

/**
 * Search tests
 */
export async function searchTests(
  projectId: string,
  query: string,
  options: {
    topK?: number;
    minScore?: number;
  } = {},
): Promise<NeuralSearchResultItem[]> {
  console.log('[166.3][RETRIEVER] Search tests:', query);

  const result = await neuralSearch({
    projectId,
    query,
    topK: options.topK ?? 5,
    filters: {
      sourceTypes: ['test'],
      minScore: options.minScore ?? 0.25,
    },
  });

  return result.results;
}

/**
 * Search chat history
 */
export async function searchChat(
  projectId: string,
  query: string,
  options: {
    topK?: number;
    minScore?: number;
    chatId?: string;
  } = {},
): Promise<NeuralSearchResultItem[]> {
  console.log('[166.3][RETRIEVER] Search chat:', query);

  const result = await neuralSearch({
    projectId,
    query,
    topK: options.topK ?? 10,
    filters: {
      sourceTypes: ['chat'],
      minScore: options.minScore ?? 0.3,
    },
  });

  return result.results;
}

/**
 * Search run logs (execution logs)
 */
export async function searchRunLogs(
  projectId: string,
  query: string,
  options: {
    topK?: number;
    minScore?: number;
  } = {},
): Promise<NeuralSearchResultItem[]> {
  console.log('[166.3][RETRIEVER] Search run logs:', query);

  const result = await neuralSearch({
    projectId,
    query,
    topK: options.topK ?? 5,
    filters: {
      sourceTypes: ['run_log'],
      minScore: options.minScore ?? 0.25,
    },
  });

  return result.results;
}

// =============================================================================
// Multi-Source Search
// =============================================================================

/**
 * Search across multiple source types with weighted results
 */
export async function multiSourceSearch(
  projectId: string,
  query: string,
  options: {
    sourceWeights?: Partial<Record<NeuralSourceType, number>>;
    topK?: number;
    minScore?: number;
  } = {},
): Promise<NeuralSearchResultItem[]> {
  console.log('[166.3][RETRIEVER] Multi-source search:', query);

  const defaultWeights: Record<NeuralSourceType, number> = {
    code: 1.0,
    project_doc: 0.9,
    media: 0.8,
    test: 0.7,
    chat: 0.6,
    run_log: 0.5,
  };

  const weights = { ...defaultWeights, ...options.sourceWeights };

  // Search all sources
  const result = await neuralSearch({
    projectId,
    query,
    topK: (options.topK ?? 10) * 2, // Get more to allow for weighting
    filters: {
      minScore: options.minScore ?? 0.2,
    },
  });

  // Apply source-type weights
  const weightedResults = result.results.map(r => ({
    ...r,
    score: r.score * (weights[r.item.sourceType] ?? 1.0),
  }));

  // Re-sort by weighted score
  weightedResults.sort((a, b) => b.score - a.score);

  return weightedResults.slice(0, options.topK ?? 10);
}

// =============================================================================
// Find Similar Items
// =============================================================================

/**
 * Find items similar to a given item
 */
export async function findSimilar(
  item: NeuralMemoryItem,
  options: {
    topK?: number;
    minScore?: number;
    sameSourceTypeOnly?: boolean;
  } = {},
): Promise<NeuralSearchResultItem[]> {
  console.log('[166.3][RETRIEVER] Find similar to:', item.id);

  const provider = getDefaultEmbeddingProvider();

  // Use existing embedding or generate new one
  const queryEmbedding =
    item.embeddingVector || (await provider.embedTexts([item.snippet]))[0];

  const filter: Partial<NeuralSearchFilter> = {
    excludeIds: [item.id],
    minScore: options.minScore ?? 0.4,
  };

  if (options.sameSourceTypeOnly) {
    filter.sourceTypes = [item.sourceType];
  }

  const topK = options.topK ?? 5;
  const results = await provider.search(item.projectId, queryEmbedding, topK + 1, filter);

  // Filter out the original item
  return results.filter(r => r.item.id !== item.id).slice(0, topK);
}

/**
 * Find code similar to given content
 */
export async function findSimilarCode(
  projectId: string,
  codeContent: string,
  options: {
    topK?: number;
    minScore?: number;
    excludeFilePath?: string;
  } = {},
): Promise<NeuralSearchResultItem[]> {
  console.log('[166.3][RETRIEVER] Find similar code');

  const provider = getDefaultEmbeddingProvider();

  const [queryEmbedding] = await provider.embedTexts([codeContent]);

  const filter: Partial<NeuralSearchFilter> = {
    sourceTypes: ['code'],
    minScore: options.minScore ?? 0.5,
  };

  const results = await provider.search(
    projectId,
    queryEmbedding,
    (options.topK ?? 5) + 5,
    filter,
  );

  // Filter out items from excluded file
  let filteredResults = results;
  if (options.excludeFilePath) {
    filteredResults = results.filter(
      r => r.item.sourceRef.filePath !== options.excludeFilePath,
    );
  }

  return filteredResults.slice(0, options.topK ?? 5);
}

// =============================================================================
// Context Retrieval for Agents
// =============================================================================

/**
 * Get relevant context for a task
 * Used by PlannerAgent, CodeAgent, etc.
 */
export async function getContextForTask(
  projectId: string,
  taskDescription: string,
  options: {
    maxItems?: number;
    includeCode?: boolean;
    includeMedia?: boolean;
    includeDocs?: boolean;
    includeTests?: boolean;
    includeChat?: boolean;
  } = {},
): Promise<{
  items: NeuralSearchResultItem[];
  summary: string;
}> {
  console.log('[166.3][RETRIEVER] Get context for task:', taskDescription.slice(0, 50));

  const {
    maxItems = 10,
    includeCode = true,
    includeMedia = true,
    includeDocs = true,
    includeTests = false,
    includeChat = false,
  } = options;

  const sourceTypes: NeuralSourceType[] = [];
  if (includeCode) sourceTypes.push('code');
  if (includeMedia) sourceTypes.push('media');
  if (includeDocs) sourceTypes.push('project_doc');
  if (includeTests) sourceTypes.push('test');
  if (includeChat) sourceTypes.push('chat');

  const result = await neuralSearch({
    projectId,
    query: taskDescription,
    topK: maxItems,
    filters: {
      sourceTypes: sourceTypes.length > 0 ? sourceTypes : undefined,
      minScore: 0.25,
    },
  });

  // Generate summary
  const typeCounts: Record<string, number> = {};
  for (const r of result.results) {
    typeCounts[r.item.sourceType] = (typeCounts[r.item.sourceType] || 0) + 1;
  }

  const summaryParts = Object.entries(typeCounts).map(
    ([type, count]) => `${count} ${type}`,
  );
  const summary = `Found ${result.totalFound} relevant items: ${summaryParts.join(', ')}`;

  return {
    items: result.results,
    summary,
  };
}

/**
 * Get context for code generation
 */
export async function getContextForCodeGen(
  projectId: string,
  prompt: string,
  options: {
    filePath?: string;
    maxCodeItems?: number;
    maxMediaItems?: number;
    maxDocItems?: number;
  } = {},
): Promise<{
  codeContext: NeuralSearchResultItem[];
  mediaContext: NeuralSearchResultItem[];
  docContext: NeuralSearchResultItem[];
}> {
  console.log('[166.3][RETRIEVER] Get context for code gen');

  const {
    filePath,
    maxCodeItems = 5,
    maxMediaItems = 3,
    maxDocItems = 2,
  } = options;

  // Search in parallel
  const [codeResults, mediaResults, docResults] = await Promise.all([
    searchCode(projectId, prompt, { topK: maxCodeItems + 2 }),
    searchMedia(projectId, prompt, { topK: maxMediaItems + 2 }),
    searchDocs(projectId, prompt, { topK: maxDocItems + 2 }),
  ]);

  // Filter out current file from code context
  let codeContext = codeResults;
  if (filePath) {
    codeContext = codeResults.filter(
      r => r.item.sourceRef.filePath !== filePath,
    );
  }

  return {
    codeContext: codeContext.slice(0, maxCodeItems),
    mediaContext: mediaResults.slice(0, maxMediaItems),
    docContext: docResults.slice(0, maxDocItems),
  };
}

// =============================================================================
// Index Statistics
// =============================================================================

/**
 * Get statistics about the neural index for a project
 */
export async function getIndexStats(projectId: string): Promise<NeuralIndexStats> {
  console.log('[166.3][RETRIEVER] Get index stats for:', projectId);

  const adapter = getEmbeddingIndexAdapter();
  const items = await adapter.listItems(projectId, 1000);

  const bySourceType: Record<NeuralSourceType, number> = {
    code: 0,
    project_doc: 0,
    media: 0,
    test: 0,
    run_log: 0,
    chat: 0,
  };

  const byLanguage: Record<string, number> = {};

  let lastIndexedAt = 0;
  let lastQueryAt: number | undefined;

  for (const item of items) {
    bySourceType[item.sourceType]++;

    if (item.language) {
      byLanguage[item.language] = (byLanguage[item.language] || 0) + 1;
    }

    if (item.updatedAt > lastIndexedAt) {
      lastIndexedAt = item.updatedAt;
    }

    if (item.lastAccessedAt && (!lastQueryAt || item.lastAccessedAt > lastQueryAt)) {
      lastQueryAt = item.lastAccessedAt;
    }
  }

  return {
    projectId,
    totalItems: items.length,
    bySourceType,
    byLanguage,
    lastIndexedAt,
    lastQueryAt,
  };
}

/**
 * List all indexed items for a project
 */
export async function listIndexedItems(
  projectId: string,
  options: {
    sourceType?: NeuralSourceType;
    limit?: number;
  } = {},
): Promise<NeuralMemoryItem[]> {
  console.log('[166.3][RETRIEVER] List indexed items for:', projectId);

  const adapter = getEmbeddingIndexAdapter();
  const items = await adapter.listItems(projectId, options.limit ?? 100);

  if (options.sourceType) {
    return items.filter(i => i.sourceType === options.sourceType);
  }

  return items;
}

/**
 * Get a specific item by ID
 */
export async function getItem(itemId: string): Promise<NeuralMemoryItem | null> {
  const adapter = getEmbeddingIndexAdapter();
  return adapter.getItem(itemId);
}

console.log('[166.3][NEURAL_MEMORY] Neural Retriever loaded');
