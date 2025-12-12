// desktop/src/components/panels/ProjectIssuesPanel.tsx
// Phase 124.8: Project-Wide Issues Panel UI
// Phase 124.8.x: Added Fix Profile selector
// Phase 143.3: Added Auto-Fix (Beta) button using runAutoFix orchestrator
// Phase 144.3: Added AutoFixResultPanel integration

import React, { useState, useCallback } from 'react';
import {
  useProjectIssues,
  useFilesWithIssues,
  type FileIssuesSummary,
} from '../../state/projectIssuesContext';
// Phase 124.8.x: Import fix profiles
import { FIX_PROFILES } from '../../lib/analysis/fixProfiles';
import './ProjectIssuesPanel.css';

// Phase 124.9: Import FixFileCallback type
import type { FixFileCallback } from '../../state/projectIssuesContext';
// Phase 144.3: Import AutoFixResultPanel
import { AutoFixResultPanel } from './AutoFixResultPanel';
import type { AutoFixResult } from '../../autoFix/autoFixTypes';

interface Props {
  /** Locale for labels */
  locale?: 'ar' | 'en';
  /** Callback when user clicks on a file */
  onOpenFile?: (filePath: string) => void;
  /** Callback when user wants to fix issues in a file */
  onFixFile?: (summary: FileIssuesSummary) => Promise<void>;
  /** Phase 124.9: Callback for project-wide auto-fix */
  onAutoFixMany?: FixFileCallback;
  /** Whether to show the panel */
  visible?: boolean;
  /** Callback to close the panel */
  onClose?: () => void;
}

/**
 * Panel showing project-wide code issues
 */
