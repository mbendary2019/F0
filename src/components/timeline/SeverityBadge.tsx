/**
 * SeverityBadge Component (Phase 62 Day 2)
 *
 * Displays severity level as a colored badge:
 * - info: Green (emerald)
 * - warn: Yellow (amber)
 * - error: Red (rose)
 */

export type SeverityLevel = "info" | "warn" | "error";

export type SeverityBadgeProps = {
  level?: SeverityLevel;
};

export function SeverityBadge({ level = "info" }: SeverityBadgeProps) {
  // Map severity to Tailwind classes
  const severityStyles: Record<SeverityLevel, string> = {
    info: "bg-emerald-500/20 text-emerald-300 border-emerald-600/40",
    warn: "bg-amber-500/20 text-amber-300 border-amber-600/40",
    error: "bg-rose-500/20 text-rose-300 border-rose-600/40",
  };

  // Map severity to icons
  const severityIcons: Record<SeverityLevel, string> = {
    info: "✓",
    warn: "⚠",
    error: "✕",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${severityStyles[level]}`}
    >
      <span>{severityIcons[level]}</span>
      <span>{level}</span>
    </span>
  );
}
