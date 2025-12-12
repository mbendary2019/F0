// src/components/quality/QualityHistoryPanel.tsx
// Phase 135.4: Quality History Panel
// Displays project quality snapshots over time with trend analysis

import React from 'react';
import type { QualitySnapshot } from '../../lib/quality/qualityHistoryTypes';
import { formatDateAgo } from '../../lib/quality/qualityHistoryTypes';
import type { PolicyStatus } from '../../lib/quality/policyEngine';

type Locale = 'en' | 'ar';

interface QualityHistoryPanelProps {
  /** Quality snapshots to display */
  snapshots: QualitySnapshot[];
  /** Current locale */
  locale: Locale;
  /** Maximum number of snapshots to show */
  maxVisible?: number;
  /** Optional: Compact mode for smaller spaces */
  compact?: boolean;
}

/**
 * Get icon for policy status
 */
function statusIcon(status: PolicyStatus): string {
  if (status === 'OK') return '✅';
  if (status === 'CAUTION') return '⚠️';
  return '⛔️';
}

/**
 * Get status color class
 */
function statusColor(status: PolicyStatus): string {
  if (status === 'OK') return 'text-emerald-400';
  if (status === 'CAUTION') return 'text-amber-400';
  return 'text-red-400';
}

/**
 * Calculate trend from snapshots
 */
function getTrend(
  snapshots: QualitySnapshot[]
): 'improving' | 'stable' | 'declining' | 'unknown' {
  if (snapshots.length < 2) return 'unknown';

  const sorted = [...snapshots].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (last.health > first.health + 2) return 'improving';
  if (last.health < first.health - 2) return 'declining';
  return 'stable';
}

/**
 * Get trend icon and color
 */
function getTrendDisplay(trend: string, locale: Locale) {
  const labels = {
    improving: locale === 'ar' ? 'يتحسن' : 'improving',
    declining: locale === 'ar' ? 'يتدهور' : 'declining',
    stable: locale === 'ar' ? 'مستقر' : 'stable',
    unknown: locale === 'ar' ? 'غير معروف' : 'unknown',
  };

  const icons = {
    improving: '📈',
    declining: '📉',
    stable: '➡️',
    unknown: '❓',
  };

  const colors = {
    improving: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    declining: 'text-red-400 border-red-500/40 bg-red-500/10',
    stable: 'text-slate-300 border-slate-500/40 bg-slate-500/10',
    unknown: 'text-slate-500 border-slate-600/40 bg-slate-600/10',
  };

  return {
    label: labels[trend as keyof typeof labels] || labels.unknown,
    icon: icons[trend as keyof typeof icons] || icons.unknown,
    colorClass: colors[trend as keyof typeof colors] || colors.unknown,
  };
}

/**
 * Quality History Panel
 * Shows quality snapshots over time with trend analysis
 */
export const QualityHistoryPanel: React.FC<QualityHistoryPanelProps> = ({
  snapshots,
  locale,
  maxVisible = 5,
  compact = false,
}) => {
  const isRtl = locale === 'ar';

  // Sort snapshots by date (newest first for display)
  const sorted = [...snapshots].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const visibleSnapshots = sorted.slice(0, maxVisible);
  const trend = getTrend(snapshots);
  const trendDisplay = getTrendDisplay(trend, locale);

  // Empty state
  if (!visibleSnapshots.length) {
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-slate-400"
      >
        {locale === 'ar'
          ? '📊 لا يوجد سجل للجودة بعد — قم بتشغيل فحص للمشروع للبدء.'
          : '📊 No quality history yet — run a project scan to get started.'}
      </div>
    );
  }

  // Compact mode
  if (compact) {
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">
              {locale === 'ar' ? 'آخر' : 'Last'} {visibleSnapshots.length}:
            </span>
            <div className="flex items-center gap-1">
              {visibleSnapshots.slice(0, 3).map((snap) => (
                <span
                  key={snap.id}
                  className={`text-sm ${statusColor(snap.policyStatus)}`}
                  title={`${snap.health}% - ${formatDateAgo(snap.createdAt, locale)}`}
                >
                  {statusIcon(snap.policyStatus)}
                </span>
              ))}
            </div>
          </div>
          <div
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${trendDisplay.colorClass}`}
          >
            <span>{trendDisplay.icon}</span>
            <span>{trendDisplay.label}</span>
          </div>
        </div>
      </div>
    );
  }

  // Full mode
  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            {locale === 'ar' ? '📊 سجل جودة المشروع' : '📊 Project Quality History'}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {locale === 'ar'
              ? 'تابع تطور صحة المشروع وعدد المشاكل عبر الزمن.'
              : 'Track how your project health and issues evolved over time.'}
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${trendDisplay.colorClass}`}
        >
          <span>{trendDisplay.icon}</span>
          <span>
            {locale === 'ar'
              ? `اتجاه الصحة: ${trendDisplay.label}`
              : `Health trend: ${trendDisplay.label}`}
          </span>
        </div>
      </div>

      {/* Snapshots List */}
      <div className="space-y-2">
        {visibleSnapshots.map((snap, idx) => {
          // Calculate delta from previous snapshot (if exists)
          const prevSnap = sorted[idx + 1];
          const deltaHealth = prevSnap ? snap.health - prevSnap.health : 0;
          const deltaIssues = prevSnap ? snap.totalIssues - prevSnap.totalIssues : 0;

          return (
            <div
              key={snap.id}
              className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2.5 text-xs transition-colors hover:bg-slate-900/80"
            >
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <span className="text-lg">{statusIcon(snap.policyStatus)}</span>

                {/* Health & Issues */}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-mono font-semibold ${statusColor(snap.policyStatus)}`}>
                      {snap.health.toFixed(0)}%
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {locale === 'ar' ? 'صحة المشروع' : 'project health'}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {/* Issues count */}
                    <span className="rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] text-slate-300">
                      {locale === 'ar'
                        ? `${snap.totalIssues} مشكلة`
                        : `${snap.totalIssues} issues`}
                    </span>

                    {/* Security alerts */}
                    {snap.securityAlerts > 0 && (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">
                        🛡️ {snap.securityAlerts}
                      </span>
                    )}

                    {/* Delta indicators */}
                    {prevSnap && deltaHealth !== 0 && (
                      <span
                        className={`text-[10px] ${
                          deltaHealth > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {deltaHealth > 0 ? '↑' : '↓'} {Math.abs(deltaHealth).toFixed(0)}%
                      </span>
                    )}

                    {prevSnap && deltaIssues !== 0 && (
                      <span
                        className={`text-[10px] ${
                          deltaIssues < 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {deltaIssues < 0 ? '↓' : '↑'} {Math.abs(deltaIssues)}{' '}
                        {locale === 'ar' ? 'مشكلة' : 'issues'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Timestamp */}
              <div className="text-[10px] text-slate-500">
                {formatDateAgo(snap.createdAt, locale)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint if there are more snapshots */}
      {snapshots.length > maxVisible && (
        <div className="mt-2 text-center text-[10px] text-slate-500">
          {locale === 'ar'
            ? `عرض آخر ${maxVisible} من ${snapshots.length} سجل`
            : `Showing last ${maxVisible} of ${snapshots.length} snapshots`}
        </div>
      )}
    </div>
  );
};

export default QualityHistoryPanel;
