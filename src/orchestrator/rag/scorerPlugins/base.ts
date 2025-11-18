/**
 * Scorer Plugin Base Interface
 *
 * Defines the contract for validation scoring plugins.
 * Plugins can use different ML algorithms (linear, XGBoost, neural nets, etc.)
 * while maintaining a consistent interface.
 */

/**
 * Feature vector for scoring
 * Keys are feature names, values are normalized scores (0-1)
 */
export type FeatureVector = Record<string, number>;

/**
 * Scorer plugin interface
 * All scorers must implement this interface
 */
export interface ScorerPlugin {
  /**
   * Plugin name (e.g., "linear", "xgboost", "neural")
   */
  name: string;

  /**
   * Plugin version
   */
  version: string;

  /**
   * Score a feature vector
   *
   * @param features - Normalized feature vector (all values 0-1)
   * @returns Validation score (0-1)
   *
   * @example
   * ```typescript
   * const score = plugin.score({
   *   citation_count: 0.5,
   *   citation_avg_score: 0.8,
   *   text_len: 0.2,
   *   hint_hit_rate: 1.0,
   *   uniq_terms_overlap: 0.7
   * });
   * // score: 0.72
   * ```
   */
  score(features: FeatureVector): number;

  /**
   * Optional: Get feature importance scores
   * Useful for model interpretability
   */
  getFeatureImportance?(): Record<string, number>;

  /**
   * Optional: Get confidence interval for score
   * Useful for active learning
   */
  getConfidence?(features: FeatureVector): {
    score: number;
    confidence: number;
    lower: number;
    upper: number;
  };
}

/**
 * Scorer plugin metadata
 */
export type ScorerMetadata = {
  name: string;
  version: string;
  description: string;
  featureNames: string[];
  trainedOn?: {
    samples: number;
    accuracy?: number;
    timestamp?: number;
  };
};

/**
 * Base class for scorer plugins (optional convenience)
 */
export abstract class BaseScorerPlugin implements ScorerPlugin {
  abstract name: string;
  abstract version: string;

  abstract score(features: FeatureVector): number;

  /**
   * Clamp score to [0, 1] range
   */
  protected clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  /**
   * Get metadata about this scorer
   */
  getMetadata(): ScorerMetadata {
    return {
      name: this.name,
      version: this.version,
      description: `${this.name} scorer plugin v${this.version}`,
      featureNames: [],
    };
  }
}
