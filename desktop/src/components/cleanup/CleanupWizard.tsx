// desktop/src/components/cleanup/CleanupWizard.tsx
// Phase 129.1: Guided Cleanup Session Wizard

import React, { useState, useMemo } from 'react';
import type {
  CleanupScope,
  CleanupIntensity,
  CleanupSession,
} from '../../lib/cleanup/cleanupTypes';
import {
  createCleanupSession,
  estimateSessionDuration,
  getDefaultSteps,
} from '../../lib/cleanup/cleanupTypes';
import './CleanupWizard.css';

interface Props {
  locale?: 'ar' | 'en';
  projectRoot: string;
  fileCount: number;
  currentHealthScore?: number;
  onStart: (session: CleanupSession) => void;
  onCancel: () => void;
}

type WizardStep = 'scope' | 'intensity' | 'confirm';

const SCOPE_OPTIONS: Array<{
  value: CleanupScope;
  label: string;
  labelAr: string;
  desc: string;
  descAr: string;
  icon: string;
}> = [
  {
    value: 'whole_project',
    label: 'Whole Project',
    labelAr: 'المشروع كامل',
    desc: 'Scan and fix all files in the project',
    descAr: 'فحص وإصلاح جميع الملفات',
    icon: '📁',
  },
  {
    value: 'src_only',
    label: 'Source Only (src/)',
    labelAr: 'المصدر فقط (src/)',
    desc: 'Focus on src/ directory only',
    descAr: 'التركيز على مجلد src/ فقط',
    icon: '📂',
  },
  {
    value: 'functions_only',
    label: 'Functions Only',
    labelAr: 'الدوال فقط (functions/)',
    desc: 'Focus on functions/ directory only',
    descAr: 'التركيز على مجلد functions/ فقط',
    icon: '⚡',
  },
];

const INTENSITY_OPTIONS: Array<{
  value: CleanupIntensity;
  label: string;
  labelAr: string;
  desc: string;
  descAr: string;
  icon: string;
  color: string;
}> = [
  {
    value: 'safe',
    label: 'Safe Only',
    labelAr: 'آمن فقط',
    desc: 'Logging, style, and non-breaking fixes',
    descAr: 'إصلاحات آمنة: تسجيل، أسلوب',
    icon: '🛡️',
    color: '#22c55e',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    labelAr: 'متوسط',
    desc: 'Safe + type improvements',
    descAr: 'آمن + تحسينات الأنواع',
    icon: '⚙️',
    color: '#f59e0b',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    labelAr: 'شامل',
    desc: 'All auto-fixable issues + ACE phases',
    descAr: 'جميع الإصلاحات + ACE phases',
    icon: '🚀',
    color: '#ef4444',
  },
];

