// src/lib/ai/feedback/computeRewards.ts
// Map user feedback (thumbs/stars) to reward values [-1, 1]

import type { Thumb } from "./feedbackSchema";

// === Reward Mapping Functions ===

/**
 * Map thumb feedback to reward value
 *
 * @param thumb - "up" or "down"
 * @returns Reward in [-1, 1]
 */
export function thumbToReward(thumb: Thumb): number {
  return thumb === "up" ? 1.0 : -1.0;
}

/**
 * Map star rating to reward value
 * Linear mapping: 1 star → -1, 3 stars → 0, 5 stars → +1
 *
 * @param stars - Rating from 1 to 5
 * @returns Reward in [-1, 1]
 */
export function starsToReward(stars: number): number {
  if (stars < 1 || stars > 5) {
    throw new Error(`Invalid star rating: ${stars}. Must be between 1 and 5.`);
  }

  // Linear mapping: (stars - 3) / 2
  // 1 → -1.0
  // 2 → -0.5
  // 3 →  0.0
  // 4 → +0.5
  // 5 → +1.0
  return (stars - 3) / 2;
}

/**
 * Compute confidence score based on feedback type
 *
 * Thumbs have binary confidence (user is certain)
 * Stars have graduated confidence (3 stars = low confidence)
 *
 * @param feedback - Feedback type and value
 * @returns Confidence in [0, 1]
 */
export function computeConfidence(feedback: {
  thumb?: Thumb;
  stars?: number;
}): number {
  const { thumb, stars } = feedback;

  if (thumb !== undefined) {
    // Thumbs are binary: high confidence
    return 1.0;
  }

  if (stars !== undefined) {
    // Stars: extremes (1, 5) are high confidence, middle (3) is low
    // Use distance from neutral (3): |stars - 3| / 2
    // 1 → 1.0, 2 → 0.5, 3 → 0.0, 4 → 0.5, 5 → 1.0
    return Math.abs(stars - 3) / 2;
  }

  // No feedback: zero confidence
  return 0.0;
}

/**
 * Compute reward and confidence from user feedback
 *
 * @param feedback - User feedback (thumb or stars)
 * @returns { reward, confidence }
 *
 * @example
 * ```typescript
 * computeReward({ thumb: "up" })
 * // => { reward: 1.0, confidence: 1.0 }
 *
 * computeReward({ stars: 4 })
 * // => { reward: 0.5, confidence: 0.5 }
 *
 * computeReward({ stars: 3 })
 * // => { reward: 0.0, confidence: 0.0 }
 * ```
 */
export function computeReward(feedback: {
  thumb?: Thumb;
  stars?: number;
}): { reward: number; confidence: number } {
  const { thumb, stars } = feedback;

  let reward = 0.0;

  if (thumb !== undefined) {
    reward = thumbToReward(thumb);
  } else if (stars !== undefined) {
    reward = starsToReward(stars);
  }

  const confidence = computeConfidence(feedback);

  return { reward, confidence };
}

/**
 * Weighted reward (multiply by confidence)
 * Used for aggregation when different feedback types are mixed
 *
 * @param reward - Raw reward value
 * @param confidence - Confidence score
 * @returns Weighted reward
 */
export function weightedReward(reward: number, confidence: number): number {
  return reward * confidence;
}

/**
 * Aggregate multiple feedback events into summary stats
 *
 * @param events - Array of { reward, confidence }
 * @returns Summary statistics
 */
