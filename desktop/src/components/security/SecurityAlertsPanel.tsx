// desktop/src/components/security/SecurityAlertsPanel.tsx
// Phase 136.0: Security Alerts Panel
// Displays security alerts with severity badges and file locations

import React from 'react';
import type {
  SecurityAlert,
  SecuritySeverity,
} from '../../lib/security/securityEngine';
import {
  getSeverityIcon,
  getSeverityLabel,
} from '../../lib/security/securityEngine';

type Locale = 'en' | 'ar';

interface SecurityAlertsPanelProps {
  alerts: SecurityAlert[];
  locale: Locale;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Max alerts to show before "show more" */
  maxVisible?: number;
}

/**
 * Get severity color classes
 */
const severityColorClasses: Record<SecuritySeverity, string> = {
  info: 'text-sky-300 bg-sky-500/10 border-sky-500/40',
  low: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40',
  medium: 'text-amber-300 bg-amber-500/10 border-amber-500/60',
  high: 'text-orange-300 bg-orange-500/10 border-orange-500/70',
  critical: 'text-red-300 bg-red-500/10 border-red-500/80',
};

/**
 * Get category icon
 */
function getCategoryIcon(category?: string): string {
  switch (category) {
    case 'injection': return '💉';
    case 'secrets': return '🔑';
    case 'auth': return '🔐';
    case 'xss': return '📜';
    case 'csrf': return '🔄';
    case 'crypto': return '🔒';
    case 'sanitization': return '🧹';
    default: return '🛡️';
  }
}

/**
 * Security Alerts Panel
 * Shows security alerts with severity indicators
 */
