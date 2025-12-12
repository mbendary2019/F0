// desktop/src/components/security/SecurityCenterPanel.tsx
// Phase 136.2: Security Center Panel - Full security alerts display with filtering
// Groups alerts by file, supports severity filtering, and AI-powered fix actions

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import { useDeployQuality } from '../../state/deployQualityContext';
import type { SecurityAlert, SecuritySeverity } from '../../lib/security/securityEngine';
import mascotImg from '../../../public/mascots/f0-mascot-login.png';

/**
 * Severity configuration with order, colors, and labels
 */
const SEVERITY_CONFIG: Record<
  SecuritySeverity,
  {
    order: number;
    color: string;
    bg: string;
    border: string;
    icon: string;
    labelEn: string;
    labelAr: string;
  }
> = {
  critical: {
    order: 0,
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    icon: '🔴',
    labelEn: 'Critical',
    labelAr: 'حرج',
  },
  high: {
    order: 1,
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/30',
    icon: '🟠',
    labelEn: 'High',
    labelAr: 'عالي',
  },
  medium: {
    order: 2,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    icon: '🟡',
    labelEn: 'Medium',
    labelAr: 'متوسط',
  },
  low: {
    order: 3,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    icon: '🔵',
    labelEn: 'Low',
    labelAr: 'منخفض',
  },
  info: {
    order: 4,
    color: 'text-slate-400',
    bg: 'bg-slate-500/20',
    border: 'border-slate-500/30',
    icon: 'ℹ️',
    labelEn: 'Info',
    labelAr: 'معلومات',
  },
};

const SEVERITY_ORDER: SecuritySeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

