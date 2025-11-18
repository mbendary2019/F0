/**
 * Linear Scorer Plugin
 *
 * Enhanced linear model that combines multiple features with learned weights.
 * This is an improvement over Day 2's fixed weights, supporting:
 * - More features (5+ instead of 4)
 * - Feature importance tracking
 * - Confidence intervals
 */

import type { ScorerPlugin, FeatureVector, ScorerMetadata } from "./base";
import { BaseScorerPlugin } from "./base";

/**
 * Default feature weights
 * Optimized for general validation tasks
 */
const DEFAULT_WEIGHTS: FeatureVector = {
  citation_count: 0.15,         // Citation coverage
  citation_avg_score: 0.20,     // Citation quality
  text_len: 0.10,               // Response completeness
  hint_hit_rate: 0.25,          // Context alignment
  uniq_terms_overlap: 0.30,     // Query relevance
};

/**
 * Linear scorer implementation
 *
 * Computes validation score as weighted sum of features:
 * score = Σ(weight_i × feature_i)
 */
export class LinearScorer extends BaseScorerPlugin implements ScorerPlugin {
  name = "linear";
  version = "1.0";

  constructor(private weights: FeatureVector = DEFAULT_WEIGHTS) {
    super();
  }

  /**
   * Score features using linear combination
   */
  score(features: FeatureVector): number {
    let score = 0;
    const keys = Object.keys(this.weights);

    for (const key of keys) {
      const weight = this.weights[key] || 0;
      const feature = features[key] || 0;
      score += weight * feature;
    }

    return this.clamp(score);
  }

  /**
   * Get feature importance (weights normalized to sum to 1)
   */
  getFeatureImportance(): Record<string, number> {
    const totalWeight = Object.values(this.weights).reduce(
      (sum, w) => sum + Math.abs(w),
      0
    );

    const importance: Record<string, number> = {};
    for (const [key, weight] of Object.entries(this.weights)) {
      importance[key] = totalWeight > 0 ? Math.abs(weight) / totalWeight : 0;
    }

    return importance;
  }

  /**
   * Get confidence interval for score
   * For linear model, confidence is based on feature completeness
   */
  getConfidence(features: FeatureVector): {
    score: number;
    confidence: number;
    lower: number;
    upper: number;
  } {
    const score = this.score(features);

    // Confidence based on how many features are non-zero
    const featureCount = Object.keys(this.weights).length;
    const nonZeroFeatures = Object.keys(features).filter(
      (k) => features[k] > 0
    ).length;

    const confidence = featureCount > 0 ? nonZeroFeatures / featureCount : 0;

    // Simple confidence interval (can be improved with statistical methods)
    const margin = (1 - confidence) * 0.2; // Max margin of 0.2
    const lower = this.clamp(score - margin);
    const upper = this.clamp(score + margin);

    return {
      score,
      confidence: Number(confidence.toFixed(3)),
      lower: Number(lower.toFixed(3)),
      upper: Number(upper.toFixed(3)),
    };
  }

  /**
   * Update weights (for online learning)
   */
  updateWeights(newWeights: Partial<FeatureVector>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Get current weights
   */
  getWeights(): FeatureVector {
    return { ...this.weights };
  }

  /**
   * Get metadata
   */
  getMetadata(): ScorerMetadata {
    return {
      name: this.name,
      version: this.version,
      description: "Linear scorer with weighted feature combination",
      featureNames: Object.keys(this.weights),
    };
  }
}

/**
 * Create a linear scorer with custom weights
 */
export function createLinearScorer(
  weights?: Partial<FeatureVector>
): LinearScorer {
  const mergedWeights = { ...DEFAULT_WEIGHTS, ...weights };
  return new LinearScorer(mergedWeights);
}

/**
 * Get default linear scorer
 */
export function getDefaultLinearScorer(): LinearScorer {
  return new LinearScorer();
}
