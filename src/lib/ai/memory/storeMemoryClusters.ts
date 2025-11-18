// src/lib/ai/memory/storeMemoryClusters.ts
// Persist memory clusters to Firestore with batch upsert

import {
  db,
  COL_CLUSTERS,
  now,
  type ClusterDoc,
  getClustersCollection,
} from "./firestoreSchema";

// === Types (compatible with Phase 56 Day 4) ===

export type ClusterWithMetadata = {
  cluster: {
    clusterId: string;
    itemIds: string[];
    size: number;
    centroid: number[];
    representativeId: string;
    similarityStats: { avg: number; min: number; max: number };
  };
  metadata: {
    title: string;
    summary: string;
    tags: string[];
    confidence: number; // 0..1
  };
};

export type SaveClustersOptions = {
  userId: string;
  mergeTags?: boolean; // Union old+new tags (default: true)
  upsert?: boolean; // Update existing clusters (default: true)
  locale?: "ar" | "en" | string; // Optional locale metadata
  source?: string; // Optional source identifier
};

export type SaveClustersResult = {
  upserted: number; // New clusters created
  updated: number; // Existing clusters updated
  skipped: number; // Clusters skipped (if upsert=false)
  errors: Array<{ clusterId: string; error: string }>; // Any errors
};

/**
 * Persist clusters into Firestore with batch upsert.
 *
 * @param clusters - Array of clusters with metadata from clusterAndTag
 * @param options - Save options (userId required)
 * @returns Result with counts of upserted/updated/skipped/errors
 *
 * @example
 * ```typescript
 * import { clusterAndTag } from "./clusterAndTag";
 * import { saveClusters } from "./storeMemoryClusters";
 *
 * const results = await clusterAndTag(memories);
 * const saveResult = await saveClusters(results, {
 *   userId: "user123",
 *   mergeTags: true,
 *   locale: "en"
 * });
 *
 * console.log(`Saved ${saveResult.upserted} new clusters, updated ${saveResult.updated}`);
 * ```
 */
