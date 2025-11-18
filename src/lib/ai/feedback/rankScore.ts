// src/lib/ai/feedback/rankScore.ts
// Blended ranking formula: similarity + weight + recency

import type { ClusterDoc } from "../memory/firestoreSchema";
import type { WeightingParams, WeightedCluster } from "./feedbackSchema";
import { DEFAULT_WEIGHTING_PARAMS } from "./feedbackSchema";
import { computeRecencyScore, clamp } from "./computeRewards";

// === Types ===

export type RankingInput = {
  cluster: ClusterDoc;
  similarity: number; // Cosine similarity to query [0, 1]
  queryTimestamp?: number; // Optional timestamp for recency computation
};

export type RankedCluster = {
  cluster: ClusterDoc;
  similarity: number;
  weight: number;
  recency_score: number;
  blended_score: number;
};

// === Main Ranking Function ===

/**
 * Compute blended ranking score for a cluster
 *
 * Formula: score = α·similarity + β·weight + γ·recency
 * Where α + β + γ = 1
 *
 * @param input - Cluster with similarity score
 * @param params - Weighting parameters (blend coefficients)
 * @returns Blended score in [0, 1]
 *
 * @example
 * ```typescript
 * const score = computeBlendedScore({
 *   cluster: myCluster,
 *   similarity: 0.85,
 *   queryTimestamp: Date.now()
 * }, {
 *   blendSimilarity: 0.5,
 *   blendWeight: 0.3,
 *   blendRecency: 0.2,
 *   decayHalfLifeDays: 21
 * });
 * ```
 */
export function computeBlendedScore(
  input: RankingInput,
  params: Partial<WeightingParams> = {}
): number {
  const fullParams = { ...DEFAULT_WEIGHTING_PARAMS, ...params };
  const { cluster, similarity, queryTimestamp } = input;

  // Extract weight (default: 0.0 if no feedback)
  const weight = cluster.weight || 0.0;

  // Compute recency score
  const lastUpdated =
    cluster.last_updated &&
    typeof cluster.last_updated === "object" &&
    "toDate" in cluster.last_updated
      ? cluster.last_updated.toDate().getTime()
      : queryTimestamp || Date.now();

  const recencyScore = computeRecencyScore(
    lastUpdated,
    fullParams.decayHalfLifeDays
  );

  // Normalize weight from [-1, 1] to [0, 1] for blending
  const normalizedWeight = (weight + 1) / 2;

  // Compute blended score
  const blended =
    fullParams.blendSimilarity * similarity +
    fullParams.blendWeight * normalizedWeight +
    fullParams.blendRecency * recencyScore;

  // Clamp to [0, 1]
  return clamp(blended, 0.0, 1.0);
}

/**
 * Rank and sort clusters by blended score
 *
 * @param inputs - Array of clusters with similarity scores
 * @param params - Weighting parameters
 * @returns Sorted array of ranked clusters
 *
 * @example
 * ```typescript
 * const ranked = rankClusters([
 *   { cluster: c1, similarity: 0.9 },
 *   { cluster: c2, similarity: 0.8 },
 *   { cluster: c3, similarity: 0.7 }
 * ], {
 *   blendSimilarity: 0.5,
 *   blendWeight: 0.3,
 *   blendRecency: 0.2
 * });
 *
 * // ranked[0] has highest blended_score
 * ```
 */
export function rankClusters(
  inputs: RankingInput[],
  params: Partial<WeightingParams> = {}
): RankedCluster[] {
  const fullParams = { ...DEFAULT_WEIGHTING_PARAMS, ...params };

  // Compute blended scores
  const ranked: RankedCluster[] = inputs.map((input) => {
    const { cluster, similarity, queryTimestamp } = input;
    const weight = cluster.weight || 0.0;

    const lastUpdated =
      cluster.last_updated &&
      typeof cluster.last_updated === "object" &&
      "toDate" in cluster.last_updated
        ? cluster.last_updated.toDate().getTime()
        : queryTimestamp || Date.now();

    const recencyScore = computeRecencyScore(
      lastUpdated,
      fullParams.decayHalfLifeDays
    );

    const normalizedWeight = (weight + 1) / 2;

    const blendedScore =
      fullParams.blendSimilarity * similarity +
      fullParams.blendWeight * normalizedWeight +
      fullParams.blendRecency * recencyScore;

    return {
      cluster,
      similarity,
      weight,
      recency_score: recencyScore,
      blended_score: clamp(blendedScore, 0.0, 1.0),
    };
  });

  // Sort by blended score (descending)
  ranked.sort((a, b) => b.blended_score - a.blended_score);

  return ranked;
}

