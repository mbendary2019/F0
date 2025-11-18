/**
 * Online Learning - Incremental Model Updates
 *
 * Implements gradient descent for learning validation weights from labeled samples.
 * Samples are stored in Firestore: ops_validate_samples
 */

import { adminDb } from "@/lib/firebaseAdmin";
import type { Weights } from "./scorerModel";

/**
 * Labeled training sample
 */
export type Sample = {
  subscores: {
    citation: number;
    context: number;
    source: number;
    relevance: number;
  };
  pass: boolean;  // Ground truth label (true = should pass validation)
};

/**
 * Sample document stored in Firestore
 */
export type SampleDoc = Sample & {
  sessionId: string;
  goal: string;
  strategy: string;
  ts: number;
};

/**
 * Perform one gradient descent step
 *
 * Uses simple linear gradient update on binary classification loss.
 * For a more sophisticated approach, consider logistic regression.
 *
 * @param weights - Current weight vector
 * @param sample - Training sample with label
 * @param learningRate - Learning rate (default 0.05)
 * @returns Updated weights
 */
export function gradientStep(
  weights: Weights,
  sample: Sample,
  learningRate = 0.05
): Weights {
  // Calculate current prediction
  const prediction =
    weights.citation * sample.subscores.citation +
    weights.context * sample.subscores.context +
    weights.source * sample.subscores.source +
    weights.relevance * sample.subscores.relevance;

  // Binary target (0 or 1)
  const target = sample.pass ? 1 : 0;

  // Error (simplified linear loss)
  const error = prediction - target;

  // Gradient descent update
  const updated = {
    citation: weights.citation - learningRate * error * sample.subscores.citation,
    context: weights.context - learningRate * error * sample.subscores.context,
    source: weights.source - learningRate * error * sample.subscores.source,
    relevance: weights.relevance - learningRate * error * sample.subscores.relevance,
  };

  // Ensure weights stay in valid range [0, 1]
  return {
    citation: Math.max(0, Math.min(1, updated.citation)),
    context: Math.max(0, Math.min(1, updated.context)),
    source: Math.max(0, Math.min(1, updated.source)),
    relevance: Math.max(0, Math.min(1, updated.relevance)),
  };
}

/**
 * Fetch labeled samples from Firestore
 *
 * @param limit - Maximum number of samples to fetch
 * @param strategy - Optional filter by strategy
 * @returns Array of labeled samples
 */
export async function fetchLabeledSamples(
  limit = 1000,
  strategy?: string
): Promise<Sample[]> {
  try {
    let query = adminDb
      .collection("ops_validate_samples")
      .orderBy("ts", "desc")
      .limit(limit);

    if (strategy) {
      query = query.where("strategy", "==", strategy) as any;
    }

    const snap = await query.get();

    return snap.docs.map((doc) => {
      const data = doc.data() as SampleDoc;
      return {
        subscores: data.subscores,
        pass: !!data.pass,
      };
    });
  } catch (err) {
    console.error("[online_learning] Error fetching samples:", err);
    return [];
  }
}

/**
 * Train weights using multiple samples with mini-batch gradient descent
 *
 * @param initialWeights - Starting weights
 * @param samples - Training samples
 * @param options - Training options
 * @returns Trained weights
 */
export function trainWeights(
  initialWeights: Weights,
  samples: Sample[],
  options?: {
    epochs?: number;
    learningRate?: number;
    shuffle?: boolean;
  }
): Weights {
  const epochs = options?.epochs ?? 3;
  const learningRate = options?.learningRate ?? 0.05;
  const shuffle = options?.shuffle ?? true;

  let weights = { ...initialWeights };

  for (let epoch = 0; epoch < epochs; epoch++) {
    const batchSamples = shuffle ? shuffleArray([...samples]) : samples;

    for (const sample of batchSamples) {
      weights = gradientStep(weights, sample, learningRate);
    }

    // Log progress
    if (samples.length > 0) {
      const loss = calculateLoss(weights, samples);
      console.log(`[online_learning] Epoch ${epoch + 1}/${epochs}, Loss: ${loss.toFixed(4)}`);
    }
  }

  return weights;
}

/**
 * Calculate mean squared error loss
 */
function calculateLoss(weights: Weights, samples: Sample[]): number {
  if (samples.length === 0) return 0;

  const totalError = samples.reduce((sum, sample) => {
    const prediction =
      weights.citation * sample.subscores.citation +
      weights.context * sample.subscores.context +
      weights.source * sample.subscores.source +
      weights.relevance * sample.subscores.relevance;

    const target = sample.pass ? 1 : 0;
    const error = prediction - target;
    return sum + error * error;
  }, 0);

  return totalError / samples.length;
}

/**
 * Shuffle array in place (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Save a labeled sample to Firestore
 *
 * @param sample - Sample to save
 */
export async function saveSample(sample: SampleDoc): Promise<void> {
  try {
    await adminDb.collection("ops_validate_samples").add(sample);
    console.log(`[online_learning] Saved sample for session ${sample.sessionId}`);
  } catch (err) {
    console.error("[online_learning] Error saving sample:", err);
    throw err;
  }
}

/**
 * Get sample statistics
 */
export async function getSampleStats(): Promise<{
  total: number;
  passed: number;
  failed: number;
  byStrategy: Record<string, { passed: number; failed: number }>;
}> {
  try {
    const snap = await adminDb.collection("ops_validate_samples").get();

    const stats = {
      total: snap.size,
      passed: 0,
      failed: 0,
      byStrategy: {} as Record<string, { passed: number; failed: number }>,
    };

    snap.docs.forEach((doc) => {
      const data = doc.data() as SampleDoc;
      if (data.pass) {
        stats.passed++;
      } else {
        stats.failed++;
      }

      const strategy = data.strategy || "default";
      if (!stats.byStrategy[strategy]) {
        stats.byStrategy[strategy] = { passed: 0, failed: 0 };
      }
      if (data.pass) {
        stats.byStrategy[strategy].passed++;
      } else {
        stats.byStrategy[strategy].failed++;
      }
    });

    return stats;
  } catch (err) {
    console.error("[online_learning] Error getting stats:", err);
    return {
      total: 0,
      passed: 0,
      failed: 0,
      byStrategy: {},
    };
  }
}
