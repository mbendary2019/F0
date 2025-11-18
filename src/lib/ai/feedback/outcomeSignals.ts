// src/lib/ai/feedback/outcomeSignals.ts
// Map implicit task outcomes to reward signals
// Phase 57.1: Implicit feedback from success/failure events

import { recordFeedback, type RecordFeedbackParams } from "./recordFeedback";
import type { Thumb } from "./feedbackSchema";

// === Outcome Types ===

export type Outcome = "success" | "failure" | "rollback" | "partial" | "timeout";

export type OutcomeReward = {
  reward: number; // [-1, 1]
  confidence: number; // [0, 1]
  description: string;
};

// === Outcome → Reward Mapping ===

/**
 * Map task outcome to reward and confidence values
 *
 * @param outcome - Task outcome type
 * @returns Reward and confidence scores
 *
 * Mapping:
 * - success: +0.9 reward, 0.9 confidence (strong positive signal)
 * - partial: +0.4 reward, 0.6 confidence (weak positive signal)
 * - rollback: -0.6 reward, 0.8 confidence (moderate negative signal)
 * - failure: -0.9 reward, 0.9 confidence (strong negative signal)
 * - timeout: -0.3 reward, 0.5 confidence (weak negative signal, could be infrastructure)
 *
 * @example
 * ```typescript
 * const { reward, confidence } = rewardFromOutcome("success");
 * // => { reward: 0.9, confidence: 0.9, description: "..." }
 * ```
 */
export function rewardFromOutcome(outcome: Outcome): OutcomeReward {
  switch (outcome) {
    case "success":
      return {
        reward: 0.9,
        confidence: 0.9,
        description: "Task completed successfully with expected results",
      };

    case "partial":
      return {
        reward: 0.4,
        confidence: 0.6,
        description: "Task partially completed, some issues encountered",
      };

    case "timeout":
      return {
        reward: -0.3,
        confidence: 0.5,
        description: "Task timed out (may be infrastructure, not context quality)",
      };

    case "rollback":
      return {
        reward: -0.6,
        confidence: 0.8,
        description: "Task rolled back due to detected issues",
      };

    case "failure":
    default:
      return {
        reward: -0.9,
        confidence: 0.9,
        description: "Task failed with errors",
      };
  }
}

/**
 * Convert outcome reward to star rating (for compatibility)
 * Maps [-1, 1] reward to [1, 5] stars
 */
function rewardToStars(reward: number): number {
  // Linear mapping: reward=-1 → stars=1, reward=+1 → stars=5
  return Math.round((reward + 1) * 2) + 1;
}

/**
 * Convert outcome reward to thumb feedback (for compatibility)
 */
function rewardToThumb(reward: number): Thumb {
  return reward >= 0 ? "up" : "down";
}

// === Main Submission Function ===

export type SubmitOutcomeParams = {
  userId: string;
  clusterId: string;
  outcome: Outcome;
  turnId?: string; // Conversational turn ID
  taskId?: string; // Task/action ID that was executed
  metadata?: {
    taskType?: string; // e.g., "deploy", "test", "refactor"
    duration?: number; // Task duration in ms
    errorMessage?: string; // Error details if failed
    context?: string; // Additional context
    [key: string]: unknown;
  };
};

export type SubmitOutcomeResult = {
  success: boolean;
  feedbackId?: string;
  reward?: number;
  confidence?: number;
  outcome?: Outcome;
  error?: string;
};

/**
 * Submit implicit outcome feedback for a cluster
 *
 * Converts task outcome (success/failure) to feedback reward
 * and records it using the existing feedback system
 *
 * @param params - Outcome submission parameters
 * @returns Submission result
 *
 * @example
 * ```typescript
 * // Deployment succeeded
 * await submitOutcome({
 *   userId: "user123",
 *   clusterId: "cl_deploy_guide",
 *   outcome: "success",
 *   taskId: "deploy_prod_123",
 *   metadata: {
 *     taskType: "deploy",
 *     duration: 45000
 *   }
 * });
 *
 * // Test failed
 * await submitOutcome({
 *   userId: "user123",
 *   clusterId: "cl_test_setup",
 *   outcome: "failure",
 *   taskId: "test_run_456",
 *   metadata: {
 *     taskType: "test",
 *     errorMessage: "Connection timeout"
 *   }
 * });
 * ```
 */
