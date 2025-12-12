// desktop/src/components/quality/QualityCoachPanel.tsx
// Phase 135.5: Quality Coach Panel - Smart suggestions UI
// Updated: variant prop (full/compact) for 2-column layout support

import React from 'react';
import type { QualityCoachSuggestion } from '../../lib/quality/qualityCoach';
import type { QualityActionType } from '../../lib/quality/policyActions';
import mascotImg from '../../../public/mascots/f0-mascot-login.png';

type Locale = 'en' | 'ar';

interface QualityCoachPanelProps {
  suggestions: QualityCoachSuggestion[];
  locale: Locale;
  onRunAction?: (actionType: QualityActionType) => void;
  /** Display variant: 'full' for big panel, 'compact' for small badge */
  variant?: 'full' | 'compact';
}

/**
 * Get badge classes based on severity
 */
function severityBadgeClasses(severity: QualityCoachSuggestion['severity']): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10 text-red-300 border-red-500/60';
    case 'warning':
      return 'bg-amber-500/10 text-amber-300 border-amber-500/60';
    case 'info':
    default:
      return 'bg-sky-500/10 text-sky-300 border-sky-500/60';
  }
}

/**
 * Get icon based on severity
 */
function severityIcon(severity: QualityCoachSuggestion['severity']): string {
  switch (severity) {
    case 'critical':
      return '⛔️';
    case 'warning':
      return '⚠️';
    case 'info':
    default:
      return '💡';
  }
}

/**
 * Get severity label
 */
function severityLabel(severity: QualityCoachSuggestion['severity'], locale: Locale): string {
  if (locale === 'ar') {
    switch (severity) {
      case 'critical':
        return 'حرج';
      case 'warning':
        return 'تحذير';
      case 'info':
      default:
        return 'معلومة';
    }
  }
  return severity;
}

/**
 * Quality Coach Panel
 * Displays smart suggestions to improve project quality
 */
export const QualityCoachPanel: React.FC<QualityCoachPanelProps> = ({
  suggestions,
  locale,
  onRunAction,
  variant = 'full',
}) => {
  const isRtl = locale === 'ar';

  // Handle empty state
  if (!suggestions.length) {
    if (variant === 'compact') {
      return null;
    }
    // Full mode - show empty message
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-xs text-slate-400"
      >
        <div className="flex items-center gap-2 mb-2">
          <img
            src={mascotImg}
            alt="Quality Coach"
            className="h-6 w-6 rounded-full object-cover"
          />
          <span className="font-medium text-slate-200">
            {locale === 'ar' ? 'مدرب الجودة' : 'Quality Coach'}
          </span>
        </div>
        <p>
          {locale === 'ar'
            ? 'لا توجد توصيات حالية — استمر في تحسين صحة المشروع وتشغيل الفحوصات بانتظام.'
            : 'No current recommendations — keep improving project health and running scans regularly.'}
        </p>
      </div>
    );
  }

  // 🔹 Compact mode - badge style for tight spaces
  if (variant === 'compact') {
    const top = suggestions[0];
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px]"
      >
        <span className="text-base">{severityIcon(top.severity)}</span>
        <span className="font-medium text-slate-100">
          {locale === 'ar' ? top.titleAr : top.title}
        </span>
        {suggestions.length > 1 && (
          <span className="text-slate-500">
            +{suggestions.length - 1}
          </span>
        )}
      </div>
    );
  }

  // 🔸 Full mode - big panel for 2-column layout
  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 shadow-[0_0_40px_rgba(0,0,0,0.75)]"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            {locale === 'ar' ? 'مدرب الجودة (Quality Coach)' : 'Quality Coach'}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {locale === 'ar'
              ? 'تحليل لسجل الجودة واقتراحات عملية لتحسين الصحة وتقليل المشاكل قبل النشر.'
              : 'Analyzes your quality history and suggests concrete actions to improve health before deploying.'}
          </p>
        </div>
        <img
          src={mascotImg}
          alt="Quality Coach"
          className="h-9 w-9 rounded-full object-cover shadow-[0_0_12px_rgba(124,58,237,0.3)]"
        />
      </div>

      {/* Suggestions List */}
      <div className="space-y-3">
        {suggestions.map((sugg) => (
          <div
            key={sugg.id}
            className="rounded-xl border border-slate-800/90 bg-slate-900/75 px-3 py-3 transition-colors hover:bg-slate-900/90"
          >
            {/* Header row */}
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{severityIcon(sugg.severity)}</span>
                <span className="text-sm font-semibold text-slate-50">
                  {locale === 'ar' ? sugg.titleAr : sugg.title}
                </span>
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityBadgeClasses(
                  sugg.severity
                )}`}
              >
                {severityLabel(sugg.severity, locale)}
              </span>
            </div>

            {/* Message */}
            <p className="text-xs leading-relaxed text-slate-300">
              {locale === 'ar' ? sugg.messageAr : sugg.message}
            </p>

            {/* Action button */}
            {sugg.recommendedActionType && onRunAction && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => onRunAction(sugg.recommendedActionType!)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-sky-600 to-sky-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:from-sky-500 hover:to-sky-400 active:scale-[0.97]"
                >
                  <span>🚀</span>
                  <span>
                    {locale === 'ar' ? 'تنفيذ الإجراء المقترح' : 'Run suggested action'}
                  </span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QualityCoachPanel;
