// src/lib/ai/feedback/feedbackSchema.ts
// Firestore schema and types for memory feedback and reinforcement learning

import { db } from "../memory/firestoreSchema";
import type { FieldValue, Timestamp } from "firebase-admin/firestore";

// Re-export computeReward from computeRewards for backward compatibility
export { computeReward } from "./computeRewards";

// === Collections ===
export const COL_FEEDBACK = "ops_memory_feedback" as const;

// === Types ===

/**
 * Feedback type: thumbs up/down or star rating
 */
export type Thumb = "up" | "down";

/**
 * Feedback Event Document (Immutable)
 * Each user interaction creates a new event record
 */
export type FeedbackEvent = {
  fb_id: string; // Unique feedback ID (e.g., "fb_1234567890")
  user_id: string; // User who gave feedback
  cluster_id: string; // Target cluster
  turn_id?: string; // Optional: conversational turn ID
  stars?: number; // Star rating (1..5) if applicable
  thumb?: Thumb; // Thumb up/down if applicable
  reward: number; // Computed reward value [-1, 1]
  confidence: number; // Confidence in reward (0..1)
  created_at: FieldValue | Timestamp; // Event timestamp
  metadata?: {
    // Optional metadata
    session_id?: string;
    query?: string; // Original query that led to this cluster
    context?: string; // Additional context
  };
};

/**
 * Cluster Feedback Statistics
 * Aggregated stats stored in ClusterDoc.feedback field
 */
export type ClusterFeedbackStats = {
  count: number; // Total feedback events
  sumReward: number; // Sum of all rewards
  sumRewardSq: number; // Sum of squared rewards (for variance)
  meanReward: number; // Mean reward
  stdReward: number; // Standard deviation
  last_feedback_at: FieldValue | Timestamp; // Last feedback timestamp
};

/**
 * Weighting Parameters
 * Configuration for EMA, Bayesian smoothing, time decay, and blending
 */
export type WeightingParams = {
  // EMA (Exponential Moving Average)
  alpha: number; // Learning rate (default: 0.1)

  // Bayesian Smoothing
  priorMean: number; // Prior mean reward (default: 0.0)
  priorK: number; // Prior pseudo-count strength (default: 5.0)

  // Time Decay
  decayHalfLifeDays: number; // Half-life in days (default: 21)

  // Blending Coefficients (must sum to 1)
  blendSimilarity: number; // α: weight for cosine similarity (default: 0.5)
  blendWeight: number; // β: weight for cluster weight (default: 0.3)
  blendRecency: number; // γ: weight for recency (default: 0.2)
};

/**
 * Weighted Cluster Result
 * Enhanced cluster with computed weight and blended score
 */
export type WeightedCluster = {
  cluster_id: string;
  weight: number; // Computed weight from feedback
  similarity: number; // Cosine similarity to query
  recency_score: number; // Time-based recency score
  blended_score: number; // Final blended score
  feedback_stats?: ClusterFeedbackStats; // Optional feedback stats
};

// === Default Configuration ===

/**
 * Default weighting parameters
 */
export const DEFAULT_WEIGHTING_PARAMS: WeightingParams = {
  alpha: 0.1, // Conservative learning rate
  priorMean: 0.0, // Neutral prior
  priorK: 5.0, // Moderate prior strength
  decayHalfLifeDays: 21, // 3 weeks half-life
  blendSimilarity: 0.5, // 50% similarity
  blendWeight: 0.3, // 30% learned weight
  blendRecency: 0.2, // 20% recency
};

/**
 * Validate that blend coefficients sum to 1.0
 */
export function validateBlendCoeffs(params: WeightingParams): boolean {
  const sum = params.blendSimilarity + params.blendWeight + params.blendRecency;
  return Math.abs(sum - 1.0) < 1e-6; // Allow small floating point error
}

/**
 * Normalize blend coefficients to sum to 1.0
 */
export function normalizeBlendCoeffs(
  params: Partial<WeightingParams>
): WeightingParams {
  const full = { ...DEFAULT_WEIGHTING_PARAMS, ...params };
  const sum =
    full.blendSimilarity + full.blendWeight + full.blendRecency;

  if (Math.abs(sum - 1.0) < 1e-6) {
    return full; // Already normalized
  }

  // Normalize to sum to 1
  return {
    ...full,
    blendSimilarity: full.blendSimilarity / sum,
    blendWeight: full.blendWeight / sum,
    blendRecency: full.blendRecency / sum,
  };
}

// === Firestore Collection References ===

/**
 * Get feedback collection reference
 */
export function getFeedbackCollection() {
  return db.collection(COL_FEEDBACK);
}

/**
 * Get feedback document reference
 */
export function getFeedbackDoc(feedbackId: string) {
  return db.collection(COL_FEEDBACK).doc(feedbackId);
}

// === Validation Helpers ===

/**
 * Validate feedback event structure
 */
export function isValidFeedbackEvent(doc: unknown): doc is FeedbackEvent {
  if (typeof doc !== "object" || doc === null) return false;
  const d = doc as Record<string, unknown>;

  const hasBasicFields =
    typeof d.fb_id === "string" &&
    typeof d.user_id === "string" &&
    typeof d.cluster_id === "string" &&
    typeof d.reward === "number" &&
    typeof d.confidence === "number";

  if (!hasBasicFields) return false;

  // Validate reward range
  if (d.reward < -1 || d.reward > 1) return false;

  // Validate confidence range
  if (d.confidence < 0 || d.confidence > 1) return false;

  // Validate stars if present
  if (d.stars !== undefined) {
    if (typeof d.stars !== "number" || d.stars < 1 || d.stars > 5) {
      return false;
    }
  }

  // Validate thumb if present
  if (d.thumb !== undefined) {
    if (d.thumb !== "up" && d.thumb !== "down") {
      return false;
    }
  }

  return true;
}

/**
 * Validate cluster feedback stats structure
 */
export function isValidFeedbackStats(
  stats: unknown
): stats is ClusterFeedbackStats {
  if (typeof stats !== "object" || stats === null) return false;
  const s = stats as Record<string, unknown>;

  return (
    typeof s.count === "number" &&
    typeof s.sumReward === "number" &&
    typeof s.sumRewardSq === "number" &&
    typeof s.meanReward === "number" &&
    typeof s.stdReward === "number" &&
    s.count >= 0
  );
}

// === JSON Converters ===

/**
 * Convert FeedbackEvent to JSON-safe object
 */
export function feedbackEventToJSON(
  event: FeedbackEvent
): Record<string, unknown> {
  return {
    fb_id: event.fb_id,
    user_id: event.user_id,
    cluster_id: event.cluster_id,
    turn_id: event.turn_id,
    stars: event.stars,
    thumb: event.thumb,
    reward: event.reward,
    confidence: event.confidence,
    created_at:
      event.created_at && typeof event.created_at === "object" && "toDate" in event.created_at
        ? (event.created_at as Timestamp).toDate().toISOString()
        : null,
    metadata: event.metadata,
  };
}

/**
 * Convert ClusterFeedbackStats to JSON-safe object
 */
export function feedbackStatsToJSON(
  stats: ClusterFeedbackStats
): Record<string, unknown> {
  return {
    count: stats.count,
    sumReward: stats.sumReward,
    sumRewardSq: stats.sumRewardSq,
    meanReward: stats.meanReward,
    stdReward: stats.stdReward,
    last_feedback_at:
      stats.last_feedback_at && typeof stats.last_feedback_at === "object" && "toDate" in stats.last_feedback_at
        ? (stats.last_feedback_at as Timestamp).toDate().toISOString()
        : null,
  };
}
