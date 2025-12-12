// desktop/src/components/CodeEditorPane.tsx
// Phase 124.6.1: Added auto code review on save
// Phase 133.1: Added Test Status Badge in editor header
// Phase 133.2: Added Generate Tests button
// Phase 136.3: Added Security Inline Badges in editor gutter
import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { EditorSelection } from '../types/editor';
import { useSelectionTracking } from '../hooks/useSelectionTracking';
import type { OpenFile, DirtyFilesMap } from '../App';
import { EditorTabs } from './EditorTabs';
// Phase 124.6.1: Code Review imports
import { useCodeReview } from '../hooks/useCodeReview';
import { useFileIssues, useEditorIssues } from '../state/editorIssuesContext';
import { EditorDiagnosticsOverlay, DiagnosticsSummaryStrip } from './editor/EditorDiagnosticsOverlay';
import type { F0Issue } from '../lib/types/issues';
// Phase 127.2: Live Alerts while typing
import { useLiveFileAlerts } from '../hooks/useLiveFileAlerts';
import { LiveAlertsPill } from './LiveAlertsPill';
// Phase 133.1: Test Status Badge
import { useFileTestStatus } from '../state/testLabContext';
import { TestStatusBadge } from './tests/TestStatusBadge';
// Phase 136.3: Security Inline Badges
import { useDeployQuality } from '../state/deployQualityContext';
import { getSecurityLineDecorations } from './security/SecurityInlineBadge';
import { buildSecurityPrompt } from '../lib/security/securityRecipes';
import type { SecurityAlert } from '../lib/security/securityEngine';

type Props = {
  filePath: string | null;
  content: string;
  onChange: (next: string) => void;
  onSave: () => void;
  isDirty: boolean;
  isLoading: boolean;
  /** Phase 109.5: Selection state */
  selection: EditorSelection | null;
  updateSelection: (start: number, end: number) => void;
  /** Phase 113.1: Locale for bilingual support */
  locale?: 'ar' | 'en';
  /** Phase 113.2: Notify parent when file dirty state changes */
  onDirtyChange?: (filePath: string, isDirty: boolean) => void;
  /** Phase 113.5: Open files for tabs */
  openFiles?: OpenFile[];
  /** Phase 113.5: Currently active file path */
  activeFilePath?: string | null;
  /** Phase 113.5: Activate a tab */
  onActivateFile?: (path: string) => void;
  /** Phase 113.5: Close a tab */
  onCloseFile?: (path: string) => void;
  /** Phase 113.5: Dirty files map for tab indicators */
  dirtyFiles?: DirtyFilesMap;
  /** Phase 124.6.1: Callback when user wants to fix an issue */
  onFixIssue?: (issue: F0Issue) => void;
  /** Phase 124.6.1: Callback when user wants explanation for an issue */
  onExplainIssue?: (issue: F0Issue) => void;
  /** Phase 124.7: Callback when user wants to fix all auto-fixable issues */
  onFixAllAuto?: (issues: F0Issue[]) => void;
  /** Phase 124.6.1: Enable auto code review on save */
  enableAutoReview?: boolean;
  /** Phase 133.2: Callback to generate tests for current file */
  onGenerateTests?: (filePath: string, content: string) => void;
  /** Phase 136.3: Callback when user wants to fix security issues */
  onSecurityFix?: (prompt: string) => void;
};

/**
 * Get Monaco language from file extension
 */
function getLanguageFromPath(filePath: string | null): string {
  if (!filePath) return 'plaintext';

  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    sql: 'sql',
    graphql: 'graphql',
    vue: 'vue',
    svelte: 'svelte',
  };

  return languageMap[ext] || 'plaintext';
}

