/**
 * Phase 36 - Auto-Tune Policies Worker
 * Scheduled function to automatically tune policies based on stats
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { proposePolicy } from "../learning/policyUpdater";
import { RollingStats } from "../types/learning";

const db = admin.firestore();

/**
 * Auto-tune policies every 15 minutes based on rolling stats
 */
export const autoTunePolicies = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "UTC",
    retryCount: 3,
  },
  async (event) => {
    try {
      console.log("[autoTunePolicies] Starting policy tuning analysis");

      const stats = await db.collection("ops_stats").get();

      let policiesProposed = 0;

      for (const doc of stats.docs) {
        const s = doc.data() as RollingStats;

        // Only analyze 24h window with sufficient samples
        if (s.window !== "24h") continue;
        if ((s.n || 0) < 100) {
          console.log(
            `[autoTunePolicies] Skipping ${s.component}: insufficient samples (${s.n})`
          );
          continue;
        }

        // Check if performance is below acceptable threshold
        if ((s.avgReward || 1) >= 0.55) {
          console.log(
            `[autoTunePolicies] Skipping ${s.component}: performance acceptable (${s.avgReward.toFixed(
              3
            )})`
          );
          continue;
        }

        console.log(
          `[autoTunePolicies] Low performance detected: ${s.component} avgReward=${s.avgReward.toFixed(
            3
          )}`
        );

        // Handle router components
        if (s.component.startsWith("router:")) {
          await tuneRouterPolicy(s);
          policiesProposed++;
        }

        // Handle scaler components
        if (s.component === "AutoScaler") {
          await tuneScalerPolicy(s);
          policiesProposed++;
        }

        // Handle canary components
        if (s.component === "CanaryManager") {
          await tuneCanaryPolicy(s);
          policiesProposed++;
        }
      }

      console.log(
        `[autoTunePolicies] Completed: ${policiesProposed} policies proposed`
      );
    } catch (error) {
      console.error("[autoTunePolicies] Error:", error);
      throw error;
    }
  }
);

/**
 * Tune router policy by adjusting model weights
 */
async function tuneRouterPolicy(stats: RollingStats): Promise<void> {
  const id = "router-core";
  const currentVersion = "1.0.0"; // In production, resolve from active policy

  await proposePolicy({
    id,
    currentVersion,
    tweak: (params) => {
      const w = { ...(params.modelWeights || {}) };
      const entries = Object.entries(w);

      if (!entries.length) return params;

      // Down-weight worst performer (heuristic: lowest weight is worst)
      const [worstModel] = entries.sort(
        (a, b) => (a[1] as number) - (b[1] as number)
      )[0];

      w[worstModel] = Math.max(0, (w[worstModel] as number) - 0.05);

      // Re-normalize weights
      const sum = (Object.values(w) as number[]).reduce((a, b) => a + b, 0) || 1;
      const normalized = Object.fromEntries(
        Object.entries(w).map(([k, v]) => [k, (v as number) / sum])
      );

      return { ...params, modelWeights: normalized };
    },
    note: `Auto-tune: avgReward=${stats.avgReward.toFixed(3)} < 0.55 on 24h`,
  });
}

/**
 * Tune scaler policy by adjusting thresholds
 */
async function tuneScalerPolicy(stats: RollingStats): Promise<void> {
  const id = "scaler-config";
  const currentVersion = "1.0.0";

  await proposePolicy({
    id,
    currentVersion,
    tweak: (params) => {
      // If p95 is high, lower the scale-up threshold
      if (stats.p95Latency > 800) {
        return {
          ...params,
          scaleUpThresholdMs: Math.max(
            400,
            (params.scaleUpThresholdMs || 800) - 100
          ),
        };
      }

      // If cost is high, increase the scale-down threshold
      if (stats.avgCostUsd > 0.05) {
        return {
          ...params,
          scaleDownThresholdMs: Math.min(
            2000,
            (params.scaleDownThresholdMs || 1000) + 200
          ),
        };
      }

      return params;
    },
    note: `Auto-tune scaler: p95=${stats.p95Latency}ms, cost=$${stats.avgCostUsd.toFixed(
      4
    )}`,
  });
}

/**
 * Tune canary policy by adjusting rollout speed
 */
async function tuneCanaryPolicy(stats: RollingStats): Promise<void> {
  const id = "canary-config";
  const currentVersion = "1.0.0";

  await proposePolicy({
    id,
    currentVersion,
    tweak: (params) => {
      // If error rate is elevated, slow down rollout
      if (stats.successRate < 0.95) {
        return {
          ...params,
          rolloutIncrementPercent: Math.max(
            5,
            (params.rolloutIncrementPercent || 15) - 5
          ),
          evaluationIntervalMinutes: Math.min(
            10,
            (params.evaluationIntervalMinutes || 5) + 2
          ),
        };
      }

      return params;
    },
    note: `Auto-tune canary: successRate=${(stats.successRate * 100).toFixed(
      1
    )}%`,
  });
}