export const ProjectIssuesPanel: React.FC<Props> = ({
  locale = 'ar',
  onOpenFile,
  onFixFile,
  onAutoFixMany,
  visible = true,
  onClose,
}) => {
  const {
    isScanning,
    totalIssues,
    totalErrors,
    totalWarnings,
    totalInfos,
    scannedFiles,
    scanDurationMs,
    lastScanTime,
    error,
    scanProject,
    clearProjectIssues,
    // Phase 124.8.x: Profile state
    activeProfileId,
    setActiveProfile,
    getFilteredIssues,
    // Phase 124.9: Project-wide fix state
    isFixingProject,
    fixedFilesCount,
    totalFilesToFix,
    fixProject,
    cancelProjectFix,
    // Phase 124.9.1-124.9.2: Enhanced tracking
    retriedFilesCount,
    currentlyFixingFiles,
    // Phase 143.3: Auto-Fix Orchestrator
    runAutoFix,
  } = useProjectIssues();

  const filesWithIssues = useFilesWithIssues();
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [fixingFile, setFixingFile] = useState<string | null>(null);
  // Phase 143.3: Auto-Fix running state
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  // Phase 144.3: Auto-Fix result panel state
  const [autoFixResult, setAutoFixResult] = useState<AutoFixResult | null>(null);
  const [showResultPanel, setShowResultPanel] = useState(false);

  const isArabic = locale === 'ar';

  // Phase 124.9: Get active profile label
  const activeProfile = FIX_PROFILES.find((p) => p.id === activeProfileId);
  const profileLabel = activeProfile
    ? isArabic
      ? activeProfile.labelAr
      : activeProfile.label
    : '';

  const labels = {
    title: isArabic ? 'مشاكل المشروع' : 'Project Issues',
    scan: isArabic ? 'فحص المشروع' : 'Scan Project',
    scanning: isArabic ? 'جاري الفحص...' : 'Scanning...',
    clear: isArabic ? 'مسح الكل' : 'Clear All',
    close: isArabic ? 'إغلاق' : 'Close',
    noIssues: isArabic ? 'لا توجد مشاكل' : 'No issues found',
    scannedFiles: isArabic ? 'ملفات تم فحصها' : 'files scanned',
    totalIssues: isArabic ? 'مشكلة' : 'issues',
    errors: isArabic ? 'خطأ' : 'errors',
    warnings: isArabic ? 'تحذير' : 'warnings',
    info: isArabic ? 'معلومة' : 'info',
    scanTime: isArabic ? 'وقت الفحص' : 'Scan time',
    ms: isArabic ? 'مللي ثانية' : 'ms',
    fix: isArabic ? 'إصلاح' : 'Fix',
    fixing: isArabic ? 'جاري الإصلاح...' : 'Fixing...',
    open: isArabic ? 'فتح' : 'Open',
    line: isArabic ? 'سطر' : 'Line',
    scanFirst: isArabic ? 'اضغط "فحص المشروع" للبدء' : 'Click "Scan Project" to start',
    errorPrefix: isArabic ? 'خطأ:' : 'Error:',
    profile: isArabic ? 'ملف التعريف:' : 'Profile:',
    // Phase 124.9: Fix All labels
    fixAll: isArabic ? 'إصلاح كل المشاكل الآمنة' : 'Fix all safe issues',
    fixingProject: isArabic ? 'جاري إصلاح المشروع...' : 'Fixing project...',
    cancel: isArabic ? 'إلغاء' : 'Cancel',
    progress: isArabic ? 'تم إصلاح' : 'Fixed',
    of: isArabic ? 'من' : 'of',
    files: isArabic ? 'ملفات' : 'files',
    // Phase 124.9.1-124.9.2: Enhanced labels
    retried: isArabic ? 'أعيد المحاولة' : 'retried',
    currentlyFixing: isArabic ? 'جاري إصلاح' : 'Currently fixing',
    parallel: isArabic ? 'بالتوازي' : 'in parallel',
    autoRescan: isArabic ? 'سيتم إعادة الفحص تلقائياً' : 'Will auto-rescan after',
    // Phase 143.3: Auto-Fix labels
    autoFix: isArabic ? 'إصلاح تلقائي (Beta)' : 'Auto-Fix (Beta)',
    autoFixing: isArabic ? 'جاري الإصلاح التلقائي...' : 'Auto-Fixing...',
  };

  const handleScan = useCallback(() => {
    scanProject(200);
  }, [scanProject]);

  // Phase 124.9: Handler for "Fix All" button
  const handleFixAll = useCallback(() => {
    if (!onAutoFixMany) return;
    fixProject(onAutoFixMany, 50); // Max 50 files per run
  }, [onAutoFixMany, fixProject]);

  // Phase 143.3: Handler for Auto-Fix (Beta) button
  // Phase 144.3: Enhanced to show result panel with backup/rollback support
  const handleAutoFix = useCallback(async () => {
    setIsAutoFixing(true);
    setAutoFixResult(null);
    try {
      const result = await runAutoFix({ mode: 'all', dryRun: false });
      console.log('[ProjectIssuesPanel] Auto-Fix result:', result);
      // Phase 144.3: Store result and show panel
      setAutoFixResult(result);
      setShowResultPanel(true);
    } catch (err) {
      console.error('[ProjectIssuesPanel] Auto-Fix error:', err);
    } finally {
      setIsAutoFixing(false);
    }
  }, [runAutoFix]);

  // Phase 144.3: Close result panel handler
  const handleCloseResultPanel = useCallback(() => {
    setShowResultPanel(false);
  }, []);

  // Phase 144.3: Rollback handler (using f0Desktop API)
  // Phase 144.4.5: Try nested autoFix.rollback first
  const handleRollback = useCallback(async () => {
    if (!autoFixResult?.backupSession?.backupDir) {
      console.warn('[ProjectIssuesPanel] No backup session to rollback');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).f0Desktop || (window as any).f0DesktopAPI;

    // Phase 144.4.5: Try nested autoFix.rollback first, then flat rollbackAutoFix
    const rollbackFn = api?.autoFix?.rollback || api?.rollbackAutoFix;

    if (!rollbackFn) {
      console.warn('[ProjectIssuesPanel] Rollback API not available');
      return;
    }

    try {
      const result = await rollbackFn({
        backupDir: autoFixResult.backupSession.backupDir,
      });
      console.log('[ProjectIssuesPanel] Rollback result:', result);
      if (result.success) {
        // Clear the result panel and re-scan
        setShowResultPanel(false);
        setAutoFixResult(null);
        await scanProject();
      } else if (result.errors?.length > 0) {
        console.error('[ProjectIssuesPanel] Rollback errors:', result.errors);
      }
    } catch (err) {
      console.error('[ProjectIssuesPanel] Rollback error:', err);
    }
  }, [autoFixResult?.backupSession?.backupDir, scanProject]);

  // Phase 144.3: Focus file handler
  const handleFocusFile = useCallback((filePath: string) => {
    if (onOpenFile) {
      onOpenFile(filePath);
    }
  }, [onOpenFile]);

  // Phase 124.8.x: Modified to pass filtered issues based on active profile
  const handleFixFile = useCallback(
    async (summary: FileIssuesSummary, filteredIssues: FileIssuesSummary['issues']) => {
      if (!onFixFile) return;
      setFixingFile(summary.filePath);
      try {
        // Create a modified summary with only the profile-filtered issues
        const filteredSummary: FileIssuesSummary = {
          ...summary,
          issues: filteredIssues,
          issueCount: filteredIssues.length,
          errors: filteredIssues.filter((i) => i.severity === 'error').length,
          warnings: filteredIssues.filter((i) => i.severity === 'warning').length,
          infos: filteredIssues.filter((i) => i.severity === 'info').length,
        };
        await onFixFile(filteredSummary);
      } finally {
        setFixingFile(null);
      }
    },
    [onFixFile]
  );

  const toggleExpand = useCallback((filePath: string) => {
    setExpandedFile((prev) => (prev === filePath ? null : filePath));
  }, []);

  if (!visible) return null;

  return (
    <div className="f0-project-issues-panel" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="f0-pip-header">
        <h3 className="f0-pip-title">{labels.title}</h3>
        <div className="f0-pip-actions">
          <button
            type="button"
            className="f0-pip-btn f0-pip-btn-scan"
            onClick={handleScan}
            disabled={isScanning || isFixingProject}
          >
            {isScanning ? labels.scanning : labels.scan}
          </button>
          {/* Phase 124.9: Fix All button */}
          {totalIssues > 0 && onAutoFixMany && !isFixingProject && !isAutoFixing && (
            <button
              type="button"
              className="f0-pip-btn f0-pip-btn-fix-all"
              onClick={handleFixAll}
              disabled={isScanning}
              title={`${labels.fixAll} (${profileLabel})`}
            >
              {labels.fixAll}
            </button>
          )}
          {/* Phase 143.3: Auto-Fix (Beta) button */}
          {totalIssues > 0 && !isFixingProject && (
            <button
              type="button"
              className="f0-pip-btn f0-pip-btn-auto-fix"
              onClick={handleAutoFix}
              disabled={isScanning || isAutoFixing}
            >
              {isAutoFixing ? labels.autoFixing : labels.autoFix}
            </button>
          )}
          {/* Phase 124.9: Progress display while fixing */}
          {isFixingProject && (
            <div className="f0-pip-fix-progress-container">
              <span className="f0-pip-fix-progress">
                {labels.progress} {fixedFilesCount} {labels.of} {totalFilesToFix} {labels.files}
                {retriedFilesCount > 0 && ` (${retriedFilesCount} ${labels.retried})`}
              </span>
              {currentlyFixingFiles.length > 0 && (
                <span className="f0-pip-currently-fixing">
                  {labels.currentlyFixing}: {currentlyFixingFiles.length} {labels.parallel}
                </span>
              )}
            </div>
          )}
          {/* Phase 124.9: Cancel button while fixing */}
          {isFixingProject && (
            <button
              type="button"
              className="f0-pip-btn f0-pip-btn-cancel"
              onClick={cancelProjectFix}
            >
              {labels.cancel}
            </button>
          )}
          {totalIssues > 0 && !isFixingProject && (
            <button
              type="button"
              className="f0-pip-btn f0-pip-btn-clear"
              onClick={clearProjectIssues}
              disabled={isScanning}
            >
              {labels.clear}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="f0-pip-btn f0-pip-btn-close"
              onClick={onClose}
            >
              {labels.close}
            </button>
          )}
        </div>
      </div>

      {/* Phase 124.8.x: Profile Selector */}
      <div className="f0-pip-profiles">
        <span className="f0-pip-profiles-label">{labels.profile}</span>
        <div className="f0-pip-profiles-btns">
          {FIX_PROFILES.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={`f0-pip-profile-btn ${activeProfileId === profile.id ? 'f0-pip-profile-btn-active' : ''}`}
              onClick={() => setActiveProfile(profile.id)}
              title={isArabic ? profile.descriptionAr : profile.description}
            >
              <span className="f0-pip-profile-icon">{profile.icon}</span>
              <span className="f0-pip-profile-label">
                {isArabic ? profile.labelAr : profile.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats Strip */}
      {lastScanTime && (
        <div className="f0-pip-stats">
          <span className="f0-pip-stat">
            {scannedFiles} {labels.scannedFiles}
          </span>
          <span className="f0-pip-stat f0-pip-stat-total">
            {totalIssues} {labels.totalIssues}
          </span>
          {totalErrors > 0 && (
            <span className="f0-pip-stat f0-pip-stat-error">
              {totalErrors} {labels.errors}
            </span>
          )}
          {totalWarnings > 0 && (
            <span className="f0-pip-stat f0-pip-stat-warning">
              {totalWarnings} {labels.warnings}
            </span>
          )}
          {totalInfos > 0 && (
            <span className="f0-pip-stat f0-pip-stat-info">
              {totalInfos} {labels.info}
            </span>
          )}
          {scanDurationMs && (
            <span className="f0-pip-stat f0-pip-stat-time">
              {labels.scanTime}: {scanDurationMs}{labels.ms}
            </span>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="f0-pip-error">
          {labels.errorPrefix} {error}
        </div>
      )}

      {/* Scanning Progress */}
      {isScanning && (
        <div className="f0-pip-progress">
          <div className="f0-pip-spinner" />
          <span>{labels.scanning}</span>
        </div>
      )}

      {/* File List */}
      <div className="f0-pip-files">
        {!lastScanTime && !isScanning && (
          <div className="f0-pip-empty">{labels.scanFirst}</div>
        )}

        {lastScanTime && filesWithIssues.length === 0 && !isScanning && (
          <div className="f0-pip-empty f0-pip-success">{labels.noIssues}</div>
        )}

        {filesWithIssues.map((summary) => {
          const isExpanded = expandedFile === summary.filePath;
          const isFixing = fixingFile === summary.filePath;
          // Phase 124.8.x: Use profile-filtered issues for fix count
          const filteredIssues = getFilteredIssues(summary);
          // Count auto-fixable issues (non-security, non-syntax errors) from filtered set
          const autoFixableCount = filteredIssues.filter(
            (i) =>
              i.category !== 'security' &&
              !i.message.includes('JSON Syntax Error') &&
              !i.message.includes('Duplicate key')
          ).length;

          return (
            <div
              key={summary.filePath}
              className={`f0-pip-file ${isExpanded ? 'f0-pip-file-expanded' : ''}`}
            >
              {/* File Header */}
              <div
                className="f0-pip-file-header"
                onClick={() => toggleExpand(summary.filePath)}
              >
                <span className="f0-pip-file-icon">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className="f0-pip-file-path" title={summary.filePath}>
                  {summary.relativePath}
                </span>
                <span className="f0-pip-file-counts">
                  {summary.errors > 0 && (
                    <span className="f0-pip-count f0-pip-count-error">
                      {summary.errors}
                    </span>
                  )}
                  {summary.warnings > 0 && (
                    <span className="f0-pip-count f0-pip-count-warning">
                      {summary.warnings}
                    </span>
                  )}
                  {summary.infos > 0 && (
                    <span className="f0-pip-count f0-pip-count-info">
                      {summary.infos}
                    </span>
                  )}
                </span>
                <div className="f0-pip-file-actions">
                  {onOpenFile && (
                    <button
                      type="button"
                      className="f0-pip-file-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFile(summary.filePath);
                      }}
                      title={labels.open}
                    >
                      {labels.open}
                    </button>
                  )}
                  {onFixFile && autoFixableCount > 0 && (
                    <button
                      type="button"
                      className="f0-pip-file-btn f0-pip-file-btn-fix"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Phase 124.8.x: Pass profile-filtered issues to handler
                        handleFixFile(summary, filteredIssues);
                      }}
                      disabled={isFixing}
                      title={`${labels.fix} ${autoFixableCount}`}
                    >
                      {isFixing ? labels.fixing : `${labels.fix} (${autoFixableCount})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Issues List */}
              {isExpanded && (
                <div className="f0-pip-issues">
                  {summary.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`f0-pip-issue f0-pip-issue-${issue.severity}`}
                    >
                      <span className="f0-pip-issue-icon">
                        {issue.severity === 'error'
                          ? '🔴'
                          : issue.severity === 'warning'
                          ? '🟡'
                          : '🔵'}
                      </span>
                      <span className="f0-pip-issue-line">
                        {labels.line} {issue.lineStart}
                        {issue.lineEnd > issue.lineStart && `-${issue.lineEnd}`}
                      </span>
                      <span className="f0-pip-issue-category">
                        [{issue.category}]
                      </span>
                      <span className="f0-pip-issue-message">
                        {issue.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Phase 144.3: Auto-Fix Result Panel Modal */}
      {showResultPanel && autoFixResult && (
        <div className="f0-pip-modal-overlay">
          <AutoFixResultPanel
            result={autoFixResult}
            onClose={handleCloseResultPanel}
            onRollback={autoFixResult.backupSession ? handleRollback : undefined}
            onFocusFile={handleFocusFile}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
};

export default ProjectIssuesPanel;
