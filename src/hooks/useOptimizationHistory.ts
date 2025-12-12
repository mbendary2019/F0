// src/hooks/useOptimizationHistory.ts
// Phase 138.2: Hook to get optimization run history for a project

"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import type { OptimizationRun } from "@/lib/optimization/types";

interface UseOptimizationHistoryResult {
  runs: OptimizationRun[];
  loading: boolean;
  error: Error | null;
}

/**
 * Real-time hook to get optimization run history for a project
 * Returns the last N optimization runs ordered by creation date (newest first)
 *
 * @param projectId - The project ID to get optimization runs for
 * @param max - Maximum number of runs to fetch (default: 5)
 * @returns { runs, loading, error }
 */
export function useOptimizationHistory(
  projectId: string | null | undefined,
  max: number = 5
): UseOptimizationHistoryResult {
  const [runs, setRuns] = useState<OptimizationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Reset state when projectId changes
    setRuns([]);
    setLoading(true);
    setError(null);

    // Don't subscribe if no projectId
    if (!projectId) {
      setLoading(false);
      return;
    }

    // Guard against SSR
    if (!db) {
      setLoading(false);
      return;
    }

    // Query for the last N optimization runs
    const runsRef = collection(db, "projects", projectId, "optimizationRuns");
    const q = query(runsRef, orderBy("createdAt", "desc"), limit(max));

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const runsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as OptimizationRun[];

        setRuns(runsList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[useOptimizationHistory] Error:", err);
        setError(err as Error);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount or projectId/max change
    return () => unsubscribe();
  }, [projectId, max]);

  return { runs, loading, error };
}
