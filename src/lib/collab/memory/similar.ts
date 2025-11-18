/**
 * Phase 56 Day 3 - Similar Memories & Smart Hints
 * Find similar memories using semantic search
 */

import { searchMemories, type SearchResult } from './search';

export type SimilarOptions = {
  roomId?: string;
  sessionId?: string;
  topK?: number;
  excludeId?: string;
};

/**
 * Find similar memories to a given text
 * Uses semantic search with lower keyword boost for better semantic matching
 */
export async function findSimilar(
  memoryText: string,
  opts: SimilarOptions = {}
): Promise<SearchResult[]> {
  const items = await searchMemories({
    query: memoryText.slice(0, 2000), // Limit query size
    roomId: opts.roomId,
    sessionId: opts.sessionId,
    topK: opts.topK ?? 5,
    hybridBoost: 0.15, // Lower boost = more semantic, less keyword
  });

  // Exclude the source memory if ID is provided
  if (opts.excludeId) {
    return items.filter((item) => item.id !== opts.excludeId);
  }

  return items;
}

/**
 * Get smart hints: similar memories for a new summary
 * Useful for suggesting related context to users
 */
export async function getSmartHints(
  summaryText: string,
  roomId: string,
  opts: { topK?: number; minScore?: number } = {}
): Promise<SearchResult[]> {
  const results = await findSimilar(summaryText, {
    roomId,
    topK: opts.topK ?? 3,
  });

  // Filter by minimum score if specified
  if (opts.minScore !== undefined) {
    return results.filter((r) => r.score >= opts.minScore);
  }

  return results;
}
