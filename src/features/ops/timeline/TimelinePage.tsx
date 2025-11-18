/**
 * Timeline Page Component (Phase 62 Day 4)
 *
 * Shared component for Timeline UI - works with App Router
 * Can be used in both localized ([locale]) and non-localized routes
 *
 * Features:
 * - URL sync for all filters (deep linking)
 * - Debounced filter updates
 * - Export (CSV/JSON)
 * - Stats strip overview
 * - Trend chart (24h mini visualization)
 * - Keyboard shortcuts (⌘K, Esc, ⌘E, ⌘R)
 * - Session export (JSON/CSV)
 * - Copy JSON helpers
 * - Skeleton loading states
 * - Empty/Error states
 */

"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTimeline } from "@/hooks/useTimeline";
import { useUrlSync } from "@/hooks/useUrlSync";
import { useDebounced } from "@/hooks/useDebounced";
import { FiltersBar } from "@/components/timeline/FiltersBar";
import { SessionModal } from "@/components/timeline/SessionModal";

// Dynamic import to prevent SSR hydration errors with react-window
const TimelineList = dynamic(
  () => import("@/components/timeline/TimelineList").then((mod) => ({ default: mod.TimelineList })),
  { ssr: false }
);
import { ExportMenu } from "@/components/timeline/ExportMenu";
import { StatsStrip } from "@/components/timeline/StatsStrip";
import TrendMini from "@/components/timeline/TrendMini";
import { KeyboardShortcuts } from "@/components/timeline/KeyboardShortcuts";
import SkeletonRow from "@/components/timeline/SkeletonRow";
import { EmptyState } from "@/components/timeline/EmptyState";
import { ErrorState } from "@/components/timeline/ErrorState";

export default function TimelinePage() {
  // Get sessionId from URL if present
  const getUrlSessionId = (): string | undefined => {
    if (typeof window === "undefined") return undefined;
    const url = new URL(window.location.href);
    return url.searchParams.get("sessionId") || undefined;
  };

  const urlSession = getUrlSessionId();

  // Timeline hook with initial filters from URL
  const { items, loading, error, hasMore, loadMore, filters, setFilters, refresh } =
    useTimeline({ sessionId: urlSession });

  // Debounce filters to avoid excessive API calls
  const debouncedFilters = useDebounced(filters, 300);

  // Sync debounced filters to URL
  useUrlSync(debouncedFilters);

  // Session modal state
  const [openSession, setOpenSession] = useState<string | null>(urlSession || null);

  /**
   * Open session modal when URL has sessionId
   */
  useEffect(() => {
    if (urlSession) {
      setOpenSession(urlSession);
    }
  }, [urlSession]);

  /**
   * Update URL when opening session (for deep linking)
   */
  const handleOpenSession = (sessionId: string) => {
    setOpenSession(sessionId);

    // Update URL for deep linking
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("sessionId", sessionId);
      window.history.pushState({}, "", url.toString());
    }
  };

  /**
   * Close session modal and clear URL param
   */
  const handleCloseSession = () => {
    setOpenSession(null);

    // Clear sessionId from URL
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("sessionId");
      window.history.pushState({}, "", url.toString());
    }
  };

  // Check if any filters are active
  const hasActiveFilters =
    filters.sessionId || filters.strategy || filters.type || filters.from || filters.to;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0d10] to-[#0f1419] p-6">
      {/* Keyboard Shortcuts */}
      <KeyboardShortcuts
        onOpenFirst={() => {
          if (items.length > 0) {
            handleOpenSession(items[0].sessionId);
          }
        }}
        onClose={handleCloseSession}
        onExport={() => {
          // Trigger export for currently open session
          if (openSession) {
            const exportBtn = document.querySelector('[aria-label*="Export session"]');
            if (exportBtn) (exportBtn as HTMLButtonElement).click();
          }
        }}
        onRefresh={refresh}
      />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Ops Timeline</h1>
            <p className="text-sm opacity-70 mt-1">
              Event stream from ops_events collection
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Export menu */}
            {items.length > 0 && <ExportMenu items={items} />}

            {/* Item count */}
            <div className="text-sm opacity-70">
              {items.length} {items.length === 1 ? "event" : "events"}
            </div>

            {/* Refresh button */}
            <button
              onClick={refresh}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500/60"
              aria-label="Refresh timeline"
            >
              {loading ? "⏳ Loading..." : "🔄 Refresh"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <FiltersBar value={filters} onChange={setFilters} />

        {/* Stats strip and Trend chart */}
        {items.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            <StatsStrip items={items} />
            <TrendMini items={items} />
          </div>
        )}

        {/* Error state */}
        {error && <ErrorState message={error} onRetry={refresh} />}

        {/* Empty state (no filters, no items) */}
        {!loading && items.length === 0 && !error && !hasActiveFilters && (
          <EmptyState />
        )}

        {/* Empty state (with filters) */}
        {!loading && items.length === 0 && !error && hasActiveFilters && (
          <div className="text-center py-16 opacity-70">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-lg font-medium mb-1">No events match your filters</div>
            <div className="text-sm text-white/60">
              Try adjusting your filters or expanding the time range
            </div>
          </div>
        )}

        {/* Loading skeleton (initial load) */}
        {loading && items.length === 0 && !error && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}

        {/* Timeline list */}
        {items.length > 0 && (
          <TimelineList
            items={items}
            hasMore={hasMore}
            loadMore={loadMore}
            onOpenSession={handleOpenSession}
          />
        )}

        {/* Loading more indicator (pagination) */}
        {loading && items.length > 0 && (
          <div className="flex justify-center py-4 opacity-70">
            <div className="text-sm">Loading more events...</div>
          </div>
        )}
      </div>

      {/* Session details modal */}
      <SessionModal sessionId={openSession} onClose={handleCloseSession} />
    </div>
  );
}
