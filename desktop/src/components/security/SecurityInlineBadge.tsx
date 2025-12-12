// desktop/src/components/security/SecurityInlineBadge.tsx
// Phase 136.3: Inline Security Badge for Editor Gutter
// Shows security alerts inline next to affected lines

'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';
import type { SecurityAlert, SecuritySeverity } from '../../lib/security/securityEngine';
import mascotImg from '../../../public/mascots/f0-mascot-login.png';

/**
 * Severity configuration for inline badges
 */
const SEVERITY_BADGE_CONFIG: Record<
  SecuritySeverity,
  {
    icon: string;
    bg: string;
    border: string;
    text: string;
    pulse?: boolean;
  }
> = {
  critical: {
    icon: '🔴',
    bg: 'bg-red-500/30',
    border: 'border-red-500/50',
    text: 'text-red-300',
    pulse: true,
  },
  high: {
    icon: '🟠',
    bg: 'bg-orange-500/30',
    border: 'border-orange-500/50',
    text: 'text-orange-300',
    pulse: true,
  },
  medium: {
    icon: '🟡',
    bg: 'bg-amber-500/30',
    border: 'border-amber-500/50',
    text: 'text-amber-300',
  },
  low: {
    icon: '🔵',
    bg: 'bg-blue-500/30',
    border: 'border-blue-500/50',
    text: 'text-blue-300',
  },
  info: {
    icon: 'ℹ️',
    bg: 'bg-slate-500/30',
    border: 'border-slate-500/50',
    text: 'text-slate-300',
  },
};

interface SecurityInlineBadgeProps {
  /** Security alerts for this line */
  alerts: SecurityAlert[];
  /** Line number */
  lineNumber: number;
  /** Locale for tooltips */
  locale?: 'en' | 'ar';
  /** Click handler for quick fix */
  onQuickFix?: (alerts: SecurityAlert[]) => void;
  /** Compact mode (icon only) */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Get highest severity from alerts
 */
function getHighestSeverity(alerts: SecurityAlert[]): SecuritySeverity {
  const order: SecuritySeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  let highest: SecuritySeverity = 'info';
  let highestOrder = 4;

  alerts.forEach((alert) => {
    const idx = order.indexOf(alert.severity);
    if (idx < highestOrder) {
      highestOrder = idx;
      highest = alert.severity;
    }
  });

  return highest;
}

/**
 * SecurityInlineBadge
 * Displays inline security indicator for editor gutter
 *
 * Usage:
 * ```tsx
 * <SecurityInlineBadge
 *   alerts={alertsForLine}
 *   lineNumber={42}
 *   locale="ar"
 *   onQuickFix={(alerts) => sendToAgent(alerts)}
 * />
 * ```
 */
export const SecurityInlineBadge: React.FC<SecurityInlineBadgeProps> = ({
  alerts,
  lineNumber,
  locale = 'en',
  onQuickFix,
  compact = false,
  className,
}) => {
  const isRTL = locale === 'ar';

  // Get highest severity for badge styling
  const highestSeverity = useMemo(() => getHighestSeverity(alerts), [alerts]);
  const config = SEVERITY_BADGE_CONFIG[highestSeverity];

  // Build tooltip content
  const tooltipContent = useMemo(() => {
    if (alerts.length === 1) {
      return alerts[0].message;
    }
    return alerts.map((a) => `• ${a.message}`).join('\n');
  }, [alerts]);

  // Labels
  const labels = {
    fix: isRTL ? 'إصلاح' : 'Fix',
    issues: isRTL ? 'مشاكل' : 'issues',
    line: isRTL ? 'سطر' : 'Line',
  };

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1 py-0.5 cursor-pointer',
        'border transition-all duration-200',
        config.bg,
        config.border,
        config.pulse && 'animate-pulse',
        'hover:scale-105 hover:shadow-lg',
        className
      )}
      title={tooltipContent}
      onClick={() => onQuickFix?.(alerts)}
      role="button"
      aria-label={`${alerts.length} security ${alerts.length === 1 ? 'issue' : 'issues'} on line ${lineNumber}`}
    >
      {/* Severity Icon */}
      <span className="text-xs">{config.icon}</span>

      {/* Count Badge (if multiple) */}
      {alerts.length > 1 && (
        <span className={clsx('text-[10px] font-bold', config.text)}>
          {alerts.length}
        </span>
      )}

      {/* Message Preview (non-compact mode) */}
      {!compact && alerts.length === 1 && (
        <span className={clsx('text-[10px] truncate max-w-[150px]', config.text)}>
          {alerts[0].message.slice(0, 30)}
          {alerts[0].message.length > 30 ? '...' : ''}
        </span>
      )}

      {/* Quick Fix Button */}
      {onQuickFix && (
        <button
          className={clsx(
            'text-[9px] px-1 rounded',
            'bg-emerald-500/30 border border-emerald-500/50',
            'text-emerald-300 hover:bg-emerald-500/40',
            'transition-colors'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onQuickFix(alerts);
          }}
        >
          <img src={mascotImg} alt="AI" className="inline h-3 w-3 rounded-full mr-0.5" /> {labels.fix}
        </button>
      )}
    </div>
  );
};

