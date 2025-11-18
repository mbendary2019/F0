import { useEffect } from "react";
import type { TimelineFilters } from "@/hooks/useTimeline";

/**
 * useUrlSync - Syncs Timeline filters with URL search parameters
 *
 * Automatically updates the browser URL when filters change, enabling:
 * - Deep linking (shareable URLs with filters)
 * - Browser back/forward navigation
 * - Bookmark support
 *
 * Uses replaceState (not pushState) to avoid polluting browser history
 * with every filter change.
 */
export function useUrlSync(filters: TimelineFilters) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);

    const set = (k: keyof TimelineFilters, v?: string | number) => {
      if (v === undefined || v === "") {
        url.searchParams.delete(String(k));
      } else {
        url.searchParams.set(String(k), String(v));
      }
    };

    // Sync all filter values to URL parameters
    set("sessionId", filters.sessionId);
    set("strategy", filters.strategy);
    set("type", filters.type);
    set("from", filters.from);
    set("to", filters.to);

    // Update URL without triggering page reload or adding history entry
    window.history.replaceState({}, "", url.toString());
  }, [filters.sessionId, filters.strategy, filters.type, filters.from, filters.to]);
}
