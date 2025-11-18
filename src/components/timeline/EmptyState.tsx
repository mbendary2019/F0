/**
 * EmptyState - Displays when no timeline events are found
 *
 * Provides helpful feedback to users when filters return no results
 * or when the timeline is genuinely empty.
 */

export function EmptyState() {
  return (
    <div className="text-center py-16 opacity-70">
      <div className="text-6xl mb-4">📊</div>
      <div className="text-lg font-medium mb-1">No events yet</div>
      <div className="text-sm text-white/60">
        Try changing filters or time range to see more results
      </div>
    </div>
  );
}
