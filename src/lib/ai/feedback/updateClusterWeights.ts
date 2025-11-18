// src/lib/ai/feedback/updateClusterWeights.ts
// Auto-weight clusters using EMA, Bayesian smoothing, and time decay

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  db,
  getClustersCollection,
  getClusterDoc,
  type ClusterDoc,
} from "../memory/firestoreSchema";
import {
  type ClusterFeedbackStats,
  type WeightingParams,
  DEFAULT_WEIGHTING_PARAMS,
} from "./feedbackSchema";
import {
  bayesianSmooth,
  applyTimeDecay,
  clamp,
} from "./computeRewards";

// === Types ===

export type UpdateWeightsResult = {
  updated: number;
  skipped: number;
  errors: Array<{ clusterId: string; error: string }>;
};

// === Main Functions ===

/**
 * Update weights for a single cluster using EMA + Bayesian smoothing + time decay
 *
 * @param clusterId - Cluster ID
 * @param params - Weighting parameters
 * @returns Success status
 *
 * @example
 * ```typescript
 * await updateClusterWeight("cl_abc123", {
 *   alpha: 0.1,
 *   priorMean: 0.0,
 *   priorK: 5.0,
 *   decayHalfLifeDays: 21
 * });
 * ```
 */
export async function updateClusterWeight(
  clusterId: string,
  params: Partial<WeightingParams> = {}
): Promise<{ success: boolean; weight?: number; error?: string }> {
  try {
    const fullParams = { ...DEFAULT_WEIGHTING_PARAMS, ...params };

    const clusterRef = getClusterDoc(clusterId);
    const snap = await clusterRef.get();

    if (!snap.exists) {
      return { success: false, error: "Cluster not found" };
    }

    const cluster = snap.data() as ClusterDoc;

    // If no feedback stats, weight is neutral (0.0)
    if (!cluster.feedback || cluster.feedback.count === 0) {
      await clusterRef.update({
        weight: 0.0,
        last_updated: FieldValue.serverTimestamp(),
      });
      return { success: true, weight: 0.0 };
    }

    // Compute new weight
    const newWeight = computeClusterWeight(cluster, fullParams);

    // Update cluster document
    await clusterRef.update({
      weight: newWeight,
      last_updated: FieldValue.serverTimestamp(),
    });

    console.log(
      `[updateClusterWeight] Updated cluster ${clusterId} weight: ${newWeight.toFixed(4)}`
    );

    return { success: true, weight: newWeight };
  } catch (error) {
    console.error(`[updateClusterWeight] Error for ${clusterId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Batch update weights for multiple clusters
 *
 * @param clusterIds - Array of cluster IDs
 * @param params - Weighting parameters
 * @returns Update result with counts
 */
export async function updateClusterWeightsBatch(
  clusterIds: string[],
  params: Partial<WeightingParams> = {}
): Promise<UpdateWeightsResult> {
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ clusterId: string; error: string }> = [];

  console.log(`[updateClusterWeightsBatch] Updating ${clusterIds.length} clusters...`);

  for (const clusterId of clusterIds) {
    const result = await updateClusterWeight(clusterId, params);

    if (result.success) {
      updated++;
    } else if (result.error === "Cluster not found") {
      skipped++;
    } else {
      errors.push({ clusterId, error: result.error || "Unknown error" });
    }
  }

  console.log(
    `[updateClusterWeightsBatch] Complete: ${updated} updated, ${skipped} skipped, ${errors.length} errors`
  );

  return { updated, skipped, errors };
}

/**
 * Update weights for all clusters (batch operation for nightly jobs)
 *
 * @param options - Query options
 * @param params - Weighting parameters
 * @returns Update result with counts
 */
export async function updateAllClusterWeights(
  options: {
    userId?: string;
    minFeedbackCount?: number;
    batchSize?: number;
  } = {},
  params: Partial<WeightingParams> = {}
): Promise<UpdateWeightsResult> {
  const { userId, minFeedbackCount = 1, batchSize = 500 } = options;

  let query = getClustersCollection();

  if (userId) {
    query = query.where("user_id", "==", userId) as any;
  }

  const snap = await query.get();

  console.log(
    `[updateAllClusterWeights] Processing ${snap.size} clusters...`
  );

  let updated = 0;
  let skipped = 0;
  const errors: Array<{ clusterId: string; error: string }> = [];

  // Process in batches
  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const cluster = doc.data() as ClusterDoc;

    // Skip clusters with insufficient feedback
    if (
      !cluster.feedback ||
      cluster.feedback.count < minFeedbackCount
    ) {
      skipped++;
      continue;
    }

    try {
      const newWeight = computeClusterWeight(cluster, {
        ...DEFAULT_WEIGHTING_PARAMS,
        ...params,
      });

      batch.update(doc.ref, {
        weight: newWeight,
        last_updated: FieldValue.serverTimestamp(),
      });

      updated++;
      batchCount++;

      // Commit batch if it reaches batchSize
      if (batchCount >= batchSize) {
        await batch.commit();
        console.log(`[updateAllClusterWeights] Committed batch of ${batchCount}`);
        batchCount = 0;
      }
    } catch (error) {
      console.error(
        `[updateAllClusterWeights] Error for ${cluster.cluster_id}:`,
        error
      );
      errors.push({
        clusterId: cluster.cluster_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Commit remaining batch
  if (batchCount > 0) {
    await batch.commit();
    console.log(`[updateAllClusterWeights] Committed final batch of ${batchCount}`);
  }

  console.log(
    `[updateAllClusterWeights] Complete: ${updated} updated, ${skipped} skipped, ${errors.length} errors`
  );

  return { updated, skipped, errors };
}

/**
 * Get clusters with weights for a user
 *
 * @param userId - User ID
 * @param options - Query options
 * @returns Array of clusters with weights
 */
export async function getWeightedClusters(
  userId: string,
  options: {
    limit?: number;
    orderBy?: "weight" | "recent" | "confidence";
    minWeight?: number;
  } = {}
): Promise<Array<ClusterDoc & { weight: number }>> {
  const { limit = 100, orderBy = "weight", minWeight } = options;

  let query = getClustersCollection().where("user_id", "==", userId);

  // Apply ordering
  switch (orderBy) {
    case "weight":
      query = query.orderBy("weight", "desc");
      break;
    case "confidence":
      query = query.orderBy("confidence", "desc");
      break;
    case "recent":
    default:
      query = query.orderBy("last_updated", "desc");
      break;
  }

  if (limit) {
    query = query.limit(limit);
  }

  const snap = await query.get();
  let clusters = snap.docs.map((doc) => doc.data() as ClusterDoc & { weight: number });

  // Filter by minimum weight (client-side)
  if (minWeight !== undefined) {
    clusters = clusters.filter((c) => (c.weight || 0) >= minWeight);
  }

  return clusters;
}

// === Core Weight Computation ===

/**
 * Compute cluster weight using EMA + Bayesian smoothing + time decay
 *
 * Algorithm:
 * 1. Start with previous weight (or 0 if none)
 * 2. Apply Bayesian smoothing to mean reward
 * 3. Apply time decay to smoothed reward
 * 4. Update weight using EMA: w_new = (1 - α) * w_old + α * decayed_reward
 * 5. Clamp result to [-1, 1]
 *
 * @param cluster - Cluster document with feedback stats
 * @param params - Weighting parameters
 * @returns New weight value
 */
function computeClusterWeight(
  cluster: ClusterDoc,
  params: WeightingParams
): number {
  const { alpha, priorMean, priorK, decayHalfLifeDays } = params;

  // Get previous weight (default: 0.0)
  const prevWeight = cluster.weight || 0.0;

  // Get feedback stats
  const stats = cluster.feedback;
  if (!stats || stats.count === 0) {
    return 0.0; // No feedback: neutral weight
  }

  // 1) Apply Bayesian smoothing to mean reward
  const smoothedReward = bayesianSmooth(
    stats.meanReward,
    stats.count,
    priorMean,
    priorK
  );

  // 2) Apply time decay
  const lastFeedbackAt = stats.last_feedback_at;
  let decayedReward = smoothedReward;

  if (
    lastFeedbackAt &&
    typeof lastFeedbackAt === "object" &&
    "toDate" in lastFeedbackAt
  ) {
    const timestampMs = (lastFeedbackAt as Timestamp).toDate().getTime();
    const ageDays = (Date.now() - timestampMs) / (1000 * 60 * 60 * 24);
    decayedReward = applyTimeDecay(smoothedReward, ageDays, decayHalfLifeDays);
  }

  // 3) Update weight using EMA: w_new = (1 - α) * w_old + α * decayed_reward
  const newWeight = (1 - alpha) * prevWeight + alpha * decayedReward;

  // 4) Clamp to [-1, 1]
  return clamp(newWeight, -1.0, 1.0);
}

/**
 * Compute weight without EMA (one-shot computation)
 * Useful for initial weight assignment or testing
 *
 * @param cluster - Cluster document with feedback stats
 * @param params - Weighting parameters
 * @returns Weight value
 */
export function computeWeightOneShot(
  cluster: ClusterDoc,
  params: Partial<WeightingParams> = {}
): number {
  const fullParams = { ...DEFAULT_WEIGHTING_PARAMS, ...params };

  const stats = cluster.feedback;
  if (!stats || stats.count === 0) {
    return 0.0;
  }

  // Apply Bayesian smoothing
  const smoothedReward = bayesianSmooth(
    stats.meanReward,
    stats.count,
    fullParams.priorMean,
    fullParams.priorK
  );

  // Apply time decay
  const lastFeedbackAt = stats.last_feedback_at;
  let decayedReward = smoothedReward;

  if (
    lastFeedbackAt &&
    typeof lastFeedbackAt === "object" &&
    "toDate" in lastFeedbackAt
  ) {
    const timestampMs = (lastFeedbackAt as Timestamp).toDate().getTime();
    const ageDays = (Date.now() - timestampMs) / (1000 * 60 * 60 * 24);
    decayedReward = applyTimeDecay(
      smoothedReward,
      ageDays,
      fullParams.decayHalfLifeDays
    );
  }

  // Return clamped value
  return clamp(decayedReward, -1.0, 1.0);
}

/**
 * Preview weight computation without writing to Firestore
 * Useful for debugging and testing
 *
 * @param clusterId - Cluster ID
 * @param params - Weighting parameters
 * @returns Preview result with weight and intermediate values
 */
export async function previewClusterWeight(
  clusterId: string,
  params: Partial<WeightingParams> = {}
): Promise<{
  success: boolean;
  clusterId: string;
  prevWeight: number;
  newWeight: number;
  stats?: {
    count: number;
    meanReward: number;
    smoothedReward: number;
    decayedReward: number;
    ageDays: number;
  };
  error?: string;
}> {
  try {
    const fullParams = { ...DEFAULT_WEIGHTING_PARAMS, ...params };

    const snap = await getClusterDoc(clusterId).get();

    if (!snap.exists) {
      return {
        success: false,
        clusterId,
        prevWeight: 0,
        newWeight: 0,
        error: "Cluster not found",
      };
    }

    const cluster = snap.data() as ClusterDoc;
    const prevWeight = cluster.weight || 0.0;

    if (!cluster.feedback || cluster.feedback.count === 0) {
      return {
        success: true,
        clusterId,
        prevWeight,
        newWeight: 0.0,
        stats: {
          count: 0,
          meanReward: 0,
          smoothedReward: 0,
          decayedReward: 0,
          ageDays: 0,
        },
      };
    }

    const stats = cluster.feedback;

    // Compute intermediate values
    const smoothedReward = bayesianSmooth(
      stats.meanReward,
      stats.count,
      fullParams.priorMean,
      fullParams.priorK
    );

    const lastFeedbackAt = stats.last_feedback_at;
    let ageDays = 0;
    let decayedReward = smoothedReward;

    if (
      lastFeedbackAt &&
      typeof lastFeedbackAt === "object" &&
      "toDate" in lastFeedbackAt
    ) {
      const timestampMs = (lastFeedbackAt as Timestamp).toDate().getTime();
      ageDays = (Date.now() - timestampMs) / (1000 * 60 * 60 * 24);
      decayedReward = applyTimeDecay(
        smoothedReward,
        ageDays,
        fullParams.decayHalfLifeDays
      );
    }

    // Compute new weight with EMA
    const newWeight = clamp(
      (1 - fullParams.alpha) * prevWeight + fullParams.alpha * decayedReward,
      -1.0,
      1.0
    );

    return {
      success: true,
      clusterId,
      prevWeight,
      newWeight,
      stats: {
        count: stats.count,
        meanReward: stats.meanReward,
        smoothedReward,
        decayedReward,
        ageDays,
      },
    };
  } catch (error) {
    console.error(`[previewClusterWeight] Error for ${clusterId}:`, error);
    return {
      success: false,
      clusterId,
      prevWeight: 0,
      newWeight: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
