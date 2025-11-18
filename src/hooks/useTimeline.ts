/**
 * useTimeline Hook (Phase 62 Day 2)
 *
 * Custom hook for fetching and managing timeline data with pagination and filters.
 * Consumes the Timeline APIs from Day 1.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Timeline item from API
 */
type TimelineItem = {
  id: string;
  sessionId: string;
  ts: number;
  label: string;
  type: string;
  severity?: "info" | "warn" | "error";
  meta?: Record<string, any>;
};

/**
 * Timeline filters matching API query parameters
 */
export type TimelineFilters = {
  from?: number;
  to?: number;
  sessionId?: string;
  strategy?: string;
  type?: string;
};

/**
 * Hook return type
 */
export type UseTimelineReturn = {
  items: TimelineItem[];
  loading: boolean;
  error: string | undefined;
  hasMore: boolean;
  loadMore: () => void;
  setFilters: (filters: TimelineFilters) => void;
  filters: TimelineFilters;
  refresh: () => void;
};

/**
 * Custom hook for Timeline data fetching with pagination
 *
 * @param initial - Initial filter values
 * @returns Timeline state and actions
 *
 * @example
 * ```tsx
 * function TimelinePage() {
 *   const { items, loading, loadMore, setFilters } = useTimeline({ sessionId: "sess123" });
 *
 *   return (
 *     <div>
 *       <button onClick={() => setFilters({ strategy: "critic" })}>Filter Critic</button>
 *       {items.map(item => <div key={item.id}>{item.label}</div>)}
 *       <button onClick={loadMore}>Load More</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTimeline(initial: Partial<TimelineFilters> = {}): UseTimelineReturn {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<TimelineFilters>({ ...initial });

  /**
   * Build API query URL with filters and cursor
   */
  const query = useMemo(() => {
    const params = new URLSearchParams();

    if (filters.from) params.set("from", String(filters.from));
    if (filters.to) params.set("to", String(filters.to));
    if (filters.sessionId) params.set("sessionId", filters.sessionId);
    if (filters.strategy) params.set("strategy", filters.strategy);
    if (filters.type) params.set("type", filters.type);
    if (cursor) params.set("cursor", cursor);

    params.set("limit", "100");

    return `/api/ops/timeline?${params.toString()}`;
  }, [filters, cursor]);

  /**
   * Load timeline data from API
   *
   * @param reset - If true, reset items and cursor (new query)
   */
  const load = useCallback(
    async (reset = false) => {
      try {
        // Reset state if this is a new query
        if (reset) {
          setItems([]);
          setCursor(null);
          setHasMore(true);
        }

        // Don't load if no more items and not resetting
        if (!hasMore && !reset) return;

        setLoading(true);
        setError(undefined);

        const res = await fetch(query);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const json = await res.json();

        // Handle error from API
        if (json.error) {
          throw new Error(json.error);
        }

        // Update items (append if not reset, replace if reset)
        setItems((prev) => (reset ? json.items : [...prev, ...json.items]));

        // Update cursor for next page
        setCursor(json.nextCursor);

        // Update hasMore flag
        setHasMore(Boolean(json.nextCursor));
      } catch (e: any) {
        console.error("[useTimeline] Error:", e);
        setError(e?.message || "Failed to load timeline");
      } finally {
        setLoading(false);
      }
    },
    [query, hasMore]
  );

  /**
   * Reload when filters change
   */
  useEffect(() => {
    load(true);
  }, [
    filters.from,
    filters.to,
    filters.sessionId,
    filters.strategy,
    filters.type,
  ]);

  /**
   * Load more items (pagination)
   */
  const loadMore = useCallback(() => {
    load(false);
  }, [load]);

  /**
   * Refresh timeline (reset and reload)
   */
  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  return {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    setFilters,
    filters,
    refresh,
  };
}
