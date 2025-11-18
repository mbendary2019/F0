// src/lib/ai/memory/snippetFeedback.ts
// Phase 57.2: Per-snippet feedback for fine-grained quality signals
// Reuses reward computation from Phase 57 feedback system

import { db } from "./firestoreSchema";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { computeReward, type Thumb } from "../feedback/feedbackSchema";
import { createTTLField } from "../util/ttl";

// === Constants ===

const COL_SNIPPET_FEEDBACK = "ops_memory_snippet_feedback" as const;

// === Types ===

export type SnippetFeedbackEvent = {
  sfb_id: string; // "sfb_<timestamp>_<random>"
  user_id: string;
  snip_id: string; // Reference to ops_memory_snippets
  cluster_id?: string; // Optional cluster context
  turn_id?: string; // Optional conversational turn
  thumb?: Thumb; // "up" or "down"
  stars?: number; // 1..5
  reward: number; // Computed reward [-1, 1]
  confidence: number; // Confidence [0, 1]
  created_at: FieldValue | Timestamp;
  expire_at?: Date | Timestamp; // TTL expiration (Phase 57.3)
  metadata?: {
    snippet_text?: string; // Cached for display
    context?: string; // Where snippet was shown
    position?: number; // Position in list
  };
};

export type RecordSnippetFeedbackParams = {
  userId: string;
  snipId: string;
  clusterId?: string;
  turnId?: string;
  thumb?: Thumb;
  stars?: number;
  metadata?: {
    snippet_text?: string;
    context?: string;
    position?: number;
  };
};

export type RecordSnippetFeedbackResult = {
  success: boolean;
  feedbackId?: string;
  reward?: number;
  confidence?: number;
  error?: string;
};

// === Main Functions ===

/**
 * Record user feedback for a specific snippet
 *
 * @param params - Feedback parameters
 * @returns Result with feedback ID and computed reward
 *
 * @example
 * ```typescript
 * // Thumbs up on snippet
 * await recordSnippetFeedback({
 *   userId: "user123",
 *   snipId: "snp_abc123",
 *   clusterId: "cl_deploy",
 *   thumb: "up"
 * });
 *
 * // Star rating
 * await recordSnippetFeedback({
 *   userId: "user123",
 *   snipId: "snp_xyz789",
 *   stars: 4,
 *   metadata: { snippet_text: "Deploy to production", position: 2 }
 * });
 * ```
 */
