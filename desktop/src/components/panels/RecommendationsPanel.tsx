// desktop/src/components/panels/RecommendationsPanel.tsx
// Phase 126.3: Intelligent Recommendations Panel UI

import React from 'react';
import { useRecommendations } from '../../state/recommendationsContext';
import type { CodeHealthRecommendation } from '../../lib/analysis/codeHealthRecommendations';
import './RecommendationsPanel.css';

interface Props {
  /** Locale for labels */
  locale?: 'ar' | 'en';
  /** Callback when user clicks "Apply" on a recommendation */
  onAction?: (rec: CodeHealthRecommendation) => void;
  /** Whether to show the panel */
  visible?: boolean;
  /** Callback to close the panel */
  onClose?: () => void;
}

/**
 * Panel showing intelligent code health recommendations
 */
export const RecommendationsPanel: React.FC<Props> = ({
  locale = 'ar',
  onAction,
  visible = true,
  onClose,
}) => {
  const {
    visibleRecommendations,
    regenerate,
    dismiss,
    lastGeneratedAt,
    isGenerating,
  } = useRecommendations();

  const isArabic = locale === 'ar';

  const labels = {
    title: isArabic ? 'توصيات ذكية' : 'Smart Recommendations',
    subtitle: isArabic
      ? 'خطوات مقترحة لتحسين صحة الكود'
      : 'Suggested steps to improve code health',
    close: isArabic ? 'إغلاق' : 'Close',
    refresh: isArabic ? 'تحديث' : 'Refresh',
    refreshing: isArabic ? 'جاري التحديث...' : 'Refreshing...',
    apply: isArabic ? 'تطبيق' : 'Apply',
    dismiss: isArabic ? 'تجاهل' : 'Dismiss',
    noRecommendations: isArabic
      ? 'لا توجد توصيات حالياً. قم بفحص المشروع أولاً.'
      : 'No recommendations. Run a project scan first.',
    lastUpdated: isArabic ? 'آخر تحديث' : 'Last updated',
    severityHigh: isArabic ? 'عالية' : 'High',
    severityMedium: isArabic ? 'متوسطة' : 'Medium',
    severityLow: isArabic ? 'منخفضة' : 'Low',
  };

  const getSeverityLabel = (severity: string): string => {
    switch (severity) {
      case 'high':
        return labels.severityHigh;
      case 'medium':
        return labels.severityMedium;
      case 'low':
        return labels.severityLow;
      default:
        return severity;
    }
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!visible) return null;

  return (
    <div className="f0-recs-panel" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="f0-recs-header">
        <div className="f0-recs-header-text">
          <h3 className="f0-recs-title">{labels.title}</h3>
          <p className="f0-recs-subtitle">{labels.subtitle}</p>
        </div>
        <div className="f0-recs-actions">
          <button
            type="button"
            className="f0-recs-btn f0-recs-btn-refresh"
            onClick={regenerate}
            disabled={isGenerating}
          >
            {isGenerating ? labels.refreshing : labels.refresh}
          </button>
          {onClose && (
            <button
              type="button"
              className="f0-recs-btn f0-recs-btn-close"
              onClick={onClose}
            >
              {labels.close}
            </button>
          )}
        </div>
      </div>

      {/* Last updated */}
      {lastGeneratedAt && (
        <div className="f0-recs-meta">
          {labels.lastUpdated}: {formatTime(lastGeneratedAt)}
        </div>
      )}

      {/* Content */}
      <div className="f0-recs-content">
        {visibleRecommendations.length === 0 ? (
          <div className="f0-recs-empty">{labels.noRecommendations}</div>
        ) : (
          <div className="f0-recs-list">
            {visibleRecommendations.map((rec) => (
              <div
                key={rec.id}
                className={`f0-recs-card f0-recs-severity-${rec.severity}`}
              >
                <div className="f0-recs-card-header">
                  <span className="f0-recs-card-icon">{rec.icon}</span>
                  <span className={`f0-recs-card-badge f0-recs-badge-${rec.severity}`}>
                    {getSeverityLabel(rec.severity)}
                  </span>
                </div>
                <div className="f0-recs-card-body">
                  <div className="f0-recs-card-title">
                    {isArabic ? rec.titleAr : rec.title}
                  </div>
                  <div className="f0-recs-card-desc">
                    {isArabic ? rec.descriptionAr : rec.description}
                  </div>
                </div>
                <div className="f0-recs-card-actions">
                  {onAction && (
                    <button
                      type="button"
                      className="f0-recs-card-btn f0-recs-card-btn-apply"
                      onClick={() => onAction(rec)}
                    >
                      {labels.apply}
                    </button>
                  )}
                  <button
                    type="button"
                    className="f0-recs-card-btn f0-recs-card-btn-dismiss"
                    onClick={() => dismiss(rec.id)}
                  >
                    {labels.dismiss}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationsPanel;
