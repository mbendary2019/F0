// desktop/src/components/HealthToast.tsx
// Phase 127.4: Toast notification for critical health alerts

import React, { useEffect, useState } from 'react';
import { type HealthAlert, getAlertTitle, getAlertMessage } from '../lib/analysis/codeHealthAlerts';
import './HealthToast.css';

interface Props {
  /** The alert to display */
  alert: HealthAlert | null;
  /** Locale for labels */
  locale?: 'ar' | 'en';
  /** Duration in ms before auto-dismiss (0 = no auto-dismiss) */
  duration?: number;
  /** Callback when toast is dismissed */
  onDismiss: () => void;
  /** Callback when toast is clicked to view details */
  onViewDetails?: () => void;
}

/**
 * Toast notification for critical health alerts
 * Auto-dismisses after duration, slides in from right
 */
export const HealthToast: React.FC<Props> = ({
  alert,
  locale = 'ar',
  duration = 5000,
  onDismiss,
  onViewDetails,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const isArabic = locale === 'ar';

  // Labels
  const labels = {
    viewDetails: isArabic ? 'عرض التفاصيل' : 'View Details',
    dismiss: isArabic ? 'إغلاق' : 'Dismiss',
  };

  // Show/hide animation
  useEffect(() => {
    if (alert) {
      setIsVisible(true);
      setIsExiting(false);
    }
  }, [alert]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!alert || duration === 0) return;

    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [alert, duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 300); // Match animation duration
  };

  const handleViewDetails = () => {
    handleDismiss();
    onViewDetails?.();
  };

  if (!alert || !isVisible) return null;

  const title = getAlertTitle(alert, locale);
  const message = getAlertMessage(alert, locale);

  return (
    <div
      className={`f0-health-toast ${isExiting ? 'toast-exit' : 'toast-enter'}`}
      dir={isArabic ? 'rtl' : 'ltr'}
      role="alert"
      aria-live="assertive"
    >
      <div className="f0-toast-icon">{alert.icon}</div>
      <div className="f0-toast-content">
        <div className="f0-toast-header">
          <span className="f0-toast-title">{title}</span>
          <span className={`f0-toast-level level-${alert.level}`}>
            {alert.level === 'critical'
              ? isArabic
                ? 'حرج'
                : 'Critical'
              : alert.level === 'warning'
              ? isArabic
                ? 'تحذير'
                : 'Warning'
              : isArabic
              ? 'معلومة'
              : 'Info'}
          </span>
        </div>
        <p className="f0-toast-message">{message}</p>
        <div className="f0-toast-actions">
          {onViewDetails && (
            <button
              className="f0-toast-btn f0-toast-btn-primary"
              onClick={handleViewDetails}
            >
              {labels.viewDetails}
            </button>
          )}
          <button className="f0-toast-btn" onClick={handleDismiss}>
            {labels.dismiss}
          </button>
        </div>
        <div className="f0-toast-hint">
          {isArabic ? 'اضغط لفتح لوحة الجودة' : 'Click to open Quality Panel'}
        </div>
      </div>
      <button
        className="f0-toast-close"
        onClick={handleDismiss}
        aria-label={labels.dismiss}
      >
        ✕
      </button>
    </div>
  );
};

export default HealthToast;