export async function recordSnippetFeedback(
  params: RecordSnippetFeedbackParams
): Promise<RecordSnippetFeedbackResult> {
  const { userId, snipId, clusterId, turnId, thumb, stars, metadata } = params;

  try {
    // Validate inputs
    if (!userId || !snipId) {
      return {
        success: false,
        error: "userId and snipId are required",
      };
    }

    if (!thumb && !stars) {
      return {
        success: false,
        error: "Either thumb or stars feedback is required",
      };
    }

    // Compute reward and confidence using existing system
    const { reward, confidence } = computeReward({ thumb, stars });

    // Generate feedback ID
    const feedbackId = generateSnippetFeedbackId();

    // Create feedback event
    const event: SnippetFeedbackEvent = {
      sfb_id: feedbackId,
      user_id: userId,
      snip_id: snipId,
      cluster_id: clusterId,
      turn_id: turnId,
      thumb,
      stars,
      reward,
      confidence,
      created_at: FieldValue.serverTimestamp(),
      ...createTTLField('snippetFeedback'), // Phase 57.3: TTL
      metadata,
    };

    // Write to Firestore
    const ref = db.collection(COL_SNIPPET_FEEDBACK).doc(feedbackId);
    await ref.set(event, { merge: false });

    console.log(
      `[snippetFeedback] Recorded feedback ${feedbackId} for snippet ${snipId} (reward: ${reward})`
    );

    return {
      success: true,
      feedbackId,
      reward,
      confidence,
    };
  } catch (error) {
    console.error("[snippetFeedback] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Batch record multiple snippet feedback events
 */
export async function recordSnippetFeedbackBatch(
  feedbackList: RecordSnippetFeedbackParams[]
): Promise<RecordSnippetFeedbackResult[]> {
  const results: RecordSnippetFeedbackResult[] = [];

  for (const params of feedbackList) {
    const result = await recordSnippetFeedback(params);
    results.push(result);
  }

  return results;
}

/**
 * Get all feedback for a snippet
 */
export async function getFeedbackForSnippet(
  snipId: string,
  options: {
    userId?: string;
    limit?: number;
    orderBy?: "recent" | "oldest";
  } = {}
): Promise<SnippetFeedbackEvent[]> {
  const { userId, limit = 100, orderBy = "recent" } = options;

  let query = db
    .collection(COL_SNIPPET_FEEDBACK)
    .where("snip_id", "==", snipId);

  if (userId) {
    query = query.where("user_id", "==", userId) as any;
  }

  query = query.orderBy("created_at", orderBy === "recent" ? "desc" : "asc");

  if (limit) {
    query = query.limit(limit);
  }

  const snap = await query.get();
  return snap.docs.map((doc) => doc.data() as SnippetFeedbackEvent);
}

/**
 * Get all feedback by a user
 */
export async function getFeedbackByUser(
  userId: string,
  options: {
    limit?: number;
    orderBy?: "recent" | "oldest";
  } = {}
): Promise<SnippetFeedbackEvent[]> {
  const { limit = 100, orderBy = "recent" } = options;

  let query = db
    .collection(COL_SNIPPET_FEEDBACK)
    .where("user_id", "==", userId);

  query = query.orderBy("created_at", orderBy === "recent" ? "desc" : "asc");

  if (limit) {
    query = query.limit(limit);
  }

  const snap = await query.get();
  return snap.docs.map((doc) => doc.data() as SnippetFeedbackEvent);
}

/**
 * Get aggregated snippet feedback statistics
 */
export async function getSnippetStats(
  snipId: string
): Promise<{
  count: number;
  avgReward: number;
  thumbsUp: number;
  thumbsDown: number;
  avgStars: number;
  recentFeedback: SnippetFeedbackEvent[];
}> {
  const feedback = await getFeedbackForSnippet(snipId, { limit: 1000 });

  if (!feedback.length) {
    return {
      count: 0,
      avgReward: 0,
      thumbsUp: 0,
      thumbsDown: 0,
      avgStars: 0,
      recentFeedback: [],
    };
  }

  const thumbsUp = feedback.filter((f) => f.thumb === "up").length;
  const thumbsDown = feedback.filter((f) => f.thumb === "down").length;

  const totalReward = feedback.reduce((sum, f) => sum + f.reward, 0);
  const avgReward = totalReward / feedback.length;

  const starRatings = feedback.filter((f) => f.stars !== undefined);
  const avgStars =
    starRatings.length > 0
      ? starRatings.reduce((sum, f) => sum + (f.stars || 0), 0) /
        starRatings.length
      : 0;

  return {
    count: feedback.length,
    avgReward,
    thumbsUp,
    thumbsDown,
    avgStars,
    recentFeedback: feedback.slice(0, 10),
  };
}

/**
 * Get top-rated snippets
 */
export async function getTopSnippets(
  options: {
    userId?: string;
    minFeedbackCount?: number;
    limit?: number;
  } = {}
): Promise<
  Array<{
    snip_id: string;
    avgReward: number;
    feedbackCount: number;
  }>
> {
  const { userId, minFeedbackCount = 2, limit = 20 } = options;

  // Query feedback events
  let query = db.collection(COL_SNIPPET_FEEDBACK);

  if (userId) {
    query = query.where("user_id", "==", userId) as any;
  }

  const snap = await query.get();

  // Group by snippet
  const snippetStats = new Map<
    string,
    { totalReward: number; count: number }
  >();

  snap.docs.forEach((doc) => {
    const event = doc.data() as SnippetFeedbackEvent;
    const existing = snippetStats.get(event.snip_id) || {
      totalReward: 0,
      count: 0,
    };

    snippetStats.set(event.snip_id, {
      totalReward: existing.totalReward + event.reward,
      count: existing.count + 1,
    });
  });

  // Compute averages and filter
  const results = Array.from(snippetStats.entries())
    .map(([snip_id, stats]) => ({
      snip_id,
      avgReward: stats.totalReward / stats.count,
      feedbackCount: stats.count,
    }))
    .filter((s) => s.feedbackCount >= minFeedbackCount)
    .sort((a, b) => b.avgReward - a.avgReward)
    .slice(0, limit);

  return results;
}

/**
 * Delete snippet feedback (admin only)
 */
export async function deleteSnippetFeedback(
  feedbackId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ref = db.collection(COL_SNIPPET_FEEDBACK).doc(feedbackId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, error: "Feedback not found" };
    }

    await ref.delete();

    console.log(`[snippetFeedback] Deleted feedback ${feedbackId}`);
    return { success: true };
  } catch (error) {
    console.error("[snippetFeedback] Delete error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fuse multiple feedback signals for snippet quality
 * Combines thumb and stars with weighted average
 */
export function fuseSnippetSignals(signals: {
  thumb?: { reward: number; confidence: number };
  stars?: { reward: number; confidence: number };
}): { reward: number; confidence: number } {
  const { thumb, stars } = signals;

  if (!thumb && !stars) {
    return { reward: 0, confidence: 0 };
  }

  if (thumb && !stars) {
    return thumb;
  }

  if (stars && !thumb) {
    return stars;
  }

  // Both present: weighted average by confidence
  const totalConfidence = (thumb?.confidence || 0) + (stars?.confidence || 0);

  if (totalConfidence === 0) {
    return { reward: 0, confidence: 0 };
  }

  const reward =
    ((thumb?.reward || 0) * (thumb?.confidence || 0) +
      (stars?.reward || 0) * (stars?.confidence || 0)) /
    totalConfidence;

  const confidence = totalConfidence / 2; // Average confidence

  return { reward, confidence };
}

// === Helper Functions ===

/**
 * Generate unique snippet feedback ID
 */
function generateSnippetFeedbackId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `sfb_${timestamp}_${random}`;
}

/**
 * Get snippet feedback summary for cluster
 */
export async function getClusterSnippetFeedback(
  clusterId: string
): Promise<{
  totalFeedback: number;
  avgReward: number;
  topSnippets: Array<{ snip_id: string; avgReward: number; count: number }>;
}> {
  const query = db
    .collection(COL_SNIPPET_FEEDBACK)
    .where("cluster_id", "==", clusterId)
    .limit(1000);

  const snap = await query.get();

  if (snap.empty) {
    return {
      totalFeedback: 0,
      avgReward: 0,
      topSnippets: [],
    };
  }

  const feedback = snap.docs.map((doc) => doc.data() as SnippetFeedbackEvent);

  const totalReward = feedback.reduce((sum, f) => sum + f.reward, 0);
  const avgReward = totalReward / feedback.length;

  // Group by snippet
  const snippetStats = new Map<
    string,
    { totalReward: number; count: number }
  >();

  feedback.forEach((f) => {
    const existing = snippetStats.get(f.snip_id) || {
      totalReward: 0,
      count: 0,
    };
    snippetStats.set(f.snip_id, {
      totalReward: existing.totalReward + f.reward,
      count: existing.count + 1,
    });
  });

  const topSnippets = Array.from(snippetStats.entries())
    .map(([snip_id, stats]) => ({
      snip_id,
      avgReward: stats.totalReward / stats.count,
      count: stats.count,
    }))
    .sort((a, b) => b.avgReward - a.avgReward)
    .slice(0, 5);

  return {
    totalFeedback: feedback.length,
    avgReward,
    topSnippets,
  };
}