export async function saveClusters(
  clusters: ClusterWithMetadata[],
  options: SaveClustersOptions
): Promise<SaveClustersResult> {
  const {
    userId,
    mergeTags = true,
    upsert = true,
    locale,
    source,
  } = options;

  if (!clusters?.length) {
    return { upserted: 0, updated: 0, skipped: 0, errors: [] };
  }

  if (!userId) {
    throw new Error("[saveClusters] userId is required");
  }

  const batch = db.batch();
  let upserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ clusterId: string; error: string }> = [];

  console.log(
    `[saveClusters] Saving ${clusters.length} clusters for user ${userId}`
  );

  for (const { cluster, metadata } of clusters) {
    try {
      const ref = getClustersCollection().doc(cluster.clusterId);
      const snap = await ref.get();

      const payload: ClusterDoc = {
        cluster_id: cluster.clusterId,
        user_id: userId,
        title: metadata.title,
        summary: metadata.summary,
        tags: metadata.tags,
        item_ids: cluster.itemIds,
        centroid: cluster.centroid,
        confidence: metadata.confidence,
        representative_id: cluster.representativeId,
        similarity_stats: cluster.similarityStats,
        size: cluster.size,
        created_at: now(),
        last_updated: now(),
        metadata: {
          ...(locale && { locale }),
          ...(source && { source }),
          version: 1, // Schema version
        },
      };

      if (!snap.exists) {
        // New cluster
        batch.set(ref, payload, { merge: false });
        upserted++;
      } else if (upsert) {
        // Update existing cluster
        const prev = snap.data() as ClusterDoc;

        // Merge tags if requested
        const finalTags = mergeTags
          ? unionTags(prev.tags, payload.tags)
          : payload.tags;

        batch.set(
          ref,
          {
            ...payload,
            created_at: prev.created_at ?? now(), // Preserve original creation time
            tags: finalTags,
            metadata: {
              ...prev.metadata,
              ...payload.metadata,
            },
          },
          { merge: true }
        );
        updated++;
      } else {
        // Skip existing clusters if upsert=false
        skipped++;
      }
    } catch (error) {
      console.error(
        `[saveClusters] Error processing cluster ${cluster.clusterId}:`,
        error
      );
      errors.push({
        clusterId: cluster.clusterId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Commit batch
  try {
    await batch.commit();
    console.log(
      `[saveClusters] Successfully saved: ${upserted} new, ${updated} updated, ${skipped} skipped`
    );
  } catch (error) {
    console.error("[saveClusters] Batch commit failed:", error);
    throw new Error(
      `Failed to commit clusters batch: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return { upserted, updated, skipped, errors };
}

/**
 * Delete clusters by IDs (batch delete)
 *
 * @param clusterIds - Array of cluster IDs to delete
 * @param userId - User ID for security check
 * @returns Number of clusters deleted
 */
export async function deleteClusters(
  clusterIds: string[],
  userId: string
): Promise<number> {
  if (!clusterIds?.length) return 0;
  if (!userId) throw new Error("[deleteClusters] userId is required");

  const batch = db.batch();
  let deleted = 0;

  for (const clusterId of clusterIds) {
    const ref = getClustersCollection().doc(clusterId);
    const snap = await ref.get();

    // Security check: only delete if user owns cluster
    if (snap.exists) {
      const data = snap.data() as ClusterDoc;
      if (data.user_id === userId) {
        batch.delete(ref);
        deleted++;
      }
    }
  }

  await batch.commit();
  console.log(`[deleteClusters] Deleted ${deleted} clusters for user ${userId}`);
  return deleted;
}

/**
 * Get clusters by user ID
 *
 * @param userId - User ID
 * @param options - Query options
 * @returns Array of cluster documents
 */
export async function getClustersByUser(
  userId: string,
  options: {
    limit?: number;
    orderBy?: "recent" | "confidence" | "size";
    minConfidence?: number;
    tags?: string[];
  } = {}
): Promise<ClusterDoc[]> {
  if (!userId) throw new Error("[getClustersByUser] userId is required");

  let query = getClustersCollection().where("user_id", "==", userId);

  // Apply ordering
  switch (options.orderBy) {
    case "confidence":
      query = query.orderBy("confidence", "desc");
      break;
    case "size":
      query = query.orderBy("size", "desc");
      break;
    case "recent":
    default:
      query = query.orderBy("last_updated", "desc");
      break;
  }

  // Apply limit
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const snap = await query.get();
  let clusters = snap.docs.map((doc) => doc.data() as ClusterDoc);

  // Filter by confidence (client-side, as Firestore doesn't support >= on non-indexed fields easily)
  if (options.minConfidence !== undefined) {
    clusters = clusters.filter((c) => c.confidence >= options.minConfidence!);
  }

  // Filter by tags (client-side)
  if (options.tags?.length) {
    const normalizedTags = options.tags.map((t) => normalizeTag(t));
    clusters = clusters.filter((c) =>
      c.tags.some((tag) => normalizedTags.includes(normalizeTag(tag)))
    );
  }

  return clusters;
}

/**
 * Get cluster by ID
 *
 * @param clusterId - Cluster ID
 * @param userId - Optional user ID for security check
 * @returns Cluster document or null
 */
export async function getClusterById(
  clusterId: string,
  userId?: string
): Promise<ClusterDoc | null> {
  const ref = getClustersCollection().doc(clusterId);
  const snap = await ref.get();

  if (!snap.exists) return null;

  const cluster = snap.data() as ClusterDoc;

  // Security check if userId provided
  if (userId && cluster.user_id !== userId) {
    return null;
  }

  return cluster;
}

// === Helper Functions ===

/**
 * Union two arrays of tags, normalized and deduplicated
 */
function unionTags(a: string[] = [], b: string[] = []): string[] {
  const set = new Set<string>([
    ...a.map(normalizeTag),
    ...b.map(normalizeTag),
  ]);
  return Array.from(set);
}

/**
 * Normalize tag: lowercase and trim
 */
function normalizeTag(s: string): string {
  return (s || "").trim().toLowerCase();
}
