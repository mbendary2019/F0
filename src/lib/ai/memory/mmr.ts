// src/lib/ai/memory/mmr.ts
// Maximal Marginal Relevance (MMR) selection for diverse, relevant snippets
// MMR balances relevance to query with diversity from already-selected items

export type Vec = number[];

export type SnippetVec = {
  id: string;
  text: string;
  vec: Vec;
  scoreQ?: number; // Precomputed similarity to query
  metadata?: Record<string, unknown>;
};

export type MMRParams = {
  lambda?: number; // Relevance vs diversity tradeoff [0..1] (default: 0.6)
  // lambda=1: pure relevance, lambda=0: pure diversity
  k?: number; // Number of snippets to select (default: 6)
  minRelevance?: number; // Minimum similarity to query (default: 0.0)
  diversityPenalty?: number; // Extra penalty for similar items (default: 0.0)
};

const DEFAULT_PARAMS: Required<MMRParams> = {
  lambda: 0.6,
  k: 6,
  minRelevance: 0.0,
  diversityPenalty: 0.0,
};

/**
 * Maximal Marginal Relevance (MMR) algorithm
 *
 * Selects k snippets that maximize:
 * MMR = λ × Sim(snippet, query) - (1-λ) × max(Sim(snippet, selected))
 *
 * @param query - Query embedding vector
 * @param pool - Pool of candidate snippets with embeddings
 * @param params - MMR parameters
 * @returns Selected snippets ordered by MMR score
 *
 * @example
 * ```typescript
 * const selected = mmr(queryVec, snippetsWithVecs, {
 *   lambda: 0.6,  // 60% relevance, 40% diversity
 *   k: 6,         // Select 6 snippets
 *   minRelevance: 0.3  // Filter out low-relevance items
 * });
 * ```
 */
