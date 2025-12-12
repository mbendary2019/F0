// desktop/src/components/cleanup/CleanupSummary.tsx
// Phase 129.3: Cleanup Session Summary View

import React from 'react';
import type { CleanupSession } from '../../lib/cleanup/cleanupTypes';
import './CleanupSummary.css';

interface Props {
  locale?: 'ar' | 'en';
  session: CleanupSession;
  onClose?: () => void;
  onViewIssues?: () => void;
  onStartNew?: () => void;
}

export const CleanupSummary: React.FC<Props> = ({
  locale = 'en',
  session,
  onClose,
  onViewIssues,
  onStartNew,
}) => {
  const isRTL = locale === 'ar';
  const { summary, healthBefore, healthAfter } = session;

  // Calculate improvement
  const healthImprovement = (healthAfter?.score || 0) - (healthBefore?.score || 0);
  const issuesReduced = (healthBefore?.totalIssues || 0) - (healthAfter?.totalIssues || 0);

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return isRTL ? `${seconds} ثانية` : `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return isRTL
      ? `${minutes} دقيقة ${remainingSeconds} ثانية`
      : `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className={`cleanup-summary ${isRTL ? 'rtl' : ''}`}>
      {/* Header */}
      <div className="summary-header">
        <div className="summary-icon">
          {healthImprovement > 0 ? '🎉' : '✅'}
        </div>
        <h2>
          {isRTL ? 'اكتملت جلسة التنظيف!' : 'Cleanup Session Complete!'}
        </h2>
      </div>

      {/* Health comparison */}
      <div className="health-comparison">
        <div className="health-before">
          <span className="health-label">{isRTL ? 'قبل' : 'Before'}</span>
          <span className="health-score">{healthBefore?.score || 0}%</span>
        </div>
        <div className="health-arrow">
          {healthImprovement > 0 ? '→' : '→'}
        </div>
        <div className={`health-after ${healthImprovement > 0 ? 'improved' : ''}`}>
          <span className="health-label">{isRTL ? 'بعد' : 'After'}</span>
          <span className="health-score">{healthAfter?.score || 0}%</span>
        </div>
        {healthImprovement > 0 && (
          <div className="health-improvement">
            +{healthImprovement}%
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{summary?.filesScanned || 0}</span>
          <span className="stat-label">{isRTL ? 'ملفات فُحصت' : 'Files Scanned'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{summary?.issuesFixed || 0}</span>
          <span className="stat-label">{isRTL ? 'مشاكل أُصلحت' : 'Issues Fixed'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{summary?.issuesRemaining || 0}</span>
          <span className="stat-label">{isRTL ? 'مشاكل متبقية' : 'Issues Remaining'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{formatDuration(summary?.durationMs || 0)}</span>
          <span className="stat-label">{isRTL ? 'الوقت' : 'Duration'}</span>
        </div>
      </div>

      {/* Issues breakdown if remaining */}
      {(healthAfter?.totalIssues || 0) > 0 && (
        <div className="issues-breakdown">
          <h4>{isRTL ? 'المشاكل المتبقية:' : 'Remaining Issues:'}</h4>
          <div className="breakdown-items">
            {(healthAfter?.bySeverity.error || 0) > 0 && (
              <span className="breakdown-item error">
                {healthAfter?.bySeverity.error} {isRTL ? 'خطأ' : 'errors'}
              </span>
            )}
            {(healthAfter?.bySeverity.warning || 0) > 0 && (
              <span className="breakdown-item warning">
                {healthAfter?.bySeverity.warning} {isRTL ? 'تحذير' : 'warnings'}
              </span>
            )}
            {(healthAfter?.bySeverity.info || 0) > 0 && (
              <span className="breakdown-item info">
                {healthAfter?.bySeverity.info} {isRTL ? 'معلومات' : 'info'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ACE phases run */}
      {(summary?.acePhasesRun?.length || 0) > 0 && (
        <div className="ace-phases">
          <span className="phases-label">
            {isRTL ? 'مراحل ACE المنفّذة:' : 'ACE Phases Run:'}
          </span>
          <span className="phases-list">
            {summary?.acePhasesRun.join(', ')}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="summary-actions">
        {(healthAfter?.totalIssues || 0) > 0 && onViewIssues && (
          <button className="btn-secondary" onClick={onViewIssues}>
            {isRTL ? 'عرض المشاكل المتبقية' : 'View Remaining Issues'}
          </button>
        )}
        {onStartNew && (
          <button className="btn-secondary" onClick={onStartNew}>
            {isRTL ? 'جلسة جديدة' : 'New Session'}
          </button>
        )}
        {onClose && (
          <button className="btn-primary" onClick={onClose}>
            {isRTL ? 'إغلاق' : 'Close'}
          </button>
        )}
      </div>
    </div>
  );
};
