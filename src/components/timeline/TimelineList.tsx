/**
 * TimelineList Component (Phase 62 Day 2 - Virtualized)
 *
 * Virtualized list of timeline items using react-window for performance.
 * Supports infinite scroll with intersection observer.
 */

"use client";

import { useEffect, useRef } from "react";
import { FixedSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { TimelineItem as RowItem, type TimelineItemData } from "./TimelineItem";

export type TimelineListProps = {
  items: TimelineItemData[];
  loadMore: () => void;
  hasMore: boolean;
  onOpenSession: (sessionId: string) => void;
};

export function TimelineList({
  items,
  loadMore,
  hasMore,
  onOpenSession,
}: TimelineListProps) {
  const sentinel = useRef<HTMLDivElement>(null);

  /**
   * Setup intersection observer for infinite scroll
   */
  useEffect(() => {
    if (!hasMore) return;

    const el = sentinel.current;
    if (!el) return;

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadMore();
        }
      }
    });

    io.observe(el);

    return () => io.disconnect();
  }, [hasMore, loadMore]);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] opacity-60">
        <div className="text-center">
          <div className="text-2xl mb-2">📭</div>
          <div>No timeline events found</div>
          <div className="text-sm mt-1">Try adjusting your filters</div>
        </div>
      </div>
    );
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index];
    if (!item) return null;

    return (
      <div style={style}>
        <RowItem item={item} onOpenSession={onOpenSession} />
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Virtualized list using react-window */}
      <div style={{ height: "600px" }}>
        <AutoSizer>
          {({ width, height }: { width: number; height: number }) => (
            <FixedSizeList
              width={width}
              height={height}
              itemCount={items.length}
              itemSize={76}
              overscanCount={5}
            >
              {Row}
            </FixedSizeList>
          )}
        </AutoSizer>
      </div>

      {/* Loading sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinel} className="flex justify-center py-4">
          <div className="text-sm opacity-60">Loading more...</div>
        </div>
      )}

      {/* End of list indicator */}
      {!hasMore && items.length > 0 && (
        <div className="text-center py-4">
          <div className="text-sm opacity-60">
            End of timeline • {items.length} events loaded
          </div>
        </div>
      )}
    </div>
  );
}
