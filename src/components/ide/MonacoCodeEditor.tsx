// src/components/ide/MonacoCodeEditor.tsx
// =============================================================================
// Phase 152.0 – Web Code Editor (Monaco base)
// Phase 153.0 – Selection Engine integration
// Phase 153.1 – Inline Ask ACE button
// Phase 154.0 – Issue decorations + Right-click Ask ACE
// Phase 154.7 – Hover delay enhancer
// Phase 154.8 – Issue navigation arrows
// =============================================================================
// PHASE 154 – INLINE ISSUES & INLINE ACE (WEB IDE) – LOCKED
// Any major behavioural changes require Phase >= 160.
// =============================================================================

'use client';

import Editor, { OnChange, OnMount } from '@monaco-editor/react';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { editor, IDisposable, IRange } from 'monaco-editor';
// Phase 153.0: Selection tracking
import { useSelectedRange, type SelectedRangeInfo } from '@/hooks/useSelectedRange';
// Phase 153.1: Inline ACE button
import { InlineAceButton } from './InlineAceButton';
// Phase 153.3: Inline suggestion bubble
import { InlineAceSuggestionBubble } from './InlineAceSuggestionBubble';
import type { InlineAceRequestContext, AceInlineResponse, AceInlinePatch } from '@/types/aceInline';
// Phase 154.0: File issues for decorations
import type { FileIssueForEditor } from '@/types/fileIssues';
// Re-export for consumers
export type { SelectedRangeInfo } from '@/hooks/useSelectedRange';
export type { InlineAceRequestContext, AceInlineResponse, AceInlinePatch } from '@/types/aceInline';
export type { FileIssueForEditor } from '@/types/fileIssues';

// =============================================================================
// Types
// =============================================================================
export type MonacoIssue = {
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
};

type MonacoCodeEditorProps = {
  value: string;
  language?: string | null;
  readOnly?: boolean;
  onChange?: OnChange;
  onMount?: (editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => void;
  /** Phase 152.5: Issues to display as markers */
  issues?: MonacoIssue[];
  /** Phase 153.0: Callback when selection changes */
  onSelectedRangeChange?: (info: SelectedRangeInfo | null) => void;
  /** Phase 153.1: Callback when Ask ACE button is clicked */
  onAskAce?: (ctx: InlineAceRequestContext) => void;
  /** Phase 153.1: Locale for button labels */
  locale?: 'en' | 'ar';
  /** Phase 153.3: ACE inline response for suggestion bubble */
  aceInlineResponse?: AceInlineResponse | null;
  /** Phase 153.3: Callback when Apply Fix is clicked */
  onApplyAcePatch?: (patch: AceInlinePatch) => void;
  /** Phase 153.3: Callback when Dismiss is clicked */
  onDismissAcePatch?: () => void;
  /** Phase 154.0: File path for context */
  filePath?: string | null;
  /** Phase 154.0: File issues for inline decorations */
  fileIssues?: FileIssueForEditor[];
};

// =============================================================================
// Language mapping for Monaco
// =============================================================================
const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  typescript: 'typescript',
  javascript: 'javascript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  html: 'html',
  markdown: 'markdown',
  md: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  python: 'python',
  py: 'python',
  rust: 'rust',
  go: 'go',
};

function getMonacoLanguage(lang: string | null | undefined): string {
  if (!lang) return 'typescript';
  return LANG_MAP[lang.toLowerCase()] || lang;
}

