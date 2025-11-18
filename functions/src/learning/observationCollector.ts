/**
 * Phase 36 - Observation Collector
 * Records observations from various system components for learning
 */

import * as admin from "firebase-admin";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { Observation } from "../types/learning";

const db = admin.firestore();

const ObservationSchema = z.object({
  jobId: z.string().optional(),
  component: z.string(),
  policyVersion: z.string().optional(),
  inputHash: z.string().optional(),
  durationMs: z.number().optional(),
  tokensIn: z.number().optional(),
  tokensOut: z.number().optional(),
  costUsd: z.number().optional(),
  outcome: z.enum(["success", "degraded", "failure", "timeout"]),
  slaMs: z.number().optional(),
  errorCode: z.string().optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

/**
 * Record an observation event
 * @param payload Observation data
 * @returns Observation ID
 */
export async function recordObservation(payload: unknown): Promise<string> {
  try {
    const parsed = ObservationSchema.parse(payload);
    const id = uuid();
    const doc: Observation = {
      id,
      ts: Date.now(),
      ...parsed,
    };

    await db.collection("ops_observations").doc(id).set(doc);

    console.log("[ObservationCollector] Recorded observation:", {
      id,
      component: doc.component,
      outcome: doc.outcome,
      durationMs: doc.durationMs,
    });

    return id;
  } catch (error) {
    console.error("[ObservationCollector] Error recording observation:", error);
    throw error;
  }
}

/**
 * Get observations for a component
 * @param component Component name
 * @param limit Max results
 */
export async function getObservations(
  component: string,
  limit: number = 100
): Promise<Observation[]> {
  const snap = await db
    .collection("ops_observations")
    .where("component", "==", component)
    .orderBy("ts", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => doc.data() as Observation);
}

/**
 * Get recent observations
 * @param sinceMs Timestamp to fetch from
 */
export async function getRecentObservations(
  sinceMs: number
): Promise<Observation[]> {
  const snap = await db
    .collection("ops_observations")
    .where("ts", ">", sinceMs)
    .orderBy("ts", "desc")
    .limit(1000)
    .get();

  return snap.docs.map((doc) => doc.data() as Observation);
}
