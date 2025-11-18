import type { Citation } from "@/lib/types/context";
import type { RankedDoc } from "./ranker";

/**
 * Builds citations from ranked documents
 */
export function buildCitations(docs: RankedDoc[]): Citation[] {
  return docs.map((doc) => ({
    docId: doc.id,
    score: doc.score,
    snippet: doc.text.slice(0, 200), // First 200 chars as snippet
    url: doc.meta?.url as string | undefined,
    lines: doc.meta?.lines as string | undefined,
  }));
}

/**
 * Enriches a document with additional metadata
 * TODO: implement entity extraction, keyword extraction, etc.
 */
export async function enrichDocument(doc: RankedDoc): Promise<RankedDoc> {
  console.log(`[enricher] enriching doc ${doc.id}`);

  // Placeholder: add simple metadata
  const enriched: RankedDoc = {
    ...doc,
    meta: {
      ...doc.meta,
      enriched: true,
      wordCount: doc.text.split(/\s+/).length,
      timestamp: Date.now(),
    },
  };

  return enriched;
}

/**
 * Enriches multiple documents in batch
 */
export async function enrichDocuments(docs: RankedDoc[]): Promise<RankedDoc[]> {
  const enriched = await Promise.all(docs.map(enrichDocument));
  return enriched;
}
