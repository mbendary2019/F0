// desktop/src/components/quality/QualityWeeklySummary.tsx
// Phase 140.8: Quality Weekly Summary Component
// Displays a summary of quality changes over the last 7 days

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { useQualityStoryEvents } from '../../hooks/useQualityStoryEvents';

interface QualityWeeklySummaryProps {
  /** Locale for bilingual support */
  locale?: 'en' | 'ar';
  /** Additional CSS class */
  className?: string;
}

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Quality Weekly Summary Component
 *
 * Shows aggregated metrics for the last 7 days:
 * - Health change
 * - Net coverage change
 * - ATP runs
 * - Auto-Improve runs
 * - Blocking security incidents
 */
export const QualityWeeklySummary: React.FC<QualityWeeklySummaryProps> = ({
  locale = 'en',
  className,
}) => {
  const { snapshots, events } = useQualityStoryEvents();
  const isAr = locale === 'ar';

  const summary = useMemo(() => {
    if (!snapshots.length) return null;

    const now = Date.now();

    // Filter snapshots from the last 7 days
    const weekSnapshots = snapshots.filter(
      (s) => now - new Date(s.timestamp).getTime() <= 7 * MS_DAY
    );

    // Filter events from the last 7 days
    const weekEvents = events.filter(
      (e) => now - new Date(e.timestamp).getTime() <= 7 * MS_DAY
    );

    // Use full history if week is empty
    const snapsToUse = weekSnapshots.length >= 2 ? weekSnapshots : snapshots;
    const eventsToUse = weekEvents.length > 0 ? weekEvents : events;

    const first = snapsToUse[0];
    const last = snapsToUse[snapsToUse.length - 1];

    // Health change
    const healthDelta = last.health - first.health;

    // Coverage change (aggregate from events)
    const coverageEvents = eventsToUse.filter(
      (e) => e.type === 'COVERAGE_RISE' || e.type === 'COVERAGE_DROP'
    );
    const totalCoverageDelta = coverageEvents.reduce(
      (sum, e) => sum + (e.coverageDelta ?? 0),
      0
    );

    // ATP runs
    const atpRuns = eventsToUse.filter((e) => e.type === 'ATP_RUN').length;

    // Auto-improve runs
    const autoImproveRuns = eventsToUse.filter(
      (e) => e.type === 'AUTO_IMPROVE'
    ).length;

    // Security blocking events
    const securityBlocks = eventsToUse.filter(
      (e) =>
        e.type === 'SECURITY_ALERT' && (e.blockingSecurityAlerts ?? 0) > 0
    ).length;

    // Deploys
    const deploys = eventsToUse.filter((e) => e.type === 'DEPLOY').length;

    return {
      healthDelta,
      totalCoverageDelta,
      atpRuns,
      autoImproveRuns,
      securityBlocks,
      deploys,
      snapshotCount: weekSnapshots.length || snapshots.length,
      isWeekData: weekSnapshots.length >= 2,
    };
  }, [snapshots, events]);

  if (!summary) return null;

  return (
    <div
      className={clsx(
        'rounded-2xl border border-white/8 bg-[#050014]/90',
        className
      )}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/8">
        <h3 className="text-sm font-semibold text-slate-50">
          {summary.isWeekData
            ? isAr
              ? 'قصة آخر 7 أيام'
              : 'Last 7 days story'
            : isAr
            ? 'ملخص التاريخ'
            : 'History summary'}
        </h3>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 text-xs text-slate-200 flex flex-col gap-1.5">
        {/* Health change */}
        <div className="flex justify-between">
          <span className="text-slate-400">
            {isAr ? 'تغيّر الصحة' : 'Health change'}
          </span>
          <span
            className={clsx(
              'font-semibold',
              summary.healthDelta > 0
                ? 'text-emerald-300'
                : summary.healthDelta < 0
                ? 'text-red-300'
                : 'text-slate-200'
            )}
          >
            {summary.healthDelta > 0 ? '+' : ''}
            {summary.healthDelta.toFixed(1)} pts
          </span>
        </div>

        {/* Coverage change */}
        <div className="flex justify-between">
          <span className="text-slate-400">
            {isAr ? 'تغيّر التغطية' : 'Net coverage change'}
          </span>
          <span
            className={clsx(
              'font-semibold',
              summary.totalCoverageDelta > 0
                ? 'text-cyan-300'
                : summary.totalCoverageDelta < 0
                ? 'text-red-300'
                : 'text-slate-200'
            )}
          >
            {summary.totalCoverageDelta > 0 ? '+' : ''}
            {summary.totalCoverageDelta.toFixed(1)}%
          </span>
        </div>

        {/* ATP runs */}
        <div className="flex justify-between">
          <span className="text-slate-400">
            {isAr ? 'تشغيلات ATP' : 'ATP runs'}
          </span>
          <span className="font-semibold text-slate-100">
            {summary.atpRuns}
          </span>
        </div>

        {/* Auto-improve runs */}
        <div className="flex justify-between">
          <span className="text-slate-400">
            {isAr ? 'تشغيلات Auto-Improve' : 'Auto-Improve runs'}
          </span>
          <span className="font-semibold text-slate-100">
            {summary.autoImproveRuns}
          </span>
        </div>

        {/* Security blocks */}
        <div className="flex justify-between">
          <span className="text-slate-400">
            {isAr ? 'حوادث أمان حاجبة' : 'Blocking security incidents'}
          </span>
          <span
            className={clsx(
              'font-semibold',
              summary.securityBlocks > 0 ? 'text-red-300' : 'text-slate-100'
            )}
          >
            {summary.securityBlocks}
          </span>
        </div>

        {/* Deploys */}
        <div className="flex justify-between">
          <span className="text-slate-400">
            {isAr ? 'عمليات النشر' : 'Deploys'}
          </span>
          <span className="font-semibold text-slate-100">{summary.deploys}</span>
        </div>

        {/* Footer */}
        <div className="mt-2 text-[11px] text-slate-500">
          {isAr
            ? `استنادًا إلى ${summary.snapshotCount} لقطة جودة تم جمعها ${
                summary.isWeekData ? 'هذا الأسبوع' : ''
              }.`
            : `Based on ${summary.snapshotCount} quality snapshots collected${
                summary.isWeekData ? ' this week' : ''
              }.`}
        </div>
      </div>
    </div>
  );
};

export default QualityWeeklySummary;
