/**
 * StatsStrip - Quick statistics overview for timeline
 *
 * Displays key metrics about the current timeline view:
 * - Total event count
 * - Validation event count
 * - Average validation score
 */

export interface StatsStripProps {
  /**
   * Timeline items to calculate stats from
   */
  items: any[];
}

export function StatsStrip({ items }: StatsStripProps) {
  const count = items.length;

  // Filter validation events
  const validates = items.filter((i) => i.type === "rag.validate");

  // Calculate average score for validation events
  const avg =
    validates.length > 0
      ? validates.reduce((sum, item) => sum + (Number(item.meta?.score) || 0), 0) /
        validates.length
      : 0;

  // Count by severity
  const errorCount = items.filter((i) => i.severity === "error").length;
  const warnCount = items.filter((i) => i.severity === "warn").length;
  const infoCount = items.filter((i) => i.severity === "info").length;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total Events */}
      <div className="p-3 rounded-2xl border border-white/10 bg-white/5">
        <div className="text-xs opacity-70 mb-1">Total Events</div>
        <div className="text-2xl font-semibold">{count}</div>
      </div>

      {/* Validations */}
      <div className="p-3 rounded-2xl border border-white/10 bg-white/5">
        <div className="text-xs opacity-70 mb-1">Validations</div>
        <div className="text-2xl font-semibold">{validates.length}</div>
      </div>

      {/* Average Score */}
      <div className="p-3 rounded-2xl border border-white/10 bg-white/5">
        <div className="text-xs opacity-70 mb-1">Avg Score</div>
        <div
          className={`text-2xl font-semibold ${
            avg >= 0.7
              ? "text-emerald-400"
              : avg >= 0.5
                ? "text-amber-400"
                : "text-rose-400"
          }`}
        >
          {avg > 0 ? avg.toFixed(2) : "—"}
        </div>
      </div>

      {/* Severity Breakdown */}
      <div className="p-3 rounded-2xl border border-white/10 bg-white/5">
        <div className="text-xs opacity-70 mb-1">By Severity</div>
        <div className="flex gap-3 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-rose-400">✕</span>
            <span>{errorCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-amber-400">⚠</span>
            <span>{warnCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-emerald-400">✓</span>
            <span>{infoCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
