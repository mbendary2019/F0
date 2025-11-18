/**
 * Phase 36 - Reward Engine
 * Scores observations and updates rolling statistics
 */

import * as admin from "firebase-admin";
import { Reward, RewardConfig, Observation, RollingStats } from "../types/learning";

const db = admin.firestore();

/**
 * Get reward configuration from Firestore
 */
async function getRewardConfig(): Promise<RewardConfig> {
  const snap = await db.collection("config").doc("reward_config").get();

  if (!snap.exists) {
    // Return default config
    return {
      version: "1.0.0",
      weights: { latency: 0.25, cost: 0.2, success: 0.6, error: 0.6 },
      bounds: { maxLatencyMs: 4000, maxCostUsd: 0.1 },
      thresholds: { minAcceptable: 0.55, retrain: 0.4 },
    };
  }

  return snap.data() as RewardConfig;
}

/**
 * Clamp value between 0 and 1
 */
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Score an observation and update rolling stats
 * @param obsId Observation document ID
 */
export async function scoreObservation(obsId: string): Promise<Reward | null> {
  try {
    const obsSnap = await db.collection("ops_observations").doc(obsId).get();

    if (!obsSnap.exists) {
      console.warn(`[RewardEngine] Observation ${obsId} not found`);
      return null;
    }

    const obs = obsSnap.data() as Observation;
    const cfg = await getRewardConfig();

    // Calculate reward components
    const success = obs.outcome === "success" ? 1 : 0;
    const error = obs.outcome === "failure" || obs.outcome === "timeout" ? 1 : 0;

    const latency = obs.durationMs ?? cfg.bounds.maxLatencyMs;
    const latencyNorm = 1 - Math.min(latency / cfg.bounds.maxLatencyMs, 1);

    const cost = obs.costUsd ?? cfg.bounds.maxCostUsd;
    const costNorm = 1 - Math.min(cost / cfg.bounds.maxCostUsd, 1);

    const successBoost = cfg.weights.success * success;
    const errorPenalty = cfg.weights.error * error;
    const latencyPenalty = cfg.weights.latency * (1 - latencyNorm);
    const costPenalty = cfg.weights.cost * (1 - costNorm);

    // Calculate final score (baseline 0.5)
    let score = 0.5 + successBoost - errorPenalty - latencyPenalty - costPenalty;
    score = clamp01(score);

    const reward: Reward = {
      obsId: obs.id,
      ts: Date.now(),
      component: obs.component,
      score,
      details: { latencyPenalty, costPenalty, successBoost, errorPenalty },
      configVersion: cfg.version,
    };

    // Save reward
    await db.collection("ops_rewards").doc(obs.id).set(reward);

    // Update rolling stats
    await updateRollingStats(
      obs.component,
      score,
      obs.durationMs || 0,
      obs.costUsd || 0,
      obs.outcome
    );

    console.log("[RewardEngine] Scored observation:", {
      obsId,
      component: obs.component,
      score: score.toFixed(3),
      outcome: obs.outcome,
    });

    return reward;
  } catch (error) {
    console.error(`[RewardEngine] Error scoring observation ${obsId}:`, error);
    return null;
  }
}

/**
 * Update rolling statistics for a component
 */
async function updateRollingStats(
  component: string,
  score: number,
  latency: number,
  cost: number,
  outcome: string
): Promise<void> {
  const windows = ["1h", "24h", "7d"] as const;
  const now = Date.now();

  await Promise.all(
    windows.map(async (w) => {
      const id = `${component}:${w}`;
      const ref = db.collection("ops_stats").doc(id);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);

        const data = snap.exists
          ? snap.data()!
          : {
              n: 0,
              successCount: 0,
              latencies: [],
              costs: [],
              rewards: [],
              component,
              window: w,
              ts: now,
            };

        const n = (data.n || 0) + 1;
        const successCount =
          (data.successCount || 0) + (outcome === "success" ? 1 : 0);

        // Keep last 200 samples for percentile calculation
        const latencies = [...(data.latencies || []).slice(-199), latency];
        const costs = [...(data.costs || []).slice(-199), cost];
        const rewards = [...(data.rewards || []).slice(-199), score];

        // Calculate percentiles
        const sortedLatencies = [...latencies].sort((a, b) => a - b);
        const p = (q: number) =>
          sortedLatencies[
            Math.min(
              sortedLatencies.length - 1,
              Math.floor(q * (sortedLatencies.length - 1))
            )
          ] || 0;

        const stats: RollingStats = {
          component,
          window: w,
          ts: now,
          n,
          successRate: successCount / n,
          p50Latency: p(0.5),
          p95Latency: p(0.95),
          avgCostUsd: costs.reduce((a, b) => a + b, 0) / costs.length,
          avgReward: rewards.reduce((a, b) => a + b, 0) / rewards.length,
          // Store raw arrays for next calculation
          latencies,
          costs,
          rewards,
          successCount,
        };

        tx.set(ref, stats, { merge: true });
      });
    })
  );
}

/**
 * Get reward for an observation
 */
export async function getReward(obsId: string): Promise<Reward | null> {
  const snap = await db.collection("ops_rewards").doc(obsId).get();
  return snap.exists ? (snap.data() as Reward) : null;
}

/**
 * Get rolling stats for a component
 */
export async function getStats(
  component: string,
  window?: string
): Promise<RollingStats[]> {
  let query = db
    .collection("ops_stats")
    .where("component", "==", component) as admin.firestore.Query;

  if (window) {
    query = query.where("window", "==", window);
  }

  const snap = await query.get();
  return snap.docs.map((doc) => doc.data() as RollingStats);
}