// =============================================================================
// Component
// =============================================================================
export function MonacoCodeEditor({
  value,
  language,
  readOnly = false,
  onChange,
  onMount,
  issues = [],
  onSelectedRangeChange,
  onAskAce,
  locale = 'en',
  aceInlineResponse,
  onApplyAcePatch,
  onDismissAcePatch,
  filePath,
  fileIssues = [],
}: MonacoCodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const selectionDisposableRef = useRef<IDisposable | null>(null);

  // Phase 154.0: Refs for context menu action to access latest state
  const fileIssuesRef = useRef<FileIssueForEditor[]>(fileIssues);
  const selectedRangeRef = useRef<SelectedRangeInfo | null>(null);
  const issueDecorationsRef = useRef<string[]>([]);

  // Phase 154.1: Track editor mount state for decorations
  const [isEditorMounted, setIsEditorMounted] = useState(false);

  // Phase 154.8: Issue navigation state
  const [currentIssueIndex, setCurrentIssueIndex] = useState<number | null>(null);

  // Phase 153.0: Selection tracking
  const { selectedRange, bindToEditor } = useSelectedRange();

  // Phase 153.1: Ask ACE button position
  const [aceButtonPosition, setAceButtonPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Phase 153.0: Notify parent when selection changes
  useEffect(() => {
    if (onSelectedRangeChange) {
      onSelectedRangeChange(selectedRange);
    }
    // Phase 154.0: Update ref for context menu action
    selectedRangeRef.current = selectedRange;
  }, [selectedRange, onSelectedRangeChange]);

  // Phase 154.0: Update fileIssues ref when prop changes
  useEffect(() => {
    fileIssuesRef.current = fileIssues;
  }, [fileIssues]);

  // Phase 153.1: Calculate button position based on cursor line
  useEffect(() => {
    const editorInstance = editorRef.current;

    if (!editorInstance || !selectedRange?.cursorLine) {
      setAceButtonPosition(null);
      return;
    }

    const lineNumber = selectedRange.cursorLine;
    const layout = editorInstance.getLayoutInfo();
    const topForLine = editorInstance.getTopForLineNumber(lineNumber);
    const scrollTop = editorInstance.getScrollTop();

    // Position button near the line number gutter
    const left = layout.contentLeft - 70; // Before line numbers
    const top = topForLine - scrollTop + 10; // Adjust for scroll

    // Only show if within visible area
    if (top < 0 || top > layout.height) {
      setAceButtonPosition(null);
      return;
    }

    console.log(
      '[153.1][WEB][INLINE] Ask ACE button positioned',
      `line=${lineNumber}`,
      `top=${top}`,
      `left=${left}`
    );

    setAceButtonPosition({ top, left: Math.max(8, left) });
  }, [selectedRange]);

  // Phase 153.1: Should show Ask ACE button
  const shouldShowAceButton = useMemo(() => {
    if (!onAskAce || readOnly) return false;
    if (!selectedRange) return false;
    // Show if there's selected text or cursor is on a line
    if (selectedRange.selectedText && selectedRange.selectedText.trim().length > 0) {
      return true;
    }
    return selectedRange.cursorLine !== null;
  }, [selectedRange, onAskAce, readOnly]);

  // Phase 153.1: Handle Ask ACE click
  const handleAskAceClick = useCallback(() => {
    const editorInstance = editorRef.current;
    if (!editorInstance || !onAskAce) return;

    const fullContent = editorInstance.getValue();
    const monacoLang = getMonacoLanguage(language);

    const ctx: InlineAceRequestContext = {
      selectedRange,
      fullContent,
      language: monacoLang,
    };

    console.log(
      '[153.1][WEB][INLINE] Ask ACE clicked',
      ctx.selectedRange
        ? {
            line: ctx.selectedRange.cursorLine,
            len: ctx.selectedRange.selectedText?.length ?? 0,
          }
        : 'no-selection'
    );

    onAskAce(ctx);
  }, [onAskAce, selectedRange, language]);

  // ==========================================================================
  // Phase 153.3: Suggestion Bubble positioning and handlers
  // ==========================================================================
  const inlinePatch: AceInlinePatch | null = aceInlineResponse?.patch ?? null;

  const [aceBubblePosition, setAceBubblePosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Calculate bubble position based on patch range or cursor
  useEffect(() => {
    const editorInstance = editorRef.current;

    if (!editorInstance || !inlinePatch) {
      setAceBubblePosition(null);
      return;
    }

    const layout = editorInstance.getLayoutInfo();
    const targetLine =
      inlinePatch.beforeRange?.startLine ??
      selectedRange?.cursorLine ??
      1;

    const topForLine = editorInstance.getTopForLineNumber(targetLine);
    const scrollTop = editorInstance.getScrollTop();

    const top = topForLine - scrollTop - 8; // Slightly above the line
    const left = layout.contentLeft + 180; // Right of Ask ACE button area

    // Only show if within visible area
    if (top < -50 || top > layout.height) {
      setAceBubblePosition(null);
      return;
    }

    console.log('[153.3][WEB][INLINE] Bubble positioned', {
      targetLine,
      top,
      left,
    });

    setAceBubblePosition({ top: Math.max(10, top), left });
  }, [inlinePatch, selectedRange]);

  // Handle Apply Fix click
  const handleApplyPatchClick = useCallback(() => {
    if (!inlinePatch || !onApplyAcePatch) return;

    console.log('[153.3][WEB][INLINE] Apply Fix clicked', {
      patchId: inlinePatch.id,
    });

    onApplyAcePatch(inlinePatch);
  }, [inlinePatch, onApplyAcePatch]);

  // Handle Dismiss click
  const handleDismissPatchClick = useCallback(() => {
    console.log('[153.3][WEB][INLINE] Dismiss patch clicked');
    onDismissAcePatch?.();
  }, [onDismissAcePatch]);

  // Handle mount
  const handleMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

    // Apply custom F0 theme
    defineF0Theme(monaco);
    monaco.editor.setTheme('f0-dark');

    // Apply issues as markers
    applyIssuesToEditor(editorInstance, monaco, issues);

    // Phase 153.0: Bind selection tracking
    selectionDisposableRef.current = bindToEditor(editorInstance);

    // Phase 153.1: Update button position on scroll
    editorInstance.onDidScrollChange(() => {
      if (selectedRange?.cursorLine) {
        const layout = editorInstance.getLayoutInfo();
        const topForLine = editorInstance.getTopForLineNumber(selectedRange.cursorLine);
        const scrollTop = editorInstance.getScrollTop();
        const left = layout.contentLeft - 70;
        const top = topForLine - scrollTop + 10;

        if (top < 0 || top > layout.height) {
          setAceButtonPosition(null);
        } else {
          setAceButtonPosition({ top, left: Math.max(8, left) });
        }
      }
    });

    // Phase 154.2: Add right-click "Ask ACE about this issue" action
    editorInstance.addAction({
      id: 'f0-ask-ace-issue',
      label: locale === 'ar' ? 'اسأل ACE عن هذه المشكلة' : 'Ask ACE about this issue',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed) => {
        if (!onAskAce) return;

        const pos = ed.getPosition();
        if (!pos) return;

        const line = pos.lineNumber;
        const currentIssues = fileIssuesRef.current ?? [];
        const issueOnLine = currentIssues.find((i) => i.line === line);
        const currentRange = selectedRangeRef.current;

        const rangeInfo: SelectedRangeInfo = currentRange ?? {
          cursorLine: line,
          cursorColumn: pos.column,
          selectionStartLine: line,
          selectionStartColumn: 1,
          selectionEndLine: line,
          selectionEndColumn: 1,
          selectedText: issueOnLine ? issueOnLine.message : null,
        };

        const ctx: InlineAceRequestContext = {
          selectedRange: rangeInfo,
          fullContent: ed.getValue(),
          language: getMonacoLanguage(language),
          filePath: filePath ?? undefined,
        };

        console.log('[154.2][WEB][INLINE] Ask ACE from context menu', {
          line,
          issueId: issueOnLine?.id,
          hasIssue: !!issueOnLine,
        });

        onAskAce(ctx);
      },
    });

    // Call external onMount if provided
    if (onMount) {
      onMount(editorInstance, monaco);
    }

    // Phase 154.1: Mark editor as mounted to trigger decoration effect
    setIsEditorMounted(true);

    console.log('[152.0][WEB][MONACO] Editor mounted', { language, readOnly });
  };

  // Cleanup selection listener on unmount
  useEffect(() => {
    return () => {
      if (selectionDisposableRef.current) {
        selectionDisposableRef.current.dispose();
        selectionDisposableRef.current = null;
      }
    };
  }, []);

  // Update markers when issues change
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      applyIssuesToEditor(editorRef.current, monacoRef.current, issues);
    }
  }, [issues]);

  // Phase 154.1: Apply issue decorations (glyph margin + inline badges)
  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;

    console.log('[154.1][WEB][DECORATIONS] useEffect triggered', {
      isEditorMounted,
      hasEditor: !!editorInstance,
      hasMonaco: !!monaco,
      fileIssuesCount: fileIssues?.length ?? 0,
      filePath,
    });

    // Wait for editor to be mounted
    if (!isEditorMounted) {
      console.log('[154.1][WEB][DECORATIONS] Editor not mounted yet');
      return;
    }

    if (!editorInstance || !monaco) {
      console.log('[154.1][WEB][DECORATIONS] Editor or Monaco not ready');
      return;
    }

    const model = editorInstance.getModel();
    if (!model) {
      console.log('[154.1][WEB][DECORATIONS] Model not ready');
      return;
    }

    const newDecorations: editor.IModelDeltaDecoration[] = (fileIssues ?? []).map((issue) => {
      const lineNumber = Math.max(1, issue.line || 1);
      const range: IRange = {
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: 1,
      };

      const severityClass =
        issue.severity === 'error'
          ? 'f0-issue-inline-error'
          : issue.severity === 'warning'
          ? 'f0-issue-inline-warning'
          : 'f0-issue-inline-info';

      const glyphClass =
        issue.severity === 'error'
          ? 'f0-issue-glyph-error'
          : issue.severity === 'warning'
          ? 'f0-issue-glyph-warning'
          : 'f0-issue-glyph-info';

      const label = issue.rule && issue.rule.trim().length > 0
        ? `${issue.message} (${issue.rule})`
        : issue.message;

      const hoverContent = {
        value: `**${issue.severity.toUpperCase()}**\n\n${label}`,
        isTrusted: false,
      };

      console.log('[154.1][WEB][DECORATIONS] Creating decoration', {
        line: lineNumber,
        severity: issue.severity,
        glyphClass,
        severityClass,
      });

      return {
        range,
        options: {
          isWholeLine: true,
          glyphMarginClassName: glyphClass,
          glyphMarginHoverMessage: hoverContent,
          className: severityClass,
          hoverMessage: hoverContent,
        },
      };
    });

    console.log('[154.1][WEB][DECORATIONS] Applying decorations', {
      count: newDecorations.length,
      previousCount: issueDecorationsRef.current.length,
    });

    issueDecorationsRef.current = editorInstance.deltaDecorations(
      issueDecorationsRef.current,
      newDecorations
    );

    console.log('[154.1][WEB][DECORATIONS] Decorations applied successfully', {
      decorationIds: issueDecorationsRef.current,
      filePath,
    });

    return () => {
      if (editorRef.current) {
        issueDecorationsRef.current = editorRef.current.deltaDecorations(
          issueDecorationsRef.current,
          []
        );
      }
    };
  }, [fileIssues, filePath, isEditorMounted]);

  // ==========================================================================
  // Phase 154.8: Issue navigation
  // ==========================================================================
  const sortedIssues = useMemo(
    () =>
      (fileIssues ?? [])
        .slice()
        .sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
    [fileIssues]
  );

  // Update current issue index based on cursor position
  useEffect(() => {
    if (!sortedIssues.length) {
      setCurrentIssueIndex(null);
      return;
    }

    const cursorLine = selectedRange?.cursorLine ?? null;
    if (!cursorLine) {
      setCurrentIssueIndex((prev) =>
        prev === null ? 0 : Math.min(prev, sortedIssues.length - 1)
      );
      return;
    }

    const idx = sortedIssues.findIndex((i) => i.line === cursorLine);
    setCurrentIssueIndex(idx === -1 ? 0 : idx);
  }, [sortedIssues, selectedRange?.cursorLine]);

  // Focus issue at specific index
  const focusIssueAtIndex = useCallback(
    (idx: number) => {
      const editor = editorRef.current;
      if (!editor || !sortedIssues.length) return;

      const count = sortedIssues.length;
      const normalized = ((idx % count) + count) % count; // wrap around

      const issue = sortedIssues[normalized];
      const lineNumber = issue.line || 1;

      editor.revealLineInCenter(lineNumber);
      editor.setPosition({ lineNumber, column: 1 });

      console.log('[154.8][WEB][ISSUES] Navigated to issue', {
        index: normalized + 1,
        total: count,
        line: lineNumber,
        id: issue.id,
      });

      setCurrentIssueIndex(normalized);
    },
    [sortedIssues]
  );

  const handlePrevIssue = useCallback(() => {
    if (!sortedIssues.length) return;
    const nextIndex = (currentIssueIndex ?? 0) - 1;
    focusIssueAtIndex(nextIndex);
  }, [sortedIssues.length, currentIssueIndex, focusIssueAtIndex]);

  const handleNextIssue = useCallback(() => {
    if (!sortedIssues.length) return;
    const nextIndex = (currentIssueIndex ?? -1) + 1;
    focusIssueAtIndex(nextIndex);
  }, [sortedIssues.length, currentIssueIndex, focusIssueAtIndex]);

  const monacoLang = getMonacoLanguage(language);

  return (
    <div className="h-full w-full relative">
      <Editor
        height="100%"
        defaultLanguage={monacoLang}
        language={monacoLang}
        value={value}
        onChange={onChange}
        onMount={handleMount}
        options={{
          readOnly,
          minimap: { enabled: true, scale: 0.75 },
          fontSize: 12,
          lineHeight: 18,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, Consolas, monospace",
          fontLigatures: true,
          smoothScrolling: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
          renderWhitespace: 'selection',
          renderLineHighlight: 'all',
          tabSize: 2,
          insertSpaces: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          padding: { top: 8, bottom: 8 },
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
          // Phase 154.1: Enable glyph margin for issue decorations
          glyphMargin: true,
          // Phase 154.7: Hover delay enhancer
          hover: {
            delay: 600, // ms – 0.6 seconds before showing tooltip
          },
          // Disable some features in readOnly mode
          ...(readOnly && {
            contextmenu: false,
            quickSuggestions: false,
          }),
        }}
        theme="vs-dark"
        loading={
          <div className="h-full w-full bg-[#050015] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              <span className="text-[10px] text-white/40">Loading editor...</span>
            </div>
          </div>
        }
      />

      {/* Phase 153.1: Inline Ask ACE button */}
      {shouldShowAceButton && aceButtonPosition && (
        <InlineAceButton
          top={aceButtonPosition.top}
          left={aceButtonPosition.left}
          onClick={handleAskAceClick}
          locale={locale}
        />
      )}

      {/* Phase 153.3: Inline suggestion bubble */}
      {inlinePatch && aceBubblePosition && (
        <InlineAceSuggestionBubble
          patch={inlinePatch}
          top={aceBubblePosition.top}
          left={aceBubblePosition.left}
          onApply={handleApplyPatchClick}
          onDismiss={handleDismissPatchClick}
          locale={locale}
        />
      )}

      {/* Phase 154.8: Issue navigation arrows */}
      {sortedIssues.length > 0 && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full bg-slate-950/80 border border-white/10 px-2 py-1 text-[11px] text-slate-100 shadow-md backdrop-blur">
          <span className="px-1 text-[10px] text-slate-300">
            {(currentIssueIndex ?? 0) + 1}/{sortedIssues.length}
          </span>
          <button
            type="button"
            onClick={handlePrevIssue}
            className="px-1.5 py-0.5 rounded-full hover:bg-slate-800 transition-colors"
            title={locale === 'ar' ? 'المشكلة السابقة' : 'Previous issue'}
          >
            ←
          </button>
          <button
            type="button"
            onClick={handleNextIssue}
            className="px-1.5 py-0.5 rounded-full hover:bg-slate-800 transition-colors"
            title={locale === 'ar' ? 'المشكلة التالية' : 'Next issue'}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// F0 Custom Theme
// =============================================================================
function defineF0Theme(monaco: typeof import('monaco-editor')) {
  monaco.editor.defineTheme('f0-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'C586C0' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'constant', foreground: '4FC1FF' },
    ],
    colors: {
      'editor.background': '#050015',
      'editor.foreground': '#D4D4D4',
      'editor.lineHighlightBackground': '#ffffff08',
      'editor.selectionBackground': '#6366f140',
      'editor.inactiveSelectionBackground': '#3a3d4120',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#C6C6C6',
      'editorCursor.foreground': '#a855f7',
      'editor.findMatchBackground': '#a855f740',
      'editor.findMatchHighlightBackground': '#a855f720',
      'editorIndentGuide.background': '#404040',
      'editorIndentGuide.activeBackground': '#707070',
      'editorBracketMatch.background': '#a855f730',
      'editorBracketMatch.border': '#a855f7',
      'minimap.background': '#020008',
      'scrollbar.shadow': '#00000050',
      'scrollbarSlider.background': '#ffffff15',
      'scrollbarSlider.hoverBackground': '#ffffff25',
      'scrollbarSlider.activeBackground': '#ffffff35',
    },
  });
}

// =============================================================================
// Apply Issues as Monaco Markers (Phase 152.5)
// =============================================================================
function applyIssuesToEditor(
  editor: editor.IStandaloneCodeEditor,
  monaco: typeof import('monaco-editor'),
  issues: MonacoIssue[]
) {
  const model = editor.getModel();
  if (!model) return;

  const markers = issues.map((issue) => ({
    startLineNumber: issue.line,
    startColumn: issue.column ?? 1,
    endLineNumber: issue.endLine ?? issue.line,
    endColumn: issue.endColumn ?? 200,
    message: issue.message,
    severity:
      issue.severity === 'error'
        ? monaco.MarkerSeverity.Error
        : issue.severity === 'warning'
        ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Info,
  }));

  monaco.editor.setModelMarkers(model, 'f0-issues', markers);

  if (markers.length > 0) {
    console.log('[152.5][WEB][ISSUES] Applied markers', { count: markers.length });
  }
}

export default MonacoCodeEditor;
