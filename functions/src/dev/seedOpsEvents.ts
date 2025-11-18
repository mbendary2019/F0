/**
 * Seed Ops Events (Development Tool - Phase 63 Day 1)
 *
 * Generates random ops_events for testing Timeline UI and TrendMini
 * Useful for quickly populating the database with test data
 *
 * Usage from client:
 * await httpsCallable(functions, "seedOpsEvents")({ count: 300 });
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Generate N random events for the last 24 hours
 *
 * @param request.data.count - Number of events to generate (10-2000, default 200)
 * @returns { success: true, inserted: number }
 */
export const seedOpsEvents = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 120,
    cors: true,
  },
  async (request) => {
    // Require admin authentication
    if (!request.auth?.token?.admin) {
      throw new HttpsError("permission-denied", "Admin only");
    }

    const n = Math.max(10, Math.min(2000, Number(request.data?.count ?? 200)));
    const db = getFirestore();

    const levels = ["info", "warn", "error"] as const;
    const types = ["ingest", "normalize", "export", "ui", "api", "rag.validate", "rag.retrieve", "mesh.start", "mesh.consensus"];
    const strategies = ["default", "fast", "safe", "llm-mini", "critic", "majority"];

    const now = Date.now();

    console.log(`[seedOpsEvents] Generating ${n} events by ${request.auth.uid}`);

    const batch = db.batch();
    for (let i = 0; i < n; i++) {
      // Random timestamp within last 24 hours
      const ts = now - Math.floor(Math.random() * 24 * 60 * 60 * 1000);

      const doc = db.collection("ops_events").doc();
      batch.set(doc, {
        ts,
        level: levels[Math.floor(Math.random() * levels.length)],
        type: types[Math.floor(Math.random() * types.length)],
        strategy: strategies[Math.floor(Math.random() * strategies.length)],
        message: `seed event ${i + 1}`,
        latency: Math.floor(Math.random() * 800) + 20, // 20-820ms
        sessionId: `sess_${Math.floor(Math.random() * 5) + 1}`, // 5 different sessions
        createdAt: now,
        meta: {
          seed: true,
          index: i,
          timestamp: new Date(ts).toISOString(),
        }
      });
    }

    await batch.commit();

    console.log(`[seedOpsEvents] ✅ Inserted ${n} events`);

    return {
      success: true,
      inserted: n,
      sessions: 5,
      timeRange: "last 24 hours",
    };
  }
);
