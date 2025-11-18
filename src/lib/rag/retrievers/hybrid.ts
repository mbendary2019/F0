// src/lib/rag/retrievers/hybrid.ts
// Phase 58: Hybrid retriever using Reciprocal Rank Fusion (RRF)

import { RecallItem } from '../types';
import { denseRetrieve } from './dense';
import { sparseRetrieve } from './sparse';

/**
 * Hybrid retriever combining dense and sparse methods
 * Uses Reciprocal Rank Fusion (RRF) to merge results
 *
 * @param queryText - User query
 * @param workspaceId - Workspace ID
 * @param topK - Number of results to return (default: 12)
 * @returns Array of recall items sorted by RRF score
 */
export async function hybridRetrieve(
  queryText: string,
  workspaceId: string,
  topK = 12
): Promise<RecallItem[]> {
  // Fetch from both retrievers in parallel (over-fetch for better fusion)
  const [denseResults, sparseResults] = await Promise.all([
    denseRetrieve(queryText, workspaceId, topK * 2),
    sparseRetrieve(queryText, workspaceId, topK * 2),
  ]);

  // Apply Reciprocal Rank Fusion
  const K = 60; // RRF constant (typical value)
  const rrfScores = new Map<string, { item: RecallItem; score: number }>();

  // Add dense results to RRF
  denseResults.forEach((item, index) => {
    const rrfScore = 1 / (K + index + 1);
    rrfScores.set(item.id, { item, score: rrfScore });
  });

  // Add sparse results to RRF (accumulate scores for items appearing in both)
  sparseResults.forEach((item, index) => {
    const rrfScore = 1 / (K + index + 1);
    const existing = rrfScores.get(item.id);

    if (existing) {
      // Item appears in both - accumulate RRF scores
      existing.score += rrfScore;
    } else {
      // New item from sparse only
      rrfScores.set(item.id, { item, score: rrfScore });
    }
  });

  // Sort by combined RRF score and return top K
  const merged = Array.from(rrfScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ item, score }) => ({
      ...item,
      score, // Replace original score with RRF score
    }));

  return merged;
}

/**
 * Weighted hybrid retrieval
 * Allows custom weighting between dense and sparse methods
 *
 * @param queryText - User query
 * @param workspaceId - Workspace ID
 * @param topK - Number of results to return
 * @param denseWeight - Weight for dense results (0-1, default: 0.7)
 * @returns Array of recall items sorted by weighted score
 */
export async function hybridRetrieveWeighted(
  queryText: string,
  workspaceId: string,
  topK = 12,
  denseWeight = 0.7
): Promise<RecallItem[]> {
  const sparseWeight = 1 - denseWeight;

  // Fetch from both retrievers in parallel
  const [denseResults, sparseResults] = await Promise.all([
    denseRetrieve(queryText, workspaceId, topK * 2),
    sparseRetrieve(queryText, workspaceId, topK * 2),
  ]);

  // Normalize scores to 0-1 range
  const normalizedDense = normalizeScores(denseResults);
  const normalizedSparse = normalizeScores(sparseResults);

  // Combine with weights
  const combinedScores = new Map<string, { item: RecallItem; score: number }>();

  normalizedDense.forEach((item) => {
    combinedScores.set(item.id, {
      item,
      score: item.score * denseWeight,
    });
  });

  normalizedSparse.forEach((item) => {
    const existing = combinedScores.get(item.id);
    if (existing) {
      existing.score += item.score * sparseWeight;
    } else {
      combinedScores.set(item.id, {
        item,
        score: item.score * sparseWeight,
      });
    }
  });

  // Sort by combined score and return top K
  return Array.from(combinedScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ item, score }) => ({
      ...item,
      score,
    }));
}

/**
 * Normalize scores to 0-1 range using min-max normalization
 */
function normalizeScores(items: RecallItem[]): RecallItem[] {
  if (items.length === 0) return [];

  const scores = items.map((item) => item.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore;

  // Avoid division by zero
  if (range < 1e-9) {
    return items.map((item) => ({ ...item, score: 1.0 }));
  }

  return items.map((item) => ({
    ...item,
    score: (item.score - minScore) / range,
  }));
}

/**
 * Hybrid retrieve with adaptive weighting based on query type
 * Automatically adjusts dense/sparse balance based on query characteristics
 */
export async function hybridRetrieveAdaptive(
  queryText: string,
  workspaceId: string,
  topK = 12
): Promise<RecallItem[]> {
  // Analyze query to determine optimal weights
  const queryLength = queryText.split(/\s+/).length;
  const hasQuotes = /"[^"]+"/.test(queryText);
  const hasCode = /```|function|class|const|import/.test(queryText);

  let denseWeight = 0.7; // Default: favor semantic search

  // Adjust weights based on query characteristics
  if (hasQuotes) {
    // Quoted searches need exact matching
    denseWeight = 0.3;
  } else if (hasCode) {
    // Code queries benefit from balanced approach
    denseWeight = 0.5;
  } else if (queryLength <= 3) {
    // Short queries need lexical boost
    denseWeight = 0.5;
  } else if (queryLength > 10) {
    // Long natural language queries favor semantic
    denseWeight = 0.8;
  }

  return hybridRetrieveWeighted(queryText, workspaceId, topK, denseWeight);
}
