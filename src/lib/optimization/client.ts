// src/lib/optimization/client.ts
// Phase 138.0.6: Client API helper for project optimization
// Uses httpsCallable from Firebase SDK for proper auth context

"use client";

import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebaseClient";
import type { RunProjectOptimizationResponse, OptimizationRun } from "./types";

/**
 * Helper to ensure user is authenticated before calling functions
 * Waits for auth state to be ready instead of checking currentUser immediately
 */
async function waitForAuth(): Promise<void> {
  if (auth.currentUser) return;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new FirebaseError("unauthenticated", "Authentication timeout"));
    }, 10000);

    const unsub = auth.onAuthStateChanged((user) => {
      clearTimeout(timeout);
      unsub();
      if (user) {
        resolve();
      } else {
        reject(
          new FirebaseError(
            "unauthenticated",
            "You must be logged in to run project optimization."
          )
        );
      }
    });
  });
}

/**
 * Start a new optimization run for a project
 *
 * @param projectId - The project ID to optimize
 * @returns RunProjectOptimizationResponse with runId, status, createdAt
 */
export async function runProjectOptimization(
  projectId: string
): Promise<RunProjectOptimizationResponse> {
  try {
    console.log("[Optimization] Starting optimization for project:", projectId);
    console.log("[Optimization] Current user:", auth.currentUser?.uid || "null");

    // Wait for auth to be ready
    await waitForAuth();

    console.log("[Optimization] Auth ready, user:", auth.currentUser?.uid);

    // Use httpsCallable from Firebase SDK - it handles auth automatically
    const callable = httpsCallable<{ projectId: string }, RunProjectOptimizationResponse>(
      functions,
      "runProjectOptimization"
    );

    console.log("[Optimization] Calling function...");
    const result = await callable({ projectId });

    console.log("[Optimization] Started run:", result.data);
    return result.data;
  } catch (err: unknown) {
    console.error("[Optimization] runProjectOptimization error", err);

    // Re-throw unauthenticated errors with clear message
    if (err instanceof FirebaseError && err.code === "functions/unauthenticated") {
      throw new FirebaseError(
        "unauthenticated",
        "You must be logged in to run project optimization."
      );
    }

    throw err;
  }
}

/**
 * Get the status of an optimization run
 *
 * @param projectId - The project ID
 * @param runId - The optimization run ID
 * @returns OptimizationRun or null if not found
 */
export async function getOptimizationRunStatus(
  projectId: string,
  runId: string
): Promise<OptimizationRun | null> {
  try {
    await waitForAuth();

    const callable = httpsCallable<{ projectId: string; runId: string }, OptimizationRun | null>(
      functions,
      "getOptimizationRunStatus"
    );

    const result = await callable({ projectId, runId });
    return result.data;
  } catch (err: unknown) {
    console.error("[Optimization] getOptimizationRunStatus error", err);
    throw err;
  }
}

/**
 * Cancel an optimization run
 *
 * @param projectId - The project ID
 * @param runId - The optimization run ID
 * @returns Success status
 */
export async function cancelOptimizationRun(
  projectId: string,
  runId: string
): Promise<{ success: boolean }> {
  try {
    await waitForAuth();

    const callable = httpsCallable<{ projectId: string; runId: string }, { success: boolean }>(
      functions,
      "cancelOptimizationRun"
    );

    const result = await callable({ projectId, runId });
    return result.data;
  } catch (err: unknown) {
    console.error("[Optimization] cancelOptimizationRun error", err);
    throw err;
  }
}
