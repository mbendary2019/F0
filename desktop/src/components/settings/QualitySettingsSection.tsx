// desktop/src/components/settings/QualitySettingsSection.tsx
// Phase 135.1: Quality Settings UI Section
// Phase 135.1.1: Polished with animations, glow, saved indicator, and deploy preview link
// Phase 135.2: Added CSS animations, tooltips, gradient button, explanatory footer

import React, { useState, useCallback } from 'react';
import {
  useQualityPolicy,
  useQualityThresholds,
} from '../../state/qualityPolicyContext';
import {
  PROFILE_META,
  type QualityPolicyThresholds,
  type QualityProfileId,
} from '../../state/qualityPolicyTypes';

interface QualitySettingsSectionProps {
  locale?: 'en' | 'ar';
  /** Callback to open the Deploy Gate preview modal */
  onOpenDeployPreview?: () => void;
}

/** Phase 135.2: Inline tooltip component */
const InfoTooltip: React.FC<{
  text: string;
  textAr?: string;
  isAr?: boolean;
}> = ({ text, textAr, isAr }) => {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="ml-1 w-4 h-4 rounded-full bg-violet-500/20 border border-violet-400/40 text-[9px] text-violet-300 hover:bg-violet-500/30 hover:border-violet-400/60 transition-all flex items-center justify-center"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => {
          e.preventDefault();
          setShow(!show);
        }}
      >
        ?
      </button>
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 border border-violet-500/40 rounded-lg text-[10px] text-violet-100 whitespace-nowrap shadow-lg shadow-violet-500/20 animate-in fade-in duration-150">
          {isAr && textAr ? textAr : text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
};

/** Threshold tooltip definitions */
const THRESHOLD_TOOLTIPS: Record<keyof QualityPolicyThresholds, { en: string; ar: string }> = {
  minHealthForCaution: {
    en: 'Below this score = warning (risky deploy)',
    ar: 'أقل من هذه النتيجة = تحذير (نشر محفوف بالمخاطر)',
  },
  minHealthForOk: {
    en: 'Below this score = caution. Above = OK to deploy',
    ar: 'أقل من هذه النتيجة = تحذير. أعلى = موافقة للنشر',
  },
  maxIssuesForOk: {
    en: 'More issues than this = risky deploy warning',
    ar: 'أكثر من هذا العدد من المشاكل = تحذير نشر محفوف بالمخاطر',
  },
  staleScanHours: {
    en: 'Scans older than this trigger a warning',
    ar: 'الفحوصات الأقدم من هذا تُظهر تحذير',
  },
  treatSecurityAlertsAsBlock: {
    en: 'If ON, security alerts will block deployment',
    ar: 'إذا مفعّل، التنبيهات الأمنية ستمنع النشر',
  },
  requireRecentTests: {
    en: 'If ON, deployment requires recent test runs',
    ar: 'إذا مفعّل، النشر يتطلب تشغيل اختبارات حديثة',
  },
};

/**
 * Quality Settings Section for Settings Modal
 * Allows users to select quality profiles and customize thresholds
 */
