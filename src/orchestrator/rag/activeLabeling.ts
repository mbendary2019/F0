/**
 * Active Labeling Helper
 *
 * Identifies uncertain validation samples that would benefit from human labeling.
 * Uses confidence bands to detect samples where the model is unsure.
 *
 * Strategy:
 * - Samples in "uncertainty band" (0.45-0.60) are flagged for review
 * - Prioritizes samples with low confidence scores
 * - Balances across different strategies (critic, majority, default)
 */

import type { FeatureVector } from "./scorerPlugins/base";
import { getScorer } from "./scorerPlugins/registry";

/**
 * Default uncertainty band
 * Scores in this range indicate model uncertainty
 */
export const DEFAULT_UNCERTAINTY_BAND = {
  lower: 0.45,
  upper: 0.60,
};

/**
 * Minimum confidence threshold
 * Below this, we consider the model uncertain
 */
export const MIN_CONFIDENCE = 0.7;

/**
 * Check if a sample is uncertain and should be labeled
 *
 * A sample is uncertain if:
 * 1. Score falls in uncertainty band (0.45-0.60), OR
 * 2. Confidence is below threshold (< 0.7)
 *
 * @param score - Validation score (0-1)
 * @param confidence - Confidence level (0-1)
 * @returns true if sample should be labeled
 *
 * @example
 * ```typescript
 * const scorer = getScorer();
 * const features = extractAllFeatures({...});
 * const result = scorer.getConfidence?.(features) || { score: 0.5, confidence: 1 };
 *
 * if (isUncertain(result.score, result.confidence)) {
 *   // Flag for human labeling
 *   await saveSampleForReview(features, result);
 * }
 * ```
 */
export function isUncertain(
  score: number,
  confidence: number = 1.0,
  band = DEFAULT_UNCERTAINTY_BAND
): boolean {
  // Check if score is in uncertainty band
  const inBand = score >= band.lower && score <= band.upper;

  // Check if confidence is too low
  const lowConfidence = confidence < MIN_CONFIDENCE;

  return inBand || lowConfidence;
}

/**
 * Get uncertainty score (0-1, higher = more uncertain)
 *
 * Combines distance from decision boundary with confidence.
 * Used for prioritizing which samples to label first.
 *
 * @param score - Validation score (0-1)
 * @param confidence - Confidence level (0-1)
 * @param threshold - Decision boundary (default 0.55)
 * @returns Uncertainty score (0-1)
 *
 * @example
 * ```typescript
 * const uncertainty1 = getUncertaintyScore(0.54, 0.6, 0.55); // High (near boundary, low confidence)
 * const uncertainty2 = getUncertaintyScore(0.90, 0.95, 0.55); // Low (far from boundary, high confidence)
 * ```
 */
export function getUncertaintyScore(
  score: number,
  confidence: number,
  threshold: number = 0.55
): number {
  // Distance from decision boundary (0 = at boundary, 0.5 = max distance)
  const distanceFromBoundary = Math.abs(score - threshold);

  // Normalize to 0-1 (closer to boundary = higher uncertainty)
  const boundaryUncertainty = 1 - Math.min(1, distanceFromBoundary / 0.5);

  // Confidence uncertainty (lower confidence = higher uncertainty)
  const confidenceUncertainty = 1 - confidence;

  // Combine both factors (weighted average)
  const uncertainty = 0.6 * boundaryUncertainty + 0.4 * confidenceUncertainty;

  return Number(uncertainty.toFixed(3));
}

/**
 * Suggest samples for labeling
 *
 * Returns samples sorted by uncertainty score (most uncertain first).
 * Useful for active learning: label the most uncertain samples to improve the model.
 *
 * @param samples - Array of validation samples with scores and confidence
 * @param limit - Maximum number of samples to return
 * @param threshold - Decision boundary
 * @returns Sorted array of samples with uncertainty scores
 *
 * @example
 * ```typescript
 * const samples = [
 *   { id: "1", score: 0.52, confidence: 0.65, features: {...} },
 *   { id: "2", score: 0.90, confidence: 0.95, features: {...} },
 *   { id: "3", score: 0.48, confidence: 0.60, features: {...} },
 * ];
 *
 * const toLabel = suggestSamplesForLabeling(samples, 2, 0.55);
 * // Returns: [sample3, sample1] (most uncertain first)
 * ```
 */
export function suggestSamplesForLabeling<T extends { score: number; confidence?: number }>(
  samples: T[],
  limit: number = 10,
  threshold: number = 0.55
): Array<T & { uncertainty: number }> {
  // Calculate uncertainty for each sample
  const withUncertainty = samples.map((sample) => ({
    ...sample,
    uncertainty: getUncertaintyScore(
      sample.score,
      sample.confidence ?? 1.0,
      threshold
    ),
  }));

  // Sort by uncertainty (highest first)
  withUncertainty.sort((a, b) => b.uncertainty - a.uncertainty);

  // Return top N most uncertain
  return withUncertainty.slice(0, limit);
}

/**
 * Check if we have enough labeled samples to calibrate
 *
 * @param labeledCount - Number of labeled samples
 * @param minRequired - Minimum samples required (default 50)
 * @returns true if we can calibrate
 */
export function canCalibrate(
  labeledCount: number,
  minRequired: number = 50
): boolean {
  return labeledCount >= minRequired;
}

/**
 * Active learning metrics
 */
export interface ActiveLearningMetrics {
  /** Total samples seen */
  total: number;

  /** Samples labeled by humans */
  labeled: number;

  /** Samples in uncertainty band */
  uncertain: number;

  /** Samples with low confidence */
  lowConfidence: number;

  /** Percentage of samples requiring labeling */
  labelingRate: number;

  /** Can we calibrate with current labeled count? */
  canCalibrate: boolean;
}

/**
 * Calculate active learning metrics
 *
 * @param samples - All validation samples
 * @param labeledSamples - Samples that have been labeled
 * @returns Metrics for monitoring active learning
 */
export function getActiveLearningMetrics(
  samples: Array<{ score: number; confidence?: number }>,
  labeledSamples: Array<unknown>
): ActiveLearningMetrics {
  const total = samples.length;
  const labeled = labeledSamples.length;

  // Count uncertain samples
  const uncertain = samples.filter((s) =>
    isUncertain(s.score, s.confidence ?? 1.0)
  ).length;

  // Count low confidence samples
  const lowConfidence = samples.filter(
    (s) => (s.confidence ?? 1.0) < MIN_CONFIDENCE
  ).length;

  // Labeling rate
  const labelingRate = total > 0 ? Number((uncertain / total).toFixed(3)) : 0;

  return {
    total,
    labeled,
    uncertain,
    lowConfidence,
    labelingRate,
    canCalibrate: canCalibrate(labeled),
  };
}

/**
 * Strategy balancing
 *
 * Ensures we have labeled samples across all strategies.
 * Returns recommended strategy to focus labeling on.
 */
export function recommendStrategyToLabel(
  labeledByStrategy: Record<string, number>
): string {
  // Target distribution: critic=40%, majority=40%, default=20%
  const targets = {
    critic: 0.4,
    majority: 0.4,
    default: 0.2,
  };

  const total = Object.values(labeledByStrategy).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return "critic"; // Start with critic
  }

  // Calculate deviation from target for each strategy
  const deviations = Object.entries(targets).map(([strategy, target]) => {
    const actual = (labeledByStrategy[strategy] || 0) / total;
    const deviation = target - actual;
    return { strategy, deviation };
  });

  // Return strategy with largest positive deviation (most underrepresented)
  deviations.sort((a, b) => b.deviation - a.deviation);
  return deviations[0].strategy;
}
