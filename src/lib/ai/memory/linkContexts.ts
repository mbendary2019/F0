// src/lib/ai/memory/linkContexts.ts
// Link new memories to existing clusters for context retrieval

import OpenAI from "openai";
import {
  db,
  COL_CLUSTERS,
  COL_LINKS,
  now,
  type LinkDoc,
  type ClusterDoc,
  getLinksCollection,
  getClustersCollection,
} from "./firestoreSchema";

export type LinkOptions = {
  userId: string;
  memoryId: string; // ID of the new memory/message
  memoryText: string; // Text to embed
  threshold?: number; // Cosine similarity threshold (default: 0.80)
  limitClusters?: number; // Cap fetched clusters (default: 1000)
  model?: string; // Embedding model ID (default: "text-embedding-3-large")
};

export type LinkResult =
  | {
      linked: true;
      link: LinkDoc;
      target: ClusterDoc;
      score: number;
    }
  | {
      linked: false;
      reason: "NO_CLUSTERS" | "BELOW_THRESHOLD" | "ERROR";
      bestScore?: number;
      error?: string;
    };

const DEFAULTS = {
  threshold: 0.8,
  limitClusters: 1000,
  model: "text-embedding-3-large",
};

/**
 * Link a new memory to the most similar cluster.
 *
 * @param options - Link options (userId, memoryId, memoryText required)
 * @returns Link result with target cluster or reason for failure
 *
 * @example
 * ```typescript
 * const result = await linkMemoryToCluster({
 *   userId: "user123",
 *   memoryId: "mem_456",
 *   memoryText: "Deployed Phase 56 to production",
 *   threshold: 0.80
 * });
 *
 * if (result.linked) {
 *   console.log(`Linked to cluster: ${result.target.title}`);
 *   console.log(`Similarity: ${(result.score * 100).toFixed(1)}%`);
 * } else {
 *   console.log(`Not linked: ${result.reason}`);
 * }
 * ```
 */
export async function linkMemoryToCluster(
  options: LinkOptions
): Promise<LinkResult> {
  const { userId, memoryId, memoryText } = options;
  const threshold = options.threshold ?? DEFAULTS.threshold;
  const model = options.model ?? DEFAULTS.model;
  const limit = options.limitClusters ?? DEFAULTS.limitClusters;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) Embed the incoming memory
    console.log(
      `[linkMemoryToCluster] Embedding memory ${memoryId} for user ${userId}`
    );
    const embRes = await client.embeddings.create({ model, input: memoryText });
    const q = embRes.data[0].embedding as number[];

    // 2) Load candidate clusters (for this user)
    const snap = await getClustersCollection()
      .where("user_id", "==", userId)
      .orderBy("last_updated", "desc")
      .limit(limit)
      .get();

    if (snap.empty) {
      console.log(`[linkMemoryToCluster] No clusters found for user ${userId}`);
      return { linked: false, reason: "NO_CLUSTERS" };
    }

    // 3) Score by cosine similarity to centroids
    let best: { cluster: ClusterDoc; score: number } | null = null;
    for (const doc of snap.docs) {
      const c = doc.data() as ClusterDoc;
      if (!Array.isArray(c.centroid) || c.centroid.length !== q.length) {
        continue; // Skip dimension mismatch
      }
      const score = cosineArray(q, c.centroid);
      if (!best || score > best.score) {
        best = { cluster: c, score };
      }
    }

    if (!best || best.score < threshold) {
      console.log(
        `[linkMemoryToCluster] Best score ${best?.score ?? 0} below threshold ${threshold}`
      );
      return {
        linked: false,
        reason: "BELOW_THRESHOLD",
        bestScore: best?.score ?? 0,
      };
    }

    // 4) Write link document
    const linkId = `lnk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const linkDoc: LinkDoc = {
      link_id: linkId,
      user_id: userId,
      source_memory_id: memoryId,
      target_cluster_id: best.cluster.cluster_id,
      similarity: round4(best.score),
      created_at: now(),
      metadata: {
        threshold_used: threshold,
        model_used: model,
      },
    };

    const ref = getLinksCollection().doc(linkId);
    await ref.set(linkDoc, { merge: false });

    console.log(
      `[linkMemoryToCluster] Created link ${linkId} to cluster ${best.cluster.cluster_id} (score: ${round4(best.score)})`
    );

    return {
      linked: true,
      link: linkDoc,
      target: best.cluster,
      score: best.score,
    };
  } catch (error) {
    console.error("[linkMemoryToCluster] Error:", error);
    return {
      linked: false,
      reason: "ERROR",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get all links for a memory
 *
 * @param memoryId - Memory ID
 * @param userId - Optional user ID for security check
 * @returns Array of link documents
 */
export async function getLinksForMemory(
  memoryId: string,
  userId?: string
): Promise<LinkDoc[]> {
  let query = getLinksCollection().where("source_memory_id", "==", memoryId);

  if (userId) {
    query = query.where("user_id", "==", userId);
  }

  const snap = await query.get();
  return snap.docs.map((doc) => doc.data() as LinkDoc);
}

/**
 * Get all links for a cluster
 *
 * @param clusterId - Cluster ID
 * @param userId - Optional user ID for security check
 * @returns Array of link documents
 */
export async function getLinksForCluster(
  clusterId: string,
  userId?: string
): Promise<LinkDoc[]> {
  let query = getLinksCollection().where("target_cluster_id", "==", clusterId);

  if (userId) {
    query = query.where("user_id", "==", userId);
  }

  const snap = await query.get();
  return snap.docs.map((doc) => doc.data() as LinkDoc);
}

/**
 * Delete links for a memory (cleanup)
 *
 * @param memoryId - Memory ID
 * @param userId - User ID for security check
 * @returns Number of links deleted
 */
export async function deleteLinksForMemory(
  memoryId: string,
  userId: string
): Promise<number> {
  const links = await getLinksForMemory(memoryId, userId);
  const batch = db.batch();

  for (const link of links) {
    batch.delete(getLinksCollection().doc(link.link_id));
  }

  await batch.commit();
  return links.length;
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

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