/**
 * Hook to get alerts grouped by line number
 */
export function useAlertsByLine(
  alerts: SecurityAlert[],
  filePath: string
): Map<number, SecurityAlert[]> {
  return useMemo(() => {
    const byLine = new Map<number, SecurityAlert[]>();

    alerts.forEach((alert) => {
      if (alert.filePath === filePath && alert.line) {
        const existing = byLine.get(alert.line) || [];
        existing.push(alert);
        byLine.set(alert.line, existing);
      }
    });

    return byLine;
  }, [alerts, filePath]);
}

/**
 * Get line decorations for Monaco editor
 */
export function getSecurityLineDecorations(
  alerts: SecurityAlert[],
  filePath: string
): Array<{
  range: { startLineNumber: number; endLineNumber: number; startColumn: 1; endColumn: 1 };
  options: {
    isWholeLine: boolean;
    className: string;
    glyphMarginClassName?: string;
    glyphMarginHoverMessage?: { value: string };
  };
}> {
  const byLine = new Map<number, SecurityAlert[]>();

  alerts.forEach((alert) => {
    if (alert.filePath === filePath && alert.line) {
      const existing = byLine.get(alert.line) || [];
      existing.push(alert);
      byLine.set(alert.line, existing);
    }
  });

  const decorations: Array<{
    range: { startLineNumber: number; endLineNumber: number; startColumn: 1; endColumn: 1 };
    options: {
      isWholeLine: boolean;
      className: string;
      glyphMarginClassName?: string;
      glyphMarginHoverMessage?: { value: string };
    };
  }> = [];

  byLine.forEach((lineAlerts, lineNumber) => {
    const highest = getHighestSeverity(lineAlerts);
    const severityClass = {
      critical: 'security-gutter-critical',
      high: 'security-gutter-high',
      medium: 'security-gutter-medium',
      low: 'security-gutter-low',
      info: 'security-gutter-info',
    }[highest];

    const lineClass = {
      critical: 'security-line-critical',
      high: 'security-line-high',
      medium: 'security-line-medium',
      low: 'security-line-low',
      info: 'security-line-info',
    }[highest];

    const hoverMessage = lineAlerts.map((a) => `🛡️ ${a.severity.toUpperCase()}: ${a.message}`).join('\n\n');

    decorations.push({
      range: {
        startLineNumber: lineNumber,
        endLineNumber: lineNumber,
        startColumn: 1,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className: lineClass,
        glyphMarginClassName: severityClass,
        glyphMarginHoverMessage: { value: hoverMessage },
      },
    });
  });

  return decorations;
}

/**
 * CSS styles for Monaco editor decorations
 * Add these to your global CSS or inject via Monaco's defineTheme
 */
export const SECURITY_DECORATION_CSS = `
/* Security Gutter Icons */
.security-gutter-critical::before {
  content: '🔴';
  font-size: 10px;
  margin-left: 4px;
}
.security-gutter-high::before {
  content: '🟠';
  font-size: 10px;
  margin-left: 4px;
}
.security-gutter-medium::before {
  content: '🟡';
  font-size: 10px;
  margin-left: 4px;
}
.security-gutter-low::before {
  content: '🔵';
  font-size: 10px;
  margin-left: 4px;
}
.security-gutter-info::before {
  content: 'ℹ️';
  font-size: 10px;
  margin-left: 4px;
}

/* Security Line Highlights */
.security-line-critical {
  background: rgba(239, 68, 68, 0.15) !important;
  border-left: 3px solid rgba(239, 68, 68, 0.8);
}
.security-line-high {
  background: rgba(249, 115, 22, 0.15) !important;
  border-left: 3px solid rgba(249, 115, 22, 0.8);
}
.security-line-medium {
  background: rgba(245, 158, 11, 0.12) !important;
  border-left: 3px solid rgba(245, 158, 11, 0.6);
}
.security-line-low {
  background: rgba(59, 130, 246, 0.1) !important;
  border-left: 3px solid rgba(59, 130, 246, 0.5);
}
.security-line-info {
  background: rgba(100, 116, 139, 0.08) !important;
  border-left: 3px solid rgba(100, 116, 139, 0.4);
}
`;

export default SecurityInlineBadge;
