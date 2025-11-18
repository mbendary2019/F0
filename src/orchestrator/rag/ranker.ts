import type { RawDoc } from "./retriever";

export type RankedDoc = RawDoc & { score: number };

/**
 * Ranks documents by relevance to the query
 * TODO: implement proper scoring (BM25, semantic similarity, etc.)
 */
export async function rank(docs: RawDoc[], query: string): Promise<RankedDoc[]> {
  console.log(`[ranker] ranking ${docs.length} docs for query="${query}"`);

  // Placeholder: simple keyword matching score
  const scored = docs.map((doc) => {
    const queryLower = query.toLowerCase();
    const textLower = doc.text.toLowerCase();

    // Simple scoring: count query word matches
    const queryWords = queryLower.split(/\s+/);
    let score = 0;

    for (const word of queryWords) {
      if (textLower.includes(word)) {
        score += 1;
      }
    }

    // Normalize by query length
    score = score / Math.max(queryWords.length, 1);

    return { ...doc, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored;
}