export const CleanupWizard: React.FC<Props> = ({
  locale = 'en',
  projectRoot,
  fileCount,
  currentHealthScore,
  onStart,
  onCancel,
}) => {
  const isRTL = locale === 'ar';
  const [currentStep, setCurrentStep] = useState<WizardStep>('scope');
  const [selectedScope, setSelectedScope] = useState<CleanupScope>('whole_project');
  const [selectedIntensity, setSelectedIntensity] = useState<CleanupIntensity>('safe');

  // Estimate duration
  const estimate = useMemo(
    () => estimateSessionDuration(fileCount, selectedIntensity),
    [fileCount, selectedIntensity]
  );

  // Preview steps
  const previewSteps = useMemo(
    () => getDefaultSteps(selectedIntensity),
    [selectedIntensity]
  );

  // Handle start
  const handleStart = () => {
    const session = createCleanupSession(projectRoot, selectedScope, selectedIntensity);
    onStart(session);
  };

  // Navigation
  const goNext = () => {
    if (currentStep === 'scope') setCurrentStep('intensity');
    else if (currentStep === 'intensity') setCurrentStep('confirm');
  };

  const goBack = () => {
    if (currentStep === 'intensity') setCurrentStep('scope');
    else if (currentStep === 'confirm') setCurrentStep('intensity');
  };

  return (
    <div className={`cleanup-wizard ${isRTL ? 'rtl' : ''}`}>
      {/* Header */}
      <div className="wizard-header">
        <h2>
          {isRTL ? '🧹 جلسة تنظيف تلقائية' : '🧹 Guided Cleanup Session'}
        </h2>
        <p className="wizard-subtitle">
          {isRTL
            ? 'اختر نطاق وشدة التنظيف'
            : 'Choose scope and intensity for your cleanup session'}
        </p>
      </div>

      {/* Progress indicator */}
      <div className="wizard-progress">
        <div className={`progress-step ${currentStep === 'scope' ? 'active' : currentStep !== 'scope' ? 'completed' : ''}`}>
          <span className="step-number">1</span>
          <span className="step-label">{isRTL ? 'النطاق' : 'Scope'}</span>
        </div>
        <div className="progress-line" />
        <div className={`progress-step ${currentStep === 'intensity' ? 'active' : currentStep === 'confirm' ? 'completed' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-label">{isRTL ? 'الشدة' : 'Intensity'}</span>
        </div>
        <div className="progress-line" />
        <div className={`progress-step ${currentStep === 'confirm' ? 'active' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">{isRTL ? 'تأكيد' : 'Confirm'}</span>
        </div>
      </div>

      {/* Step content */}
      <div className="wizard-content">
        {/* Step 1: Scope */}
        {currentStep === 'scope' && (
          <div className="step-scope">
            <h3>{isRTL ? 'اختر نطاق الفحص' : 'Choose Scan Scope'}</h3>
            <div className="scope-options">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`scope-option ${selectedScope === option.value ? 'selected' : ''}`}
                  onClick={() => setSelectedScope(option.value)}
                >
                  <span className="option-icon">{option.icon}</span>
                  <span className="option-label">
                    {isRTL ? option.labelAr : option.label}
                  </span>
                  <span className="option-desc">
                    {isRTL ? option.descAr : option.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Intensity */}
        {currentStep === 'intensity' && (
          <div className="step-intensity">
            <h3>{isRTL ? 'اختر شدة التنظيف' : 'Choose Cleanup Intensity'}</h3>
            <div className="intensity-options">
              {INTENSITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`intensity-option ${selectedIntensity === option.value ? 'selected' : ''}`}
                  onClick={() => setSelectedIntensity(option.value)}
                  style={{ '--accent-color': option.color } as React.CSSProperties}
                >
                  <span className="option-icon">{option.icon}</span>
                  <span className="option-label">
                    {isRTL ? option.labelAr : option.label}
                  </span>
                  <span className="option-desc">
                    {isRTL ? option.descAr : option.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {currentStep === 'confirm' && (
          <div className="step-confirm">
            <h3>{isRTL ? 'تأكيد الجلسة' : 'Confirm Session'}</h3>

            {/* Summary */}
            <div className="confirm-summary">
              <div className="summary-item">
                <span className="summary-label">{isRTL ? 'النطاق:' : 'Scope:'}</span>
                <span className="summary-value">
                  {SCOPE_OPTIONS.find(o => o.value === selectedScope)?.[isRTL ? 'labelAr' : 'label']}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{isRTL ? 'الشدة:' : 'Intensity:'}</span>
                <span className="summary-value">
                  {INTENSITY_OPTIONS.find(o => o.value === selectedIntensity)?.[isRTL ? 'labelAr' : 'label']}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{isRTL ? 'الملفات:' : 'Files:'}</span>
                <span className="summary-value">{fileCount.toLocaleString()}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{isRTL ? 'الوقت المتوقع:' : 'Est. Time:'}</span>
                <span className="summary-value">
                  {isRTL ? estimate.displayAr : estimate.display}
                </span>
              </div>
              {currentHealthScore !== undefined && (
                <div className="summary-item">
                  <span className="summary-label">{isRTL ? 'الصحة الحالية:' : 'Current Health:'}</span>
                  <span className="summary-value">{currentHealthScore}%</span>
                </div>
              )}
            </div>

            {/* Steps preview */}
            <div className="steps-preview">
              <h4>{isRTL ? 'الخطوات:' : 'Steps:'}</h4>
              <ol className="steps-list">
                {previewSteps.map((step, idx) => (
                  <li key={step.id}>
                    {isRTL ? step.labelAr : step.label}
                  </li>
                ))}
              </ol>
            </div>

            {/* Warning for aggressive */}
            {selectedIntensity === 'aggressive' && (
              <div className="intensity-warning">
                <span className="warning-icon">⚠️</span>
                <span>
                  {isRTL
                    ? 'سيتم إنشاء نسخة احتياطية قبل التعديلات'
                    : 'A snapshot will be created before any changes'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="wizard-footer">
        <button className="btn-secondary" onClick={onCancel}>
          {isRTL ? 'إلغاء' : 'Cancel'}
        </button>

        <div className="footer-actions">
          {currentStep !== 'scope' && (
            <button className="btn-secondary" onClick={goBack}>
              {isRTL ? 'رجوع' : 'Back'}
            </button>
          )}

          {currentStep !== 'confirm' ? (
            <button className="btn-primary" onClick={goNext}>
              {isRTL ? 'التالي' : 'Next'}
            </button>
          ) : (
            <button className="btn-start" onClick={handleStart}>
              {isRTL ? '🚀 بدء الجلسة' : '🚀 Start Session'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
