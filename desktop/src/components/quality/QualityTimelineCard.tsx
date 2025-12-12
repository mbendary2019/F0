// desktop/src/components/quality/QualityTimelineCard.tsx
// Phase 140.8: Quality Timeline Card Component
// Displays a visual timeline of project quality over time

import React from 'react';
import clsx from 'clsx';
import { useQualityStoryEvents } from '../../hooks/useQualityStoryEvents';
import type { QualityStoryEvent } from '../../types/qualityStory';

interface QualityTimelineCardProps {
  /** Locale for bilingual support */
  locale?: 'en' | 'ar';
  /** Additional CSS class */
  className?: string;
}

/**
 * Format time from ISO string
 */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date from ISO string (short)
 */
function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get icon for event type
 */
function getEventIcon(e: QualityStoryEvent): string {
  switch (e.type) {
    case 'SECURITY_ALERT':
      return '\u{1F6E1}'; // shield
    case 'HEALTH_DROP':
    case 'COVERAGE_DROP':
      return '\u26A0'; // warning
    case 'HEALTH_RISE':
    case 'COVERAGE_RISE':
      return '\u2191'; // up arrow
    case 'DEPLOY':
      return '\u{1F680}'; // rocket
    case 'ATP_RUN':
      return '\u{1F9EA}'; // test tube
    case 'AUTO_IMPROVE':
      return '\u2728'; // sparkles
    default:
      return '\u2139'; // info
  }
}

/**
 * Get color class for event type
 */
function getEventColor(e: QualityStoryEvent): string {
  switch (e.type) {
    case 'HEALTH_DROP':
    case 'COVERAGE_DROP':
    case 'SECURITY_ALERT':
      return 'text-red-400 bg-red-500/20 border-red-500/40';
    case 'HEALTH_RISE':
    case 'COVERAGE_RISE':
    case 'AUTO_IMPROVE':
      return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40';
    case 'DEPLOY':
      return 'text-sky-400 bg-sky-500/20 border-sky-500/40';
    case 'ATP_RUN':
      return 'text-violet-400 bg-violet-500/20 border-violet-500/40';
    default:
      return 'text-slate-400 bg-slate-500/20 border-slate-500/40';
  }
}

/**
 * Quality Timeline Card Component
 *
 * Displays project quality history as a visual timeline with:
 * - Simple bar chart showing health over time
 * - Event markers for significant changes
 * - Scrollable event list
 */
export const QualityTimelineCard: React.FC<QualityTimelineCardProps> = ({
  locale = 'en',
  className,
}) => {
  const { snapshots, events } = useQualityStoryEvents();
  const isAr = locale === 'ar';

  const hasData = snapshots.length > 0;

  // Get date range for header
  const dateRange = hasData
    ? `${formatDateShort(snapshots[0].timestamp)} - ${formatDateShort(
        snapshots[snapshots.length - 1].timestamp
      )}`
    : isAr
    ? 'لا توجد بيانات'
    : 'No data';

  return (
    <div
      className={clsx(
        'rounded-2xl border border-white/8 bg-[#160016]/80 shadow-2xl shadow-purple-900/40',
        'flex flex-col h-full',
        className
      )}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/8">
        <h3 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 rounded-full border border-purple-500/60 bg-purple-800/40 items-center justify-center text-[11px]">
            Q
          </span>
          {isAr ? 'جودة المشروع عبر الزمن' : 'Project quality over time'}
        </h3>
        <span className="text-[11px] text-slate-400">{dateRange}</span>
      </div>

      {/* Chart area */}
      <div className="px-4 py-3 flex-1 min-h-0">
        {hasData ? (
          <div className="h-32 rounded-xl bg-[#070012] border border-[#31125b]/70 p-2 flex items-end gap-0.5">
            {snapshots.slice(-20).map((snap, idx) => {
              const height = Math.max(4, (snap.health / 100) * 100);
              const isLatest = idx === snapshots.slice(-20).length - 1;
              return (
                <div
                  key={snap.id}
                  className="flex-1 flex flex-col items-center justify-end group relative"
                >
                  <div
                    className={clsx(
                      'w-full rounded-t transition-all duration-200',
                      isLatest
                        ? 'bg-gradient-to-t from-purple-600 to-purple-400'
                        : 'bg-gradient-to-t from-purple-900/80 to-purple-700/60',
                      'group-hover:from-purple-500 group-hover:to-purple-300'
                    )}
                    style={{ height: `${height}%` }}
                    title={`${snap.health.toFixed(1)}% - ${formatDateShort(snap.timestamp)}`}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                    <div className="bg-slate-900/95 border border-slate-700/80 rounded-lg px-2 py-1 text-[10px] text-slate-100 whitespace-nowrap shadow-xl">
                      <div className="font-semibold">{snap.health.toFixed(1)}%</div>
                      <div className="text-slate-400">
                        {formatDateShort(snap.timestamp)} {formatTime(snap.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-32 rounded-xl bg-[#070012] border border-[#31125b]/70 flex items-center justify-center text-xs text-slate-400">
            {isAr
              ? 'لا توجد لقطات جودة بعد. قم بتشغيل فحص أو اختبارات.'
              : 'No quality snapshots yet. Run a scan or tests.'}
          </div>
        )}
      </div>

      {/* Events strip */}
      {hasData && events.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1">
            {events.slice(0, 15).map((e) => (
              <div
                key={e.id}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
                  getEventColor(e)
                )}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/20">
                  {getEventIcon(e)}
                </span>
                <span className="truncate max-w-[120px]">{e.title}</span>
                <span className="text-white/40">
                  {formatTime(e.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityTimelineCard;
