/**
 * Phase 36 - Score Observations Worker
 * Scheduled function to score recent observations
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { scoreObservation } from "../learning/rewardEngine";

const db = admin.firestore();

/**
 * Score recent observations every 5 minutes
 */
export const scoreObservations = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "UTC",
    retryCount: 3,
  },
  async (event) => {
    try {
      // Get observations from last 10 minutes
      const since = Date.now() - 10 * 60 * 1000;

      const snap = await db
        .collection("ops_observations")
        .where("ts", ">", since)
        .get();

      console.log(
        `[scoreObservations] Processing ${snap.size} observations since ${new Date(
          since
        ).toISOString()}`
      );

      if (snap.empty) {
        console.log("[scoreObservations] No observations to score");
        return;
      }

      // Score all observations
      const tasks = snap.docs.map((doc) => scoreObservation(doc.id));
      const results = await Promise.allSettled(tasks);

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      console.log("[scoreObservations] Completed:", {
        total: snap.size,
        successful,
        failed,
      });
    } catch (error) {
      console.error("[scoreObservations] Error:", error);
      throw error;
    }
  }
);
