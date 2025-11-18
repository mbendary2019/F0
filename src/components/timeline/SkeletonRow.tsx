/**
 * SkeletonRow - Loading placeholder for timeline items
 *
 * Displays an animated skeleton while timeline data is loading.
 * Provides visual feedback to users that content is being fetched.
 */

export default function SkeletonRow() {
  return (
    <div className="p-3 rounded-xl border border-white/10 bg-white/5 animate-pulse">
      <div className="h-4 w-1/3 bg-white/20 rounded mb-2" />
      <div className="h-3 w-2/3 bg-white/10 rounded" />
    </div>
  );
}