export async function submitOutcome(
  params: SubmitOutcomeParams
): Promise<SubmitOutcomeResult> {
  const { userId, clusterId, outcome, turnId, taskId, metadata } = params;

  try {
    // Validate inputs
    if (!userId || !clusterId || !outcome) {
      return {
        success: false,
        error: "userId, clusterId, and outcome are required",
      };
    }

    // Get reward and confidence from outcome
    const outcomeReward = rewardFromOutcome(outcome);

    // Convert to stars and thumb for compatibility with existing feedback system
    const stars = rewardToStars(outcomeReward.reward);
    const thumb = rewardToThumb(outcomeReward.reward);

    console.log(
      `[submitOutcome] ${userId} → cluster ${clusterId}: ${outcome} (reward: ${outcomeReward.reward}, stars: ${stars})`
    );

    // Record feedback using existing system
    const feedbackParams: RecordFeedbackParams = {
      userId,
      clusterId,
      feedback: {
        stars,
        thumb,
      },
      turnId,
      metadata: {
        // Merge outcome metadata with feedback metadata
        outcome,
        outcome_description: outcomeReward.description,
        task_id: taskId,
        implicit_signal: true,
        ...metadata,
      },
    };

    const result = await recordFeedback(feedbackParams);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      feedbackId: result.feedbackId,
      reward: outcomeReward.reward,
      confidence: outcomeReward.confidence,
      outcome,
    };
  } catch (error) {
    console.error("[submitOutcome] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Batch submit multiple outcome signals
 *
 * @param outcomes - Array of outcome submissions
 * @returns Array of results
 */
export async function submitOutcomeBatch(
  outcomes: SubmitOutcomeParams[]
): Promise<SubmitOutcomeResult[]> {
  const results: SubmitOutcomeResult[] = [];

  for (const params of outcomes) {
    const result = await submitOutcome(params);
    results.push(result);
  }

  return results;
}

/**
 * Infer outcome from error object
 * Helper for automatic outcome detection
 *
 * @param error - Error object or message
 * @returns Inferred outcome
 */
export function inferOutcomeFromError(error: unknown): Outcome {
  if (!error) return "success";

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Check for timeout patterns
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("deadline exceeded")
  ) {
    return "timeout";
  }

  // Check for rollback patterns
  if (
    message.includes("rollback") ||
    message.includes("rolled back") ||
    message.includes("revert")
  ) {
    return "rollback";
  }

  // Default to failure
  return "failure";
}

/**
 * Auto-submit outcome from try-catch block
 *
 * @param params - Base parameters
 * @param error - Caught error (undefined if success)
 * @returns Submission result
 *
 * @example
 * ```typescript
 * try {
 *   await deployToProduction();
 *   await autoSubmitOutcome({
 *     userId: "user123",
 *     clusterId: "cl_deploy_guide",
 *     taskId: "deploy_123"
 *   });
 * } catch (error) {
 *   await autoSubmitOutcome({
 *     userId: "user123",
 *     clusterId: "cl_deploy_guide",
 *     taskId: "deploy_123"
 *   }, error);
 * }
 * ```
 */
export async function autoSubmitOutcome(
  params: Omit<SubmitOutcomeParams, "outcome">,
  error?: unknown
): Promise<SubmitOutcomeResult> {
  const outcome = error ? inferOutcomeFromError(error) : "success";

  return submitOutcome({
    ...params,
    outcome,
    metadata: {
      ...params.metadata,
      errorMessage: error instanceof Error ? error.message : undefined,
      auto_inferred: true,
    },
  });
}

/**
 * Get outcome statistics for a cluster
 *
 * @param feedbackEvents - Feedback events with outcome metadata
 * @returns Outcome statistics
 */
export function getOutcomeStats(
  feedbackEvents: Array<{
    metadata?: { outcome?: Outcome; implicit_signal?: boolean };
    reward: number;
  }>
): {
  total: number;
  implicit: number;
  explicit: number;
  byOutcome: Record<Outcome, number>;
  successRate: number;
  avgReward: number;
} {
  const stats = {
    total: feedbackEvents.length,
    implicit: 0,
    explicit: 0,
    byOutcome: {
      success: 0,
      partial: 0,
      timeout: 0,
      rollback: 0,
      failure: 0,
    } as Record<Outcome, number>,
    successRate: 0,
    avgReward: 0,
  };

  if (!feedbackEvents.length) return stats;

  let totalReward = 0;
  let successCount = 0;

  for (const event of feedbackEvents) {
    const isImplicit = event.metadata?.implicit_signal === true;

    if (isImplicit) {
      stats.implicit++;
      const outcome = event.metadata?.outcome;
      if (outcome && outcome in stats.byOutcome) {
        stats.byOutcome[outcome]++;
        if (outcome === "success" || outcome === "partial") {
          successCount++;
        }
      }
    } else {
      stats.explicit++;
      // Count positive explicit feedback as success
      if (event.reward > 0) successCount++;
    }

    totalReward += event.reward;
  }

  stats.successRate = successCount / stats.total;
  stats.avgReward = totalReward / stats.total;

  return stats;
}

/**
 * Calibrate outcome → reward mapping based on historical data
 * (Advanced: requires ground truth labels)
 *
 * @param historicalData - Past outcomes with ground truth quality scores
 * @returns Calibrated reward mapping
 */
export function calibrateOutcomeRewards(
  historicalData: Array<{
    outcome: Outcome;
    groundTruthQuality: number; // [0, 1]
  }>
): Record<Outcome, OutcomeReward> {
  const outcomeGroups = new Map<Outcome, number[]>();

  for (const { outcome, groundTruthQuality } of historicalData) {
    if (!outcomeGroups.has(outcome)) {
      outcomeGroups.set(outcome, []);
    }
    outcomeGroups.get(outcome)!.push(groundTruthQuality);
  }

  const calibrated: Record<Outcome, OutcomeReward> = {} as any;

  for (const [outcome, qualities] of outcomeGroups) {
    const avgQuality = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
    const stdDev = Math.sqrt(
      qualities.reduce((sum, q) => sum + Math.pow(q - avgQuality, 2), 0) / qualities.length
    );

    // Map quality [0, 1] to reward [-1, 1]
    const reward = avgQuality * 2 - 1;

    // Use inverse of std dev as confidence (more consistent = higher confidence)
    const confidence = 1 - Math.min(stdDev, 0.5) * 2;

    calibrated[outcome] = {
      reward,
      confidence,
      description: `Calibrated from ${qualities.length} samples (μ=${avgQuality.toFixed(2)}, σ=${stdDev.toFixed(2)})`,
    };
  }

  return calibrated;
}
