// desktop/src/components/quality/QualityCoachPanelFull.tsx
// Phase 135.5: Full Quality Coach Panel - Complete Intelligence Layer
// Phase 145.P.2: Auto-Improve Pipeline UI with GitHub Actions-style step visualization
// Features:
// - Project Quality at a Glance (health, issues, trend)
// - AI Diagnosis (root cause analysis)
// - Recommended Fixes (prioritized)
// - Auto-Improve Pipeline (one-click optimization with step visualization)

import React, { useState, useMemo } from 'react';
import type { QualityCoachSuggestion } from '../../lib/quality/qualityCoach';
import type { QualityActionType } from '../../lib/quality/policyActions';
import mascotImg from '../../../public/mascots/f0-mascot-login.png';

type Locale = 'en' | 'ar';
type HealthTrend = 'improving' | 'declining' | 'stable' | 'unknown';

// ============================================
// Phase 145.P.2: Auto-Improve Pipeline Steps
// GitHub Actions-style step visualization
// ============================================

const AUTO_IMPROVE_STEPS = [
  {
    id: 'AUTO_FIX_ISSUES',
    icon: '🔧',
    labelEn: 'Auto-fix top issues',
    labelAr: 'إصلاح المشاكل الرئيسية',
    descEn: 'ACE runs safe fixes on lint errors, type issues, and common bugs.',
    descAr: 'يقوم ACE بإصلاحات آمنة لأخطاء الـ lint والأنواع والأخطاء الشائعة.',
  },
  {
    id: 'GENERATE_TESTS',
    icon: '🧪',
    labelEn: 'Generate tests',
    labelAr: 'توليد الاختبارات',
    descEn: 'Creates unit tests for uncovered code paths.',
    descAr: 'إنشاء اختبارات وحدة للمسارات غير المغطاة.',
  },
  {
    id: 'SECURITY_SCAN',
    icon: '🛡️',
    labelEn: 'Security check',
    labelAr: 'فحص الأمان',
    descEn: 'Scans for vulnerabilities and applies security patches.',
    descAr: 'يفحص الثغرات الأمنية ويطبق التصحيحات.',
  },
  {
    id: 'QUALITY_SNAPSHOT',
    icon: '📋',
    labelEn: 'Quality snapshot',
    labelAr: 'لقطة الجودة',
    descEn: 'Records final quality metrics after improvements.',
    descAr: 'يسجل مقاييس الجودة النهائية بعد التحسينات.',
  },
] as const;

export type PipelineStepId = typeof AUTO_IMPROVE_STEPS[number]['id'];

export interface PipelineProgressState {
  currentStepId: PipelineStepId | null;
  completedSteps: PipelineStepId[];
  isRunning: boolean;
}

interface QualityCoachPanelFullProps {
  locale: Locale;
  suggestions: QualityCoachSuggestion[];
  healthTrend: HealthTrend;
  latestHealth: number;
  latestIssues: number;
  testsStatus: 'passing' | 'failing' | 'not_run';
  securityAlerts: number;
  snapshotsCount: number;
  onRunAction?: (action: QualityActionType) => void;
  onRunPipeline?: () => Promise<void>;
  /** Phase 145.P.2: Pipeline progress state for step visualization */
  pipelineProgress?: PipelineProgressState;
}

/**
 * Get trend icon and styling
 */
function getTrendDisplay(trend: HealthTrend, locale: Locale) {
  const labels = {
    improving: locale === 'ar' ? 'يتحسن ↑' : 'Improving ↑',
    declining: locale === 'ar' ? 'ينخفض ↓' : 'Declining ↓',
    stable: locale === 'ar' ? 'مستقر →' : 'Stable →',
    unknown: locale === 'ar' ? 'غير معروف' : 'Unknown',
  };

  const colors = {
    improving: 'text-emerald-400',
    declining: 'text-red-400',
    stable: 'text-slate-300',
    unknown: 'text-slate-500',
  };

  return {
    label: labels[trend],
    color: colors[trend],
  };
}

/**
 * Get severity icon
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
 * Get severity badge classes
 */
function severityBadgeClasses(severity: QualityCoachSuggestion['severity']): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'warning':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'info':
    default:
      return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  }
}

/**
 * Full Quality Coach Panel
 * Complete intelligence layer with diagnostics and auto-improve pipeline
 */
