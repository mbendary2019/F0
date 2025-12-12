/**
 * Phase 96.1 + 96.3: QA Status Badge Component
 *
 * Displays QA status for tasks with color-coded badge
 * Shows: not_run (gray), passed (green), failed (amber)
 *
 * Phase 96.3 additions:
 * - Score display (0-100)
 * - Expandable details section
 * - Re-run QA button with mode selector
 */

'use client';

import React, { useState, useCallback } from 'react';

type QaStatus = 'not_run' | 'passed' | 'failed';

interface QaStatusBadgeProps {
  status?: QaStatus;
  className?: string;
  lang?: 'ar' | 'en';
  showTooltip?: boolean;
  lastQaSummary?: string;
  lastQaAt?: string;
}

const QA_STATUS_CONFIG: Record<QaStatus, { label: string; labelAr: string; icon: string; className: string }> = {
  not_run: {
    label: 'QA: Not run',
    labelAr: 'QA: لم يُشغل',
    icon: '⏸️',
    className: 'bg-gray-800 text-gray-300 border border-gray-600/30',
  },
  passed: {
    label: 'QA Passed',
    labelAr: 'QA نجح',
    icon: '✅',
    className: 'bg-emerald-700/30 text-emerald-100 border border-emerald-500/30',
  },
  failed: {
    label: 'QA Issues',
    labelAr: 'QA مشاكل',
    icon: '⚠️',
    className: 'bg-amber-700/30 text-amber-100 border border-amber-500/30',
  },
};

export function QaStatusBadge({
  status,
  className = '',
  lang = 'ar',
  showTooltip = false,
  lastQaSummary,
  lastQaAt,
}: QaStatusBadgeProps) {
  const qaStatus: QaStatus = status || 'not_run';
  const config = QA_STATUS_CONFIG[qaStatus];
  const isArabic = lang === 'ar';

  const badge = (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${config.className} ${className}`}
      title={showTooltip ? lastQaSummary : undefined}
    >
      <span className="mr-1">{config.icon}</span>
      {isArabic ? config.labelAr : config.label}
    </span>
  );

  return badge;
}

// QA Mode type for re-run selector
type QaMode = 'static' | 'ai' | 'both';

/**
 * Phase 96.1 + 96.3: Detailed QA Result Card for Task Modal
 * Shows: status, summary, score, details toggle, re-run button
 */
export function QaResultCard({
  status,
  summary,
  details,
  score,
  qaAt,
  lang = 'ar',
  className = '',
  projectId,
  taskId,
  onReRunQa,
}: {
  status?: QaStatus;
  summary?: string;
  details?: string; // Phase 96.3: Detailed AI report (markdown)
  score?: number; // Phase 96.3: Overall QA score (0-100)
  qaAt?: string;
  lang?: 'ar' | 'en';
  className?: string;
  projectId?: string;
  taskId?: string;
  onReRunQa?: (mode: QaMode) => Promise<void>;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [reRunLoading, setReRunLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<QaMode>('static');

  const qaStatus: QaStatus = status || 'not_run';
  const isArabic = lang === 'ar';

  const config = QA_STATUS_CONFIG[qaStatus];

  // Handle re-run QA
  const handleReRunQa = useCallback(async () => {
    if (!onReRunQa) return;
    setReRunLoading(true);
    try {
      await onReRunQa(selectedMode);
    } catch (err) {
      console.error('Failed to re-run QA:', err);
    } finally {
      setReRunLoading(false);
    }
  }, [onReRunQa, selectedMode]);

  // Score color based on value
  const getScoreColor = (s?: number) => {
    if (s === undefined || s === null) return 'text-gray-400';
    if (s >= 90) return 'text-emerald-400';
    if (s >= 70) return 'text-green-400';
    if (s >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className={`rounded-xl border ${config.className} ${className}`}>
      {/* Header with status and score */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.icon}</span>
            <span className="font-semibold text-sm">
              {isArabic ? 'تقرير QA' : 'QA Report'}
            </span>
            <QaStatusBadge status={status} lang={lang} />
          </div>
          <div className="flex items-center gap-3">
            {/* Score Badge */}
            {score !== undefined && score !== null && (
              <div className={`flex items-center gap-1 ${getScoreColor(score)}`}>
                <span className="text-xs">{isArabic ? 'التقييم:' : 'Score:'}</span>
                <span className="font-bold">{score}/100</span>
              </div>
            )}
            {qaAt && (
              <span className="text-xs opacity-60">
                {new Date(qaAt).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <p className="text-sm whitespace-pre-wrap opacity-90 mb-2">{summary}</p>
        )}

        {/* No QA message */}
        {qaStatus === 'not_run' && !summary && (
          <p className="text-sm opacity-60">
            {isArabic ? 'لم يتم تشغيل فحص QA بعد' : 'QA check has not been run yet'}
          </p>
        )}
      </div>

      {/* Details Section (expandable) */}
      {details && (
        <div className="border-b border-white/10">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-white/5 transition-colors"
          >
            <span className="opacity-70">
              {isArabic ? 'عرض التفاصيل' : 'Show Details'}
            </span>
            <span className="opacity-50">{showDetails ? '▲' : '▼'}</span>
          </button>
          {showDetails && (
            <div className="px-3 pb-3">
              <pre className="text-xs whitespace-pre-wrap opacity-80 bg-black/30 rounded-lg p-3 max-h-60 overflow-y-auto">
                {details}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Re-run QA Section */}
      {(projectId && taskId) || onReRunQa ? (
        <div className="p-3 flex items-center gap-2 flex-wrap">
          {/* Mode Selector */}
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as QaMode)}
            className="text-xs bg-black/30 border border-white/20 rounded px-2 py-1.5 focus:outline-none focus:border-white/40"
            disabled={reRunLoading}
          >
            <option value="static">
              {isArabic ? '🔧 Static (tsc/lint)' : '🔧 Static (tsc/lint)'}
            </option>
            <option value="ai">
              {isArabic ? '🤖 AI Review' : '🤖 AI Review'}
            </option>
            <option value="both">
              {isArabic ? '🔄 Static + AI' : '🔄 Static + AI'}
            </option>
          </select>

          {/* Re-run Button */}
          <button
            onClick={handleReRunQa}
            disabled={reRunLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 rounded-lg text-xs transition-colors disabled:opacity-50"
          >
            {reRunLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                {isArabic ? 'جاري...' : 'Running...'}
              </>
            ) : (
              <>
                🔁 {isArabic ? 'إعادة فحص QA' : 'Re-run QA'}
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Compact QA indicator (just icon + color)
 */
export function QaIndicator({ status, className = '' }: { status?: QaStatus; className?: string }) {
  const qaStatus: QaStatus = status || 'not_run';

  const iconMap: Record<QaStatus, { icon: string; color: string }> = {
    not_run: { icon: '○', color: 'text-gray-400' },
    passed: { icon: '●', color: 'text-emerald-400' },
    failed: { icon: '●', color: 'text-amber-400' },
  };

  const { icon, color } = iconMap[qaStatus];

  return (
    <span className={`text-xs ${color} ${className}`} title={`QA: ${qaStatus}`}>
      {icon}
    </span>
  );
}
