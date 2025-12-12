// desktop/src/components/panels/AutoFixResultPanel.tsx
// Phase 144.2.1 – Auto-Fix Result Panel UI
// Phase 144.3 – Enhanced grouping and skip reason display

import React, { useMemo, useState } from 'react';
import type {
  AutoFixResult,
  AutoFixIssueError,
  AutoFixSkipReason,
} from '../../autoFix/autoFixTypes';
import { getSkipReasonLabel } from '../../autoFix/autoFixTypes';
import './AutoFixResultPanel.css';

// ============================================
// Types
// ============================================

type GroupedErrors = {
  key: string;
  ruleId?: string;
  reason: AutoFixSkipReason;
  count: number;
  sampleFile?: string;
  issues: AutoFixIssueError[];
};

interface AutoFixResultPanelProps {
  result: AutoFixResult | null;
  onClose: () => void;
  onRollback?: () => Promise<void>;
  onFocusFile?: (filePath: string) => void;
  onStartAceCleanup?: (options: {
    filePath: string;
    ruleId?: string;
    reason: AutoFixSkipReason;
  }) => void;
  locale?: 'ar' | 'en';
}

// ============================================
// Helper Functions
// ============================================

function groupErrors(errors: AutoFixIssueError[]): GroupedErrors[] {
  const map = new Map<string, GroupedErrors>();

  for (const err of errors) {
    const ruleId = err.ruleId ?? 'Unknown rule';
    const key = `${err.reason}:${ruleId}`;

    let group = map.get(key);
    if (!group) {
      group = {
        key,
        ruleId: err.ruleId,
        reason: err.reason,
        count: 0,
        sampleFile: err.filePath,
        issues: [],
      };
      map.set(key, group);
    }

    group.count++;
    group.issues.push(err);
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function getReasonColor(reason: AutoFixSkipReason): string {
  switch (reason) {
    case 'NO_FIXER':
      return 'var(--f0-warning, #f59e0b)';
    case 'OUT_OF_SCOPE':
      return 'var(--f0-muted, #6b7280)';
    case 'FIXER_ERROR':
      return 'var(--f0-error, #ef4444)';
    case 'SECURITY':
      return 'var(--f0-purple, #8b5cf6)';
    case 'FILE_NOT_FOUND':
      return 'var(--f0-muted, #6b7280)';
    // Phase 144.5: New skip reasons
    case 'PATCH_NO_CONTENT':
      return 'var(--f0-info, #3b82f6)';
    case 'BEFORE_MISMATCH':
      return 'var(--f0-warning, #f59e0b)';
    default:
      return 'var(--f0-muted, #6b7280)';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ============================================
// Component
// ============================================

export const AutoFixResultPanel: React.FC<AutoFixResultPanelProps> = ({
  result,
  onClose,
  onRollback,
  onFocusFile,
  onStartAceCleanup,
  locale = 'en',
}) => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const isArabic = locale === 'ar';

  const labels = {
    title: isArabic ? 'نتائج الإصلاح التلقائي' : 'Auto-Fix Results',
    close: isArabic ? 'إغلاق' : 'Close',
    rollback: isArabic ? 'تراجع' : 'Rollback',
    rollingBack: isArabic ? 'جاري التراجع...' : 'Rolling back...',
    summary: isArabic ? 'الملخص' : 'Summary',
    fixedIssues: isArabic ? 'المشاكل المصلّحة' : 'Fixed Issues',
    fixedFiles: isArabic ? 'الملفات المُعدَّلة' : 'Fixed Files',
    unfixableIssues: isArabic ? 'مشاكل غير قابلة للإصلاح (قيود البيتا)' : 'Unfixable Issues (Beta Limitations)',
    openFile: isArabic ? 'فتح الملف' : 'Open File',
    useAce: isArabic ? 'استخدم ACE' : 'Use ACE',
    noResults: isArabic ? 'لا توجد نتائج' : 'No results',
    duration: isArabic ? 'المدة' : 'Duration',
    betaNote: isArabic
      ? 'الإصلاح التلقائي (بيتا) يمكنه إصلاح بعض أنواع المشاكل فقط. المشاكل المتبقية تحتاج ACE أو مراجعة يدوية.'
      : 'Auto-Fix (Beta) can safely fix only some issue types. The remaining issues need ACE Guided Cleanup or manual review.',
    issues: isArabic ? 'مشكلة' : 'issues',
    files: isArabic ? 'ملفات' : 'files',
    outOfScope: isArabic ? 'خارج النطاق' : 'Out of Scope',
    noFixer: isArabic ? 'بدون إصلاح' : 'No Fixer',
    errors: isArabic ? 'أخطاء' : 'Errors',
    // Phase 144.5: New labels for patch-related skip reasons
    noContent: isArabic ? 'غير محمّل' : 'Not Loaded',
    mismatch: isArabic ? 'تغيّر' : 'Changed',
    noBackup: isArabic ? 'لا توجد نسخة احتياطية' : 'No backup available',
  };

  const groupedErrors = useMemo(() => {
    if (!result?.errors) return [];
    return groupErrors(result.errors);
  }, [result?.errors]);

  const outOfScopeCount = useMemo(() => {
    return groupedErrors
      .filter((g) => g.reason === 'OUT_OF_SCOPE')
      .reduce((sum, g) => sum + g.count, 0);
  }, [groupedErrors]);

  const noFixerCount = useMemo(() => {
    return groupedErrors
      .filter((g) => g.reason === 'NO_FIXER')
      .reduce((sum, g) => sum + g.count, 0);
  }, [groupedErrors]);

  const fixerErrorCount = useMemo(() => {
    return groupedErrors
      .filter((g) => g.reason === 'FIXER_ERROR')
      .reduce((sum, g) => sum + g.count, 0);
  }, [groupedErrors]);

  // Phase 144.5: New skip reason counters
  const noContentCount = useMemo(() => {
    return groupedErrors
      .filter((g) => g.reason === 'PATCH_NO_CONTENT')
      .reduce((sum, g) => sum + g.count, 0);
  }, [groupedErrors]);

  const mismatchCount = useMemo(() => {
    return groupedErrors
      .filter((g) => g.reason === 'BEFORE_MISMATCH')
      .reduce((sum, g) => sum + g.count, 0);
  }, [groupedErrors]);

  const handleRollback = async () => {
    if (!onRollback) return;
    setIsRollingBack(true);
    try {
      await onRollback();
    } finally {
      setIsRollingBack(false);
    }
  };

  if (!result) {
    return (
      <div className="f0-autofix-result-panel" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="f0-afr-header">
          <h3>{labels.title}</h3>
          <button onClick={onClose} className="f0-afr-close-btn">
            {labels.close}
          </button>
        </div>
        <div className="f0-afr-empty">{labels.noResults}</div>
      </div>
    );
  }

  const fixedCount = result.fixedIssueIds.length;
  const patchedFilesCount = result.patches.length;
  const totalErrors = result.errors.length;
  const duration = result.stats?.durationMs ?? 0;

  return (
    <div className="f0-autofix-result-panel" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="f0-afr-header">
        <h3>{labels.title}</h3>
        <div className="f0-afr-header-actions">
          {onRollback && patchedFilesCount > 0 && (
            <button
              onClick={handleRollback}
              className="f0-afr-rollback-btn"
              disabled={isRollingBack}
            >
              {isRollingBack ? labels.rollingBack : labels.rollback}
            </button>
          )}
          <button onClick={onClose} className="f0-afr-close-btn">
            {labels.close}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="f0-afr-summary">
        <div className="f0-afr-stat f0-afr-stat-success">
          <span className="f0-afr-stat-value">{fixedCount}</span>
          <span className="f0-afr-stat-label">{labels.fixedIssues}</span>
        </div>
        <div className="f0-afr-stat f0-afr-stat-files">
          <span className="f0-afr-stat-value">{patchedFilesCount}</span>
          <span className="f0-afr-stat-label">{labels.fixedFiles}</span>
        </div>
        {outOfScopeCount > 0 && (
          <div className="f0-afr-stat f0-afr-stat-muted">
            <span className="f0-afr-stat-value">{outOfScopeCount}</span>
            <span className="f0-afr-stat-label">{labels.outOfScope}</span>
          </div>
        )}
        {noFixerCount > 0 && (
          <div className="f0-afr-stat f0-afr-stat-warning">
            <span className="f0-afr-stat-value">{noFixerCount}</span>
            <span className="f0-afr-stat-label">{labels.noFixer}</span>
          </div>
        )}
        {fixerErrorCount > 0 && (
          <div className="f0-afr-stat f0-afr-stat-error">
            <span className="f0-afr-stat-value">{fixerErrorCount}</span>
            <span className="f0-afr-stat-label">{labels.errors}</span>
          </div>
        )}
        {/* Phase 144.5: New skip reason stats */}
        {noContentCount > 0 && (
          <div className="f0-afr-stat f0-afr-stat-info">
            <span className="f0-afr-stat-value">{noContentCount}</span>
            <span className="f0-afr-stat-label">{labels.noContent}</span>
          </div>
        )}
        {mismatchCount > 0 && (
          <div className="f0-afr-stat f0-afr-stat-warning">
            <span className="f0-afr-stat-value">{mismatchCount}</span>
            <span className="f0-afr-stat-label">{labels.mismatch}</span>
          </div>
        )}
        {duration > 0 && (
          <div className="f0-afr-stat f0-afr-stat-time">
            <span className="f0-afr-stat-value">{formatDuration(duration)}</span>
            <span className="f0-afr-stat-label">{labels.duration}</span>
          </div>
        )}
      </div>

      {/* Beta Note */}
      {totalErrors > 0 && (
        <div className="f0-afr-beta-note">
          <span className="f0-afr-beta-icon">ℹ️</span>
          <span>{labels.betaNote}</span>
        </div>
      )}

      {/* Fixed Files List */}
      {patchedFilesCount > 0 && (
        <div className="f0-afr-section">
          <h4 className="f0-afr-section-title">
            ✅ {labels.fixedFiles} ({patchedFilesCount})
          </h4>
          <div className="f0-afr-files-list">
            {result.patches.slice(0, 10).map((patch) => (
              <div key={patch.filePath} className="f0-afr-file-item">
                <span className="f0-afr-file-path">{patch.filePath}</span>
                {onFocusFile && (
                  <button
                    onClick={() => onFocusFile(patch.filePath)}
                    className="f0-afr-file-btn"
                  >
                    {labels.openFile}
                  </button>
                )}
              </div>
            ))}
            {patchedFilesCount > 10 && (
              <div className="f0-afr-more">
                +{patchedFilesCount - 10} {labels.files}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unfixable Issues (Grouped) */}
      {totalErrors > 0 && (
        <div className="f0-afr-section">
          <h4 className="f0-afr-section-title">
            ⚠️ {labels.unfixableIssues} ({totalErrors})
          </h4>
          <div className="f0-afr-groups">
            {groupedErrors.map((group) => (
              <div key={group.key} className="f0-afr-group">
                <div
                  className="f0-afr-group-header"
                  onClick={() =>
                    setExpandedGroup(expandedGroup === group.key ? null : group.key)
                  }
                >
                  <span className="f0-afr-group-expand">
                    {expandedGroup === group.key ? '▼' : '▶'}
                  </span>
                  <span
                    className="f0-afr-group-rule"
                    style={{
                      backgroundColor: getReasonColor(group.reason),
                    }}
                  >
                    {group.ruleId ?? 'Unknown'}
                  </span>
                  <span className="f0-afr-group-reason">
                    {getSkipReasonLabel(group.reason, locale)}
                  </span>
                  <span className="f0-afr-group-count">
                    {group.count} {labels.issues}
                  </span>
                  {onStartAceCleanup && group.sampleFile && (
                    <button
                      className="f0-afr-ace-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartAceCleanup({
                          filePath: group.sampleFile!,
                          ruleId: group.ruleId,
                          reason: group.reason,
                        });
                      }}
                    >
                      {labels.useAce}
                    </button>
                  )}
                </div>

                {expandedGroup === group.key && (
                  <div className="f0-afr-group-files">
                    {/* Group files by path and show count */}
                    {(() => {
                      const fileCount = new Map<string, number>();
                      for (const issue of group.issues) {
                        const count = fileCount.get(issue.filePath) ?? 0;
                        fileCount.set(issue.filePath, count + 1);
                      }
                      const sorted = Array.from(fileCount.entries()).sort(
                        (a, b) => b[1] - a[1]
                      );
                      return sorted.slice(0, 5).map(([filePath, count]) => (
                        <div key={filePath} className="f0-afr-group-file">
                          <span className="f0-afr-group-file-path">{filePath}</span>
                          <span className="f0-afr-group-file-count">
                            ({count} {labels.issues})
                          </span>
                          {onFocusFile && (
                            <button
                              className="f0-afr-file-btn-sm"
                              onClick={() => onFocusFile(filePath)}
                            >
                              {labels.openFile}
                            </button>
                          )}
                        </div>
                      ));
                    })()}
                    {group.issues.length > 5 && (
                      <div className="f0-afr-more-files">
                        +{new Set(group.issues.map((i) => i.filePath)).size - 5} {labels.files}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoFixResultPanel;
