/**
 * Model Calibrator - Automated Model Training and Threshold Optimization
 *
 * Calibrates validation models by:
 * 1. Training weights using labeled samples via gradient descent
 * 2. Optimizing thresholds to achieve target accuracy
 * 3. Computing performance metrics (accuracy, precision, recall)
 */

import type { Weights, Thresholds } from "./scorerModel";
import { scoreWithWeights } from "./scorerModel";
import { fetchLabeledSamples, type Sample } from "./online_learning";

/**
 * Calibration options
 */
export type CalibrationOptions = {
  targetAcc?: number;      // Target accuracy (default 0.75)
  epochs?: number;         // Training epochs (default 3)
  learningRate?: number;   // Learning rate (default 0.05)
  minSamples?: number;     // Minimum samples required (default 50)
};

/**
 * Calibration result
 */
export type CalibrationResult = {
  weights: Weights;
  thresholds: Thresholds;
  metrics: {
    acc: number;           // Accuracy
    precision?: number;    // Precision (true positives / predicted positives)
    recall?: number;       // Recall (true positives / actual positives)
    samples: number;       // Number of samples used
  };
};

/**
 * Clamp value to [0, 1] range
 */
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Calibrate model weights and thresholds
 *
 * @param base - Base model to start from
 * @param options - Calibration options
 * @returns Calibrated weights, thresholds, and metrics
 */
export async function calibrateModel(
  base: { weights: Weights; thresholds: Thresholds },
  options?: CalibrationOptions
): Promise<CalibrationResult> {
  const targetAcc = options?.targetAcc ?? 0.75;
  const epochs = options?.epochs ?? 3;
  const learningRate = options?.learningRate ?? 0.05;
  const minSamples = options?.minSamples ?? 50;

  // Fetch labeled samples
  const samples = await fetchLabeledSamples(2000);

  console.log(`[calibrator] Starting calibration with ${samples.length} samples`);

  // Not enough samples - return base model
  if (samples.length < minSamples) {
    console.warn(`[calibrator] Insufficient samples (${samples.length} < ${minSamples}), using base model`);
    return {
      weights: base.weights,
      thresholds: base.thresholds,
      metrics: {
        acc: 0,
        samples: samples.length,
      },
    };
  }

  // Train weights using gradient descent
  let weights = { ...base.weights };

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const sample of samples) {
      const prediction = scoreWithWeights(sample.subscores as any, weights);
      const target = sample.pass ? 1 : 0;
      const error = prediction - target;

      // Gradient update
      weights.citation = clamp01(
        weights.citation - learningRate * error * sample.subscores.citation
      );
      weights.context = clamp01(
        weights.context - learningRate * error * sample.subscores.context
      );
      weights.source = clamp01(
        weights.source - learningRate * error * sample.subscores.source
      );
      weights.relevance = clamp01(
        weights.relevance - learningRate * error * sample.subscores.relevance
      );
    }

    console.log(`[calibrator] Completed epoch ${epoch + 1}/${epochs}`);
  }

  // Optimize thresholds
  const thresholds = optimizeThresholds(samples, weights, targetAcc);

  // Calculate metrics
  const metrics = calculateMetrics(samples, weights, thresholds.default);

  console.log(`[calibrator] Calibration complete: acc=${metrics.acc.toFixed(3)}, samples=${metrics.samples}`);

  return {
    weights,
    thresholds,
    metrics,
  };
}

/**
 * Optimize thresholds to achieve target accuracy
 *
 * Uses percentile-based threshold selection:
 * - Positive samples: 40th percentile (more lenient)
 * - Negative samples: 60th percentile (more strict)
 * - Default threshold: midpoint
 */