/**
 * Rank clusters and return top K
 *
 * @param inputs - Array of clusters with similarity scores
 * @param topK - Number of top results to return
 * @param params - Weighting parameters
 * @returns Top K ranked clusters
 */
export function rankTopK(
  inputs: RankingInput[],
  topK: number,
  params: Partial<WeightingParams> = {}
): RankedCluster[] {
  const ranked = rankClusters(inputs, params);
  return ranked.slice(0, topK);
}

/**
 * Filter clusters by minimum blended score
 *
 * @param ranked - Array of ranked clusters
 * @param minScore - Minimum blended score threshold [0, 1]
 * @returns Filtered clusters
 */
export function filterByMinScore(
  ranked: RankedCluster[],
  minScore: number
): RankedCluster[] {
  return ranked.filter((r) => r.blended_score >= minScore);
}

/**
 * Re-rank clusters using different parameters
 * Useful for A/B testing or experimentation
 *
 * @param ranked - Previously ranked clusters
 * @param newParams - New weighting parameters
 * @returns Re-ranked clusters
 */
export function rerank(
  ranked: RankedCluster[],
  newParams: Partial<WeightingParams>
): RankedCluster[] {
  const inputs: RankingInput[] = ranked.map((r) => ({
    cluster: r.cluster,
    similarity: r.similarity,
  }));

  return rankClusters(inputs, newParams);
}

// === Score Decomposition & Analysis ===

/**
 * Decompose blended score into components
 * Useful for debugging and understanding ranking
 *
 * @param input - Cluster with similarity score
 * @param params - Weighting parameters
 * @returns Score components
 */
export function decomposeScore(
  input: RankingInput,
  params: Partial<WeightingParams> = {}
): {
  similarity: number;
  weight: number;
  recency_score: number;
  similarity_contribution: number;
  weight_contribution: number;
  recency_contribution: number;
  blended_score: number;
} {
  const fullParams = { ...DEFAULT_WEIGHTING_PARAMS, ...params };
  const { cluster, similarity, queryTimestamp } = input;

  const weight = cluster.weight || 0.0;

  const lastUpdated =
    cluster.last_updated &&
    typeof cluster.last_updated === "object" &&
    "toDate" in cluster.last_updated
      ? cluster.last_updated.toDate().getTime()
      : queryTimestamp || Date.now();

  const recencyScore = computeRecencyScore(
    lastUpdated,
    fullParams.decayHalfLifeDays
  );

  const normalizedWeight = (weight + 1) / 2;

  const similarityContribution = fullParams.blendSimilarity * similarity;
  const weightContribution = fullParams.blendWeight * normalizedWeight;
  const recencyContribution = fullParams.blendRecency * recencyScore;

  const blendedScore = clamp(
    similarityContribution + weightContribution + recencyContribution,
    0.0,
    1.0
  );

  return {
    similarity,
    weight,
    recency_score: recencyScore,
    similarity_contribution: similarityContribution,
    weight_contribution: weightContribution,
    recency_contribution: recencyContribution,
    blended_score: blendedScore,
  };
}

/**
 * Explain ranking for a cluster (human-readable)
 *
 * @param input - Cluster with similarity score
 * @param params - Weighting parameters
 * @returns Human-readable explanation
 */
export function explainRanking(
  input: RankingInput,
  params: Partial<WeightingParams> = {}
): string {
  const decomposed = decomposeScore(input, params);
  const { cluster } = input;

  const lines = [
    `Cluster: ${cluster.title || cluster.cluster_id}`,
    `Blended Score: ${(decomposed.blended_score * 100).toFixed(1)}%`,
    ``,
    `Components:`,
    `  Similarity: ${(decomposed.similarity * 100).toFixed(1)}% → ${(decomposed.similarity_contribution * 100).toFixed(1)}%`,
    `  Weight: ${(decomposed.weight * 100).toFixed(1)}% → ${(decomposed.weight_contribution * 100).toFixed(1)}%`,
    `  Recency: ${(decomposed.recency_score * 100).toFixed(1)}% → ${(decomposed.recency_contribution * 100).toFixed(1)}%`,
  ];

  return lines.join("\n");
}

