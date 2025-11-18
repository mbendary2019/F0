/**
 * useTimelineFeed Hook
 *
 * Real-time Timeline feed using Firestore listeners.
 * Automatically updates when new events are added.
 *
 * Phase 62 Day 5
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Query,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export interface TimelineFeedFilters {
  sessionId?: string;
  strategy?: string;
  type?: string;
  from?: number;
  to?: number;
}

export interface TimelineFeedItem {
  id: string;
  ts: number;
  type: string;
  sessionId: string;
  label: string;
  severity?: "info" | "warn" | "error";
  meta?: Record<string, any>;
  [key: string]: any;
}

export interface UseTimelineFeedReturn {
  items: TimelineFeedItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Real-time timeline feed with Firestore listeners
 *
 * @param filters - Filter criteria for events
 * @param maxItems - Maximum number of items to fetch (default: 500)
 * @returns Real-time updating items array
 *
 * @example
 * const { items, loading, error } = useTimelineFeed({
 *   sessionId: "sess_123",
 *   type: "rag.validate"
 * });
 */
export function useTimelineFeed(
  filters: TimelineFeedFilters = {},
  maxItems = 500
): UseTimelineFeedReturn {
  const [items, setItems] = useState<TimelineFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build Firestore query based on filters
  const q = useMemo(() => {
    try {
      const col = collection(db, "ops_events");
      const clauses: any[] = [];

      // Add filter conditions
      if (filters.sessionId) {
        clauses.push(where("sessionId", "==", filters.sessionId));
      }
      if (filters.strategy) {
        clauses.push(where("strategy", "==", filters.strategy));
      }
      if (filters.type) {
        clauses.push(where("type", "==", filters.type));
      }
      if (filters.from) {
        clauses.push(where("ts", ">=", filters.from));
      }
      if (filters.to) {
        clauses.push(where("ts", "<", filters.to));
      }

      // Always order by timestamp (descending) and limit
      return query(col, ...clauses, orderBy("ts", "desc"), limit(maxItems));
    } catch (err: any) {
      console.error("[useTimelineFeed] Query build error:", err);
      setError(err.message || "Failed to build query");
      return null;
    }
  }, [
    filters.sessionId,
    filters.strategy,
    filters.type,
    filters.from,
    filters.to,
    maxItems,
  ]);

  useEffect(() => {
    if (!q) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q as Query<DocumentData>,
      (snapshot) => {
        try {
          const newItems = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as TimelineFeedItem[];

          setItems(newItems);
          setLoading(false);
        } catch (err: any) {
          console.error("[useTimelineFeed] Snapshot error:", err);
          setError(err.message || "Failed to process snapshot");
          setLoading(false);
        }
      },
      (err) => {
        console.error("[useTimelineFeed] Listener error:", err);
        setError(err.message || "Real-time listener failed");
        setLoading(false);
      }
    );

    // Cleanup on unmount or filter change
    return () => unsubscribe();
  }, [q]);

  return { items, loading, error };
}

/**
 * Hook variant that combines static fetch + real-time updates
 *
 * First fetches initial data via API (with pagination support),
 * then switches to real-time updates for new events.
 */
export function useTimelineFeedHybrid(
  filters: TimelineFeedFilters = {},
  initialLimit = 100
) {
  const [items, setItems] = useState<TimelineFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initial API fetch
  useEffect(() => {
    if (initialized) return;

    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.sessionId) params.set("sessionId", filters.sessionId);
        if (filters.strategy) params.set("strategy", filters.strategy);
        if (filters.type) params.set("type", filters.type);
        if (filters.from) params.set("from", String(filters.from));
        if (filters.to) params.set("to", String(filters.to));
        params.set("limit", String(initialLimit));

        const res = await fetch(`/api/ops/timeline?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        setItems(data.items || []);
        setInitialized(true);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [initialized, filters, initialLimit]);

  // Real-time updates after initialization
  const { items: realtimeItems } = useTimelineFeed(filters, 100);

  useEffect(() => {
    if (initialized && realtimeItems.length > 0) {
      // Merge real-time updates with existing items
      setItems((prev) => {
        const ids = new Set(prev.map((i) => i.id));
        const newItems = realtimeItems.filter((i) => !ids.has(i.id));
        return [...newItems, ...prev].slice(0, 500); // Keep max 500
      });
    }
  }, [initialized, realtimeItems]);

  return { items, loading, error };
}
