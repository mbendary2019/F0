// desktop/src/components/panels/CodeHealthDashboard.tsx
// Phase 125.3: Code Health Dashboard UI

import React, { useMemo } from 'react';
import { useCodeHealth } from '../../state/codeHealthContext';
import {
  computeHealthScore,
  computeImprovement,
} from '../../lib/analysis/codeHealthTypes';
import './CodeHealthDashboard.css';

interface Props {
  /** Locale for labels */
  locale?: 'ar' | 'en';
  /** Whether to show the panel */
  visible?: boolean;
  /** Callback to close the panel */
  onClose?: () => void;
}

/**
 * Dashboard showing code health metrics and history
 */
export const CodeHealthDashboard: React.FC<Props> = ({
  locale = 'ar',
  visible = true,
  onClose,
}) => {
  const { snapshots, clearHistory, getRecentRuns } = useCodeHealth();

  const isArabic = locale === 'ar';

  const labels = {
    title: isArabic ? 'صحة الكود' : 'Code Health',
    close: isArabic ? 'إغلاق' : 'Close',
    clearHistory: isArabic ? 'مسح التاريخ' : 'Clear History',
    currentScore: isArabic ? 'النتيجة الحالية' : 'Current Score',
    noData: isArabic ? 'لا توجد بيانات. قم بفحص المشروع أولاً.' : 'No data yet. Scan your project first.',
    recentRuns: isArabic ? 'آخر عمليات الإصلاح' : 'Recent Fix Runs',
    noRuns: isArabic ? 'لا توجد عمليات إصلاح بعد' : 'No fix runs yet',
    issues: isArabic ? 'مشاكل' : 'issues',
    filesFixed: isArabic ? 'ملف تم إصلاحه' : 'files fixed',
    reduced: isArabic ? 'تم تقليل' : 'reduced',
    before: isArabic ? 'قبل' : 'Before',
    after: isArabic ? 'بعد' : 'After',
    improvement: isArabic ? 'تحسن' : 'Improvement',
    breakdown: isArabic ? 'توزيع المشاكل' : 'Issue Breakdown',
    byCategory: isArabic ? 'حسب الفئة' : 'By Category',
    bySeverity: isArabic ? 'حسب الشدة' : 'By Severity',
    logging: isArabic ? 'تسجيل' : 'Logging',
    types: isArabic ? 'أنواع' : 'Types',
    style: isArabic ? 'أسلوب' : 'Style',
    deadCode: isArabic ? 'كود ميت' : 'Dead Code',
    security: isArabic ? 'أمان' : 'Security',
    performance: isArabic ? 'أداء' : 'Performance',
    other: isArabic ? 'أخرى' : 'Other',
    errors: isArabic ? 'أخطاء' : 'Errors',
    warnings: isArabic ? 'تحذيرات' : 'Warnings',
    infos: isArabic ? 'معلومات' : 'Info',
    filesScanned: isArabic ? 'ملف تم فحصه' : 'files scanned',
    totalIssues: isArabic ? 'إجمالي المشاكل' : 'total issues',
    profile: isArabic ? 'الملف التعريفي' : 'Profile',
    scan: isArabic ? 'فحص' : 'Scan',
    autoFix: isArabic ? 'إصلاح تلقائي' : 'Auto-fix',
  };

  // Get the latest snapshot
  const latestSnapshot = useMemo(() => {
    return snapshots.length > 0 ? snapshots[0] : null;
  }, [snapshots]);

  // Compute score from latest snapshot
  const healthScore = useMemo(() => {
    return computeHealthScore(latestSnapshot);
  }, [latestSnapshot]);

  // Get recent runs (last 5)
  const recentRuns = useMemo(() => {
    return getRecentRuns(5);
  }, [getRecentRuns]);

  // Format timestamp
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (!visible) return null;

  return (
    <div className="f0-code-health-dashboard" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="f0-chd-header">
        <h3 className="f0-chd-title">{labels.title}</h3>
        <div className="f0-chd-actions">
          {snapshots.length > 0 && (
            <button
              type="button"
              className="f0-chd-btn f0-chd-btn-clear"
              onClick={clearHistory}
            >
              {labels.clearHistory}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="f0-chd-btn f0-chd-btn-close"
              onClick={onClose}
            >
              {labels.close}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="f0-chd-content">
        {!latestSnapshot ? (
          <div className="f0-chd-empty">{labels.noData}</div>
        ) : (
          <>
            {/* Score Card */}
            <div className={`f0-chd-score-card f0-chd-score-${healthScore.color}`}>
              <div className="f0-chd-score-ring">
                <svg viewBox="0 0 100 100" className="f0-chd-score-svg">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.2"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${healthScore.score * 2.83} 283`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <span className="f0-chd-score-value">{healthScore.score}</span>
              </div>
              <div className="f0-chd-score-label">
                {isArabic ? healthScore.labelAr : healthScore.label}
              </div>
              <div className="f0-chd-score-stats">
                <span>{latestSnapshot.filesScanned} {labels.filesScanned}</span>
                <span className="f0-chd-score-divider">|</span>
                <span>{latestSnapshot.totalIssues} {labels.totalIssues}</span>
              </div>
            </div>

            {/* Breakdown Section */}
            <div className="f0-chd-breakdown">
              {/* By Severity */}
              <div className="f0-chd-breakdown-section">
                <h4 className="f0-chd-breakdown-title">{labels.bySeverity}</h4>
                <div className="f0-chd-breakdown-items">
                  <div className="f0-chd-breakdown-item f0-chd-severity-error">
                    <span className="f0-chd-breakdown-icon">🔴</span>
                    <span className="f0-chd-breakdown-label">{labels.errors}</span>
                    <span className="f0-chd-breakdown-value">{latestSnapshot.severity.errors}</span>
                  </div>
                  <div className="f0-chd-breakdown-item f0-chd-severity-warning">
                    <span className="f0-chd-breakdown-icon">🟡</span>
                    <span className="f0-chd-breakdown-label">{labels.warnings}</span>
                    <span className="f0-chd-breakdown-value">{latestSnapshot.severity.warnings}</span>
                  </div>
                  <div className="f0-chd-breakdown-item f0-chd-severity-info">
                    <span className="f0-chd-breakdown-icon">🔵</span>
                    <span className="f0-chd-breakdown-label">{labels.infos}</span>
                    <span className="f0-chd-breakdown-value">{latestSnapshot.severity.infos}</span>
                  </div>
                </div>
              </div>

              {/* By Category */}
              <div className="f0-chd-breakdown-section">
                <h4 className="f0-chd-breakdown-title">{labels.byCategory}</h4>
                <div className="f0-chd-breakdown-items">
                  {latestSnapshot.categories.logging > 0 && (
                    <div className="f0-chd-breakdown-item">
                      <span className="f0-chd-breakdown-label">{labels.logging}</span>
                      <span className="f0-chd-breakdown-value">{latestSnapshot.categories.logging}</span>
                    </div>
                  )}
                  {latestSnapshot.categories.types > 0 && (
                    <div className="f0-chd-breakdown-item">
                      <span className="f0-chd-breakdown-label">{labels.types}</span>
                      <span className="f0-chd-breakdown-value">{latestSnapshot.categories.types}</span>
                    </div>
                  )}
                  {latestSnapshot.categories.style > 0 && (
                    <div className="f0-chd-breakdown-item">
                      <span className="f0-chd-breakdown-label">{labels.style}</span>
                      <span className="f0-chd-breakdown-value">{latestSnapshot.categories.style}</span>
                    </div>
                  )}
                  {latestSnapshot.categories.deadCode > 0 && (
                    <div className="f0-chd-breakdown-item">
                      <span className="f0-chd-breakdown-label">{labels.deadCode}</span>
                      <span className="f0-chd-breakdown-value">{latestSnapshot.categories.deadCode}</span>
                    </div>
                  )}
                  {latestSnapshot.categories.security > 0 && (
                    <div className="f0-chd-breakdown-item f0-chd-category-security">
                      <span className="f0-chd-breakdown-label">{labels.security}</span>
                      <span className="f0-chd-breakdown-value">{latestSnapshot.categories.security}</span>
                    </div>
                  )}
                  {latestSnapshot.categories.performance > 0 && (
                    <div className="f0-chd-breakdown-item">
                      <span className="f0-chd-breakdown-label">{labels.performance}</span>
                      <span className="f0-chd-breakdown-value">{latestSnapshot.categories.performance}</span>
                    </div>
                  )}
                  {latestSnapshot.categories.other > 0 && (
                    <div className="f0-chd-breakdown-item">
                      <span className="f0-chd-breakdown-label">{labels.other}</span>
                      <span className="f0-chd-breakdown-value">{latestSnapshot.categories.other}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Runs */}
            <div className="f0-chd-runs">
              <h4 className="f0-chd-runs-title">{labels.recentRuns}</h4>
              {recentRuns.length === 0 ? (
                <div className="f0-chd-runs-empty">{labels.noRuns}</div>
              ) : (
                <div className="f0-chd-runs-list">
                  {recentRuns.map((run) => {
                    const improvement = computeImprovement(run.before, run.after);
                    return (
                      <div key={run.id} className="f0-chd-run">
                        <div className="f0-chd-run-header">
                          <span className="f0-chd-run-date">
                            {formatDate(run.timestamp)} {formatTime(run.timestamp)}
                          </span>
                          <span className="f0-chd-run-files">
                            {run.filesFixed} {labels.filesFixed}
                          </span>
                          {run.profileId && (
                            <span className="f0-chd-run-profile">
                              {labels.profile}: {run.profileId}
                            </span>
                          )}
                        </div>
                        {improvement && improvement.issuesReduced > 0 && (
                          <div className="f0-chd-run-improvement">
                            <span className="f0-chd-run-improvement-icon">📉</span>
                            <span className="f0-chd-run-improvement-text">
                              {labels.reduced} {improvement.issuesReduced} {labels.issues} ({improvement.percentReduced}%)
                            </span>
                          </div>
                        )}
                        <div className="f0-chd-run-comparison">
                          <div className="f0-chd-run-before">
                            <span className="f0-chd-run-label">{labels.before}</span>
                            <span className="f0-chd-run-value">
                              {run.before?.totalIssues ?? '?'} {labels.issues}
                            </span>
                          </div>
                          <span className="f0-chd-run-arrow">→</span>
                          <div className="f0-chd-run-after">
                            <span className="f0-chd-run-label">{labels.after}</span>
                            <span className="f0-chd-run-value">
                              {run.after?.totalIssues ?? '?'} {labels.issues}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CodeHealthDashboard;
