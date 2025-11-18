// src/lib/rag/rerank.ts
// Phase 58: Re-ranking with MMR and blended scoring

import { RecallItem, ScoringWeights } from './types';

/**
 * Default scoring weights for blended score calculation
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  alpha: 0.5, // similarity weight
  beta: 0.3, // feedback weight
  gamma: 0.15, // recency weight
  delta: 0.05, // novelty weight
};

/**
 * Calculate blended score from multiple signals
 * Combines similarity, feedback, recency, and novelty
 *
 * @param signals - Scoring signals
 * @param weights - Custom weights (optional)
 * @returns Blended score (0-1)
 */
export function blendedScore(
  signals: {
    similarity: number;
    weight: number;
    recency: number;
    novelty: number;
  },
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  return (
    weights.alpha * signals.similarity +
    weights.beta * signals.weight +
    weights.gamma * signals.recency +
    weights.delta * signals.novelty
  );
}

/**
 * Apply Maximal Marginal Relevance (MMR) for diversity
 * Reduces redundancy by penalizing similar items
 *
 * @param items - Recall items to re-rank
 * @param lambda - Trade-off between relevance and diversity (0-1, default: 0.65)
 * @param k - Number of items to return (default: 8)
 * @returns Re-ranked items with diversity
 */
export function applyMMR(
  items: RecallItem[],
  lambda = 0.65,
  k = 8
): RecallItem[] {
  if (items.length === 0) return [];

  const picked: RecallItem[] = [];
  const remaining = [...items];

  while (picked.length < Math.min(k, remaining.length)) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // Calculate maximum similarity to already picked items
      const maxSimilarity =
        picked.length > 0
          ? Math.max(...picked.map((p) => textSimilarity(p.text, candidate.text)))
          : 0;

      // MMR score = lambda * relevance - (1 - lambda) * similarity
      const mmrScore = lambda * candidate.score - (1 - lambda) * maxSimilarity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }

    // Pick best candidate and remove from remaining
    picked.push(remaining.splice(bestIndex, 1)[0]);
  }

  return picked;
}

/**
 * Calculate text similarity using simple TF-based cosine similarity
 * Lightweight approximation for MMR diversity calculation
 *
 * @param a - First text
 * @param b - Second text
 * @returns Similarity score (0-1)
 */
function textSimilarity(a: string, b: string): number {
  const termsA = buildTermFrequency(a);
  const termsB = buildTermFrequency(b);

  // Get all unique terms
  const allTerms = new Set([...Object.keys(termsA), ...Object.keys(termsB)]);

  // Calculate cosine similarity
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const term of allTerms) {
    const freqA = termsA[term] || 0;
    const freqB = termsB[term] || 0;

    dotProduct += freqA * freqB;
    normA += freqA * freqA;
    normB += freqB * freqB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator < 1e-9) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Build term frequency map from text
 */
function buildTermFrequency(text: string): Record<string, number> {
  const terms: Record<string, number> = {};

  // Tokenize and count
  text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .forEach((term) => {
      terms[term] = (terms[term] || 0) + 1;
    });

  return terms;
}

/**
 * Re-rank items with blended scoring and MMR
 * Combines Phase 57 feedback signals with diversity
 *
 * @param items - Initial recall items
 * @param options - Reranking options
 * @returns Re-ranked items
 */
export function rerank(
  items: RecallItem[],
  options: {
    useMMR?: boolean;
    mmrLambda?: number;
    topK?: number;
    weights?: ScoringWeights;
  } = {}
): RecallItem[] {
  const {
    useMMR = true,
    mmrLambda = 0.65,
    topK = 8,
    weights = DEFAULT_WEIGHTS,
  } = options;

  if (items.length === 0) return [];

  // 1) Calculate blended scores if metadata is available
  const scoredItems = items.map((item) => {
    // Extract signals from metadata (Phase 57 feedback)
    const feedbackWeight = (item.meta?.feedback_weight as number) || 0;
    const recency = calculateRecencyScore(item.meta?.last_used_at);
    const novelty = 1 - (item.meta?.use_count as number || 0) / 100; // Normalize to 0-1

    const blended = blendedScore(
      {
        similarity: item.score,
        weight: feedbackWeight,
        recency,
        novelty: Math.max(0, novelty),
      },
      weights
    );

    return {
      ...item,
      score: blended,
    };
  });

  // 2) Sort by blended score
  scoredItems.sort((a, b) => b.score - a.score);

  // 3) Apply MMR if enabled
  if (useMMR) {
    return applyMMR(scoredItems, mmrLambda, topK);
  }

  // 4) Return top K without MMR
  return scoredItems.slice(0, topK);
}

/**
 * Calculate recency score from timestamp
 * More recent items get higher scores
 *
 * @param timestamp - Last used timestamp
 * @returns Recency score (0-1)
 */
function calculateRecencyScore(timestamp: any): number {
  if (!timestamp) return 0;

  try {
    // Convert Firestore timestamp to Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const ageMs = now.getTime() - date.getTime();

    // Decay function: exponential decay with 7-day half-life
    const halfLifeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const recency = Math.exp(-ageMs / halfLifeMs);

    return Math.max(0, Math.min(1, recency));
  } catch (error) {
    return 0;
  }
}

/**
 * Re-rank with context awareness
 * Boosts items that are contextually relevant to the conversation
 */
export function rerankWithContext(
  items: RecallItem[],
  contextItems: string[],
  options: {
    contextBoost?: number;
    useMMR?: boolean;
    mmrLambda?: number;
    topK?: number;
  } = {}
): RecallItem[] {
  const { contextBoost = 1.2, ...rerankOptions } = options;

  // Calculate context similarity for each item
  const contextScored = items.map((item) => {
    let maxContextSim = 0;

    for (const contextItem of contextItems) {
      const sim = textSimilarity(item.text, contextItem);
      maxContextSim = Math.max(maxContextSim, sim);
    }

    // Boost score if contextually relevant
    const boostedScore = item.score * (1 + maxContextSim * (contextBoost - 1));

    return {
      ...item,
      score: boostedScore,
    };
  });

  // Apply standard reranking
  return rerank(contextScored, rerankOptions);
}
