// desktop/src/components/ace/AceActivityWidget.tsx
// Phase 128.8: ACE Activity Widget for Header
// Shows a small icon with pulse animation indicating ACE status

import React from 'react';
import { useAceMetrics, useAceAlerts } from '../../state/aceContext';
import type { AceActivityStatus } from '../../lib/ace/aceMetricsTypes';
import './AceActivityWidget.css';

interface Props {
  locale?: 'ar' | 'en';
  onClick?: () => void;
}

/**
 * ACE Activity Widget - Small header icon showing ACE status
 */
export const AceActivityWidget: React.FC<Props> = ({ locale = 'ar', onClick }) => {
  const isArabic = locale === 'ar';
  const { activityStatus, isScanning } = useAceMetrics();
  const { activeAlerts, highestSeverity } = useAceAlerts();

  // Get status color and pulse animation
  const getStatusInfo = (status: AceActivityStatus) => {
    switch (status) {
      case 'running':
        return { color: '#3b82f6', pulse: true, icon: 'running' };
      case 'attention':
        return { color: '#f59e0b', pulse: true, icon: 'attention' };
      case 'stale':
        return { color: '#9ca3af', pulse: false, icon: 'stale' };
      case 'idle':
      default:
        return { color: '#22c55e', pulse: false, icon: 'idle' };
    }
  };

  const statusInfo = getStatusInfo(activityStatus);

  // Override with alert severity if there are active alerts
  let displayColor = statusInfo.color;
  let shouldPulse = statusInfo.pulse;

  if (highestSeverity === 'critical') {
    displayColor = '#ef4444';
    shouldPulse = true;
  } else if (highestSeverity === 'warning' && activityStatus !== 'running') {
    displayColor = '#f59e0b';
    shouldPulse = true;
  }

  const labels = {
    title: isArabic ? 'ACE - محرك تطوير الكود' : 'ACE - Auto Code Evolution',
    idle: isArabic ? 'الكود بحالة جيدة' : 'Code is healthy',
    attention: isArabic ? 'يحتاج اهتمام' : 'Needs attention',
    stale: isArabic ? 'الفحص قديم' : 'Scan is stale',
    running: isArabic ? 'جاري الفحص...' : 'Scanning...',
  };

  const statusLabel = isScanning
    ? labels.running
    : labels[activityStatus as keyof typeof labels] || labels.idle;

  return (
    <button
      className={`f0-ace-widget ${shouldPulse ? 'pulsing' : ''}`}
      onClick={onClick}
      title={`${labels.title}\n${statusLabel}`}
      style={{ '--ace-status-color': displayColor } as React.CSSProperties}
    >
      {/* ACE Icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="f0-ace-widget-icon"
      >
        {/* DNA/Evolution helix icon */}
        <path d="M2 15c6.667-6 13.333 0 20-6" />
        <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
        <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
        <path d="M17 6l-2.5-2.5" />
        <path d="M14 8l-1-1" />
        <path d="M7 18l2.5 2.5" />
        <path d="M10 16l1 1" />
      </svg>

      {/* Status dot */}
      <span
        className={`f0-ace-widget-dot ${shouldPulse ? 'pulsing' : ''}`}
        style={{ backgroundColor: displayColor }}
      />

      {/* Alert count badge */}
      {activeAlerts.length > 0 && (
        <span className="f0-ace-widget-badge">
          {activeAlerts.length > 9 ? '9+' : activeAlerts.length}
        </span>
      )}
    </button>
  );
};

export default AceActivityWidget;
