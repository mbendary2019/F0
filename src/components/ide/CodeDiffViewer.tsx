// src/components/ide/CodeDiffViewer.tsx
// =============================================================================
// Phase 152.6 – Monaco Diff Editor
// Shows side-by-side comparison of original vs modified code
// =============================================================================
// Phase 152 – Web Code Editor v1 (LOCKED)
// NOTE: Any major behavioral changes should be done in Phase >= 153.
// =============================================================================

'use client';

import { DiffEditor } from '@monaco-editor/react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================
type CodeDiffViewerProps = {
  original: string;
  modified: string;
  language?: string | null;
  filePath?: string | null;
  locale?: 'en' | 'ar';
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

// Monaco language mapping
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
export function CodeDiffViewer({
  original,
  modified,
  language,
  filePath,
  locale = 'en',
}: CodeDiffViewerProps) {
  const isArabic = locale === 'ar';
  const monacoLang = getMonacoLanguage(language);
  const fileName = filePath?.split('/').pop() || filePath;
  const dirPath = filePath?.split('/').slice(0, -1).join('/');
  const langLabel = language ? (LANG_LABELS[language] || language.toUpperCase()) : null;
  const langColor = language ? (LANG_COLORS[language] || 'bg-white/10 text-white/60') : '';

  // Calculate diff stats
  const originalLines = original.split('\n').length;
  const modifiedLines = modified.split('\n').length;
  const linesDiff = modifiedLines - originalLines;

  return (
    <div className="h-full w-full bg-[#050015] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#070019]">
        <div className="flex items-center gap-3 min-w-0">
          {/* Diff icon */}
          <span className="text-sm opacity-60">📊</span>

          {/* File path */}
          <div className="flex items-center gap-2 min-w-0">
            {dirPath && (
              <span className="text-[10px] text-white/30 truncate hidden sm:block">
                {dirPath}/
              </span>
            )}
            <span className="text-xs text-white/90 font-medium truncate">
              {fileName || (isArabic ? 'لم يتم اختيار ملف' : 'No file selected')}
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

          {/* Diff badge */}
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
            DIFF
          </span>
        </div>

        {/* Right side info */}
        <div className="flex items-center gap-4 text-[10px] text-white/40">
          {/* Line diff indicator */}
          {linesDiff !== 0 && (
            <span className={linesDiff > 0 ? 'text-emerald-400' : 'text-red-400'}>
              {linesDiff > 0 ? `+${linesDiff}` : linesDiff} {isArabic ? 'سطر' : 'lines'}
            </span>
          )}
          <span className="text-[9px] text-purple-400/60 hidden sm:inline">
            Phase 152.6 · Diff
          </span>
        </div>
      </div>

      {/* Labels row */}
      <div className="flex-shrink-0 flex border-b border-white/5 bg-[#060012]">
        <div className="flex-1 px-4 py-1.5 text-[10px] text-white/40 border-r border-white/5">
          {isArabic ? 'الأصلي' : 'Original'} ({originalLines} {isArabic ? 'سطر' : 'lines'})
        </div>
        <div className="flex-1 px-4 py-1.5 text-[10px] text-white/40">
          {isArabic ? 'المُعدَّل' : 'Modified'} ({modifiedLines} {isArabic ? 'سطر' : 'lines'})
        </div>
      </div>

      {/* Diff Editor */}
      <div className="flex-1 min-h-0">
        <DiffEditor
          height="100%"
          original={original}
          modified={modified}
          language={monacoLang}
          theme="vs-dark"
          options={{
            renderSideBySide: true,
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            lineHeight: 18,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, Consolas, monospace",
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
            renderIndicators: true,
            ignoreTrimWhitespace: false,
            renderOverviewRuler: true,
          }}
          loading={
            <div className="h-full w-full bg-[#050015] flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                <span className="text-[10px] text-white/40">
                  {isArabic ? 'جاري تحميل المقارنة...' : 'Loading diff...'}
                </span>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}

export default CodeDiffViewer;
