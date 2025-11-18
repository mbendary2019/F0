import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * AutoScaler: adjusts config flags based on rolling load windows.
 * Inputs (Firestore): ops_stats/current → { rps, errorRate, p95ms }
 * Outputs (Firestore): config/runtime → { concurrency, cacheTtl, throttle }
 */
export const autoScaler = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "UTC",
    retryCount: 3,
  },
  async (event) => {
    try {
      const statsSnap = await db.doc("ops_stats/current").get();
      const stats = statsSnap.exists
        ? (statsSnap.data() as any)
        : { rps: 0, errorRate: 0, p95ms: 0 };

      // Derive targets based on current metrics
      const highLoad = stats.rps > 120 || stats.p95ms > 800;
      const degraded = stats.errorRate > 0.02 || stats.p95ms > 1200;

      const target = {
        concurrency: highLoad ? 200 : 80,
        cacheTtl: highLoad ? 120 : 300,
        throttle: degraded ? 0.7 : 1.0, // reduce QPS if degraded
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        reason: highLoad
          ? degraded
            ? "high_load+degraded"
            : "high_load"
          : degraded
          ? "degraded"
          : "normal",
      };

      await db.doc("config/runtime").set(target, { merge: true });

      console.log("[AutoScaler] Updated runtime config:", {
        rps: stats.rps,
        p95ms: stats.p95ms,
        errorRate: stats.errorRate,
        decision: target.reason,
        concurrency: target.concurrency,
        cacheTtl: target.cacheTtl,
        throttle: target.throttle,
      });
    } catch (error) {
      console.error("[AutoScaler] Error:", error);
      throw error;
    }
  }
);
