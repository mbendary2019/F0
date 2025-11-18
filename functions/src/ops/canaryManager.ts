import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * CanaryManager: gradually increases traffic share if SLOs hold; rolls back on breach.
 * Control doc: config/canary → { rolloutPercent:number, rollbackRequested?:boolean }
 * SLO source: monitoring snapshots at ops_slo/window → { errorRate, p95ms }
 */
export const canaryManager = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "UTC",
    retryCount: 3,
  },
  async (event) => {
    try {
      const [cfgSnap, sloSnap] = await Promise.all([
        db.doc("config/canary").get(),
        db.doc("ops_slo/window").get(),
      ]);

      const cfg = cfgSnap.exists
        ? (cfgSnap.data() as any)
        : { rolloutPercent: 10 };
      const slo = sloSnap.exists
        ? (sloSnap.data() as any)
        : { errorRate: 0, p95ms: 0 };

      // Check if paused
      if (cfg.paused === true) {
        console.log("[CanaryManager] Canary progression paused");
        return;
      }

      // Check for SLO breach or explicit rollback request
      const errorBreach = (slo.errorRate ?? 0) > 0.01; // 1% error rate threshold
      const latencyBreach = (slo.p95ms ?? 0) > 900; // 900ms latency threshold
      const rollbackRequested = cfg.rollbackRequested === true;

      const breach = errorBreach || latencyBreach || rollbackRequested;

      let next = cfg.rolloutPercent ?? 10;
      let decision = "hold";

      if (breach) {
        // Rollback to 0%
        next = 0;
        decision = "rollback";

        console.warn("[CanaryManager] SLO breach detected, rolling back:", {
          errorBreach: errorBreach ? slo.errorRate : null,
          latencyBreach: latencyBreach ? slo.p95ms : null,
          rollbackRequested,
        });
      } else if (next < 100) {
        // Progressive promotion: +15% increments
        next = Math.min(100, next + 15);
        decision = next === 100 ? "promote_final" : "promote";

        console.log("[CanaryManager] Promoting canary:", {
          from: cfg.rolloutPercent,
          to: next,
          sloErrorRate: slo.errorRate,
          sloP95: slo.p95ms,
        });
      } else {
        // Already at 100%, maintain
        decision = "maintain";
        console.log("[CanaryManager] Canary at 100%, maintaining");
      }

      await db.doc("config/canary").set(
        {
          rolloutPercent: next,
          rollbackRequested: false,
          lastDecision: decision,
          lastSlo: {
            errorRate: slo.errorRate ?? 0,
            p95ms: slo.p95ms ?? 0,
            evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Create incident document if rollback occurred
      if (decision === "rollback") {
        const incidentRef = db.collection("incidents").doc();
        await incidentRef.set({
          type: "canary_rollback",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          reason: errorBreach
            ? `error_rate_breach_${slo.errorRate}`
            : latencyBreach
            ? `latency_breach_${slo.p95ms}ms`
            : "rollback_requested",
          slo: {
            errorRate: slo.errorRate,
            p95ms: slo.p95ms,
          },
          previousRollout: cfg.rolloutPercent,
          status: "auto_rollback_complete",
        });

        console.log(
          "[CanaryManager] Incident document created:",
          incidentRef.id
        );
      }
    } catch (error) {
      console.error("[CanaryManager] Error:", error);
      throw error;
    }
  }
);
