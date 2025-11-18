// src/lib/ai/feedback/recordFeedback.ts
// Record user feedback and update cluster aggregate statistics

import { FieldValue } from "firebase-admin/firestore";
import {
  db,
  getClustersCollection,
  getClusterDoc,
} from "../memory/firestoreSchema";
import {
  getFeedbackCollection,
  type FeedbackEvent,
  type ClusterFeedbackStats,
  type Thumb,
} from "./feedbackSchema";
import { computeReward, aggregateRewards } from "./computeRewards";

// === Types ===

export type RecordFeedbackParams = {
  userId: string;
  clusterId: string;
  feedback: {
    thumb?: Thumb;
    stars?: number;
  };
  turnId?: string; // Optional conversational turn ID
  metadata?: {
    session_id?: string;
    query?: string;
    context?: string;
  };
};

export type RecordFeedbackResult = {
  success: boolean;
  feedbackId?: string;
  reward?: number;
  confidence?: number;
  error?: string;
};

// === Main Function ===

/**
 * Record user feedback for a cluster and update aggregate statistics
 *
 * @param params - Feedback parameters
 * @returns Result with feedback ID and computed reward
 *
 * @example
 * ```typescript
 * // Record thumbs up
 * const result = await recordFeedback({
 *   userId: "user123",
 *   clusterId: "cl_abc123",
 *   feedback: { thumb: "up" }
 * });
 *
 * // Record star rating
 * const result = await recordFeedback({
 *   userId: "user123",
 *   clusterId: "cl_abc123",
 *   feedback: { stars: 4 },
 *   turnId: "turn_456",
 *   metadata: { query: "How do I deploy?" }
 * });
 * ```
 */
