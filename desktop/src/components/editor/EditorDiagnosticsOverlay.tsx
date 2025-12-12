// desktop/src/components/editor/EditorDiagnosticsOverlay.tsx
// Phase 124.6: Editor Diagnostics Overlay for Code Issues

import React, { useState, useCallback } from 'react';
import type { F0Issue } from '../../lib/types/issues';
import { getSeverityIcon, getCategoryIcon } from '../../lib/types/issues';

interface Props {
  /** List of issues to display */
  issues: F0Issue[];
  /** Line height in pixels (for positioning) */
  lineHeight?: number;
  /** Callback when user wants to fix an issue */
  onFixIssue?: (issue: F0Issue) => void;
  /** Callback when user wants explanation */
  onExplainIssue?: (issue: F0Issue) => void;
  /** Callback when user dismisses an issue */
  onDismissIssue?: (issue: F0Issue) => void;
  /** Locale for labels */
  locale?: 'ar' | 'en';
}

/**
 * Overlay component that displays code review issues inline with the editor
 */
export const EditorDiagnosticsOverlay: React.FC<Props> = ({
  issues,
  lineHeight = 20,
  onFixIssue,
  onExplainIssue,
  onDismissIssue,
  locale = 'ar',
}) => {
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const isArabic = locale === 'ar';

  const labels = {
    fix: isArabic ? 'إصلاح' : 'Fix',
    explain: isArabic ? 'شرح' : 'Explain',
    dismiss: isArabic ? 'تجاهل' : 'Dismiss',
    line: isArabic ? 'سطر' : 'Line',
  };

  const handleMarkerClick = useCallback((issueId: string) => {
    setExpandedIssue((prev) => (prev === issueId ? null : issueId));
  }, []);

  if (!issues.length) return null;

  return (
    <div className="f0-diagnostics-overlay">
      {issues.map((issue) => {
        const top = (issue.lineStart - 1) * lineHeight;
        const isExpanded = expandedIssue === issue.id;
        const severityClass =
          issue.severity === 'error'
            ? 'f0-marker-error'
            : issue.severity === 'warning'
            ? 'f0-marker-warning'
            : 'f0-marker-info';

        return (
          <div
            key={issue.id}
            className="f0-diagnostic-row"
            style={{ top }}
          >
            {/* Gutter marker */}
            <button
              type="button"
              className={`f0-diagnostic-marker ${severityClass}`}
              onClick={() => handleMarkerClick(issue.id)}
              title={issue.message}
            >
              <span className="f0-marker-dot" />
            </button>

            {/* Expanded tooltip/card */}
            {isExpanded && (
              <div className="f0-diagnostic-card">
                <div className="f0-diagnostic-card-header">
                  <span className="f0-diagnostic-icons">
                    {getSeverityIcon(issue.severity)}
                    {getCategoryIcon(issue.category)}
                  </span>
                  <span className="f0-diagnostic-category">
                    {issue.category.toUpperCase()}
                  </span>
                  <span className="f0-diagnostic-line">
                    {labels.line} {issue.lineStart}
                    {issue.lineEnd > issue.lineStart && `-${issue.lineEnd}`}
                  </span>
                </div>

                <div className="f0-diagnostic-message">
                  {issue.message}
                </div>

                {issue.suggestedFix && (
                  <div className="f0-diagnostic-suggestion">
                    <code>{issue.suggestedFix}</code>
                  </div>
                )}

                <div className="f0-diagnostic-actions">
                  {onExplainIssue && (
                    <button
                      type="button"
                      className="f0-diagnostic-btn f0-btn-explain"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExplainIssue(issue);
                      }}
                    >
                      💡 {labels.explain}
                    </button>
                  )}
                  {onFixIssue && (
                    <button
                      type="button"
                      className="f0-diagnostic-btn f0-btn-fix"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFixIssue(issue);
                      }}
                    >
                      🔧 {labels.fix}
                    </button>
                  )}
                  {onDismissIssue && (
                    <button
                      type="button"
                      className="f0-diagnostic-btn f0-btn-dismiss"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissIssue(issue);
                        setExpandedIssue(null);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Summary strip showing issue counts by severity
 * Phase 124.7: Added onFixAllAuto for batch fix
 */
export const DiagnosticsSummaryStrip: React.FC<{
  issues: F0Issue[];
  onClearAll?: () => void;
  onFixAllAuto?: () => void;
  locale?: 'ar' | 'en';
}> = ({ issues, onClearAll, onFixAllAuto, locale = 'ar' }) => {
  const isArabic = locale === 'ar';

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;
  // Phase 124.7.3: Count auto-fixable issues (non-security, non-syntax-error, non-duplicate-key)
  const autoFixableCount = issues.filter((i) =>
    i.category !== 'security' &&
    !i.message.includes('JSON Syntax Error') &&
    !i.message.includes('Duplicate key')
  ).length;

  if (!issues.length) return null;

  return (
    <div className="f0-diagnostics-strip">
      <div className="f0-diagnostics-counts">
        {errorCount > 0 && (
          <span className="f0-count-error">
            🔴 {errorCount} {isArabic ? 'خطأ' : 'errors'}
          </span>
        )}
        {warningCount > 0 && (
          <span className="f0-count-warning">
            🟡 {warningCount} {isArabic ? 'تحذير' : 'warnings'}
          </span>
        )}
        {infoCount > 0 && (
          <span className="f0-count-info">
            🔵 {infoCount} {isArabic ? 'معلومة' : 'info'}
          </span>
        )}
      </div>
      <div className="f0-diagnostics-actions">
        {/* Phase 124.7: Fix All Auto button */}
        {onFixAllAuto && autoFixableCount > 0 && (
          <button
            type="button"
            className="f0-diagnostics-fixall"
            onClick={onFixAllAuto}
            title={isArabic ? `إصلاح ${autoFixableCount} مشكلة تلقائياً` : `Fix ${autoFixableCount} issues automatically`}
          >
            🔧 {isArabic ? 'إصلاح الكل (تلقائي)' : 'Fix all (auto)'}
          </button>
        )}
        {onClearAll && (
          <button
            type="button"
            className="f0-diagnostics-clear"
            onClick={onClearAll}
          >
            {isArabic ? 'مسح الكل' : 'Clear all'}
          </button>
        )}
      </div>
    </div>
  );
};

export default EditorDiagnosticsOverlay;