function optimizeThresholds(
  samples: Sample[],
  weights: Weights,
  targetAcc: number
): Thresholds {
  // Calculate scores for all samples
  const scores = samples.map((s) => ({
    sample: s,
    score: scoreWithWeights(s.subscores as any, weights),
  }));

  // Separate positive and negative samples
  const positiveScores = scores
    .filter((x) => x.sample.pass)
    .map((x) => x.score)
    .sort((a, b) => a - b);

  const negativeScores = scores
    .filter((x) => !x.sample.pass)
    .map((x) => x.score)
    .sort((a, b) => a - b);

  // Calculate default threshold
  const posPercentile =
    positiveScores[Math.floor(positiveScores.length * 0.4)] ?? 0.6;
  const negPercentile =
    negativeScores[Math.floor(negativeScores.length * 0.6)] ?? 0.5;

  const defaultThreshold = clamp01((posPercentile + negPercentile) / 2);

  // Strategy-specific thresholds
  const thresholds: Thresholds = {
    default: defaultThreshold,
    critic: clamp01(defaultThreshold + 0.05),   // Stricter
    majority: clamp01(defaultThreshold - 0.05), // More lenient
  };

  console.log(
    `[calibrator] Optimized thresholds: default=${thresholds.default.toFixed(2)}, critic=${thresholds.critic?.toFixed(2)}, majority=${thresholds.majority?.toFixed(2)}`
  );

  return thresholds;
}

/**
 * Calculate performance metrics
 */
function calculateMetrics(
  samples: Sample[],
  weights: Weights,
  threshold: number
): {
  acc: number;
  precision: number;
  recall: number;
  samples: number;
} {
  if (samples.length === 0) {
    return { acc: 0, precision: 0, recall: 0, samples: 0 };
  }

  let truePositives = 0;
  let trueNegatives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const sample of samples) {
    const score = scoreWithWeights(sample.subscores as any, weights);
    const predicted = score >= threshold;
    const actual = sample.pass;

    if (predicted && actual) truePositives++;
    else if (!predicted && !actual) trueNegatives++;
    else if (predicted && !actual) falsePositives++;
    else if (!predicted && actual) falseNegatives++;
  }

  const accuracy = (truePositives + trueNegatives) / samples.length;

  const precision =
    truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 0;

  const recall =
    truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;

  return {
    acc: Number(accuracy.toFixed(3)),
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    samples: samples.length,
  };
}

/**
 * Evaluate model on test samples
 *
 * @param weights - Model weights
 * @param threshold - Validation threshold
 * @param samples - Test samples
 * @returns Performance metrics
 */
export function evaluateModel(
  weights: Weights,
  threshold: number,
  samples: Sample[]
): {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
} {
  const metrics = calculateMetrics(samples, weights, threshold);

  const f1Score =
    metrics.precision + metrics.recall > 0
      ? (2 * metrics.precision * metrics.recall) /
        (metrics.precision + metrics.recall)
      : 0;

  return {
    accuracy: metrics.acc,
    precision: metrics.precision,
    recall: metrics.recall,
    f1Score: Number(f1Score.toFixed(3)),
  };
}

/**
 * Find optimal threshold for target metric
 *
 * @param samples - Training samples
 * @param weights - Model weights
 * @param targetMetric - "accuracy" | "precision" | "recall" | "f1"
 * @param targetValue - Target value for metric
 * @returns Optimal threshold
 */
export function findOptimalThreshold(
  samples: Sample[],
  weights: Weights,
  targetMetric: "accuracy" | "precision" | "recall" | "f1" = "accuracy",
  targetValue = 0.75
): number {
  let bestThreshold = 0.5;
  let bestMetric = 0;

  // Grid search over threshold values
  for (let t = 0.3; t <= 0.8; t += 0.05) {
    const metrics = evaluateModel(weights, t, samples);
    const metricValue = metrics[targetMetric];

    if (metricValue > bestMetric) {
      bestMetric = metricValue;
      bestThreshold = t;
    }
  }

  console.log(
    `[calibrator] Optimal threshold for ${targetMetric}: ${bestThreshold.toFixed(2)} (${targetMetric}=${bestMetric.toFixed(3)})`
  );

  return bestThreshold;
}
