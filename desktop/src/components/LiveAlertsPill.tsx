// desktop/src/components/LiveAlertsPill.tsx
// Phase 127.2: Live Alerts Pill - shows live pattern alerts in editor header

import React, { useState, useRef, useEffect } from 'react';
import type { LiveAlertsSummary, LiveFileAlert } from '../hooks/useLiveFileAlerts';
import './LiveAlertsPill.css';

interface Props {
  /** Live alerts summary */
  summary: LiveAlertsSummary;
  /** Locale for labels */
  locale?: 'ar' | 'en';
}

/**
 * Live Alerts Pill
 * Shows a small badge with live alerts count
 * Expands to show details on hover/click
 */
export const LiveAlertsPill: React.FC<Props> = ({ summary, locale = 'ar' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);
  const isArabic = locale === 'ar';

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  // Don't render if no alerts
  if (summary.alerts.length === 0) {
    return null;
  }

  // Labels
  const labels = {
    liveAlerts: isArabic ? 'تنبيهات مباشرة' : 'Live Alerts',
    found: isArabic ? 'تم العثور على' : 'Found',
    times: isArabic ? 'مرة' : 'times',
    occurrences: isArabic ? 'تكرار' : 'occurrences',
  };

  // Determine pill color based on highest severity
  const pillClass = summary.hasCritical
    ? 'pill-critical'
    : summary.hasWarning
    ? 'pill-warning'
    : 'pill-info';

  return (
    <div ref={pillRef} className="f0-live-alerts-container">
      <button
        className={`f0-live-alert-pill ${pillClass}`}
        onClick={() => setIsExpanded(!isExpanded)}
        title={summary.alerts.map(a => `${a.icon} ${isArabic ? a.messageAr : a.message} (${a.count})`).join('\n')}
      >
        <span className="f0-live-alert-icon">
          {summary.hasCritical ? '!' : summary.hasWarning ? '⚠️' : '💡'}
        </span>
        <span className="f0-live-alert-count">
          {summary.alerts.length} {labels.liveAlerts}
        </span>
      </button>

      {/* Expanded dropdown */}
      {isExpanded && (
        <div className="f0-live-alerts-dropdown" dir={isArabic ? 'rtl' : 'ltr'}>
          <div className="f0-live-alerts-header">
            <span>{labels.liveAlerts}</span>
            <span className="f0-live-alerts-total">
              {summary.totalCount} {labels.occurrences}
            </span>
          </div>
          <div className="f0-live-alerts-list">
            {summary.alerts.map((alert) => (
              <AlertRow
                key={alert.patternId}
                alert={alert}
                locale={locale}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Single alert row in the dropdown
 */
const AlertRow: React.FC<{ alert: LiveFileAlert; locale: 'ar' | 'en' }> = ({
  alert,
  locale,
}) => {
  const isArabic = locale === 'ar';
  const message = isArabic ? alert.messageAr : alert.message;

  const severityClass = `alert-${alert.severity}`;

  return (
    <div className={`f0-live-alert-row ${severityClass}`}>
      <span className="f0-live-alert-row-icon">{alert.icon}</span>
      <div className="f0-live-alert-row-content">
        <span className="f0-live-alert-row-message">{message}</span>
        <span className="f0-live-alert-row-count">
          ({alert.count}×)
        </span>
      </div>
    </div>
  );
};

export default LiveAlertsPill;
