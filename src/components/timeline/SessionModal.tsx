/**
 * SessionModal Component (Phase 62 Day 2)
 *
 * Modal dialog that displays detailed information about a session:
 * - Session metadata (duration, event count, statistics)
 * - All events in chronological order
 * - Event metadata (JSON view)
 *
 * Fetches session details from /api/ops/timeline/[sessionId]
 */

import { useEffect, useState } from "react";
import { SeverityBadge } from "./SeverityBadge";
import { SessionExport } from "./SessionExport";
import { CopyJson } from "./CopyJson";
import { exportSessionCsv } from "@/utils/exportSession";

export type SessionModalProps = {
  sessionId: string | null;
  onClose: () => void;
};

export type SessionSummary = {
  sessionId: string;
  userId?: string;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  events: Array<{
    id: string;
    ts: number;
    label: string;
    type: string;
    severity?: "info" | "warn" | "error";
    meta?: Record<string, any>;
  }>;
  stats: {
    validations: {
      count: number;
      avgScore?: number;
      byModel?: Record<string, number>;
      byStrategy?: Record<string, number>;
      passed?: number;
      failed?: number;
    };
    citations?: {
      total?: number;
      average?: number;
    };
    retrievals?: {
      count: number;
      avgMs?: number;
    };
  };
};

export function SessionModal({ sessionId, onClose }: SessionModalProps) {
  const [data, setData] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch session details when sessionId changes
   */
  useEffect(() => {
    if (!sessionId) {
      setData(null);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/ops/timeline/${sessionId}`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const json = await res.json();

        if (json.error) {
          throw new Error(json.error);
        }

        setData(json);
      } catch (e: any) {
        console.error("[SessionModal] Error:", e);
        setError(e?.message || "Failed to load session");
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  /**
   * Keyboard navigation - Close modal on Escape key
   */
  useEffect(() => {
    if (!sessionId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sessionId, onClose]);

  if (!sessionId) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[92vw] max-w-5xl max-h-[86vh] overflow-auto rounded-2xl border border-white/15 bg-[#0b0d10] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Session Details</h3>
            <p className="text-sm opacity-70 font-mono mt-1">{sessionId}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Export buttons */}
            <SessionExport sessionId={sessionId} format="both" />

            {/* Session CSV button - exports only this session's events */}
            <button
              onClick={() => data?.events && exportSessionCsv(sessionId, data.events)}
              disabled={loading || !data?.events}
              className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500/60"
              aria-label="Export this session's events as CSV"
              title="Export this session's events as CSV"
            >
              📊 Session CSV
            </button>

            {/* Close button */}
            <button
              className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/60"
              onClick={onClose}
              aria-label="Close modal"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="text-center">
              <div className="text-2xl mb-2">⏳</div>
              <div className="opacity-60">Loading session details...</div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
            <div className="font-medium">Error</div>
            <div className="text-sm opacity-80">{error}</div>
          </div>
        )}

        {/* Session data */}
        {!loading && !error && data && (
          <div className="space-y-6">
            {/* Session metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <div>
                <div className="text-xs opacity-70 mb-1">Duration</div>
                <div className="font-mono text-sm">
                  {data.durationMs ? `${data.durationMs}ms` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs opacity-70 mb-1">Events</div>
                <div className="font-mono text-sm">{data.events?.length || 0}</div>
              </div>
              <div>
                <div className="text-xs opacity-70 mb-1">Validations</div>
                <div className="font-mono text-sm">
                  {data.stats.validations.count} (avg: {data.stats.validations.avgScore?.toFixed(2) || "—"})
                </div>
              </div>
              <div>
                <div className="text-xs opacity-70 mb-1">Citations</div>
                <div className="font-mono text-sm">
                  {data.stats.citations?.total || 0}
                </div>
              </div>
            </div>

            {/* Statistics */}
            {data.stats.validations.count > 0 && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-sm font-medium mb-3">Validation Statistics</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="opacity-70">Passed:</span>{" "}
                    <span className="text-emerald-300 font-mono">{data.stats.validations.passed || 0}</span>
                  </div>
                  <div>
                    <span className="opacity-70">Failed:</span>{" "}
                    <span className="text-rose-300 font-mono">{data.stats.validations.failed || 0}</span>
                  </div>
                </div>

                {data.stats.validations.byStrategy && (
                  <div className="mt-3">
                    <div className="opacity-70 text-xs mb-2">By Strategy:</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(data.stats.validations.byStrategy).map(([strategy, count]) => (
                        <span key={strategy} className="px-2 py-1 rounded-md bg-purple-500/20 text-purple-300 text-xs">
                          {strategy}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Events timeline */}
            <div>
              <div className="text-sm font-medium mb-3">Events ({data.events?.length || 0})</div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                {(data.events || []).map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 transition-colors"
                  >
                    {/* Event header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <SeverityBadge level={event.severity} />
                        <span className="text-sm font-medium">{event.label}</span>
                      </div>
                      <span className="text-xs opacity-60">
                        {new Date(event.ts).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Event type */}
                    <div className="text-xs opacity-70 font-mono mb-2">{event.type}</div>

                    {/* Event metadata */}
                    {event.meta && Object.keys(event.meta).length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer opacity-70 hover:opacity-100 transition-opacity mb-2">
                          View metadata
                        </summary>
                        <div className="mt-2 space-y-2">
                          <pre className="p-2 rounded-lg bg-black/30 whitespace-pre-wrap break-words opacity-85 overflow-x-auto">
                            {JSON.stringify(event.meta, null, 2)}
                          </pre>
                          <CopyJson value={event} label="Copy Event" />
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
