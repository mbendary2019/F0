import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Watchdog: self-healing actions when health checks fail.
 * Reads ops_health/readyz → { ok, lastError, failCount }
 * If failCount ≥ 3 within 10m: triggers rollback flag and clears hot caches.
 */
export const watchdog = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "UTC",
    retryCount: 3,
  },
  async (event) => {
    try {
      const healthSnap = await db.doc("ops_health/readyz").get();
      const health = healthSnap.exists
        ? (healthSnap.data() as any)
        : { ok: true, failCount: 0 };

      console.log("[Watchdog] Health check status:", {
        ok: health.ok,
        failCount: health.failCount ?? 0,
        lastError: health.lastError,
      });

      if (!health.ok && (health.failCount ?? 0) >= 3) {
        console.warn(
          "[Watchdog] Health check failed 3+ times, triggering remediation"
        );

        // Mark system as degraded and request rollback
        await db.doc("config/canary").set(
          {
            rollbackRequested: true,
            reason: health.lastError || "unknown_health_failure",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Purge caches indicator (consumed by your API layer)
        await db.doc("ops_signals/cache").set(
          {
            invalidate: true,
            reason: "watchdog_remediation",
            ts: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log("[Watchdog] Remediation triggered:", {
          rollbackRequested: true,
          cacheInvalidated: true,
          reason: health.lastError,
        });
      } else if (health.ok) {
        // Reset fail count if system is healthy
        if ((health.failCount ?? 0) > 0) {
          await db.doc("ops_health/readyz").update({
            failCount: 0,
            lastError: null,
          });
          console.log("[Watchdog] Health restored, fail count reset");
        }
      }
    } catch (error) {
      console.error("[Watchdog] Error:", error);
      throw error;
    }
  }
);