interface SecurityCenterPanelProps {
  /** Locale for labels */
  locale?: 'en' | 'ar';
  /** Callback when "Fix with Agent" is clicked for a file */
  onFixFile?: (filePath: string, alerts: SecurityAlert[]) => void;
  /** Callback when "Run full security fix" is clicked */
  onFixAll?: (alerts: SecurityAlert[]) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Grouped alerts by file path
 */
interface FileAlertGroup {
  filePath: string;
  alerts: SecurityAlert[];
  highestSeverity: SecuritySeverity;
}

/**
 * SecurityCenterPanel
 * Full security center with filtering, grouping, and AI fix actions
 */
export const SecurityCenterPanel: React.FC<SecurityCenterPanelProps> = ({
  locale = 'en',
  onFixFile,
  onFixAll,
  className,
}) => {
  const { securityAlerts, externalSecurityStats } = useDeployQuality();
  const [activeFilter, setActiveFilter] = useState<SecuritySeverity | 'all'>('all');
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const isRTL = locale === 'ar';

  // Count alerts by severity
  const countsBySeverity = useMemo(() => {
    const counts: Record<SecuritySeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    securityAlerts.forEach((alert) => {
      counts[alert.severity]++;
    });
    return counts;
  }, [securityAlerts]);

  // Filter alerts based on active filter
  const filteredAlerts = useMemo(() => {
    if (activeFilter === 'all') return securityAlerts;
    return securityAlerts.filter((a) => a.severity === activeFilter);
  }, [securityAlerts, activeFilter]);

  // Group alerts by file path
  const groupedByFile = useMemo(() => {
    const groups: Map<string, SecurityAlert[]> = new Map();
    filteredAlerts.forEach((alert) => {
      const existing = groups.get(alert.filePath) ?? [];
      existing.push(alert);
      groups.set(alert.filePath, existing);
    });

    // Convert to array and sort by highest severity
    const result: FileAlertGroup[] = [];
    groups.forEach((alerts, filePath) => {
      // Find highest severity in this group
      let highestSeverity: SecuritySeverity = 'info';
      let highestOrder = 4;
      alerts.forEach((a) => {
        const order = SEVERITY_CONFIG[a.severity].order;
        if (order < highestOrder) {
          highestOrder = order;
          highestSeverity = a.severity;
        }
      });
      result.push({ filePath, alerts, highestSeverity });
    });

    // Sort by highest severity first
    result.sort((a, b) => {
      return (
        SEVERITY_CONFIG[a.highestSeverity].order -
        SEVERITY_CONFIG[b.highestSeverity].order
      );
    });

    return result;
  }, [filteredAlerts]);

  // Toggle file expansion
  const toggleFile = useCallback((filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  // Handle fix file
  const handleFixFile = useCallback(
    (filePath: string, alerts: SecurityAlert[]) => {
      onFixFile?.(filePath, alerts);
    },
    [onFixFile]
  );

  // Handle fix all
  const handleFixAll = useCallback(() => {
    onFixAll?.(securityAlerts);
  }, [onFixAll, securityAlerts]);

  // Labels
  const labels = {
    title: isRTL ? 'مركز الأمان' : 'Security Center',
    noAlerts: isRTL ? 'لا توجد تنبيهات أمنية' : 'No security alerts',
    allClear: isRTL ? 'كل شيء آمن ✅' : 'All clear ✅',
    fixWithAgent: isRTL ? 'إصلاح مع Agent' : 'Fix with Agent',
    fixAll: isRTL ? 'إصلاح الكل مع Agent' : 'Fix All with Agent',
    filter: isRTL ? 'تصفية:' : 'Filter:',
    all: isRTL ? 'الكل' : 'All',
    lastScan: isRTL ? 'آخر فحص:' : 'Last scan:',
    line: isRTL ? 'سطر' : 'Line',
    alerts: isRTL ? 'تنبيهات' : 'alerts',
  };

  return (
    <div
      className={clsx(
        'flex flex-col rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl',
        className
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <h2 className="text-base font-semibold text-white">{labels.title}</h2>
          {securityAlerts.length > 0 && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
              {securityAlerts.length}
            </span>
          )}
        </div>

        {/* Global Fix Button */}
        {securityAlerts.length > 0 && onFixAll && (
          <button
            onClick={handleFixAll}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5',
              'bg-emerald-500/20 border border-emerald-500/30',
              'text-xs font-medium text-emerald-300',
              'hover:bg-emerald-500/30 transition-colors'
            )}
          >
            <img src={mascotImg} alt="AI" className="h-4 w-4 rounded-full" />
            <span>{labels.fixAll}</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 overflow-x-auto">
        <span className="text-xs text-slate-400">{labels.filter}</span>

        {/* All Button */}
        <button
          onClick={() => setActiveFilter('all')}
          className={clsx(
            'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
            activeFilter === 'all'
              ? 'bg-white/10 text-white'
              : 'text-slate-400 hover:bg-white/5'
          )}
        >
          {labels.all}
          <span className="rounded bg-white/10 px-1 text-[10px]">
            {securityAlerts.length}
          </span>
        </button>

        {/* Severity Buttons */}
        {SEVERITY_ORDER.map((severity) => {
          const config = SEVERITY_CONFIG[severity];
          const count = countsBySeverity[severity];
          if (count === 0) return null;

          return (
            <button
              key={severity}
              onClick={() => setActiveFilter(severity)}
              className={clsx(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                activeFilter === severity
                  ? `${config.bg} ${config.color}`
                  : 'text-slate-400 hover:bg-white/5'
              )}
            >
              <span>{config.icon}</span>
              <span>{isRTL ? config.labelAr : config.labelEn}</span>
              <span className="rounded bg-white/10 px-1 text-[10px]">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[400px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="text-4xl mb-2">🔒</span>
            <p className="text-sm text-slate-400">{labels.noAlerts}</p>
            <p className="text-xs text-emerald-400 mt-1">{labels.allClear}</p>
          </div>
        ) : (
          groupedByFile.map((group) => {
            const isExpanded = expandedFiles.has(group.filePath);
            const severityConfig = SEVERITY_CONFIG[group.highestSeverity];

            return (
              <div
                key={group.filePath}
                className={clsx(
                  'rounded-lg border overflow-hidden',
                  severityConfig.border,
                  severityConfig.bg
                )}
              >
                {/* File Header */}
                <button
                  onClick={() => toggleFile(group.filePath)}
                  className={clsx(
                    'flex items-center justify-between w-full px-3 py-2',
                    'hover:bg-white/5 transition-colors text-left'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={clsx(
                        'transform transition-transform',
                        isExpanded ? 'rotate-90' : ''
                      )}
                    >
                      ▶
                    </span>
                    <span className="text-xs">{severityConfig.icon}</span>
                    <span className="text-sm font-mono text-white truncate">
                      {group.filePath.split('/').pop()}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                      {group.filePath}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={clsx('text-xs', severityConfig.color)}>
                      {group.alerts.length} {labels.alerts}
                    </span>
                    {onFixFile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFixFile(group.filePath, group.alerts);
                        }}
                        className={clsx(
                          'flex items-center gap-1 rounded px-2 py-0.5',
                          'bg-emerald-500/20 border border-emerald-500/30',
                          'text-[10px] text-emerald-300',
                          'hover:bg-emerald-500/30 transition-colors'
                        )}
                      >
                        <img src={mascotImg} alt="AI" className="h-3.5 w-3.5 rounded-full" />
                        <span className="hidden sm:inline">{labels.fixWithAgent}</span>
                      </button>
                    )}
                  </div>
                </button>

                {/* Alert Details (expanded) */}
                {isExpanded && (
                  <div className="border-t border-white/5 bg-black/20">
                    {group.alerts.map((alert, idx) => {
                      const alertConfig = SEVERITY_CONFIG[alert.severity];
                      return (
                        <div
                          key={`${alert.filePath}-${alert.line}-${idx}`}
                          className={clsx(
                            'flex items-start gap-2 px-3 py-2',
                            'border-b border-white/5 last:border-b-0'
                          )}
                        >
                          <span className="text-xs mt-0.5">{alertConfig.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/90">{alert.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={clsx(
                                  'text-[10px] px-1 rounded',
                                  alertConfig.bg,
                                  alertConfig.color
                                )}
                              >
                                {isRTL ? alertConfig.labelAr : alertConfig.labelEn}
                              </span>
                              {alert.line && (
                                <span className="text-[10px] text-slate-500">
                                  {labels.line} {alert.line}
                                </span>
                              )}
                              {alert.ruleId && (
                                <span className="text-[10px] text-slate-600 font-mono">
                                  {alert.ruleId}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer with last scan info */}
      {externalSecurityStats?.lastScanAt && (
        <div className="border-t border-white/5 px-4 py-2">
          <p className="text-[10px] text-slate-500">
            {labels.lastScan}{' '}
            {new Date(externalSecurityStats.lastScanAt).toLocaleString(
              isRTL ? 'ar-EG' : 'en-US'
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default SecurityCenterPanel;
