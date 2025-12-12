// src/hooks/useLatestOptimizationRun.ts
// Phase 138.1 + 138.4.4: Real-time hook for latest optimization run with stale detection

"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import type { OptimizationRun } from "@/lib/optimization/types";

// Phase 138.4.4: Consider run stale after 48 hours
const STALE_HOURS = 48;

interface UseLatestOptimizationRunResult {
  run: OptimizationRun | null;
  loading: boolean;
  error: Error | null;
  /** Phase 138.4.4: True if the last run is older than 48 hours */
  isStale: boolean;
}

/**
 * Real-time hook to get the latest optimization run for a project
 * Subscribes to Firestore and updates automatically when run status changes
 *
 * @param projectId - The project ID to get optimization runs for
 * @returns { run, loading, error }
 */
export function useLatestOptimizationRun(
  projectId: string | null | undefined
): UseLatestOptimizationRunResult {
  const [run, setRun] = useState<OptimizationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Reset state when projectId changes
    setRun(null);
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

    // Query for the latest optimization run
    const runsRef = collection(db, "projects", projectId, "optimizationRuns");
    const q = query(runsRef, orderBy("createdAt", "desc"), limit(1));

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setRun(null);
        } else {
          const doc = snapshot.docs[0];
          setRun({
            id: doc.id,
            ...doc.data(),
          } as OptimizationRun);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[useLatestOptimizationRun] Error:", err);
        setError(err as Error);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount or projectId change
    return () => unsubscribe();
  }, [projectId]);

  // Phase 138.4.4: Calculate if the run is stale (older than 48 hours)
  const isStale = useMemo(() => {
    if (!run?.finishedAt) return false;
    const finished = new Date(run.finishedAt).getTime();
    const ageMs = Date.now() - finished;
    return ageMs > STALE_HOURS * 60 * 60 * 1000;
  }, [run?.finishedAt]);

  return { run, loading, error, isStale };
}
