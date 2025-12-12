// desktop/src/components/cleanup/CleanupRunning.tsx
// Phase 129.3: Cleanup Session Running View

import React from 'react';
import type { CleanupSession, CleanupStep } from '../../lib/cleanup/cleanupTypes';
import './CleanupRunning.css';

interface Props {
  locale?: 'ar' | 'en';
  session: CleanupSession;
  progress: number;
  onCancel?: () => void;
}

const STEP_ICONS: Record<CleanupStep['type'], string> = {
  scan: '🔍',
  fix_safe: '🛡️',
  fix_types: '📝',
  ace_phase: '🚀',
  recompute: '📊',
};

const STATUS_ICONS: Record<CleanupStep['status'], string> = {
  pending: '⏳',
  running: '⚡',
  completed: '✅',
  skipped: '⏭️',
  failed: '❌',
};

export const CleanupRunning: React.FC<Props> = ({
  locale = 'en',
  session,
  progress,
  onCancel,
}) => {
  const isRTL = locale === 'ar';
  const currentStep = session.steps[session.currentStepIndex];

  return (
    <div className={`cleanup-running ${isRTL ? 'rtl' : ''}`}>
      {/* Header */}
      <div className="running-header">
        <div className="running-icon">🧹</div>
        <h2>
          {isRTL ? 'جلسة التنظيف جارية...' : 'Cleanup Session Running...'}
        </h2>
      </div>

      {/* Current step */}
      <div className="current-step">
        <span className="step-icon">{STEP_ICONS[currentStep?.type || 'scan']}</span>
        <span className="step-label">
          {isRTL ? currentStep?.labelAr : currentStep?.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-container">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="progress-text">{progress}%</span>
      </div>

      {/* Steps list */}
      <div className="steps-list">
        {session.steps.map((step, idx) => (
          <div
            key={step.id}
            className={`step-item ${step.status}`}
          >
            <span className="step-status">{STATUS_ICONS[step.status]}</span>
            <span className="step-name">
              {isRTL ? step.labelAr : step.label}
            </span>
            {step.result?.itemsFixed !== undefined && step.result.itemsFixed > 0 && (
              <span className="step-result">
                +{step.result.itemsFixed} {isRTL ? 'إصلاح' : 'fixes'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Cancel button */}
      {onCancel && (
        <div className="running-actions">
          <button className="btn-cancel" onClick={onCancel}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      )}
    </div>
  );
};
