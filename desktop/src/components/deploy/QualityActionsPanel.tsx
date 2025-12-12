// src/components/deploy/QualityActionsPanel.tsx
// Phase 135.3: Quality Actions Panel - displays suggested fixes based on policy evaluation

import React from 'react';
import type { PolicyEvaluationResult, PolicyStatus } from '../../lib/quality/policyEngine';
import type { QualityAction } from '../../lib/quality/policyActions';
import { getActionIcon } from '../../lib/quality/policyActions';

type Locale = 'en' | 'ar';

interface QualityActionsPanelProps {
  /** Policy evaluation result */
  result: PolicyEvaluationResult;
  /** List of suggested actions */
  actions: QualityAction[];
  /** Current locale */
  locale: Locale;
  /** Callback when user clicks to run an action */
  onRunAction: (action: QualityAction) => void;
  /** Optional: Whether actions are currently running */
  isRunning?: boolean;
}

const statusColorClasses: Record<PolicyStatus, string> = {
  OK: 'border-emerald-500/60 bg-emerald-500/10',
  CAUTION: 'border-amber-500/60 bg-amber-500/10',
  BLOCK: 'border-red-500/60 bg-red-500/10',
};

const statusLabel: Record<PolicyStatus, { en: string; ar: string }> = {
  OK: {
    en: 'Meets current quality policy',
    ar: 'يلبي سياسة الجودة الحالية',
  },
  CAUTION: {
    en: 'Quality risks detected',
    ar: 'تم اكتشاف مخاطر في الجودة',
  },
  BLOCK: {
    en: 'Deployment blocked by quality policy',
    ar: 'تم منع النشر بواسطة سياسة الجودة',
  },
};

const statusIcon: Record<PolicyStatus, string> = {
  OK: '✅',
  CAUTION: '⚠️',
  BLOCK: '⛔️',
};

/**
 * Quality Actions Panel
 * Displays suggested fixes based on policy evaluation results
 */
export const QualityActionsPanel: React.FC<QualityActionsPanelProps> = ({
  result,
  actions,
  locale,
  onRunAction,
  isRunning = false,
}) => {
  const isRtl = locale === 'ar';

  // Empty state when no actions needed
  if (!actions.length) {
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="mt-4 rounded-xl border border-slate-700/70 bg-slate-900/40 px-4 py-3 text-sm text-slate-300"
      >
        {locale === 'ar'
          ? 'لا توجد إصلاحات مقترحة حاليًا — مشروعك قريب من سياسة الجودة المحددة.'
          : 'No suggested fixes right now — your project is close to the configured quality policy.'}
      </div>
    );
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            {locale === 'ar'
              ? 'الإصلاحات المقترحة من نظام الجودة'
              : 'Suggested fixes from Quality Gate'}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {locale === 'ar'
              ? 'اختر إجراءً وسيقوم الوكيل تلقائيًا بالعمل على الملفات المتأثرة.'
              : 'Pick an action and let the Agent automatically work on the affected files.'}
          </p>
        </div>

        {/* Status Badge */}
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
            statusColorClasses[result.status]
          }`}
        >
          <span className="text-base">{statusIcon[result.status]}</span>
          <span className="text-slate-100">
            {locale === 'ar'
              ? statusLabel[result.status].ar
              : statusLabel[result.status].en}
          </span>
        </div>
      </div>

      {/* Actions List */}
      <div className="space-y-3">
        {actions.map((action) => {
          const isManyFiles = action.suggestedFiles.length > 3;
          const sampleFiles = action.suggestedFiles.slice(0, 3);
          const icon = getActionIcon(action.type);

          return (
            <div
              key={action.type}
              className="group rounded-xl border border-slate-800/90 bg-slate-900/60 px-3 py-3 transition hover:border-sky-500/70 hover:bg-slate-900"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex flex-1 items-start gap-2">
                  <span className="mt-0.5 text-lg">{icon}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-50">
                        {locale === 'ar' ? action.labelAr : action.label}
                      </span>
                      {action.suggestedFiles.length > 0 && (
                        <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                          {locale === 'ar'
                            ? `${action.suggestedFiles.length} ملف/ملفات`
                            : `${action.suggestedFiles.length} file(s)`}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {locale === 'ar'
                        ? action.descriptionAr
                        : action.description}
                    </p>
                  </div>
                </div>

                {/* Run Action Button */}
                <button
                  type="button"
                  onClick={() => onRunAction(action)}
                  disabled={isRunning}
                  className={`
                    inline-flex items-center justify-center rounded-full
                    bg-sky-600 px-3 py-1.5 text-xs font-medium text-white
                    shadow-sm transition hover:bg-sky-500 active:scale-[0.97]
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {isRunning ? (
                    <>
                      <span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {locale === 'ar' ? 'جاري التشغيل...' : 'Running...'}
                    </>
                  ) : (
                    locale === 'ar' ? 'تشغيل بالوكيل' : 'Run with Agent'
                  )}
                </button>
              </div>

              {/* Files preview */}
              {action.suggestedFiles.length > 0 && (
                <div className="mt-2 text-[11px] text-slate-500">
                  {locale === 'ar' ? 'ملفات مقترحة:' : 'Suggested files:'}{' '}
                  <span className="font-mono text-slate-300">
                    {sampleFiles.map((f, i) => (
                      <span key={f}>
                        {f.split('/').pop()}
                        {i < sampleFiles.length - 1 && ', '}
                      </span>
                    ))}
                  </span>
                  {isManyFiles && (
                    <span className="text-slate-500">
                      {' '}
                      {locale === 'ar'
                        ? `و +${action.suggestedFiles.length - sampleFiles.length} ملف آخر`
                        : `+${action.suggestedFiles.length - sampleFiles.length} more`}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="mt-3 text-center text-[10px] text-slate-500">
        {locale === 'ar'
          ? '💡 الوكيل سيعمل على الملفات المحددة ويقترح التعديلات للمراجعة'
          : '💡 The Agent will work on the specified files and suggest changes for review'}
      </div>
    </div>
  );
};

export default QualityActionsPanel;
