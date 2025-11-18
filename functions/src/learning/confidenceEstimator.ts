/**
 * Phase 37 - Confidence Estimator
 * Calculates confidence scores for system components based on statistical metrics
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { Confidence, ConfidenceReason } from "../types/meta";

const db = admin.firestore();

function stdDev(arr: number[]): number {
  if (!arr || arr.length === 0) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

export const refreshConfidence = onSchedule(
  {
    schedule: "every 10 minutes",
    timeZone: "UTC",
    retryCount: 3,
  },
  async (event) => {
    try {
      const windows: Confidence['window'][] = ['1h', '24h', '7d'];
      const components = new Set<string>();

      // Get all unique components from stats
      const statsSnap = await db.collection('ops_stats').get();
      for (const doc of statsSnap.docs) {
        const data = doc.data() as any;
        if (data.component) {
          components.add(data.component);
        }
      }

      console.log(`[refreshConfidence] Processing ${components.size} components across ${windows.length} windows`);

      for (const component of components) {
        for (const window of windows) {
          const statDocId = `${component}:${window}`;
          const sRef = db.collection('ops_stats').doc(statDocId);
          const sSnap = await sRef.get();

          if (!sSnap.exists) {
            console.log(`[refreshConfidence] No stats for ${statDocId}`);
            continue;
          }

          const s = sSnap.data() as any;

          // Extract metrics
          const rewardAvg = s.avgReward ?? 0.5;
          const latencyP95 = s.p95Latency ?? 0;
          const costAvg = s.avgCostUsd ?? 0;
          const successRate = s.successRate ?? 0.9;

          // Calculate standard deviations
          const latencyStd = s.latencies && s.latencies.length ? stdDev(s.latencies) : 0;
          const rewardStd = s.rewards && s.rewards.length ? stdDev(s.rewards) : 0;
          const costStd = s.costs && s.costs.length ? stdDev(s.costs) : 0;

          const reasons: ConfidenceReason[] = [];
          let score = 0.9; // Start optimistic

          // Sample size penalty
          const n = s.n || 0;
          if (n < 50) {
            score -= 0.2;
            reasons.push('low_sample_size');
          }

          // Reward instability penalty
          if (rewardStd > 0.2) {
            score -= 0.15;
            reasons.push('reward_instability');
          }

          // High latency variance penalty
          if (latencyP95 > 0 && latencyStd > latencyP95 * 0.3) {
            score -= 0.1;
            reasons.push('high_latency_variance');
          }

          // Cost spike penalty
          if (costAvg > 0 && costStd > Math.max(0.01, costAvg * 0.5)) {
            score -= 0.05;
            reasons.push('cost_spike');
          }

          // SLO violations penalty
          if (s.sloViolations && s.sloViolations > 0) {
            score -= 0.1;
            reasons.push('slo_violations');
          }

          // Clamp score to [0, 1]
          score = Math.max(0, Math.min(1, score));

          if (reasons.length === 0) {
            reasons.push('ok');
          }

          const conf: Confidence = {
            component,
            window,
            subject: undefined,
            score,
            reasons,
            sampleSize: n,
            metrics: {
              rewardAvg,
              rewardStd,
              latencyP95,
              latencyStd,
              costAvg,
              costStd,
              successRate,
            },
            ts: Date.now(),
          };

          const confDocId = `${component}:${window}`;
          await db.collection('ops_confidence').doc(confDocId).set(conf);

          console.log(`[refreshConfidence] ${confDocId}: score=${score.toFixed(2)}, reasons=${reasons.join(',')}`);
        }
      }

      console.log('[refreshConfidence] Completed successfully');
    } catch (error) {
      console.error('[refreshConfidence] Error:', error);
      throw error;
    }
  }
);