export function mmr(
  query: Vec,
  pool: SnippetVec[],
  params: MMRParams = {}
): SnippetVec[] {
  const opt = { ...DEFAULT_PARAMS, ...params };

  if (!pool.length) return [];
  if (pool.length <= opt.k) return [...pool];

  // Precompute similarity to query for all snippets
  for (const snippet of pool) {
    if (snippet.scoreQ === undefined) {
      snippet.scoreQ = cosine(query, snippet.vec);
    }
  }

  // Filter by minimum relevance threshold
  let candidates = pool.filter((s) => (s.scoreQ ?? 0) >= opt.minRelevance);
  if (!candidates.length) {
    console.warn("[mmr] No candidates meet minRelevance threshold, using top items");
    candidates = [...pool].sort((a, b) => (b.scoreQ ?? 0) - (a.scoreQ ?? 0)).slice(0, opt.k);
    return candidates;
  }

  const selected: SnippetVec[] = [];
  const remaining = new Set(candidates);

  // Initialize with most relevant item
  const first = candidates.reduce((best, s) =>
    (s.scoreQ ?? 0) > (best.scoreQ ?? 0) ? s : best
  );
  selected.push(first);
  remaining.delete(first);

  // Iteratively select k items
  while (selected.length < Math.min(opt.k, candidates.length) && remaining.size > 0) {
    let best: SnippetVec | null = null;
    let bestScore = -Infinity;

    for (const candidate of remaining) {
      const simQ = candidate.scoreQ ?? 0;

      // Compute maximum similarity to already-selected items
      let maxSimSelected = 0;
      for (const selectedItem of selected) {
        const sim = cosine(candidate.vec, selectedItem.vec);
        if (sim > maxSimSelected) {
          maxSimSelected = sim;
        }
      }

      // MMR score with optional diversity penalty
      const diversityTerm = maxSimSelected + opt.diversityPenalty * maxSimSelected;
      const score = opt.lambda * simQ - (1 - opt.lambda) * diversityTerm;

      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (!best) break;

    selected.push(best);
    remaining.delete(best);
  }

  return selected;
}

/**
 * MMR with temporal decay (prefer recent snippets)
 *
 * @param query - Query embedding vector
 * @param pool - Pool of candidate snippets with timestamps
 * @param params - MMR parameters with decay
 * @returns Selected snippets
 */
export function mmrWithRecency(
  query: Vec,
  pool: SnippetVec[],
  params: MMRParams & { decayHalfLifeDays?: number } = {}
): SnippetVec[] {
  const decayHalfLife = params.decayHalfLifeDays || 30;
  const now = Date.now();

  // Apply temporal decay to relevance scores
  const decayedPool = pool.map((s) => {
    const timestamp = (s.metadata?.createdAt as number) || now;
    const ageDays = (now - timestamp) / (1000 * 60 * 60 * 24);
    const decay = Math.pow(0.5, ageDays / decayHalfLife);

    return {
      ...s,
      scoreQ: (s.scoreQ ?? cosine(query, s.vec)) * decay,
    };
  });

  return mmr(query, decayedPool, params);
}

/**
 * Batch MMR for multiple queries
 *
 * @param queries - Array of query vectors
 * @param pool - Shared pool of snippets
 * @param params - MMR parameters
 * @returns Array of selected snippets per query
 */
export function batchMMR(
  queries: Vec[],
  pool: SnippetVec[],
  params: MMRParams = {}
): SnippetVec[][] {
  return queries.map((q) => mmr(q, pool, params));
}

/**
 * MMR with clustering constraint
 * Ensures diversity across source clusters
 *
 * @param query - Query embedding vector
 * @param pool - Pool of snippets with cluster IDs
 * @param params - MMR parameters with cluster constraint
 * @returns Selected snippets
 */
export function mmrWithClusterDiversity(
  query: Vec,
  pool: SnippetVec[],
  params: MMRParams & { maxPerCluster?: number } = {}
): SnippetVec[] {
  const maxPerCluster = params.maxPerCluster || Infinity;
  const clusterCounts = new Map<string, number>();

  // Run standard MMR
  const selected = mmr(query, pool, params);

  // Filter to ensure max per cluster
  const filtered: SnippetVec[] = [];
  for (const snippet of selected) {
    const clusterId = (snippet.metadata?.clusterId as string) || "unknown";
    const count = clusterCounts.get(clusterId) || 0;

    if (count < maxPerCluster) {
      filtered.push(snippet);
      clusterCounts.set(clusterId, count + 1);
    }
  }

  return filtered;
}

// === Vector Operations ===

/**
 * Dot product of two vectors
 */
function dot(a: Vec, b: Vec): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * L2 norm (magnitude) of a vector
 */
function l2(a: Vec): number {
  return Math.sqrt(a.reduce((sum, x) => sum + x * x, 0));
}

/**
 * Cosine similarity between two vectors
 */
export function cosine(a: Vec, b: Vec): number {
  const denominator = l2(a) * l2(b);
  if (denominator === 0) return 0;
  return dot(a, b) / denominator;
}

/**
 * Normalize vector to unit length
 */
export function normalize(vec: Vec): Vec {
  const magnitude = l2(vec);
  if (magnitude === 0) return vec;
  return vec.map((x) => x / magnitude);
}

/**
 * Compute pairwise similarity matrix
 */
export function pairwiseSimilarity(vecs: Vec[]): number[][] {
  const n = vecs.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0;
    for (let j = i + 1; j < n; j++) {
      const sim = cosine(vecs[i], vecs[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }

  return matrix;
}

/**
 * Compute diversity score for a set of snippets
 * Higher score = more diverse
 */
export function diversityScore(snippets: SnippetVec[]): number {
  if (snippets.length <= 1) return 1.0;

  let totalSim = 0;
  let count = 0;

  for (let i = 0; i < snippets.length; i++) {
    for (let j = i + 1; j < snippets.length; j++) {
      totalSim += cosine(snippets[i].vec, snippets[j].vec);
      count++;
    }
  }

  const avgSim = count > 0 ? totalSim / count : 0;
  return 1 - avgSim; // Invert: lower average similarity = higher diversity
}

/**
 * Compute relevance score for a set of snippets
 */
export function relevanceScore(query: Vec, snippets: SnippetVec[]): number {
  if (!snippets.length) return 0;

  const totalSim = snippets.reduce(
    (sum, s) => sum + (s.scoreQ ?? cosine(query, s.vec)),
    0
  );

  return totalSim / snippets.length;
}

/**
 * Explain MMR selection (for debugging)
 */
export function explainMMR(
  query: Vec,
  selected: SnippetVec[],
  pool: SnippetVec[]
): {
  relevance: number;
  diversity: number;
  coverage: number;
  snippets: Array<{ id: string; text: string; relevance: number }>;
} {
  const relevance = relevanceScore(query, selected);
  const diversity = diversityScore(selected);
  const coverage = selected.length / pool.length;

  const snippets = selected.map((s) => ({
    id: s.id,
    text: s.text.substring(0, 100) + (s.text.length > 100 ? "..." : ""),
    relevance: s.scoreQ ?? cosine(query, s.vec),
  }));

  return { relevance, diversity, coverage, snippets };
}

/**
 * Tune lambda parameter using validation set
 * Requires ground truth relevance scores
 */
export function tuneMMRLambda(
  query: Vec,
  pool: SnippetVec[],
  groundTruth: Map<string, number>,
  lambdaRange: { min: number; max: number; steps: number } = {
    min: 0.3,
    max: 0.9,
    steps: 7,
  }
): { bestLambda: number; bestScore: number } {
  let bestLambda = 0.6;
  let bestScore = -Infinity;

  const step = (lambdaRange.max - lambdaRange.min) / (lambdaRange.steps - 1);

  for (let i = 0; i < lambdaRange.steps; i++) {
    const lambda = lambdaRange.min + i * step;
    const selected = mmr(query, pool, { lambda, k: 6 });

    // Compute NDCG or other metric
    let score = 0;
    for (let j = 0; j < selected.length; j++) {
      const relevance = groundTruth.get(selected[j].id) || 0;
      const discount = Math.log2(j + 2); // NDCG discount
      score += relevance / discount;
    }

    if (score > bestScore) {
      bestScore = score;
      bestLambda = lambda;
    }
  }

  return { bestLambda, bestScore };
}
