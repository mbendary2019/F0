// desktop/src/components/HealthAlertsPanel.tsx
// Phase 127.4: Health Alerts Panel - Shows recent alerts list

import React from 'react';
import { useHealthAlerts } from '../state/healthAlertsContext';
import { getAlertTitle, getAlertMessage, type HealthAlert, type HealthAlertLevel } from '../lib/analysis/codeHealthAlerts';
import './HealthAlertsPanel.css';

interface Props {
  /** Locale for labels */
  locale?: 'ar' | 'en';
  /** Callback when panel should close */
  onClose?: () => void;
}

/**
 * Health Alerts Panel
 * Shows list of recent health alerts with dismiss/clear actions
 */
export const HealthAlertsPanel: React.FC<Props> = ({
  locale = 'ar',
  onClose,
}) => {
  const { alerts, unreadCount, markAllRead, dismissAlert, clearAll } = useHealthAlerts();

  const isArabic = locale === 'ar';

  // Labels
  const labels = {
    title: isArabic ? 'تنبيهات صحة الكود' : 'Code Health Alerts',
    noAlerts: isArabic ? 'لا توجد تنبيهات حالياً' : 'No alerts at the moment',
    markAllRead: isArabic ? 'تعيين الكل كمقروء' : 'Mark all read',
    clearAll: isArabic ? 'مسح الكل' : 'Clear all',
    dismiss: isArabic ? 'تجاهل' : 'Dismiss',
    close: isArabic ? 'إغلاق' : 'Close',
    unread: isArabic ? 'غير مقروء' : 'unread',
  };

  // Get level badge class
  const getLevelClass = (level: HealthAlertLevel): string => {
    switch (level) {
      case 'critical':
        return 'alert-level-critical';
      case 'warning':
        return 'alert-level-warning';
      case 'info':
      default:
        return 'alert-level-info';
    }
  };

  // Get level label
  const getLevelLabel = (level: HealthAlertLevel): string => {
    if (isArabic) {
      switch (level) {
        case 'critical':
          return 'حرج';
        case 'warning':
          return 'تحذير';
        case 'info':
        default:
          return 'معلومة';
      }
    }
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  // Format timestamp
  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return isArabic ? 'الآن' : 'Just now';
    }
    if (diffMins < 60) {
      return isArabic ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return isArabic ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return isArabic ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  };

  return (
    <div className="f0-alerts-panel" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="f0-alerts-header">
        <div className="f0-alerts-title-row">
          <h3 className="f0-alerts-title">{labels.title}</h3>
          {unreadCount > 0 && (
            <span className="f0-alerts-unread-badge">
              {unreadCount} {labels.unread}
            </span>
          )}
        </div>
        <div className="f0-alerts-actions">
          {alerts.length > 0 && (
            <>
              <button
                className="f0-alerts-action-btn"
                onClick={markAllRead}
                title={labels.markAllRead}
              >
                {labels.markAllRead}
              </button>
              <button
                className="f0-alerts-action-btn f0-alerts-action-danger"
                onClick={clearAll}
                title={labels.clearAll}
              >
                {labels.clearAll}
              </button>
            </>
          )}
          {onClose && (
            <button
              className="f0-alerts-close-btn"
              onClick={onClose}
              title={labels.close}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className="f0-alerts-list">
        {alerts.length === 0 ? (
          <div className="f0-alerts-empty">
            <span className="f0-alerts-empty-icon">🎉</span>
            <p>{labels.noAlerts}</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              locale={locale}
              getLevelClass={getLevelClass}
              getLevelLabel={getLevelLabel}
              formatTime={formatTime}
              onDismiss={() => dismissAlert(alert.id)}
              dismissLabel={labels.dismiss}
            />
          ))
        )}
      </div>
    </div>
  );
};

/**
 * Single Alert Item
 */
interface AlertItemProps {
  alert: HealthAlert;
  locale: 'ar' | 'en';
  getLevelClass: (level: HealthAlertLevel) => string;
  getLevelLabel: (level: HealthAlertLevel) => string;
  formatTime: (isoString: string) => string;
  onDismiss: () => void;
  dismissLabel: string;
}

const AlertItem: React.FC<AlertItemProps> = ({
  alert,
  locale,
  getLevelClass,
  getLevelLabel,
  formatTime,
  onDismiss,
  dismissLabel,
}) => {
  const title = getAlertTitle(alert, locale);
  const message = getAlertMessage(alert, locale);

  return (
    <div className={`f0-alert-item ${getLevelClass(alert.level)}`}>
      <div className="f0-alert-icon">{alert.icon}</div>
      <div className="f0-alert-content">
        <div className="f0-alert-header">
          <span className="f0-alert-title">{title}</span>
          <span className={`f0-alert-level-badge ${getLevelClass(alert.level)}`}>
            {getLevelLabel(alert.level)}
          </span>
        </div>
        <p className="f0-alert-message">{message}</p>
        <div className="f0-alert-footer">
          <span className="f0-alert-time">{formatTime(alert.createdAt)}</span>
          <button
            className="f0-alert-dismiss-btn"
            onClick={onDismiss}
            title={dismissLabel}
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HealthAlertsPanel;