export const QualityCoachPanelFull: React.FC<QualityCoachPanelFullProps> = ({
  locale,
  suggestions,
  healthTrend,
  latestHealth,
  latestIssues,
  testsStatus,
  securityAlerts,
  snapshotsCount,
  onRunAction,
  onRunPipeline,
  pipelineProgress,
}) => {
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [runningAction, setRunningAction] = useState<QualityActionType | null>(null);

  // Phase 145.P.2: Compute step status for each pipeline step
  const getStepStatus = useMemo(() => {
    return (stepId: PipelineStepId): 'pending' | 'running' | 'completed' => {
      if (!pipelineProgress) return 'pending';
      if (pipelineProgress.completedSteps.includes(stepId)) return 'completed';
      if (pipelineProgress.currentStepId === stepId && pipelineProgress.isRunning) return 'running';
      return 'pending';
    };
  }, [pipelineProgress]);

  const isRtl = locale === 'ar';
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  const trendDisplay = getTrendDisplay(healthTrend, locale);

  // Determine health color
  const healthColor =
    latestHealth >= 70
      ? 'text-emerald-400'
      : latestHealth >= 50
      ? 'text-amber-400'
      : 'text-red-400';

  // Determine tests color
  const testsColor =
    testsStatus === 'passing'
      ? 'text-emerald-400'
      : testsStatus === 'failing'
      ? 'text-red-400'
      : 'text-slate-400';

  const testsLabel =
    testsStatus === 'passing'
      ? t('Passing', 'ناجحة')
      : testsStatus === 'failing'
      ? t('Failing', 'فاشلة')
      : t('Not Run', 'لم تُشغّل');

  // Handle running a single action
  const handleRunAction = async (actionType: QualityActionType) => {
    if (!onRunAction) return;
    setRunningAction(actionType);
    try {
      onRunAction(actionType);
    } finally {
      setRunningAction(null);
    }
  };

  // Handle running the full pipeline
  const handleRunPipeline = async () => {
    if (!onRunPipeline) return;
    setIsPipelineRunning(true);
    try {
      await onRunPipeline();
    } finally {
      setIsPipelineRunning(false);
    }
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="rounded-2xl border border-slate-800/90 bg-slate-950/95 p-5 shadow-[0_0_40px_rgba(0,0,0,0.7)] space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">
            {t('Quality Coach', 'مدرب الجودة')}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {t(
              'AI-powered analysis and recommendations',
              'تحليل وتوصيات مدعومة بالذكاء الاصطناعي'
            )}
          </p>
        </div>
        <img
          src={mascotImg}
          alt="Quality Coach"
          className="h-10 w-10 rounded-full object-cover shadow-[0_0_12px_rgba(124,58,237,0.4)]"
        />
      </div>

      {/* Section 1: Quick Stats */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            {t('Health', 'الصحة')}
          </p>
          <p className={`text-xl font-bold ${healthColor}`}>{latestHealth}%</p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            {t('Issues', 'المشاكل')}
          </p>
          <p className="text-xl font-bold text-white">{latestIssues}</p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            {t('Tests', 'الاختبارات')}
          </p>
          <p className={`text-sm font-bold ${testsColor}`}>{testsLabel}</p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            {t('Trend', 'الاتجاه')}
          </p>
          <p className={`text-sm font-bold ${trendDisplay.color}`}>
            {trendDisplay.label}
          </p>
        </div>
      </div>

      {/* Security Alert Badge (if any) */}
      {securityAlerts > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2">
          <span className="text-lg">🛡️</span>
          <span className="text-xs font-medium text-red-300">
            {t(
              `${securityAlerts} security alert${securityAlerts > 1 ? 's' : ''} detected`,
              `تم اكتشاف ${securityAlerts} تنبيه أمني`
            )}
          </span>
        </div>
      )}

      {/* Section 2: AI Diagnosis / Suggestions */}
      {suggestions.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            {t('Diagnosis & Recommendations', 'التشخيص والتوصيات')}
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
            {suggestions.map((sugg) => (
              <div
                key={sugg.id}
                className="rounded-xl bg-slate-900/80 border border-slate-800/80 p-3 transition-colors hover:bg-slate-900"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{severityIcon(sugg.severity)}</span>
                    <span className="text-sm font-semibold text-white">
                      {locale === 'ar' ? sugg.titleAr : sugg.title}
                    </span>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${severityBadgeClasses(
                      sugg.severity
                    )}`}
                  >
                    {sugg.severity === 'critical'
                      ? t('Critical', 'حرج')
                      : sugg.severity === 'warning'
                      ? t('Warning', 'تحذير')
                      : t('Info', 'معلومة')}
                  </span>
                </div>

                {/* Message */}
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {locale === 'ar' ? sugg.messageAr : sugg.message}
                </p>

                {/* Action button */}
                {sugg.recommendedActionType && onRunAction && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRunAction(sugg.recommendedActionType!)}
                      disabled={runningAction === sugg.recommendedActionType}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-600 to-sky-500 px-3 py-1.5 text-[10px] font-medium text-white shadow-sm transition hover:from-sky-500 hover:to-sky-400 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>🚀</span>
                      <span>
                        {runningAction === sugg.recommendedActionType
                          ? t('Running...', 'جاري التنفيذ...')
                          : t('Run action', 'تنفيذ')}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-center">
          <p className="text-xs text-emerald-300">
            {t(
              '✅ No issues detected. Keep up the great work!',
              '✅ لا توجد مشاكل مكتشفة. استمر في العمل الرائع!'
            )}
          </p>
        </div>
      )}

      {/* Section 3: Auto-Improve Pipeline with Step Visualization */}
      {/* Phase 145.P.2: GitHub Actions-style step display */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-900/30 to-violet-900/20 border border-purple-700/40 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <h3 className="font-semibold text-purple-200">
            {t('Auto-Improve Project', 'تحسين المشروع تلقائيًا')}
          </h3>
        </div>

        <p className="text-[11px] text-purple-300/80 leading-relaxed">
          {t(
            'Run auto-fix, generate tests, and security fixes in a single pipeline. The AI will analyze and improve your project automatically.',
            'شغّل الإصلاح التلقائي وتوليد الاختبارات وإصلاحات الأمان في خط أنابيب واحد. سيقوم الذكاء الاصطناعي بتحليل وتحسين مشروعك تلقائيًا.'
          )}
        </p>

        {/* Phase 145.P.2: Pipeline Steps Visualization */}
        <div className="space-y-2">
          {AUTO_IMPROVE_STEPS.map((step, idx) => {
            const status = getStepStatus(step.id);
            const isLast = idx === AUTO_IMPROVE_STEPS.length - 1;

            // Status indicator: ● running, ✔ completed, ○ pending
            const statusIcon =
              status === 'running' ? (
                <span className="animate-pulse text-purple-400">●</span>
              ) : status === 'completed' ? (
                <span className="text-emerald-400">✔</span>
              ) : (
                <span className="text-slate-500">○</span>
              );

            // Step label color
            const labelColor =
              status === 'running'
                ? 'text-purple-200'
                : status === 'completed'
                ? 'text-emerald-300'
                : 'text-slate-400';

            return (
              <div
                key={step.id}
                className={`relative flex items-start gap-3 animate-fadeInUp ${
                  !isLast ? 'pb-2' : ''
                }`}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                {/* Vertical connector line */}
                {!isLast && (
                  <div
                    className={`absolute top-5 w-px h-[calc(100%-12px)] ${
                      status === 'completed' ? 'bg-emerald-500/40' : 'bg-slate-700/60'
                    }`}
                    style={{ left: isRtl ? 'auto' : '7px', right: isRtl ? '7px' : 'auto' }}
                  />
                )}

                {/* Status icon */}
                <div className="w-4 h-4 flex items-center justify-center text-sm shrink-0 mt-0.5 z-10">
                  {statusIcon}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{step.icon}</span>
                    <span className={`text-xs font-medium ${labelColor}`}>
                      {locale === 'ar' ? step.labelAr : step.labelEn}
                    </span>
                    {status === 'running' && (
                      <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full">
                        {t('Running', 'جاري')}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    {locale === 'ar' ? step.descAr : step.descEn}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleRunPipeline}
          disabled={isPipelineRunning || !onRunPipeline || pipelineProgress?.isRunning}
          className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:from-purple-500 hover:to-violet-400 hover:shadow-purple-500/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-purple-500/25"
        >
          {isPipelineRunning || pipelineProgress?.isRunning ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>{t('Optimizing...', 'جاري التحسين...')}</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>{t('Optimize project now', 'تحسين المشروع الآن')}</span>
            </>
          )}
        </button>
      </div>

      {/* Footer: Snapshots info */}
      {snapshotsCount > 0 && (
        <div className="text-center text-[10px] text-slate-500">
          {t(
            `Based on ${snapshotsCount} quality snapshot${snapshotsCount > 1 ? 's' : ''}`,
            `بناءً على ${snapshotsCount} لقطة جودة`
          )}
        </div>
      )}
    </div>
  );
};

export default QualityCoachPanelFull;