export const QualitySettingsSection: React.FC<QualitySettingsSectionProps> = ({
  locale = 'en',
  onOpenDeployPreview,
}) => {
  const { state, setProfile, updateThresholds, resetToDefaults } = useQualityPolicy();
  const thresholds = useQualityThresholds();

  const isAr = locale === 'ar';

  // "Saved ✓" indicator state
  const [justSaved, setJustSaved] = useState(false);

  const markSaved = useCallback(() => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }, []);

  // Handlers that trigger save indicator
  const handleProfileClick = useCallback((id: QualityProfileId) => {
    setProfile(id);
    markSaved();
  }, [setProfile, markSaved]);

  const handleThresholdChange = useCallback((
    key: keyof QualityPolicyThresholds,
    value: number | boolean
  ) => {
    updateThresholds({ [key]: value });
    markSaved();
  }, [updateThresholds, markSaved]);

  const handleReset = useCallback(() => {
    resetToDefaults();
    markSaved();
  }, [resetToDefaults, markSaved]);

  // Profile color classes for glow effects
  const getProfileGlow = (id: QualityProfileId, isSelected: boolean) => {
    if (!isSelected) return '';
    switch (id) {
      case 'strict':
        return 'shadow-[0_0_18px_rgba(239,68,68,0.55)] scale-[1.02]';
      case 'balanced':
        return 'shadow-[0_0_18px_rgba(251,191,36,0.55)] scale-[1.02]';
      case 'relaxed':
        return 'shadow-[0_0_18px_rgba(52,211,153,0.55)] scale-[1.02]';
      case 'custom':
        return 'shadow-[0_0_18px_rgba(167,139,250,0.55)] scale-[1.02]';
    }
  };

  // Phase 135.2: Enhanced hover animations
  const getProfileColors = (id: QualityProfileId, isSelected: boolean) => {
    if (!isSelected) {
      return 'border-slate-700/70 bg-slate-950/40 text-slate-200 hover:border-fuchsia-400/40 hover:bg-slate-900/70 hover:-translate-y-0.5 hover:shadow-lg';
    }
    switch (id) {
      case 'strict':
        return 'border-red-400/70 bg-red-500/15 text-red-100';
      case 'balanced':
        return 'border-amber-400/70 bg-amber-500/15 text-amber-100';
      case 'relaxed':
        return 'border-emerald-400/70 bg-emerald-500/15 text-emerald-100';
      case 'custom':
        return 'border-violet-400/70 bg-violet-500/15 text-violet-100';
    }
  };

  const getGradientOverlay = (id: QualityProfileId) => {
    switch (id) {
      case 'strict':
        return 'bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.25),_transparent_55%)]';
      case 'balanced':
        return 'bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25),_transparent_55%)]';
      case 'relaxed':
        return 'bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.25),_transparent_55%)]';
      case 'custom':
        return 'bg-[radial-gradient(circle_at_top,_rgba(167,139,250,0.25),_transparent_55%)]';
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <span>🛡️</span>
          {isAr ? 'ملفات تعريف الجودة' : 'Quality Profiles'}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] text-slate-400 leading-relaxed max-w-[85%]">
            {isAr
              ? 'تحكّم في مدى صرامة فحوصات الجودة قبل النشر. Strict يناسب الإنتاج، Balanced لمعظم المشاريع، Relaxed للتجارب.'
              : 'Control how strict quality checks are before deploying. Strict for production, Balanced for most projects, Relaxed for experiments.'}
          </p>
          {/* Saved indicator */}
          {justSaved && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200 shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse">
              <span>✓</span>
              <span>{isAr ? 'تم الحفظ' : 'Saved'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Profile Selector with Glow + CSS Animations */}
      <div className="grid grid-cols-2 gap-2">
        {PROFILE_META.map((profile) => {
          const isSelected = state.profile === profile.id;

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleProfileClick(profile.id)}
              className={[
                'relative p-3 rounded-lg border text-left overflow-hidden',
                'transition-all duration-200 ease-out transform-gpu',
                getProfileColors(profile.id, isSelected),
                getProfileGlow(profile.id, isSelected),
              ].join(' ')}
            >
              {/* Radial glow overlay for active profile */}
              {isSelected && (
                <span className={`pointer-events-none absolute inset-0 ${getGradientOverlay(profile.id)} opacity-80`} />
              )}

              <div className="relative flex items-center gap-2 mb-1">
                <span className="transition-transform duration-200 group-hover:scale-110">{profile.icon}</span>
                <span className="font-medium text-sm">
                  {isAr ? profile.label.ar : profile.label.en}
                </span>
                {isSelected && (
                  <span className="text-[9px] opacity-70 uppercase tracking-wider animate-pulse">
                    {isAr ? 'نشط' : 'Active'}
                  </span>
                )}
              </div>
              <p className="relative text-[11px] opacity-70 line-clamp-2">
                {isAr ? profile.description.ar : profile.description.en}
              </p>
            </button>
          );
        })}
      </div>

      {/* Custom Thresholds (shown when custom profile) */}
      {state.profile === 'custom' && (
        <div className="mt-4 p-4 bg-gradient-to-br from-violet-950/30 to-slate-950/50 rounded-xl border border-violet-500/30 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-violet-100">
              {isAr ? 'إعدادات مخصصة' : 'Custom Settings'}
            </h4>
            <button
              onClick={handleReset}
              className="text-[10px] text-violet-300/70 hover:text-violet-200 underline transition-colors"
            >
              {isAr ? 'إعادة للافتراضي' : 'Reset to Default'}
            </button>
          </div>

          {/* Number inputs with tooltips */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center text-[10px] text-violet-200/60 mb-1 uppercase tracking-wider">
                {isAr ? 'الحد للتحذير' : 'Min Health (Caution)'}
                <InfoTooltip
                  text={THRESHOLD_TOOLTIPS.minHealthForCaution.en}
                  textAr={THRESHOLD_TOOLTIPS.minHealthForCaution.ar}
                  isAr={isAr}
                />
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={thresholds.minHealthForCaution}
                onChange={(e) =>
                  handleThresholdChange('minHealthForCaution', Number(e.target.value))
                }
                className="w-full px-2 py-1.5 bg-slate-900/80 border border-violet-500/30 rounded-lg text-sm text-violet-100 focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/30 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center text-[10px] text-violet-200/60 mb-1 uppercase tracking-wider">
                {isAr ? 'الحد للموافقة' : 'Min Health (OK)'}
                <InfoTooltip
                  text={THRESHOLD_TOOLTIPS.minHealthForOk.en}
                  textAr={THRESHOLD_TOOLTIPS.minHealthForOk.ar}
                  isAr={isAr}
                />
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={thresholds.minHealthForOk}
                onChange={(e) =>
                  handleThresholdChange('minHealthForOk', Number(e.target.value))
                }
                className="w-full px-2 py-1.5 bg-slate-900/80 border border-violet-500/30 rounded-lg text-sm text-violet-100 focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/30 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center text-[10px] text-violet-200/60 mb-1 uppercase tracking-wider">
                {isAr ? 'الحد الأقصى للمشاكل' : 'Max Issues'}
                <InfoTooltip
                  text={THRESHOLD_TOOLTIPS.maxIssuesForOk.en}
                  textAr={THRESHOLD_TOOLTIPS.maxIssuesForOk.ar}
                  isAr={isAr}
                />
              </label>
              <input
                type="number"
                min={0}
                value={thresholds.maxIssuesForOk}
                onChange={(e) =>
                  handleThresholdChange('maxIssuesForOk', Number(e.target.value))
                }
                className="w-full px-2 py-1.5 bg-slate-900/80 border border-violet-500/30 rounded-lg text-sm text-violet-100 focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/30 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center text-[10px] text-violet-200/60 mb-1 uppercase tracking-wider">
                {isAr ? 'ساعات الفحص القديم' : 'Stale Scan (hrs)'}
                <InfoTooltip
                  text={THRESHOLD_TOOLTIPS.staleScanHours.en}
                  textAr={THRESHOLD_TOOLTIPS.staleScanHours.ar}
                  isAr={isAr}
                />
              </label>
              <input
                type="number"
                min={1}
                value={thresholds.staleScanHours}
                onChange={(e) =>
                  handleThresholdChange('staleScanHours', Number(e.target.value))
                }
                className="w-full px-2 py-1.5 bg-slate-900/80 border border-violet-500/30 rounded-lg text-sm text-violet-100 focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/30 transition-all"
              />
            </div>
          </div>

          {/* Boolean toggles with tooltips */}
          <div className="space-y-2 pt-2 border-t border-violet-500/20">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={thresholds.treatSecurityAlertsAsBlock}
                onChange={(e) =>
                  handleThresholdChange('treatSecurityAlertsAsBlock', e.target.checked)
                }
                className="rounded border-violet-500/50 bg-slate-900 text-violet-500 focus:ring-violet-500/30"
              />
              <span className="text-[11px] text-violet-100/80 group-hover:text-violet-100 transition-colors">
                {isAr ? 'حظر النشر عند وجود تنبيهات أمنية' : 'Block deploy on security alerts'}
              </span>
              <InfoTooltip
                text={THRESHOLD_TOOLTIPS.treatSecurityAlertsAsBlock.en}
                textAr={THRESHOLD_TOOLTIPS.treatSecurityAlertsAsBlock.ar}
                isAr={isAr}
              />
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={thresholds.requireRecentTests}
                onChange={(e) =>
                  handleThresholdChange('requireRecentTests', e.target.checked)
                }
                className="rounded border-violet-500/50 bg-slate-900 text-violet-500 focus:ring-violet-500/30"
              />
              <span className="text-[11px] text-violet-100/80 group-hover:text-violet-100 transition-colors">
                {isAr ? 'يتطلب تشغيل اختبارات حديثة' : 'Require recent test runs'}
              </span>
              <InfoTooltip
                text={THRESHOLD_TOOLTIPS.requireRecentTests.en}
                textAr={THRESHOLD_TOOLTIPS.requireRecentTests.ar}
                isAr={isAr}
              />
            </label>
          </div>
        </div>
      )}

      {/* Current Thresholds Preview (for non-custom profiles) */}
      {state.profile !== 'custom' && (
        <div className="mt-2 p-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">
            {isAr ? 'الحدود الحالية' : 'Current Thresholds'}
          </p>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="text-slate-300">
              <span className="text-slate-500">{isAr ? 'صحة' : 'Health'}:</span>{' '}
              <span className="font-medium">{thresholds.minHealthForOk}%</span>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-500">{isAr ? 'مشاكل' : 'Issues'}:</span>{' '}
              <span className="font-medium">{thresholds.maxIssuesForOk}</span>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-500">{isAr ? 'فحص' : 'Scan'}:</span>{' '}
              <span className="font-medium">{thresholds.staleScanHours}h</span>
            </div>
          </div>
        </div>
      )}

      {/* Phase 135.2: Enhanced Footer with explanatory text + gradient button */}
      <div className="pt-3 border-t border-slate-800/70 space-y-3">
        {/* Explanatory text */}
        <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/40">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            {isAr ? (
              <>
                <span className="text-slate-300 font-medium">💡 كيف يعمل:</span>{' '}
                هذه الإعدادات تحدد قواعد بوابة النشر (Deploy Gate) ومراقب الجودة (Quality Watchdog).
                عند النشر، سيتم فحص صحة المشروع والاختبارات والتنبيهات الأمنية بناءً على هذه الحدود.
              </>
            ) : (
              <>
                <span className="text-slate-300 font-medium">💡 How it works:</span>{' '}
                These settings define rules for Deploy Gate and Quality Watchdog.
                When deploying, project health, tests, and security alerts are checked against these thresholds.
              </>
            )}
          </p>
        </div>

        {/* Auto-save note */}
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {isAr
            ? '✓ أي تعديل يتم حفظه تلقائيًا على هذا الجهاز.'
            : '✓ Changes are auto-saved locally to this device.'}
        </p>

        {/* Phase 135.2: Gradient Deploy preview button */}
        {onOpenDeployPreview && (
          <button
            type="button"
            onClick={onOpenDeployPreview}
            className="group relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-medium text-white overflow-hidden transition-all duration-300 hover:shadow-[0_0_24px_rgba(249,115,22,0.5)] hover:scale-[1.02]"
          >
            {/* Gradient background */}
            <span className="absolute inset-0 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 opacity-90" />
            {/* Animated shine effect */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {/* Content */}
            <span className="relative">🚀</span>
            <span className="relative">
              {isAr ? 'معاينة بوابة النشر بهذا البروفايل' : 'Preview Deploy Gate with this profile'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default QualitySettingsSection;