export async function recordFeedback(
  params: RecordFeedbackParams
): Promise<RecordFeedbackResult> {
  const { userId, clusterId, feedback, turnId, metadata } = params;

  try {
    // 1) Validate inputs
    if (!userId || !clusterId) {
      return {
        success: false,
        error: "userId and clusterId are required",
      };
    }

    if (!feedback.thumb && !feedback.stars) {
      return {
        success: false,
        error: "Either thumb or stars feedback is required",
      };
    }

    // 2) Compute reward and confidence
    const { reward, confidence } = computeReward(feedback);

    // 3) Create feedback event
    const feedbackId = generateFeedbackId();
    const event: FeedbackEvent = {
      fb_id: feedbackId,
      user_id: userId,
      cluster_id: clusterId,
      turn_id: turnId,
      stars: feedback.stars,
      thumb: feedback.thumb,
      reward,
      confidence,
      created_at: FieldValue.serverTimestamp(),
      metadata,
    };

    // 4) Write feedback event (immutable)
    const feedbackRef = getFeedbackCollection().doc(feedbackId);
    await feedbackRef.set(event, { merge: false });

    console.log(
      `[recordFeedback] Created feedback ${feedbackId} for cluster ${clusterId} (reward: ${reward}, confidence: ${confidence})`
    );

    // 5) Update cluster aggregate statistics
    await updateClusterStats(clusterId, reward, confidence);

    return {
      success: true,
      feedbackId,
      reward,
      confidence,
    };
  } catch (error) {
    console.error("[recordFeedback] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Batch record multiple feedback events
 *
 * @param feedbackList - Array of feedback parameters
 * @returns Array of results
 */
export async function recordFeedbackBatch(
  feedbackList: RecordFeedbackParams[]
): Promise<RecordFeedbackResult[]> {
  const results: RecordFeedbackResult[] = [];

  for (const params of feedbackList) {
    const result = await recordFeedback(params);
    results.push(result);
  }

  return results;
}

/**
 * Get all feedback events for a cluster
 *
 * @param clusterId - Cluster ID
 * @param options - Query options
 * @returns Array of feedback events
 */
export async function getFeedbackForCluster(
  clusterId: string,
  options: {
    userId?: string;
    limit?: number;
    orderBy?: "recent" | "oldest";
  } = {}
): Promise<FeedbackEvent[]> {
  const { userId, limit = 100, orderBy = "recent" } = options;

  let query = getFeedbackCollection().where("cluster_id", "==", clusterId);

  if (userId) {
    query = query.where("user_id", "==", userId);
  }

  // Apply ordering
  query = query.orderBy(
    "created_at",
    orderBy === "recent" ? "desc" : "asc"
  );

  if (limit) {
    query = query.limit(limit);
  }

  const snap = await query.get();
  return snap.docs.map((doc) => doc.data() as FeedbackEvent);
}

/**
 * Get all feedback events for a user
 *
 * @param userId - User ID
 * @param options - Query options
 * @returns Array of feedback events
 */
export async function getFeedbackForUser(
  userId: string,
  options: {
    limit?: number;
    orderBy?: "recent" | "oldest";
  } = {}
): Promise<FeedbackEvent[]> {
  const { limit = 100, orderBy = "recent" } = options;

  let query = getFeedbackCollection().where("user_id", "==", userId);

  // Apply ordering
  query = query.orderBy(
    "created_at",
    orderBy === "recent" ? "desc" : "asc"
  );

  if (limit) {
    query = query.limit(limit);
  }

  const snap = await query.get();
  return snap.docs.map((doc) => doc.data() as FeedbackEvent);
}

/**
 * Delete feedback event (admin only)
 *
 * @param feedbackId - Feedback ID
 * @returns Success status
 */
export async function deleteFeedback(
  feedbackId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ref = getFeedbackCollection().doc(feedbackId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, error: "Feedback not found" };
    }

    // Get cluster ID before deletion
    const event = snap.data() as FeedbackEvent;
    const clusterId = event.cluster_id;

    // Delete feedback event
    await ref.delete();

    // Recompute cluster statistics
    await recomputeClusterStats(clusterId);

    console.log(`[deleteFeedback] Deleted feedback ${feedbackId}`);
    return { success: true };
  } catch (error) {
    console.error("[deleteFeedback] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// === Helper Functions ===

/**
 * Generate unique feedback ID
 */
function generateFeedbackId(): string {
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Update cluster aggregate statistics (incremental)
 *
 * @param clusterId - Cluster ID
 * @param reward - New reward value
 * @param confidence - New confidence value
 */
async function updateClusterStats(
  clusterId: string,
  reward: number,
  confidence: number
): Promise<void> {
  const clusterRef = getClusterDoc(clusterId);
  const snap = await clusterRef.get();

  if (!snap.exists) {
    console.warn(
      `[updateClusterStats] Cluster ${clusterId} not found, skipping stats update`
    );
    return;
  }

  const cluster = snap.data();
  const prevStats: ClusterFeedbackStats = cluster?.feedback || {
    count: 0,
    sumReward: 0,
    sumRewardSq: 0,
    meanReward: 0,
    stdReward: 0,
    last_feedback_at: FieldValue.serverTimestamp(),
  };

  // Incremental update
  const newCount = prevStats.count + 1;
  const weightedReward = reward * confidence;
  const newSumReward = prevStats.sumReward + weightedReward;
  const newSumRewardSq = prevStats.sumRewardSq + weightedReward * reward;

  // Compute new mean and std
  const newMeanReward = newSumReward / newCount;
  const variance = newSumRewardSq / newCount - newMeanReward * newMeanReward;
  const newStdReward = Math.sqrt(Math.max(0, variance));

  const newStats: ClusterFeedbackStats = {
    count: newCount,
    sumReward: newSumReward,
    sumRewardSq: newSumRewardSq,
    meanReward: newMeanReward,
    stdReward: newStdReward,
    last_feedback_at: FieldValue.serverTimestamp(),
  };

  // Update cluster document
  await clusterRef.update({
    feedback: newStats,
    last_updated: FieldValue.serverTimestamp(),
  });

  console.log(
    `[updateClusterStats] Updated cluster ${clusterId} stats: count=${newCount}, mean=${newMeanReward.toFixed(3)}`
  );
}

/**
 * Recompute cluster statistics from scratch (full recount)
 * Used when feedback is deleted or for batch updates
 *
 * @param clusterId - Cluster ID
 */
async function recomputeClusterStats(clusterId: string): Promise<void> {
  // Fetch all feedback events for this cluster
  const events = await getFeedbackForCluster(clusterId, { limit: 10000 });

  if (events.length === 0) {
    // No feedback: clear stats
    const clusterRef = getClusterDoc(clusterId);
    await clusterRef.update({
      feedback: FieldValue.delete(),
      weight: FieldValue.delete(),
      last_updated: FieldValue.serverTimestamp(),
    });
    console.log(
      `[recomputeClusterStats] Cleared stats for cluster ${clusterId} (no feedback)`
    );
    return;
  }

  // Aggregate all events
  const stats = aggregateRewards(events);

  const newStats: ClusterFeedbackStats = {
    count: stats.count,
    sumReward: stats.sumReward,
    sumRewardSq: stats.sumRewardSq,
    meanReward: stats.meanReward,
    stdReward: stats.stdReward,
    last_feedback_at:
      events[0].created_at || FieldValue.serverTimestamp(),
  };

  // Update cluster document
  const clusterRef = getClusterDoc(clusterId);
  await clusterRef.update({
    feedback: newStats,
    last_updated: FieldValue.serverTimestamp(),
  });

  console.log(
    `[recomputeClusterStats] Recomputed cluster ${clusterId} stats: count=${stats.count}, mean=${stats.meanReward.toFixed(3)}`
  );
}

/**
 * Recompute statistics for all clusters (batch operation)
 * Use for nightly jobs or data migrations
 *
 * @param userId - Optional user ID to limit scope
 * @returns Number of clusters updated
 */
export async function recomputeAllClusterStats(
  userId?: string
): Promise<number> {
  let query = getClustersCollection();

  if (userId) {
    query = query.where("user_id", "==", userId) as any;
  }

  const snap = await query.get();
  let updated = 0;

  console.log(
    `[recomputeAllClusterStats] Recomputing stats for ${snap.size} clusters...`
  );

  for (const doc of snap.docs) {
    const cluster = doc.data();
    await recomputeClusterStats(cluster.cluster_id);
    updated++;
  }

  console.log(`[recomputeAllClusterStats] Updated ${updated} clusters`);
  return updated;
}
