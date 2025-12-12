// desktop/src/features/quality/QualityOverlayBar.tsx
// Phase 138.6.1: Global Quality Overlay Bar UI Component
// Phase 140.7: Added "Orchestrated by F0" badge
// Displays aggregated quality metrics in a persistent bar below the header

import React from 'react';
import { useQualityOverlayState } from './useQualityOverlayState';
import { useQualityStory } from '../../hooks/useQualityStory';
import type { QualityRiskLevel, QualityTestsStatus } from './qualityOverlayModel';

/**
 * Get label for risk level
 */
function riskLabel(risk: QualityRiskLevel, isAr: boolean): string {
  switch (risk) {
    case 'low':
      return isAr ? 'منخفض' : 'Low';
    case 'medium':
      return isAr ? 'متوسط' : 'Medium';
    case 'high':
      return isAr ? 'عالي' : 'High';
    case 'critical':
      return isAr ? 'حرج' : 'Critical';
    default:
      return isAr ? 'غير متوفر' : 'N/A';
  }
}

/**
 * Get CSS classes for risk badge
 */
function riskClass(risk: QualityRiskLevel): string {
  switch (risk) {
    case 'low':
      return 'qob-badge-low';
    case 'medium':
      return 'qob-badge-medium';
    case 'high':
      return 'qob-badge-high';
    case 'critical':
      return 'qob-badge-critical';
    default:
      return 'qob-badge-none';
  }
}

/**
 * Get icon for risk level
 */
function riskIcon(risk: QualityRiskLevel): string {
  switch (risk) {
    case 'critical':
      return '🚨';
    case 'high':
      return '⚠️';
    case 'medium':
      return '⚡';
    case 'low':
      return '✓';
    default:
      return '';
  }
}

/**
 * Get label for tests status
 */
function testsLabel(status: QualityTestsStatus, isAr: boolean): string {
  switch (status) {
    case 'not_run':
      return isAr ? 'لم تُشغَّل' : 'Not run';
    case 'passing':
      return isAr ? 'ناجحة' : 'Passing';
    case 'failing':
      return isAr ? 'فاشلة' : 'Failing';
    case 'running':
      return isAr ? 'جاري...' : 'Running...';
    default:
      return '—';
  }
}

/**
 * Get CSS class for tests status
 */
function testsClass(status: QualityTestsStatus): string {
  switch (status) {
    case 'passing':
      return 'qob-tests-passing';
    case 'failing':
      return 'qob-tests-failing';
    case 'running':
      return 'qob-tests-running';
    default:
      return 'qob-tests-unknown';
  }
}

/**
 * Format relative time
 */
function formatRelative(dateIso: string | null, isAr: boolean): string {
  if (!dateIso) return isAr ? 'غير متاح' : 'N/A';
  const ts = new Date(dateIso).getTime();
  if (Number.isNaN(ts)) return dateIso;
  const diffMs = Date.now() - ts;
  const diffMin = Math.round(diffMs / (1000 * 60));
  if (diffMin < 1) return isAr ? 'الآن' : 'Just now';
  if (diffMin < 60) return isAr ? `${diffMin} د` : `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return isAr ? `${diffH} س` : `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  return isAr ? `${diffD} ي` : `${diffD}d ago`;
}

/**
 * Props for QualityOverlayBar
 */
