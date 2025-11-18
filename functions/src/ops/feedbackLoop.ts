import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * FeedbackLoop: aggregates logs & metrics into a concise cognitive report.
 * Stores at ops/reports/latest and appends to ops/reports/history/{ts}
 */
export const feedbackLoop = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "UTC",
    retryCount: 3,
  },
  async (event) => {
    try {
      // Pull inputs
      const [stats, health, canary] = await Promise.all([
        db.doc("ops_stats/current").get(),
        db.doc("ops_health/readyz").get(),
        db.doc("config/canary").get(),
      ]);

      const s = stats.exists ? (stats.data() as any) : {};
      const h = health.exists ? (health.data() as any) : {};
      const c = canary.exists ? (canary.data() as any) : {};

      const summary: any = {
        ts: admin.firestore.FieldValue.serverTimestamp(),
        rps: s.rps ?? 0,
        p95ms: s.p95ms ?? 0,
        errorRate: s.errorRate ?? 0,
        healthOk: h.ok ?? true,
        canaryRollout: c.rolloutPercent ?? 0,
        recommendations: [] as string[],
      };

      // Generate cognitive recommendations
      if ((s.errorRate ?? 0) > 0.01) {
        summary.recommendations.push(
          "⚠️  Elevated error rate detected. Investigate top failing endpoints, check recent deployments, and review error logs."
        );
      }

      if ((s.p95ms ?? 0) > 800) {
        summary.recommendations.push(
          "🐌 High latency detected. Enable aggressive caching, increase concurrency, and check for slow database queries."
        );
      }

      if ((s.p95ms ?? 0) > 1200) {
        summary.recommendations.push(
          "🚨 Critical latency threshold exceeded. Consider immediate rollback or traffic throttling."
        );
      }

      if (h.ok === false) {
        summary.recommendations.push(
          `❌ Health checks failing${
            h.lastError ? ": " + h.lastError : ""
          }. Watchdog will trigger rollback if failures persist. Check system resources and dependencies.`
        );
      }

      if (c.rollbackRequested) {
        summary.recommendations.push(
          "🔄 Rollback requested. CanaryManager will reduce traffic to previous stable version."
        );
      }

      if ((s.rps ?? 0) > 150) {
        summary.recommendations.push(
          "📈 High traffic volume. Monitor capacity and consider scaling resources."
        );
      }

      if (summary.recommendations.length === 0) {
        summary.recommendations.push(
          "✅ All systems operational. No action required. Maintain current configuration."
        );
      }

      // Store report
      const reportId = `report_${Date.now()}`;
      const ref = db.collection("ops/reports/history").doc(reportId);

      await Promise.all([
        db.doc("ops/reports/latest").set(summary, { merge: true }),
        ref.set(summary),
      ]);

      console.log("[FeedbackLoop] Cognitive report generated:", {
        reportId,
        rps: summary.rps,
        p95ms: summary.p95ms,
        errorRate: summary.errorRate,
        healthOk: summary.healthOk,
        recommendationCount: summary.recommendations.length,
        recommendations: summary.recommendations,
      });
    } catch (error) {
      console.error("[FeedbackLoop] Error:", error);
      throw error;
    }
  }
);