export const SecurityAlertsPanel: React.FC<SecurityAlertsPanelProps> = ({
  alerts,
  locale,
  compact = false,
  maxVisible = 5,
}) => {
  const isRtl = locale === 'ar';
  const [showAll, setShowAll] = React.useState(false);

  // Empty state
  if (!alerts.length) {
    if (compact) return null;

    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="rounded-xl border border-emerald-700/50 bg-emerald-900/30 px-4 py-3 text-xs text-emerald-200"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">✅</span>
          <span>
            {locale === 'ar'
              ? 'لا توجد تنبيهات أمان حالياً لهذا المشروع.'
              : 'No security alerts detected for this project.'}
          </span>
        </div>
      </div>
    );
  }

  // Count blocking alerts
  const blockingCount = alerts.filter((a) => a.isBlocking).length;
  const highSeverityCount = alerts.filter(
    (a) => a.severity === 'high' || a.severity === 'critical'
  ).length;

  // Visible alerts
  const visibleAlerts = showAll ? alerts : alerts.slice(0, maxVisible);
  const hiddenCount = alerts.length - visibleAlerts.length;

  // Compact mode - just a badge
  if (compact) {
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-[11px]"
      >
        <span className="text-base">🛡️</span>
        <span className="font-medium text-red-200">
          {alerts.length} {locale === 'ar' ? 'تنبيه أمني' : 'security alert(s)'}
        </span>
        {blockingCount > 0 && (
          <span className="rounded-full bg-red-500/30 px-2 py-0.5 text-[10px] text-red-100">
            ⛔️ {blockingCount} {locale === 'ar' ? 'حرج' : 'blocking'}
          </span>
        )}
      </div>
    );
  }

  // Full panel
  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="rounded-2xl border border-red-800/70 bg-gradient-to-br from-red-950/80 to-red-900/40 p-4 shadow-[0_0_30px_rgba(255,50,50,0.15)]"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-lg">
            🛡️
          </span>
          <div>
            <h3 className="text-sm font-semibold text-red-50">
              {locale === 'ar' ? 'تنبيهات الأمان' : 'Security Alerts'}
            </h3>
            <p className="text-[10px] text-red-300/70">
              {locale === 'ar'
                ? 'يجب معالجة التنبيهات الحرجة قبل النشر'
                : 'Critical alerts must be resolved before deploy'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Total count badge */}
          <span className="flex items-center gap-1 rounded-full bg-red-900/70 px-3 py-1 text-[11px] text-red-200">
            ⚠️ {alerts.length} {locale === 'ar' ? 'تحذير' : 'alert(s)'}
          </span>

          {/* Blocking count badge */}
          {blockingCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600/50 px-3 py-1 text-[11px] font-semibold text-red-100">
              ⛔️ {blockingCount} {locale === 'ar' ? 'يمنع النشر' : 'blocking'}
            </span>
          )}
        </div>
      </div>

      {/* Severity summary bar */}
      <div className="mb-3 flex flex-wrap gap-2 text-[10px]">
        {alerts.filter((a) => a.severity === 'critical').length > 0 && (
          <span className="rounded-full bg-red-600/30 px-2 py-0.5 text-red-200">
            🚨 {alerts.filter((a) => a.severity === 'critical').length} Critical
          </span>
        )}
        {alerts.filter((a) => a.severity === 'high').length > 0 && (
          <span className="rounded-full bg-orange-600/30 px-2 py-0.5 text-orange-200">
            ⛔️ {alerts.filter((a) => a.severity === 'high').length} High
          </span>
        )}
        {alerts.filter((a) => a.severity === 'medium').length > 0 && (
          <span className="rounded-full bg-amber-600/30 px-2 py-0.5 text-amber-200">
            ⚠️ {alerts.filter((a) => a.severity === 'medium').length} Medium
          </span>
        )}
        {alerts.filter((a) => a.severity === 'low').length > 0 && (
          <span className="rounded-full bg-emerald-600/30 px-2 py-0.5 text-emerald-200">
            💡 {alerts.filter((a) => a.severity === 'low').length} Low
          </span>
        )}
      </div>

      {/* Alerts list */}
      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-xl border px-3 py-2.5 transition-colors hover:bg-white/[0.03] ${
              alert.isBlocking
                ? 'border-red-700/80 bg-red-950/80'
                : 'border-red-900/60 bg-red-950/50'
            }`}
          >
            {/* Alert header */}
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Category icon */}
                <span className="text-base">{getCategoryIcon(alert.category)}</span>

                {/* Severity badge */}
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    severityColorClasses[alert.severity]
                  }`}
                >
                  {getSeverityIcon(alert.severity)}{' '}
                  {getSeverityLabel(alert.severity, locale)}
                </span>

                {/* Category tag */}
                {alert.category && (
                  <span className="rounded-full bg-slate-800/50 px-2 py-0.5 text-[9px] text-slate-400">
                    {alert.category}
                  </span>
                )}

                {/* Blocking indicator */}
                {alert.isBlocking && (
                  <span className="rounded-full bg-red-600/40 px-2 py-0.5 text-[9px] font-semibold text-red-200">
                    {locale === 'ar' ? 'يمنع النشر' : 'BLOCKING'}
                  </span>
                )}
              </div>

              {/* File location */}
              {alert.filePath && (
                <span className="truncate max-w-[180px] text-[10px] text-red-300/80 font-mono">
                  {alert.filePath}
                  {alert.line ? `:${alert.line}` : ''}
                  {alert.column ? `:${alert.column}` : ''}
                </span>
              )}
            </div>

            {/* Alert message */}
            <p className="text-[11px] leading-relaxed text-red-100/90">
              {locale === 'ar' && alert.messageAr ? alert.messageAr : alert.message}
            </p>

            {/* Rule ID if available */}
            {alert.ruleId && (
              <p className="mt-1 text-[9px] text-red-400/60 font-mono">
                Rule: {alert.ruleId}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Show more / less button */}
      {hiddenCount > 0 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 w-full rounded-lg bg-red-900/40 px-3 py-1.5 text-[11px] text-red-200 hover:bg-red-900/60 transition-colors"
        >
          {locale === 'ar'
            ? `عرض ${hiddenCount} تنبيه إضافي`
            : `Show ${hiddenCount} more alert(s)`}
        </button>
      )}

      {showAll && alerts.length > maxVisible && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-2 w-full rounded-lg bg-red-900/40 px-3 py-1.5 text-[11px] text-red-200 hover:bg-red-900/60 transition-colors"
        >
          {locale === 'ar' ? 'إظهار أقل' : 'Show less'}
        </button>
      )}
    </div>
  );
};

export default SecurityAlertsPanel;
