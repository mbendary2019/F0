// src/components/ide/InlineAceSuggestionBubble.tsx
// =============================================================================
// Phase 153.3 – Inline ACE Suggestion Bubble (WEB)
// Floating bubble showing ACE patch suggestion with Apply/Dismiss buttons
// =============================================================================

'use client';

import * as React from 'react';
import type { AceInlinePatch } from '@/types/aceInline';

type InlineAceSuggestionBubbleProps = {
  patch: AceInlinePatch;
  top: number;
  left: number;
  onApply: () => void;
  onDismiss: () => void;
  locale?: 'en' | 'ar';
};

export function InlineAceSuggestionBubble({
  patch,
  top,
  left,
  onApply,
  onDismiss,
  locale = 'en',
}: InlineAceSuggestionBubbleProps) {
  const isArabic = locale === 'ar';

  return (
    <div
      className="
        absolute z-30
        max-w-sm
        rounded-xl
        border border-white/10
        bg-slate-900/95
        shadow-xl
        p-3
        text-xs
        text-slate-100
        backdrop-blur
        space-y-2
        animate-in fade-in slide-in-from-top-2 duration-200
      "
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-fuchsia-300">
            {isArabic ? 'اقتراح ACE' : 'ACE Suggestion'}
          </div>
          <div className="text-sm font-semibold">
            {patch.title ?? (isArabic ? 'اقتراح إصلاح' : 'Inline fix suggestion')}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-100 text-xs p-1 rounded hover:bg-white/10 transition"
          title={isArabic ? 'إغلاق' : 'Close'}
        >
          ✕
        </button>
      </div>

      {/* Explanation */}
      {patch.explanation && (
        <p className="text-[11px] leading-snug text-slate-200 line-clamp-3">
          {patch.explanation}
        </p>
      )}

      {/* Line range indicator */}
      <div className="text-[10px] text-slate-400">
        {isArabic ? 'السطور' : 'Lines'}: {patch.beforeRange.startLine}
        {patch.beforeRange.endLine !== patch.beforeRange.startLine &&
          ` - ${patch.beforeRange.endLine}`}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDismiss}
          className="px-2 py-1 text-[11px] rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 transition"
        >
          {isArabic ? 'تجاهل' : 'Ignore'}
        </button>
        <button
          type="button"
          onClick={onApply}
          className="px-2.5 py-1 text-[11px] rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition flex items-center gap-1"
        >
          <span>✨</span>
          {isArabic ? 'تطبيق' : 'Apply Fix'}
        </button>
      </div>
    </div>
  );
}

export default InlineAceSuggestionBubble;