/**
 * Compare two ranking parameter sets side-by-side
 *
 * @param input - Cluster with similarity score
 * @param paramsA - First parameter set
 * @param paramsB - Second parameter set
 * @returns Comparison object
 */
export function compareRankings(
  input: RankingInput,
  paramsA: Partial<WeightingParams>,
  paramsB: Partial<WeightingParams>
): {
  scoreA: number;
  scoreB: number;
  diff: number;
  percentDiff: number;
  decomposedA: ReturnType<typeof decomposeScore>;
  decomposedB: ReturnType<typeof decomposeScore>;
} {
  const decomposedA = decomposeScore(input, paramsA);
  const decomposedB = decomposeScore(input, paramsB);

  const scoreA = decomposedA.blended_score;
  const scoreB = decomposedB.blended_score;
  const diff = scoreB - scoreA;
  const percentDiff = scoreA > 0 ? (diff / scoreA) * 100 : 0;

  return {
    scoreA,
    scoreB,
    diff,
    percentDiff,
    decomposedA,
    decomposedB,
  };
}

// === Batch Ranking Utilities ===

/**
 * Rank clusters with multiple parameter sets and compare
 * Useful for A/B testing
 *
 * @param inputs - Array of clusters with similarity scores
 * @param paramsSets - Array of parameter sets to compare
 * @returns Rankings for each parameter set
 */
export function rankWithMultipleParams(
  inputs: RankingInput[],
  paramsSets: Array<{ name: string; params: Partial<WeightingParams> }>
): Array<{ name: string; ranked: RankedCluster[] }> {
  return paramsSets.map(({ name, params }) => ({
    name,
    ranked: rankClusters(inputs, params),
  }));
}

/**
 * Find optimal blend coefficients using grid search
 * Requires ground truth relevance scores for evaluation
 *
 * @param inputs - Array of clusters with similarity scores
 * @param groundTruth - Ground truth relevance scores [0, 1]
 * @param gridSteps - Number of steps for each coefficient (default: 5)
 * @returns Best parameters with evaluation metric
 */
export function optimizeBlendCoeffs(
  inputs: RankingInput[],
  groundTruth: number[],
  gridSteps: number = 5
): {
  bestParams: WeightingParams;
  bestScore: number;
  allResults: Array<{ params: WeightingParams; score: number }>;
} {
  if (inputs.length !== groundTruth.length) {
    throw new Error("inputs and groundTruth must have same length");
  }

  const stepSize = 1 / gridSteps;
  const allResults: Array<{ params: WeightingParams; score: number }> = [];

  let bestParams = DEFAULT_WEIGHTING_PARAMS;
  let bestScore = -Infinity;

  // Grid search over blend coefficients
  for (let i = 0; i <= gridSteps; i++) {
    for (let j = 0; j <= gridSteps - i; j++) {
      const alpha = i * stepSize;
      const beta = j * stepSize;
      const gamma = 1 - alpha - beta;

      if (gamma < 0 || gamma > 1) continue;

      const params: WeightingParams = {
        ...DEFAULT_WEIGHTING_PARAMS,
        blendSimilarity: alpha,
        blendWeight: beta,
        blendRecency: gamma,
      };

      // Compute scores with these parameters
      const ranked = rankClusters(inputs, params);
      const predictedScores = ranked.map((r) => r.blended_score);

      // Evaluate using Mean Squared Error (MSE)
      const mse =
        predictedScores.reduce(
          (sum, pred, idx) => sum + Math.pow(pred - groundTruth[idx], 2),
          0
        ) / predictedScores.length;

      // Lower MSE is better, so negate for maximization
      const score = -mse;

      allResults.push({ params, score });

      if (score > bestScore) {
        bestScore = score;
        bestParams = params;
      }
    }
  }

  return { bestParams, bestScore, allResults };
}
