// src/components/ide/CodeViewer.tsx
// =============================================================================
// Phase 152 – Web Code Editor wrapper (Monaco-based)
// Replaces simple code viewer with full Monaco editor
// =============================================================================
// PHASE 154 – INLINE ISSUES & INLINE ACE (WEB IDE) – LOCKED
// Any major behavioural changes require Phase >= 160.
// =============================================================================

'use client';

import { MonacoCodeEditor, type MonacoIssue, type SelectedRangeInfo, type InlineAceRequestContext, type AceInlineResponse, type AceInlinePatch, type FileIssueForEditor } from './MonacoCodeEditor';
import { cn } from '@/lib/utils';
// Re-export for consumers
export type { SelectedRangeInfo, InlineAceRequestContext, AceInlineResponse, AceInlinePatch, FileIssueForEditor } from './MonacoCodeEditor';

// =============================================================================
// Types
// =============================================================================
type CodeViewerProps = {
  filePath?: string | null;
  content: string;
  language?: string | null;
  loading?: boolean;
  notFound?: boolean;
  readOnly?: boolean;
  locale?: 'en' | 'ar';
  /** Phase 152.1: Callback when content changes in editor */
  onChangeContent?: (value: string) => void;
  /** Phase 152.5: Issues to display as inline markers */
  issues?: MonacoIssue[];
  /** Phase 153.0: Callback when selection changes */
  onSelectedRangeChange?: (info: SelectedRangeInfo | null) => void;
  /** Phase 153.1: Callback when Ask ACE button is clicked */
  onAskAce?: (ctx: InlineAceRequestContext) => void;
  /** Phase 153.3: ACE inline response for suggestion bubble */
  aceInlineResponse?: AceInlineResponse | null;
  /** Phase 153.3: Callback when Apply Fix is clicked */
  onApplyAcePatch?: (patch: AceInlinePatch) => void;
  /** Phase 153.3: Callback when Dismiss is clicked */
  onDismissAcePatch?: () => void;
  /** Phase 154.0: File issues for inline decorations */
  fileIssues?: FileIssueForEditor[];
};

// =============================================================================
// Language display names
// =============================================================================
const LANG_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  tsx: 'TSX',
  jsx: 'JSX',
  json: 'JSON',
  css: 'CSS',
  scss: 'SCSS',
  html: 'HTML',
  markdown: 'Markdown',
  yaml: 'YAML',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  other: 'Text',
};

// Language colors for badge
const LANG_COLORS: Record<string, string> = {
  typescript: 'bg-blue-500/20 text-blue-300',
  javascript: 'bg-yellow-500/20 text-yellow-300',
  tsx: 'bg-sky-500/20 text-sky-300',
  jsx: 'bg-amber-500/20 text-amber-300',
  json: 'bg-emerald-500/20 text-emerald-300',
  css: 'bg-pink-500/20 text-pink-300',
  scss: 'bg-pink-500/20 text-pink-300',
  html: 'bg-orange-500/20 text-orange-300',
  markdown: 'bg-white/10 text-white/70',
  yaml: 'bg-red-500/20 text-red-300',
  python: 'bg-green-500/20 text-green-300',
  rust: 'bg-orange-600/20 text-orange-300',
  go: 'bg-cyan-500/20 text-cyan-300',
};

// =============================================================================
// Component
// =============================================================================
export function CodeViewer({
  filePath,
  content,
  language,
  loading,
  notFound,
  readOnly = false,
  locale = 'en',
  onChangeContent,
  issues = [],
  onSelectedRangeChange,
  onAskAce,
  aceInlineResponse,
  onApplyAcePatch,
  onDismissAcePatch,
  fileIssues = [],
}: CodeViewerProps) {
  const isArabic = locale === 'ar';

  // Loading state
  if (loading) {
    return (
      <div className="h-full w-full bg-[#050015] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-xs text-white/40">
            {isArabic ? 'جاري تحميل الملف...' : 'Loading file...'}
          </span>
        </div>
      </div>
    );
  }

  // Not found state
  if (notFound) {
    return (
      <div className="h-full w-full bg-[#050015] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <span className="text-3xl">📄</span>
          <span className="text-sm text-red-300/80">
            {isArabic
              ? 'الملف غير موجود أو لم يتم مزامنته بعد.'
              : 'File not found or not synced yet.'}
          </span>
          <span className="text-[10px] text-white/30 max-w-xs">
            {isArabic
              ? 'تأكد أن المشروع مفتوح في تطبيق Desktop.'
              : 'Make sure the project is open in the Desktop app.'}
          </span>
        </div>
      </div>
    );
  }

  // No file selected
  if (!filePath) {
    return (
      <div className="h-full w-full bg-[#050015] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <span className="text-4xl opacity-30">👈</span>
          <span className="text-sm text-white/50">
            {isArabic
              ? 'اختر ملفًا من القائمة الجانبية لعرض محتواه.'
              : 'Select a file from the sidebar to view its content.'}
          </span>
        </div>
      </div>
    );
  }

  // File info
  const fileName = filePath.split('/').pop() || filePath;
  const dirPath = filePath.split('/').slice(0, -1).join('/');
  const langLabel = language ? (LANG_LABELS[language] || language.toUpperCase()) : null;
  const langColor = language ? (LANG_COLORS[language] || 'bg-white/10 text-white/60') : '';
  const lineCount = content.split('\n').length;

  return (
    <div className="h-full w-full bg-[#050015] flex flex-col overflow-hidden">
      {/* Header - File tab */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#070019]">
        <div className="flex items-center gap-3 min-w-0">
          {/* File icon based on language */}
          <span className="text-sm opacity-60">
            {language === 'tsx' || language === 'jsx' ? '⚛️' :
             language === 'typescript' || language === 'javascript' ? '📜' :
             language === 'css' || language === 'scss' ? '🎨' :
             language === 'json' ? '📋' :
             language === 'markdown' ? '📝' : '📄'}
          </span>

          {/* File path */}
          <div className="flex items-center gap-2 min-w-0">
            {dirPath && (
              <span className="text-[10px] text-white/30 truncate hidden sm:block">
                {dirPath}/
              </span>
            )}
            <span className="text-xs text-white/90 font-medium truncate">
              {fileName}
            </span>
          </div>

          {/* Language badge */}
          {langLabel && (
            <span className={cn(
              'text-[9px] px-2 py-0.5 rounded-full font-medium hidden sm:inline',
              langColor
            )}>
              {langLabel}
            </span>
          )}

          {/* ReadOnly badge */}
          {readOnly && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-600/30 text-slate-400 hidden sm:inline">
              {isArabic ? 'للقراءة فقط' : 'Read-only'}
            </span>
          )}
        </div>

        {/* Right side info */}
        <div className="flex items-center gap-3 text-[10px] text-white/30">
          <span>{lineCount} {isArabic ? 'سطر' : 'lines'}</span>
          <span className="text-[9px] text-purple-400/60 hidden sm:inline">
            Phase 152 · Monaco
          </span>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <MonacoCodeEditor
          value={content}
          language={language ?? undefined}
          readOnly={readOnly}
          onChange={(val) => {
            if (onChangeContent && typeof val === 'string') {
              onChangeContent(val);
            }
          }}
          issues={issues}
          onSelectedRangeChange={onSelectedRangeChange}
          onAskAce={onAskAce}
          locale={locale}
          aceInlineResponse={aceInlineResponse}
          onApplyAcePatch={onApplyAcePatch}
          onDismissAcePatch={onDismissAcePatch}
          filePath={filePath}
          fileIssues={fileIssues}
        />
      </div>
    </div>
  );
}

export default CodeViewer;
