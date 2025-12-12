// desktop/src/components/quality/QualityHeaderCard.tsx
// Phase 132.P1: Polished Quality Header Card with ring + alert dot

import React from 'react';
import { useQualityMonitor } from '../../state/qualityMonitorContext';
import { formatRelativeTime } from '../../lib/quality/qualityMonitorTypes';
import {
  getHealthSeverity,
  getSeverityColors,
  getSeverityLabel,
} from '../../lib/quality/qualityUtils';

interface QualityHeaderCardProps {
  onClick?: () => void;
  locale?: 'ar' | 'en';
  hasCriticalAlert?: boolean;
}

/**
 * Quality Header Card
 * Shows health ring, tests status, severity badge, and last cleanup time
 * Click to open Quality Panel
 */
export const QualityHeaderCard: React.FC<QualityHeaderCardProps> = ({
  onClick,
  locale = 'en',
  hasCriticalAlert = false,
}) => {
  const { summary } = useQualityMonitor();

  const health = summary.healthScore ?? 0;
  const isArabic = locale === 'ar';
  const severity = getHealthSeverity(summary.healthScore);
  const colors = getSeverityColors(severity);

  // Tests status icon
  const testsIcon =
    summary.testsStatus === 'passing'
      ? '✅'
      : summary.testsStatus === 'failing'
      ? '❌'
      : '–';

  // Tests status text
  const testsText =
    summary.testsStatus === 'passing'
      ? isArabic
        ? 'ناجحة'
        : 'Passing'
      : summary.testsStatus === 'failing'
      ? isArabic
        ? 'فاشلة'
        : 'Failing'
      : isArabic
      ? 'لم تُشغّل'
      : 'Not run';

  // Last cleanup time
  const lastCleanupTime = summary.lastCleanup?.createdAt || null;

  // Neon glow based on severity
  const getGlowStyle = (): React.CSSProperties => {
    if (severity === 'good') {
      return {
        boxShadow:
          '0 0 15px rgba(52, 211, 153, 0.4), 0 0 30px rgba(52, 211, 153, 0.2), 0 0 45px rgba(52, 211, 153, 0.1)',
      };
    }
    if (severity === 'ok') {
      return {
        boxShadow:
          '0 0 15px rgba(251, 191, 36, 0.4), 0 0 30px rgba(251, 191, 36, 0.2), 0 0 45px rgba(251, 191, 36, 0.1)',
      };
    }
    if (severity === 'warning') {
      return {
        boxShadow:
          '0 0 15px rgba(251, 146, 60, 0.45), 0 0 30px rgba(251, 146, 60, 0.25), 0 0 45px rgba(251, 146, 60, 0.12)',
      };
    }
    if (severity === 'critical') {
      return {
        boxShadow:
          '0 0 18px rgba(248, 113, 113, 0.55), 0 0 35px rgba(248, 113, 113, 0.35), 0 0 50px rgba(248, 113, 113, 0.18)',
      };
    }
    return {};
  };

  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-3 rounded-2xl border border-[#382a7b] bg-[#100325]/90 px-3 py-2 text-xs text-white/90 shadow-sm transition-all duration-200 hover:border-[#8a6bff] hover:bg-[#1a0639] hover:shadow-[0_0_18px_rgba(123,92,255,0.35)]"
      style={getGlowStyle()}
      title={isArabic ? 'عرض لوحة جودة المشروع' : 'View Project Quality'}
    >
      {/* Critical alert dot */}
      {(hasCriticalAlert || severity === 'critical') && (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(248,113,113,0.8)] animate-pulse" />
      )}

      {/* Health ring */}
      <div className="relative flex h-10 w-10 items-center justify-center">
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-br ${colors.ring} opacity-90 ${
            severity === 'critical' ? 'animate-pulse' : ''
          }`}
        />
        <div className="absolute inset-[3px] rounded-full bg-[#080018]" />
        <span className={`relative text-[11px] font-bold ${colors.text}`}>
          {summary.healthScore != null ? `${health}%` : '--'}
        </span>
      </div>

      {/* Text content */}
      <div className="flex flex-col items-start gap-0.5">
        {/* Title row */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-semibold uppercase tracking-wide text-white/90">
            {isArabic ? 'الجودة' : 'Quality'}
          </span>
          <span
            className={`rounded-full ${colors.bg} ${colors.border} border px-1.5 py-[1px] text-[9px] uppercase tracking-wide ${colors.text}`}
          >
            {getSeverityLabel(severity, locale)}
          </span>
          <span className="opacity-50">•</span>
          <span className="flex items-center gap-1 opacity-80">
            {testsIcon} {testsText}
          </span>
        </div>

        {/* Cleanup row */}
        <div className="text-[10px] text-white/55">
          {isArabic ? 'تنظيف: ' : 'Cleanup: '}
          {lastCleanupTime
            ? formatRelativeTime(lastCleanupTime)
            : isArabic
            ? 'لا يوجد'
            : 'None'}
        </div>
      </div>

      {/* Issues badge */}
      {summary.totalIssues !== null && summary.totalIssues > 0 && (
        <div className="ml-1 flex items-center justify-center rounded-full bg-[#2a1a4a] px-2 py-0.5 text-[10px] text-white/70">
          {summary.totalIssues} {isArabic ? 'مشكلة' : 'issues'}
        </div>
      )}
    </button>
  );
};

export default QualityHeaderCard;
