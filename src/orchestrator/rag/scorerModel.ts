/**
 * Scorer Model - Dynamic Validation Model with Learnable Weights
 *
 * Manages loading/saving of validation models with different versions.
 * Each model has configurable weights and strategy-specific thresholds.
 *
 * Models are stored in Firestore: ops_validate_models
 */

import { adminDb } from "@/lib/firebaseAdmin";

/**
 * Weight vector for 4 validation dimensions
 */
export type Weights = {
  citation: number;
  context: number;
  source: number;
  relevance: number;
};

/**
 * Strategy-specific thresholds
 */
export type Thresholds = {
  default: number;     // Default validation threshold
  critic?: number;     // Higher threshold for critic strategy
  majority?: number;   // Lower threshold for majority strategy
};

/**
 * Model document stored in Firestore
 */
export type ModelDoc = {
  version: string;          // Model version identifier
  ts: number;               // Timestamp when model was created
  weights: Weights;         // Learned weights for scoring
  thresholds: Thresholds;   // Strategy-specific thresholds
  metrics?: {
    auc?: number;           // Area under ROC curve
    acc?: number;           // Accuracy on validation set
  };
  notes?: string;           // Human-readable notes
};

/**
 * Default weights (from Phase 61 Day 1)
 */
const DEFAULT_WEIGHTS: Weights = {
  citation: 0.35,
  context: 0.25,
  source: 0.20,
  relevance: 0.20,
};

/**
 * Default thresholds for different strategies
 */
const DEFAULT_THRESHOLDS: Thresholds = {
  default: 0.55,    // Standard threshold
  critic: 0.60,     // Stricter for critic strategy
  majority: 0.50,   // More lenient for majority strategy
};

/**
 * Load the latest model from Firestore
 * Falls back to defaults if no model exists
 */
export async function loadLatestModel(): Promise<ModelDoc> {
  try {
    const snap = await adminDb
      .collection("ops_validate_models")
      .orderBy("ts", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      console.log("[scorerModel] No models found, using defaults");
      return {
        version: "v0",
        ts: Date.now(),
        weights: DEFAULT_WEIGHTS,
        thresholds: DEFAULT_THRESHOLDS,
      };
    }

    const model = snap.docs[0].data() as ModelDoc;
    console.log(`[scorerModel] Loaded model ${model.version}`);
    return model;
  } catch (err) {
    console.error("[scorerModel] Error loading model, using defaults:", err);
    return {
      version: "v0_fallback",
      ts: Date.now(),
      weights: DEFAULT_WEIGHTS,
      thresholds: DEFAULT_THRESHOLDS,
    };
  }
}

/**
 * Load a specific model version
 */
export async function loadModel(version: string): Promise<ModelDoc | null> {
  try {
    const doc = await adminDb
      .collection("ops_validate_models")
      .doc(version)
      .get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as ModelDoc;
  } catch (err) {
    console.error(`[scorerModel] Error loading model ${version}:`, err);
    return null;
  }
}

/**
 * Save a new model version to Firestore
 */
export async function saveModel(model: ModelDoc): Promise<void> {
  try {
    await adminDb
      .collection("ops_validate_models")
      .doc(model.version)
      .set(model);

    console.log(`[scorerModel] Saved model ${model.version} with acc=${model.metrics?.acc?.toFixed(3)}`);
  } catch (err) {
    console.error(`[scorerModel] Error saving model ${model.version}:`, err);
    throw err;
  }
}

/**
 * Calculate weighted score from subscores
 *
 * @param subscores - 4-dimensional subscore vector
 * @param weights - Weight vector
 * @returns Final weighted score (0-1)
 */
export function scoreWithWeights(
  subscores: { citation: number; context: number; source: number; relevance: number },
  weights: Weights
): number {
  const score =
    subscores.citation * weights.citation +
    subscores.context * weights.context +
    subscores.source * weights.source +
    subscores.relevance * weights.relevance;

  return Math.max(0, Math.min(1, score));
}

/**
 * Get threshold for a specific strategy
 */
export function getThreshold(thresholds: Thresholds, strategy: string): number {
  if (strategy === "critic" && thresholds.critic !== undefined) {
    return thresholds.critic;
  }
  if (strategy === "majority" && thresholds.majority !== undefined) {
    return thresholds.majority;
  }
  return thresholds.default;
}

/**
 * List all model versions
 */
export async function listModels(limit = 10): Promise<ModelDoc[]> {
  try {
    const snap = await adminDb
      .collection("ops_validate_models")
      .orderBy("ts", "desc")
      .limit(limit)
      .get();

    return snap.docs.map((doc) => doc.data() as ModelDoc);
  } catch (err) {
    console.error("[scorerModel] Error listing models:", err);
    return [];
  }
}

/**
 * Get default weights (for testing/fallback)
 */
export function getDefaultWeights(): Weights {
  return { ...DEFAULT_WEIGHTS };
}

/**
 * Get default thresholds (for testing/fallback)
 */
export function getDefaultThresholds(): Thresholds {
  return { ...DEFAULT_THRESHOLDS };
}
