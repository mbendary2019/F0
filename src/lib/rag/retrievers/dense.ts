// src/lib/rag/retrievers/dense.ts
// Phase 58: Dense retriever using cached embeddings for semantic search

import { RecallItem } from '../types';
import { getManyOrEmbed } from '@/lib/ai/memory/snippetCache';
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
 * Dense retriever using semantic embeddings
 * Leverages Phase 57.2 snippet cache for efficient embedding generation
 *
 * @param queryText - User query
 * @param workspaceId - Workspace ID
 * @param topK - Number of results to return (default: 12)
 * @returns Array of recall items sorted by cosine similarity
 */
export async function denseRetrieve(
  queryText: string,
  workspaceId: string,
  topK = 12
): Promise<RecallItem[]> {
  const db = getFirestore();

  // 1) Fetch recent memory snippets as candidates (fast, recent data)
  // We over-fetch to have a good candidate pool
  const baseQuery = query(
    collectionGroup(db, 'ops_memory_snippets'),
    where('workspaceId', '==', workspaceId),
    orderBy('last_used_at', 'desc'),
    firestoreLimit(200)
  );

  const snap = await getDocs(baseQuery);

  const candidates: Array<{
    id: string;
    text: string;
    source: 'memory';
    meta?: Record<string, any>;
  }> = [];

  snap.forEach((doc) => {
    const data = doc.data();
    candidates.push({
      id: doc.id,
      text: (data.text || '') as string,
      source: 'memory',
      meta: {
        last_used_at: data.last_used_at,
        use_count: data.use_count,
        workspace_id: data.workspaceId,
      },
    });
  });

  if (candidates.length === 0) {
    return [];
  }

  // 2) Get embeddings with cache (batch operation)
  const texts = candidates.map((c) => c.text);
  const result = await getManyOrEmbed(texts);

  // Combine hits and misses to get all vectors
  const allEmbedded = [...result.hits, ...result.misses];
  const vectors = allEmbedded.map((item) => item.embedding);

  // 3) Compute query embedding
  const queryResult = await getManyOrEmbed([queryText]);
  const queryVector = queryResult.hits[0]?.embedding || queryResult.misses[0]?.embedding;

  if (!queryVector) {
    throw new Error('Failed to generate query embedding');
  }

  // 4) Calculate cosine similarity for each candidate
  const scored = vectors.map((vec, i) => ({
    index: i,
    similarity: cosineSimilarity(vec, queryVector),
  }));

  // 5) Sort by similarity (highest first) and take top K
  scored.sort((a, b) => b.similarity - a.similarity);

  const topResults = scored.slice(0, topK).map(({ index, similarity }) => ({
    id: candidates[index].id,
    source: candidates[index].source,
    text: candidates[index].text,
    score: similarity,
    meta: candidates[index].meta,
  }));

  return topResults;
}

/**
 * Compute cosine similarity between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score (0-1, higher is more similar)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  // Avoid division by zero
  if (denominator < 1e-9) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Dense retrieve with source filtering
 * Supports filtering by memory, docs, and ops
 */
export async function denseRetrieveWithSources(
  queryText: string,
  workspaceId: string,
  options: {
    topK?: number;
    allowMemory?: boolean;
    allowDocs?: boolean;
    allowOps?: boolean;
  } = {}
): Promise<RecallItem[]> {
  const { topK = 12, allowMemory = true } = options;

  // For now, we only support memory
  // TODO: Add docs and ops sources in future iterations
  // Future: allowDocs and allowOps will filter additional sources
  if (!allowMemory) {
    return [];
  }

  return denseRetrieve(queryText, workspaceId, topK);
}
