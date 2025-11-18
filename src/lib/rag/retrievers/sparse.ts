// src/lib/rag/retrievers/sparse.ts
// Phase 58: Sparse retriever using BM25 for keyword-based search

import { RecallItem } from '../types';
import {
  getFirestore,
  query,
  collectionGroup,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
} from 'firebase/firestore';

/**
 * Sparse retriever using BM25 algorithm
 * Best for exact keyword matching and quoted searches
 *
 * @param queryText - User query
 * @param workspaceId - Workspace ID
 * @param topK - Number of results to return (default: 12)
 * @returns Array of recall items sorted by BM25 score
 */
export async function sparseRetrieve(
  queryText: string,
  workspaceId: string,
  topK = 12
): Promise<RecallItem[]> {
  const db = getFirestore();

  // Fetch more candidates for BM25 scoring (we need corpus for IDF calculation)
  const baseQuery = query(
    collectionGroup(db, 'ops_memory_snippets'),
    where('workspaceId', '==', workspaceId),
    orderBy('last_used_at', 'desc'),
    firestoreLimit(400) // Larger pool for better BM25 statistics
  );

  const snap = await getDocs(baseQuery);

  const docs: Array<{
    id: string;
    text: string;
    meta?: Record<string, any>;
  }> = [];

  snap.forEach((doc) => {
    const data = doc.data();
    docs.push({
      id: doc.id,
      text: (data.text || '') as string,
      meta: {
        last_used_at: data.last_used_at,
        use_count: data.use_count,
        workspace_id: data.workspaceId,
      },
    });
  });

  if (docs.length === 0) {
    return [];
  }

  // Calculate BM25 scores
  const corpus = docs.map((d) => d.text);
  const scores = bm25(queryText, corpus);

  // Sort by score and return top K
  const scored = scores
    .map((score, index) => ({ index, score }))
    .sort((a, b) => b.score - a.score);

  const topResults = scored.slice(0, topK).map(({ index, score }) => ({
    id: docs[index].id,
    source: 'memory' as const,
    text: docs[index].text,
    score,
    meta: docs[index].meta,
  }));

  return topResults;
}

/**
 * BM25 scoring algorithm
 * Optimized for keyword matching with TF-IDF weighting
 *
 * @param query - Query text
 * @param corpus - Array of document texts
 * @param k1 - Term frequency saturation parameter (default: 1.2)
 * @param b - Length normalization parameter (default: 0.75)
 * @returns Array of BM25 scores for each document
 */
function bm25(
  query: string,
  corpus: string[],
  k1 = 1.2,
  b = 0.75
): number[] {
  // Tokenize query and corpus
  const queryTokens = tokenize(query);
  const corpusTokens = corpus.map((doc) => tokenize(doc));

  const N = corpus.length;
  if (N === 0) return [];

  // Calculate average document length
  const avgDocLength =
    corpusTokens.reduce((sum, tokens) => sum + tokens.length, 0) / N;

  // Build document frequency map (how many docs contain each term)
  const documentFrequency = new Map<string, number>();
  for (const docTokens of corpusTokens) {
    const uniqueTokens = new Set(docTokens);
    uniqueTokens.forEach((token) => {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    });
  }

  // Calculate IDF for each term
  const idf = (term: string): number => {
    const df = documentFrequency.get(term) || 0;
    // BM25 IDF formula
    return Math.log((N - df + 0.5) / (df + 0.5) + 1);
  };

  // Score each document
  const scores = corpusTokens.map((docTokens) => {
    const docLength = docTokens.length;

    // Build term frequency map for this document
    const termFrequency = new Map<string, number>();
    for (const token of docTokens) {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    }

    // Calculate BM25 score
    let score = 0;
    for (const queryToken of queryTokens) {
      const tf = termFrequency.get(queryToken) || 0;
      const termIdf = idf(queryToken);

      // BM25 formula
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
      score += termIdf * (numerator / denominator);
    }

    return score;
  });

  return scores;
}

/**
 * Tokenize text into normalized terms
 * - Lowercase
 * - Remove punctuation
 * - Split on whitespace
 * - Filter empty tokens
 *
 * @param text - Text to tokenize
 * @returns Array of tokens
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Keep letters and numbers
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Sparse retrieve with exact phrase matching boost
 * Gives higher scores to documents containing exact phrases from the query
 */
export async function sparseRetrieveWithPhraseBoost(
  queryText: string,
  workspaceId: string,
  topK = 12,
  phraseBoost = 1.5
): Promise<RecallItem[]> {
  const results = await sparseRetrieve(queryText, workspaceId, topK * 2);

  // Extract quoted phrases from query
  const phrases = queryText.match(/"([^"]+)"/g)?.map((p) => p.replace(/"/g, '')) || [];

  if (phrases.length === 0) {
    return results.slice(0, topK);
  }

  // Boost scores for documents containing exact phrases
  const boosted = results.map((item) => {
    let boost = 1.0;
    for (const phrase of phrases) {
      if (item.text.toLowerCase().includes(phrase.toLowerCase())) {
        boost *= phraseBoost;
      }
    }
    return {
      ...item,
      score: item.score * boost,
    };
  });

  // Re-sort and return top K
  boosted.sort((a, b) => b.score - a.score);
  return boosted.slice(0, topK);
}
