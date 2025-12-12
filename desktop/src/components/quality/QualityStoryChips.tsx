// desktop/src/components/quality/QualityStoryChips.tsx
// Phase 140.8: Quality Story Chips Component
// Displays recent quality events as detailed chips/cards

import React from 'react';
import clsx from 'clsx';
import { useQualityStoryEvents } from '../../hooks/useQualityStoryEvents';
import type { QualityStoryEvent } from '../../types/qualityStory';

interface QualityStoryChipsProps {
  /** Locale for bilingual support */
  locale?: 'en' | 'ar';
  /** Maximum number of events to show */
  maxEvents?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Format date and time from ISO string
 */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get icon for event type
 */
function iconForEvent(e: QualityStoryEvent): string {
  switch (e.type) {
    case 'HEALTH_DROP':
    case 'COVERAGE_DROP':
      return '\u2193'; // down arrow
    case 'HEALTH_RISE':
    case 'COVERAGE_RISE':
      return '\u2191'; // up arrow
    case 'SECURITY_ALERT':
      return '\u{1F6E1}'; // shield
    case 'ATP_RUN':
      return '\u{1F9EA}'; // test tube
    case 'DEPLOY':
      return '\u{1F680}'; // rocket
    case 'AUTO_IMPROVE':
      return '\u2728'; // sparkles
    default:
      return '\u2139'; // info
  }
}

/**
 * Get color class for event type
 */
function toneClass(e: QualityStoryEvent): string {
  switch (e.type) {
    case 'HEALTH_DROP':
    case 'COVERAGE_DROP':
    case 'SECURITY_ALERT':
      return 'border-red-500/40 bg-red-950/40';
    case 'HEALTH_RISE':
    case 'COVERAGE_RISE':
    case 'AUTO_IMPROVE':
      return 'border-emerald-500/40 bg-emerald-950/40';
    case 'DEPLOY':
      return 'border-sky-500/40 bg-sky-950/40';
    case 'ATP_RUN':
      return 'border-violet-500/40 bg-violet-950/40';
    default:
      return 'border-slate-600/40 bg-slate-900/60';
  }
}

/**
 * Quality Story Chips Component
 *
 * Displays recent quality events as detailed cards showing:
 * - Event title and description
 * - Timestamp
 * - Metrics (health, coverage, issues)
 */
export const QualityStoryChips: React.FC<QualityStoryChipsProps> = ({
  locale = 'en',
  maxEvents = 6,
  className,
}) => {
  const { events } = useQualityStoryEvents();
  const isAr = locale === 'ar';

  if (!events.length) return null;

  const displayEvents = events.slice(0, maxEvents);

  return (
    <div
      className={clsx(
        'rounded-2xl border border-white/8 bg-[#050013]/80',
        className
      )}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/8">
        <h3 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
          <span className="text-amber-400">\u26A0</span>
          {isAr ? 'لمحة سريعة عن قصة المشروع' : 'Project story at a glance'}
        </h3>
      </div>

      {/* Events list */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {displayEvents.map((e) => (
          <div
            key={e.id}
            className={clsx(
              'rounded-xl border px-3 py-2.5 flex flex-col gap-1 text-xs text-slate-100',
              toneClass(e)
            )}
          >
            {/* Title row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/40 border border-white/10">
                  {iconForEvent(e)}
                </span>
                <span className="font-semibold text-[13px] leading-tight">
                  {e.title}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                {formatDateTime(e.timestamp)}
              </span>
            </div>

            {/* Description */}
            {e.description && (
              <p className="text-[11px] text-slate-300/90 leading-snug">
                {e.description}
              </p>
            )}

            {/* Metrics badges */}
            <div className="flex flex-wrap gap-1 mt-1">
              {typeof e.health === 'number' && (
                <span className="inline-flex items-center rounded-full border border-purple-400/40 bg-purple-900/20 text-[10px] h-5 px-2">
                  {isAr ? 'صحة' : 'Health'} {e.health.toFixed(1)}%
                  {e.healthDelta != null && e.healthDelta !== 0 && (
                    <span
                      className={clsx(
                        'ml-1',
                        e.healthDelta > 0 ? 'text-emerald-300' : 'text-red-300'
                      )}
                    >
                      ({e.healthDelta > 0 ? '+' : ''}
                      {e.healthDelta.toFixed(1)})
                    </span>
                  )}
                </span>
              )}

              {typeof e.coverageDelta === 'number' && e.coverageDelta !== 0 && (
                <span className="inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-900/20 text-[10px] h-5 px-2">
                  {isAr ? 'تغطية' : 'Coverage'}{' '}
                  {e.coverageDelta > 0 ? '+' : ''}
                  {e.coverageDelta.toFixed(1)}%
                </span>
              )}

              {typeof e.issuesDelta === 'number' && e.issuesDelta !== 0 && (
                <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-900/20 text-[10px] h-5 px-2">
                  {isAr ? 'مشاكل' : 'Issues'}{' '}
                  {e.issuesDelta > 0 ? '+' : ''}
                  {e.issuesDelta}
                </span>
              )}

              {e.blockingSecurityAlerts != null &&
                e.blockingSecurityAlerts > 0 && (
                  <span className="inline-flex items-center rounded-full border border-red-400/60 bg-red-900/40 text-[10px] h-5 px-2">
                    {e.blockingSecurityAlerts}{' '}
                    {isAr ? 'أمان حاجب' : 'blocking security'}
                  </span>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QualityStoryChips;