export function aggregateRewards(
  events: Array<{ reward: number; confidence: number }>
): {
  count: number;
  sumReward: number;
  sumRewardSq: number;
  meanReward: number;
  stdReward: number;
} {
  if (events.length === 0) {
    return {
      count: 0,
      sumReward: 0,
      sumRewardSq: 0,
      meanReward: 0,
      stdReward: 0,
    };
  }

  // Use confidence-weighted rewards for aggregation
  const weighted = events.map((e) => weightedReward(e.reward, e.confidence));
  const sumConfidence = events.reduce((sum, e) => sum + e.confidence, 0);

  // If total confidence is zero, return neutral stats
  if (sumConfidence === 0) {
    return {
      count: events.length,
      sumReward: 0,
      sumRewardSq: 0,
      meanReward: 0,
      stdReward: 0,
    };
  }

  // Compute weighted mean
  const sumReward = weighted.reduce((sum, r) => sum + r, 0);
  const meanReward = sumReward / sumConfidence;

  // Compute weighted variance
  const sumRewardSq = weighted.reduce(
    (sum, r, i) => sum + r * events[i].reward,
    0
  );
  const variance = sumRewardSq / sumConfidence - meanReward * meanReward;
  const stdReward = Math.sqrt(Math.max(0, variance)); // Clamp to avoid negative variance

  return {
    count: events.length,
    sumReward,
    sumRewardSq,
    meanReward,
    stdReward,
  };
}

/**
 * Apply Bayesian smoothing to mean reward
 * Blends observed mean with prior mean based on pseudo-count strength
 *
 * @param observedMean - Observed mean reward from data
 * @param observedCount - Number of observations
 * @param priorMean - Prior mean (default: 0.0)
 * @param priorK - Prior pseudo-count strength (default: 5.0)
 * @returns Smoothed mean reward
 *
 * @example
 * ```typescript
 * // Few observations: strong pull toward prior
 * bayesianSmooth(0.8, 2, 0.0, 5.0) // => ~0.23
 *
 * // Many observations: weak pull toward prior
 * bayesianSmooth(0.8, 100, 0.0, 5.0) // => ~0.76
 * ```
 */
export function bayesianSmooth(
  observedMean: number,
  observedCount: number,
  priorMean: number = 0.0,
  priorK: number = 5.0
): number {
  if (observedCount === 0) {
    return priorMean;
  }

  // Weighted average: (prior_k * prior_mean + count * observed_mean) / (prior_k + count)
  const totalWeight = priorK + observedCount;
  const smoothed =
    (priorK * priorMean + observedCount * observedMean) / totalWeight;

  return smoothed;
}

/**
 * Apply time decay to reward based on age
 * Exponential decay with configurable half-life
 *
 * @param reward - Original reward value
 * @param ageDays - Age in days
 * @param halfLifeDays - Decay half-life in days (default: 21)
 * @returns Decayed reward
 *
 * @example
 * ```typescript
 * // Fresh feedback: no decay
 * applyTimeDecay(1.0, 0, 21) // => 1.0
 *
 * // Half-life old: 50% decay
 * applyTimeDecay(1.0, 21, 21) // => 0.5
 *
 * // Very old: minimal weight
 * applyTimeDecay(1.0, 84, 21) // => 0.0625
 * ```
 */
export function applyTimeDecay(
  reward: number,
  ageDays: number,
  halfLifeDays: number = 21
): number {
  if (ageDays <= 0) {
    return reward;
  }

  // Exponential decay: reward * 0.5^(age / half_life)
  const decayFactor = Math.pow(0.5, ageDays / halfLifeDays);
  return reward * decayFactor;
}

/**
 * Compute recency score from timestamp
 * Recent items get higher scores (0..1 range)
 *
 * @param timestampMs - Timestamp in milliseconds
 * @param halfLifeDays - Recency half-life in days (default: 21)
 * @returns Recency score in [0, 1]
 */
export function computeRecencyScore(
  timestampMs: number,
  halfLifeDays: number = 21
): number {
  const nowMs = Date.now();
  const ageDays = (nowMs - timestampMs) / (1000 * 60 * 60 * 24);

  if (ageDays <= 0) {
    return 1.0; // Fresh content
  }

  // Exponential decay: 0.5^(age / half_life)
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Normalize score to [0, 1] range using sigmoid
 * Useful for converting unbounded scores to probabilities
 *
 * @param score - Raw score
 * @param center - Center point (default: 0.0)
 * @param scale - Scale factor (default: 1.0)
 * @returns Normalized score in [0, 1]
 */
export function sigmoid(
  score: number,
  center: number = 0.0,
  scale: number = 1.0
): number {
  return 1 / (1 + Math.exp(-(score - center) / scale));
}

/**
 * Clamp value to [min, max] range
 *
 * @param value - Input value
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