export const CodeEditorPane: React.FC<Props> = ({
  filePath,
  content,
  onChange,
  onSave,
  isDirty,
  isLoading,
  selection,
  updateSelection,
  locale = 'en',
  onDirtyChange,
  openFiles = [],
  activeFilePath,
  onActivateFile,
  onCloseFile,
  dirtyFiles = {},
  onFixIssue,
  onExplainIssue,
  onFixAllAuto,
  enableAutoReview = true,
  onGenerateTests,
  onSecurityFix,
}) => {
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : null;
  const language = useMemo(() => getLanguageFromPath(filePath), [filePath]);

  // Phase 124.6.1: Code review integration
  // Note: Requires EditorIssuesProvider to be present in the tree
  const codeReviewResult = useCodeReview({ filePath: filePath || '' });
  const { runCodeReview, loading: reviewLoading, clearIssues } = codeReviewResult;

  // Phase 124.6.1: Get issues for current file and setFileIssues for dismissing
  const fileIssues = useFileIssues(filePath || '');
  const { setFileIssues } = useEditorIssues();

  // Phase 127.2: Live Alerts - detect patterns while typing
  const liveAlertsSummary = useLiveFileAlerts(content, filePath);

  // Phase 133.1: Get test status for current file
  const testStatus = useFileTestStatus(filePath || '');

  // Phase 136.3: Get security alerts from deploy quality context
  const { securityAlerts } = useDeployQuality();

  // Phase 136.3: Filter security alerts for current file
  const fileSecurityAlerts = useMemo(() => {
    if (!filePath || !securityAlerts) return [];
    return securityAlerts.filter((a) => a.filePath === filePath || a.filePath.endsWith(filePath));
  }, [filePath, securityAlerts]);

  // Phase 136.3: Monaco editor ref for applying decorations
  const monacoEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);

  // Phase 133.2: Check if this file can have tests generated
  // Phase 136.5: Simplified - always show for source files without tests
  const canGenerateTests = useMemo(() => {
    if (!filePath || !content || !onGenerateTests) return false;
    // Only for source files (not test files, not config files)
    const isSourceFile = /\.(tsx|ts|js|jsx)$/.test(filePath);
    const isTestFile = /\.(test|spec)\.(tsx|ts|js|jsx)$/.test(filePath);
    const isConfigFile = /(config|\.d\.ts|types)/.test(filePath);
    // Show banner for source files that aren't test files or config files
    // Also hide if tests are already passing
    return isSourceFile && !isTestFile && !isConfigFile && testStatus !== 'passed';
  }, [filePath, content, onGenerateTests, testStatus]);

  // Phase 133.2: Handle generate tests click
  const handleGenerateTests = useCallback(() => {
    if (filePath && content && onGenerateTests) {
      onGenerateTests(filePath, content);
    }
  }, [filePath, content, onGenerateTests]);

  // Phase 136.3: Handle security fix request
  const handleSecurityFix = useCallback(
    (alerts: SecurityAlert[]) => {
      if (!onSecurityFix || !filePath) return;
      const prompt = buildSecurityPrompt('FIX_FILE_VULNS', locale as 'ar' | 'en', {
        filePath,
        alerts,
      });
      onSecurityFix(prompt);
    },
    [onSecurityFix, filePath, locale]
  );

  // Phase 136.3: Apply security decorations when alerts change
  useEffect(() => {
    const editor = monacoEditorRef.current;
    if (!editor || !filePath) return;

    // Get decorations from security alerts
    const decorations = getSecurityLineDecorations(fileSecurityAlerts, filePath);

    // Apply decorations to Monaco editor
    // Monaco accepts plain objects with range properties - no need to create Range instances
    const monacoDecorations: Monaco.editor.IModelDeltaDecoration[] = decorations.map((d) => ({
      range: {
        startLineNumber: d.range.startLineNumber,
        startColumn: d.range.startColumn,
        endLineNumber: d.range.endLineNumber,
        endColumn: d.range.endColumn,
      },
      options: d.options,
    }));

    // Update decorations (deltaDecorations replaces old with new)
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      monacoDecorations
    );

    console.log('[CodeEditorPane] Applied security decorations:', {
      file: filePath,
      alertCount: fileSecurityAlerts.length,
      decorationCount: monacoDecorations.length,
    });
  }, [fileSecurityAlerts, filePath]);

  // Phase 124.6.1: Track content for auto-review after save
  const lastSavedContentRef = useRef<string | null>(null);

  // Phase 124.6.1: Handle save with auto code review
  const handleSaveWithReview = useCallback(() => {
    // 1) Regular save
    onSave();

    // 2) Auto review after save (if enabled)
    if (enableAutoReview && filePath && content) {
      void runCodeReview({
        before: lastSavedContentRef.current,
        after: content,
      });
      lastSavedContentRef.current = content;
    }
  }, [onSave, enableAutoReview, filePath, content, runCodeReview]);

  // Phase 113.2: Track previous dirty state to detect changes
  const prevDirtyRef = useRef<boolean>(isDirty);

  // Phase 113.2: Notify parent when dirty state changes
  useEffect(() => {
    if (filePath && onDirtyChange && prevDirtyRef.current !== isDirty) {
      onDirtyChange(filePath, isDirty);
    }
    prevDirtyRef.current = isDirty;
  }, [isDirty, filePath, onDirtyChange]);

  // Phase 113.1: Bilingual labels
  const isArabic = locale === 'ar';

  // Phase 113.3: Complete bilingual labels
  const labels = {
    title: isArabic ? 'المحرر' : 'EDITOR',
    noFileSelected: isArabic ? 'لم يتم اختيار ملف.' : 'No file selected.',
    selectFileHint: isArabic ? 'اختر ملفاً من اليسار للبدء في التحرير.' : 'Choose a file from the left to start editing.',
    loadingEditor: isArabic ? 'جاري تحميل المحرر...' : 'Loading editor...',
    selection: isArabic ? 'التحديد' : 'Selection',
    chars: isArabic ? 'حرف' : 'chars',
    saveTooltip: isArabic ? 'Cmd/Ctrl + S للحفظ السريع' : 'Cmd/Ctrl + S to save',
  };

  const statusLabel = isDirty
    ? (isArabic ? 'غير محفوظ' : 'Unsaved')
    : (isArabic ? 'محفوظ' : 'Saved');
  const saveButtonLabel = isLoading
    ? (isArabic ? 'جاري الحفظ...' : 'Saving...')
    : isDirty
      ? (isArabic ? 'حفظ' : 'Save')
      : (isArabic ? 'محفوظ' : 'Saved');

  /**
   * Phase 109.5.1: Handle selection changes from Monaco
   */
  const handleSelectionChange = useCallback(
    (sel: EditorSelection | null) => {
      if (sel) {
        updateSelection(sel.startOffset, sel.endOffset);
      }
    },
    [updateSelection]
  );

  const { handleEditorDidMount } = useSelectionTracking({
    filePath,
    content,
    onSelectionChange: handleSelectionChange,
  });

  /**
   * Handle Monaco editor mount
   */
  const onEditorMount: OnMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      // Phase 136.3: Store editor reference for security decorations
      monacoEditorRef.current = editor;

      // Setup keyboard shortcuts - Phase 124.6.1: Use handleSaveWithReview for auto review
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        handleSaveWithReview();
      });

      // Call the selection tracking mount handler
      handleEditorDidMount(editor, monaco);
    },
    [handleSaveWithReview, handleEditorDidMount]
  );

  /**
   * Handle content changes
   */
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        onChange(value);
      }
    },
    [onChange]
  );

  return (
    <div className="pane code-editor-pane">
      <h2 className="pane-title">{labels.title}</h2>

      {/* Phase 114.2: Editor Tabs Bar */}
      {onActivateFile && onCloseFile && (
        <EditorTabs
          openFiles={openFiles}
          activeFilePath={activeFilePath ?? null}
          dirtyFiles={dirtyFiles}
          locale={locale}
          onActivateFile={onActivateFile}
          onCloseFile={onCloseFile}
        />
      )}

      {filePath ? (
        <div className="f0-editor-wrapper">
          <div className="f0-editor-header">
            <div className="f0-editor-file">
              <span className="f0-editor-file-name">{fileName}</span>
              {/* Phase 133.1: Test Status Badge */}
              {testStatus && (
                <TestStatusBadge status={testStatus} size="sm" locale={locale} />
              )}
              {/* Phase 136.3: Security Alerts Badge */}
              {fileSecurityAlerts.length > 0 && (
                <button
                  onClick={() => handleSecurityFix(fileSecurityAlerts)}
                  className="ml-2 rounded-full bg-red-900/40 border border-red-500/40 px-2.5 py-0.5 text-[10px] font-medium text-red-300 hover:bg-red-800/50 hover:text-red-200 transition-colors flex items-center gap-1"
                  title={isArabic ? `${fileSecurityAlerts.length} مشكلة أمنية - اضغط للإصلاح` : `${fileSecurityAlerts.length} security issues - Click to fix`}
                >
                  <span>🛡️</span>
                  <span>{fileSecurityAlerts.length}</span>
                  {onSecurityFix && <span className="text-[9px]">{isArabic ? 'إصلاح' : 'Fix'}</span>}
                </button>
              )}
              <span className="f0-editor-file-path">{filePath}</span>
            </div>
            {/* Phase 113.1: Status indicator */}
            <div className="f0-editor-status">
              <span
                className={
                  'f0-editor-status-dot' + (isDirty ? ' f0-editor-status-dot-dirty' : '')
                }
              />
              <span className="f0-editor-status-file">{fileName}</span>
              <span className="f0-editor-status-sep">•</span>
              <span className="f0-editor-status-label">{statusLabel}</span>
            </div>
            <div className="f0-editor-actions">
              {/* Phase 127.2: Live Alerts Pill */}
              <LiveAlertsPill summary={liveAlertsSummary} locale={locale} />
              {/* Phase 124.6.1: Show review loading indicator */}
              {reviewLoading && (
                <span className="f0-editor-review-indicator">🔍</span>
              )}
              <button
                className="f0-btn f0-btn-primary"
                onClick={handleSaveWithReview}
                disabled={!isDirty || isLoading}
                title={labels.saveTooltip}
              >
                {saveButtonLabel}
              </button>
            </div>
          </div>

          {/* Phase 109.5.1: Selection indicator */}
          {selection && selection.selectedText.length > 0 && (
            <div className="f0-editor-selection-indicator">
              <span className="f0-editor-selection-icon">&#x2630;</span>
              <span className="f0-editor-selection-text">
                {labels.selection}: {selection.selectedText.slice(0, 40)}
                {selection.selectedText.length > 40 ? '...' : ''}
              </span>
              <span className="f0-editor-selection-length">
                ({selection.selectedText.length} {labels.chars})
              </span>
            </div>
          )}

          {/* Phase 124.6.1: Diagnostics Summary Strip */}
          {/* Phase 124.7: Added onFixAllAuto for batch fix */}
          {fileIssues.length > 0 && (
            <DiagnosticsSummaryStrip
              issues={fileIssues}
              onClearAll={clearIssues}
              onFixAllAuto={onFixAllAuto ? () => onFixAllAuto(fileIssues) : undefined}
              locale={locale}
            />
          )}

          {/* Phase 136.5: Generate Tests Banner - shown when file has no tests */}
          {canGenerateTests && (
            <div className="f0-generate-tests-banner">
              <div className="f0-generate-tests-content">
                <span className="f0-generate-tests-icon">🧪</span>
                <span className="f0-generate-tests-text">
                  {isArabic
                    ? 'هذا الملف لا يحتوي على اختبارات'
                    : 'This file has no tests'}
                </span>
              </div>
              <button
                onClick={handleGenerateTests}
                className="f0-generate-tests-btn"
              >
                {isArabic ? 'توليد اختبارات' : 'Generate Tests'}
              </button>
            </div>
          )}

          <div className="f0-editor-body f0-monaco-container">
            <Editor
              height="100%"
              language={language}
              value={content}
              onChange={handleEditorChange}
              onMount={onEditorMount}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                bracketPairColorization: { enabled: true },
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                formatOnPaste: true,
                formatOnType: true,
              }}
              loading={
                <div className="f0-editor-loading">
                  <span>{labels.loadingEditor}</span>
                </div>
              }
            />

            {/* Phase 124.6.1: Diagnostics Overlay */}
            {fileIssues.length > 0 && (
              <EditorDiagnosticsOverlay
                issues={fileIssues}
                lineHeight={20}
                onFixIssue={onFixIssue}
                onExplainIssue={onExplainIssue}
                onDismissIssue={(issue) => {
                  // Remove this issue from the list
                  if (filePath) {
                    const filtered = fileIssues.filter((i) => i.id !== issue.id);
                    setFileIssues(filePath, filtered);
                  }
                }}
                locale={locale}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="pane-content">
          <p className="empty-state">{labels.noFileSelected}</p>
          <p className="empty-state-hint">{labels.selectFileHint}</p>
        </div>
      )}
    </div>
  );
};

export default CodeEditorPane;
