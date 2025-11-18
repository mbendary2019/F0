/**
 * Phase 56 Day 2 - Semantic Search SDK
 * Client SDK for searching memories
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export type SearchParams = {
  query: string;
  roomId?: string;
  sessionId?: string;
  topK?: number;
  hybridBoost?: number;
};

export type SearchResult = {
  id: string;
  roomId: string;
  sessionId: string;
  text: string;
  sim: number;      // cosine similarity
  score: number;    // hybrid score
  createdAt: any;
};

export type SearchResultSource = 'semantic' | 'hybrid' | 'keyword';

/**
 * Determine the source/type of a search result based on scores
 */
export function getResultSource(result: SearchResult): SearchResultSource {
  const { sim, score } = result;

  // High similarity, low score difference = mainly semantic
  if (sim > 0.7 && Math.abs(sim - score) < 0.1) {
    return 'semantic';
  }

  // Score significantly higher than similarity = keyword boost helped
  if (score - sim > 0.2) {
    return 'keyword';
  }

  // Mix of both
  return 'hybrid';
}

/**
 * Get badge styling for result source
 */
export function getSourceBadge(source: SearchResultSource): {
  label: string;
  className: string;
} {
  switch (source) {
    case 'semantic':
      return {
        label: 'Semantic',
        className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      };
    case 'keyword':
      return {
        label: 'Keyword',
        className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      };
    case 'hybrid':
      return {
        label: 'Hybrid',
        className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      };
  }
}

// In-memory cache for search results
const searchCache = new Map<string, SearchResult[]>();

// Abort controller for canceling previous requests
let lastController: AbortController | null = null;

/**
 * Search memories using semantic + hybrid search
 * @param params Search parameters
 * @returns Array of search results sorted by relevance
 */
export async function searchMemories(params: SearchParams): Promise<SearchResult[]> {
  try {
    const fn = httpsCallable(functions, 'searchMemories');
    const res = await fn(params as any);
    return ((res.data as any).items || []) as SearchResult[];
  } catch (error: any) {
    console.error('[searchMemories] Error:', error);
    throw new Error(error.message || 'Search failed');
  }
}

/**
 * Search with caching - reduces redundant API calls
 */
export async function searchWithCache(params: SearchParams): Promise<SearchResult[]> {
  const cacheKey = JSON.stringify(params);

  if (searchCache.has(cacheKey)) {
    console.log('[searchWithCache] Cache hit');
    return searchCache.get(cacheKey)!;
  }

  const results = await searchMemories(params);
  searchCache.set(cacheKey, results);

  // Clear old cache entries after 100 items
  if (searchCache.size > 100) {
    const firstKey = searchCache.keys().next().value;
    searchCache.delete(firstKey);
  }

  return results;
}

/**
 * Search with debounce and abort controller - optimized for real-time search
 */
export async function searchMemoriesDebounced(
  params: SearchParams,
  debounceMs: number = 300
): Promise<SearchResult[]> {
  // Cancel previous request
  if (lastController) {
    lastController.abort();
  }
  lastController = new AbortController();

  // Debounce
  await new Promise((resolve) => setTimeout(resolve, debounceMs));

  // Check if aborted during debounce
  if (lastController.signal.aborted) {
    throw new Error('Search aborted');
  }

  return searchMemories(params);
}