interface QualityOverlayBarProps {
  /** Locale for bilingual support */
  locale?: 'ar' | 'en';
  /** Handler to open Quality Panel */
  onOpenQualityPanel?: () => void;
  /** Handler to open Tests Panel */
  onOpenTestsPanel?: () => void;
  /** Handler to open Security Panel */
  onOpenSecurityPanel?: () => void;
  /** Handler to run full quality check */
  onRunFullCheck?: () => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Global Quality Overlay Bar Component
 * Displays a persistent bar with aggregated quality metrics
 */
export const QualityOverlayBar: React.FC<QualityOverlayBarProps> = ({
  locale = 'en',
  onOpenQualityPanel,
  onOpenTestsPanel,
  onOpenSecurityPanel,
  onRunFullCheck,
  className = '',
}) => {
  const { snapshot, loading } = useQualityOverlayState();
  const story = useQualityStory();
  const hasStory = !!story;
  const isAr = locale === 'ar';

  // Don't show if no data and not loading
  if (!snapshot && !loading) return null;

  const health = snapshot?.health ?? null;
  const risk = snapshot?.riskLevel ?? 'none';
  const stale = snapshot?.isStale ?? false;
  const testsStatus = snapshot?.testsStatus ?? 'unknown';

  return (
    <div className={`qob-bar ${isAr ? 'qob-rtl' : ''} ${className}`}>
      {/* Left: Health + Risk */}
      <div className="qob-section qob-section-health">
        <span className="qob-label">
          {isAr ? 'صحة المشروع' : 'Health'}
        </span>
        <span className="qob-health-value">
          {loading || health === null ? '—' : `${health}%`}
        </span>
        <span className={`qob-badge ${riskClass(risk)}`}>
          {riskIcon(risk) && <span className="qob-badge-icon">{riskIcon(risk)}</span>}
          <span>{riskLabel(risk, isAr)}</span>
          {stale && (
            <span className="qob-stale-badge">
              {isAr ? 'قديم' : 'Stale'}
            </span>
          )}
        </span>
        {/* Phase 140.7: Orchestrated by F0 badge */}
        {hasStory && (
          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
            {isAr ? 'منسّق بواسطة F0' : 'Orchestrated by F0'}
          </span>
        )}
      </div>

      {/* Middle: Mini metrics buttons */}
      <div className="qob-section qob-section-metrics">
        {/* Tests */}
        <button
          type="button"
          className={`qob-metric-btn ${testsClass(testsStatus)}`}
          onClick={onOpenTestsPanel}
          title={isAr ? 'فتح لوحة الاختبارات' : 'Open Tests Panel'}
        >
          <span className="qob-metric-dot qob-dot-tests" />
          <span className="qob-metric-label">
            {isAr ? 'اختبارات' : 'Tests'}:
          </span>
          <span className="qob-metric-value">
            {testsLabel(testsStatus, isAr)}
          </span>
          {snapshot?.lastTestsAt && (
            <span className="qob-metric-time">
              · {formatRelative(snapshot.lastTestsAt, isAr)}
            </span>
          )}
        </button>

        {/* Security */}
        <button
          type="button"
          className="qob-metric-btn"
          onClick={onOpenSecurityPanel}
          title={isAr ? 'فتح لوحة الأمان' : 'Open Security Panel'}
        >
          <span className="qob-metric-dot qob-dot-security" />
          <span className="qob-metric-label">
            {isAr ? 'أمان' : 'Security'}:
          </span>
          <span className="qob-metric-value">
            {snapshot?.securityAlerts.total ?? 0}{' '}
            {isAr ? 'تنبيه' : 'alerts'}
          </span>
          {snapshot && snapshot.securityAlerts.blocking > 0 && (
            <span className="qob-blocking-badge">
              {snapshot.securityAlerts.blocking}{' '}
              {isAr ? 'حاجب' : 'blocking'}
            </span>
          )}
        </button>

        {/* Issues */}
        <button
          type="button"
          className="qob-metric-btn"
          onClick={onOpenQualityPanel}
          title={isAr ? 'فتح لوحة الجودة' : 'Open Quality Panel'}
        >
          <span className="qob-metric-dot qob-dot-issues" />
          <span className="qob-metric-label">
            {isAr ? 'مشاكل' : 'Issues'}:
          </span>
          <span className="qob-metric-value">
            {snapshot?.issuesCount ?? 0}
          </span>
        </button>

        {/* ACE Level (only if not none) */}
        {snapshot && snapshot.aceLevel !== 'none' && (
          <div className={`qob-ace-badge qob-ace-${snapshot.aceLevel}`}>
            <span className="qob-metric-dot qob-dot-ace" />
            <span className="qob-metric-label">ACE:</span>
            <span className="qob-metric-value qob-ace-value">
              {snapshot.aceLevel}
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="qob-section qob-section-actions">
        <span className="qob-snapshot-time">
          {snapshot?.lastSnapshotAt ? (
            <>
              <span className="qob-snapshot-label">
                {isAr ? 'آخر فحص' : 'Last scan'}:{' '}
              </span>
              <span className="qob-snapshot-value">
                {formatRelative(snapshot.lastSnapshotAt, isAr)}
              </span>
            </>
          ) : (
            <span className="qob-snapshot-none">
              {isAr ? 'لم يتم الفحص بعد' : 'No scan yet'}
            </span>
          )}
        </span>

        <button
          type="button"
          className="qob-run-btn"
          onClick={onRunFullCheck}
          disabled={loading}
        >
          {loading ? (
            isAr ? 'جاري الفحص...' : 'Scanning...'
          ) : (
            isAr ? 'فحص كامل' : 'Full Check'
          )}
        </button>
      </div>
    </div>
  );
};

export default QualityOverlayBar;
