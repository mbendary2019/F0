/**
 * TimelineItem Component (Phase 62 Day 2)
 *
 * Displays a single timeline event with:
 * - Severity badge
 * - Event label and metadata (model, score)
 * - Event type and session ID
 * - Timestamp
 * - "Open" button to view session details
 */

import { SeverityBadge, type SeverityLevel } from "./SeverityBadge";

export type TimelineItemData = {
  id: string;
  sessionId: string;
  ts: number;
  label: string;
  type: string;
  severity?: SeverityLevel;
  meta?: Record<string, any>;
};

export type TimelineItemProps = {
  item: TimelineItemData;
  onOpenSession?: (sessionId: string) => void;
};

export function TimelineItem({ item, onOpenSession }: TimelineItemProps) {
  const dt = new Date(item.ts).toLocaleString();

  return (
    <div className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl border border-white/10 transition-colors">
      {/* Left side: Event info */}
      <div className="min-w-0 pr-4 flex-1">
        {/* First row: Badge, label, and metadata */}
        <div className="flex items-center gap-2 text-sm mb-1">
          <SeverityBadge level={item.severity} />

          <span className="font-medium truncate">{item.label}</span>

          {/* Show model if available */}
          {item.meta?.model && (
            <span className="text-xs opacity-70 px-2 py-0.5 rounded-md bg-white/5">
              {item.meta.model}
            </span>
          )}

          {/* Show score if available */}
          {typeof item.meta?.score === "number" && (
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                item.meta.score >= 0.7
                  ? "bg-emerald-500/20 text-emerald-300"
                  : item.meta.score >= 0.5
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-rose-500/20 text-rose-300"
              }`}
            >
              {item.meta.score.toFixed(2)}
            </span>
          )}
        </div>

        {/* Second row: Type and session ID */}
        <div className="text-xs opacity-70 truncate">
          <span className="font-mono">{item.type}</span>
          <span className="mx-2">•</span>
          <span className="font-mono">{item.sessionId}</span>

          {/* Show strategy if available */}
          {item.meta?.strategy && (
            <>
              <span className="mx-2">•</span>
              <span>strategy: {item.meta.strategy}</span>
            </>
          )}
        </div>
      </div>

      {/* Right side: Timestamp and action */}
      <div className="flex items-center gap-3">
        <span className="text-xs opacity-60 whitespace-nowrap">{dt}</span>

        {onOpenSession && (
          <button
            className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/10 hover:border-white/30 transition-colors text-sm"
            onClick={() => onOpenSession(item.sessionId)}
          >
            Open
          </button>
        )}
      </div>
    </div>
  );
}
