// src/lib/ai/memory/fetchClusterContext.ts
// Retrieve cluster context for AI prompts and recommendations

import OpenAI from "openai";
import {
  db,
  COL_CLUSTERS,
  type ClusterDoc,
  getClustersCollection,
} from "./firestoreSchema";

export type GetContextParams = {
  userId: string;
  topN?: number; // Default: 1
  orderBy?: "recent" | "confidence"; // Default: "recent"
};

export type ScoredCluster = {
  cluster: ClusterDoc;
  score: number; // Cosine similarity (only for query-based)
};

export type GetContextForQueryParams = {
  userId: string;
  query: string; // Natural language query (next task/message)
  model?: string; // Embedding model (default: "text-embedding-3-large")
  topK?: number; // Return topK clusters (default: 3)
  candidateLimit?: number; // Fetch limit from Firestore (default: 400)
};

/**
 * Get recent or high-confidence clusters for a user.
 *
 * @param params - Query parameters
 * @returns Array of cluster documents
 *
 * @example
 * ```typescript
 * // Get most recent cluster
 * const recent = await getContextForUser({ userId: "user123", topN: 1 });
 *
 * // Get top 3 high-confidence clusters
 * const topClusters = await getContextForUser({
 *   userId: "user123",
 *   topN: 3,
 *   orderBy: "confidence"
 * });
 * ```
 */
export async function getContextForUser(
  params: GetContextParams
): Promise<ClusterDoc[]> {
  const { userId, topN = 1, orderBy = "recent" } = params;

  let query = getClustersCollection().where("user_id", "==", userId);

  // Apply ordering
  query =
    orderBy === "confidence"
      ? query.orderBy("confidence", "desc")
      : query.orderBy("last_updated", "desc");

  const snap = await query.limit(Math.max(1, topN)).get();
  return snap.docs.map((d) => d.data() as ClusterDoc);
}

/**
 * Get context clusters relevant to a natural language query.
 * Uses semantic search (cosine similarity) to find best matches.
 *
 * @param params - Query parameters
 * @returns Array of scored clusters (sorted by similarity)
 *
 * @example
 * ```typescript
 * const context = await getContextForQuery({
 *   userId: "user123",
 *   query: "How do I fix Firebase emulator connection issues?",
 *   topK: 3
 * });
 *
 * for (const { cluster, score } of context) {
 *   console.log(`${cluster.title} (${(score * 100).toFixed(1)}%)`);
 *   console.log(`  Summary: ${cluster.summary}`);
 *   console.log(`  Tags: ${cluster.tags.join(", ")}`);
 * }
 * ```
 */
export async function getContextForQuery(
  params: GetContextForQueryParams
): Promise<ScoredCluster[]> {
  const {
    userId,
    query,
    model = "text-embedding-3-large",
    topK = 3,
    candidateLimit = 400,
  } = params;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 1) Embed query
  console.log(`[getContextForQuery] Embedding query for user ${userId}`);
  const emb = await client.embeddings.create({ model, input: query });
  const q = emb.data[0].embedding as number[];

  // 2) Fetch candidate clusters
  const snap = await getClustersCollection()
    .where("user_id", "==", userId)
    .orderBy("last_updated", "desc")
    .limit(candidateLimit)
    .get();

  if (snap.empty) {
    console.log(`[getContextForQuery] No clusters found for user ${userId}`);
    return [];
  }

  // 3) Score by cosine similarity
  const scored = snap.docs
    .map((d) => d.data() as ClusterDoc)
    .filter((c) => Array.isArray(c.centroid) && c.centroid.length === q.length)
    .map((c) => ({
      cluster: c,
      score: cosineArray(q, c.centroid),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  console.log(
    `[getContextForQuery] Found ${scored.length} relevant clusters (top score: ${scored[0]?.score.toFixed(3) ?? 0})`
  );

  return scored;
}

/**
 * Get clusters by tag
 *
 * @param userId - User ID
 * @param tags - Array of tags to match
 * @param options - Query options
 * @returns Array of cluster documents
 */
export async function getClustersByTag(
  userId: string,
  tags: string[],
  options: { limit?: number; orderBy?: "recent" | "confidence" } = {}
): Promise<ClusterDoc[]> {
  const { limit = 50, orderBy = "recent" } = options;

  let query = getClustersCollection().where("user_id", "==", userId);

  // Apply ordering
  query =
    orderBy === "confidence"
      ? query.orderBy("confidence", "desc")
      : query.orderBy("last_updated", "desc");

  const snap = await query.limit(limit).get();

  // Filter by tags (client-side, as Firestore array-contains-any requires index)
  const normalizedTags = tags.map((t) => t.toLowerCase().trim());
  const filtered = snap.docs
    .map((d) => d.data() as ClusterDoc)
    .filter((c) =>
      c.tags.some((tag) => normalizedTags.includes(tag.toLowerCase().trim()))
    );

  return filtered;
}

/**
 * Get cluster statistics for a user
 *
 * @param userId - User ID
 * @returns Statistics object
 */
export async function getClusterStats(
  userId: string
): Promise<{
  totalClusters: number;
  totalMemories: number;
  avgClusterSize: number;
  avgConfidence: number;
  topTags: Array<{ tag: string; count: number }>;
}> {
  const snap = await getClustersCollection()
    .where("user_id", "==", userId)
    .get();

  if (snap.empty) {
    return {
      totalClusters: 0,
      totalMemories: 0,
      avgClusterSize: 0,
      avgConfidence: 0,
      topTags: [],
    };
  }

  const clusters = snap.docs.map((d) => d.data() as ClusterDoc);

  const totalClusters = clusters.length;
  const totalMemories = clusters.reduce((sum, c) => sum + c.size, 0);
  const avgClusterSize = totalMemories / totalClusters;
  const avgConfidence =
    clusters.reduce((sum, c) => sum + c.confidence, 0) / totalClusters;

  // Count tag frequency
  const tagCounts = new Map<string, number>();
  for (const cluster of clusters) {
    for (const tag of cluster.tags) {
      const normalized = tag.toLowerCase().trim();
      tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
    }
  }

  const topTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalClusters,
    totalMemories,
    avgClusterSize,
    avgConfidence,
    topTags,
  };
}

// === Math Helpers ===

function l2norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  const L = Math.min(a.length, b.length);
  for (let i = 0; i < L; i++) s += a[i] * b[i];
  return s;
}

function cosineArray(a: number[], b: number[]): number {
  return dot(a, b) / ((l2norm(a) || 1) * (l2norm(b) || 1));
}
