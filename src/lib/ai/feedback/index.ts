// src/lib/ai/feedback/index.ts
// Phase 57: Memory Feedback & Reinforcement Learning - Public API
// Phase 57.1: Outcome Signals - Implicit Feedback

// === Schema & Types ===
export * from "./feedbackSchema";

// === Reward Computation ===
export {
  thumbToReward,
  starsToReward,
  computeReward,
  computeConfidence,
  weightedReward,
  aggregateRewards,
  bayesianSmooth,
  applyTimeDecay,
  computeRecencyScore,
  sigmoid,
  clamp,
} from "./computeRewards";

// === Feedback Recording ===
export {
  recordFeedback,
  recordFeedbackBatch,
  getFeedbackForCluster,
  getFeedbackForUser,
  deleteFeedback,
  recomputeAllClusterStats,
  type RecordFeedbackParams,
  type RecordFeedbackResult,
} from "./recordFeedback";

// === Cluster Weight Updates ===
export {
  updateClusterWeight,
  updateClusterWeightsBatch,
  updateAllClusterWeights,
  getWeightedClusters,
  computeWeightOneShot,
  previewClusterWeight,
  type UpdateWeightsResult,
} from "./updateClusterWeights";

// === Ranking with Feedback ===
export {
  computeBlendedScore,
  rankClusters,
  rankTopK,
  filterByMinScore,
  rerank,
  decomposeScore,
  explainRanking,
  compareRankings,
  rankWithMultipleParams,
  optimizeBlendCoeffs,
  type RankingInput,
  type RankedCluster,
} from "./rankScore";

// === Outcome Signals (Phase 57.1) ===
export {
  submitOutcome,
  submitOutcomeBatch,
  rewardFromOutcome,
  inferOutcomeFromError,
  autoSubmitOutcome,
  getOutcomeStats,
  calibrateOutcomeRewards,
  type Outcome,
  type OutcomeReward,
  type SubmitOutcomeParams,
  type SubmitOutcomeResult,
} from "./outcomeSignals";
