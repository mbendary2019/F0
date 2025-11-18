/**
 * Phase 37 - Adaptive Router Scheduler
 * Runs uncertainty-aware router adaptation every 30 minutes
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { adaptRouterWeights } from "../learning/uncertaintyRouter";

export const adaptiveRouter = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "UTC",
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[adaptiveRouter] Starting router adaptation');
      const result = await adaptRouterWeights('router-core', '1.0.0');

      if (result) {
        console.log(`[adaptiveRouter] Success: ${result.policyId} ${result.from} → ${result.to}`);
      } else {
        console.log('[adaptiveRouter] No adaptation performed (conditions not met)');
      }
    } catch (error) {
      console.error('[adaptiveRouter] Error:', error);
      throw error;
    }
  }
);
