// src/components/ide/IssueDetailsPanel.tsx
// =============================================================================
// Phase 154.6 – Issue Details Panel (WEB)
// PHASE 154 – INLINE ISSUES & INLINE ACE (WEB IDE) – LOCKED
// Any major behavioural changes require Phase >= 160.
// =============================================================================

'use client';

import * as React from 'react';
import type { FileIssueForEditor } from '@/types/fileIssues';

type IssueDetailsPanelProps = {
  issues: FileIssueForEditor[];
  focusedIssue: FileIssueForEditor | null;
  locale?: 'en' | 'ar';
  onIssueClick?: (issue: FileIssueForEditor) => void;
};

export function IssueDetailsPanel({
  issues,
  focusedIssue,
  locale = 'en',
  onIssueClick,
}: IssueDetailsPanelProps) {
  const isArabic = locale === 'ar';

  if (!issues.length) {
    return (
      <aside className="hidden xl:block w-80 shrink-0 rounded-2xl bg-slate-950/60 border border-white/5 p-4 text-xs text-slate-300">
        <div className="font-semibold text-slate-100 mb-1">
          {isArabic ? 'المشاكل' : 'Issues'}
        </div>
        <p className="text-[11px] text-slate-400">
          {isArabic
            ? 'لا توجد مشاكل في هذا الملف.'
            : 'No issues detected for this file.'}
        </p>
      </aside>
    );
  }

  const total = issues.length;
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;

  return (
    <aside className="hidden xl:flex w-80 shrink-0 flex-col rounded-2xl bg-slate-950/60 border border-white/5 p-4 text-xs text-slate-300">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-semibold text-slate-100">
            {isArabic ? 'المشاكل' : 'Issues'}
          </div>
          <div className="text-[11px] text-slate-400">
            {isArabic
              ? `${total} مشكلة في هذا الملف`
              : `${total} issue${total === 1 ? '' : 's'} in this file`}
          </div>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-2 mb-3 text-[11px]">
        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-200">
          {errors} {isArabic ? 'أخطاء' : 'Errors'}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-100">
          {warnings} {isArabic ? 'تحذيرات' : 'Warnings'}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-100">
          {infos} {isArabic ? 'معلومات' : 'Info'}
        </span>
      </div>

      {/* Focused issue card */}
      {focusedIssue && (
        <div className="mb-3 rounded-xl bg-slate-900/80 border border-slate-700/60 p-3 space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-fuchsia-300">
            {isArabic ? 'المشكلة المحددة' : 'Focused issue'}
          </div>
          <div className="text-xs font-semibold text-slate-50">
            {isArabic ? 'السطر' : 'Line'} {focusedIssue.line} ·{' '}
            {focusedIssue.severity.toUpperCase()}
          </div>
          <p className="text-[11px] leading-snug">{focusedIssue.message}</p>
          {focusedIssue.rule && (
            <div className="text-[10px] text-slate-400">
              {isArabic ? 'القاعدة:' : 'Rule:'} {focusedIssue.rule}
            </div>
          )}
          {focusedIssue.source && (
            <div className="text-[10px] text-slate-500">
              {isArabic ? 'المصدر:' : 'Source:'} {focusedIssue.source}
            </div>
          )}
        </div>
      )}

      {/* Issues list */}
      <div className="mt-1 flex-1 overflow-auto space-y-1 max-h-[300px]">
        {issues.map((issue) => {
          const isFocused = focusedIssue?.id === issue.id;
          const severityColor =
            issue.severity === 'error'
              ? 'text-red-400'
              : issue.severity === 'warning'
              ? 'text-amber-400'
              : 'text-sky-400';

          return (
            <div
              key={issue.id}
              onClick={() => onIssueClick?.(issue)}
              className={`flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                isFocused
                  ? 'bg-slate-800/80 border border-slate-600'
                  : 'hover:bg-slate-900/80 border border-transparent'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-slate-100">
                  <span className={severityColor}>●</span>{' '}
                  {isArabic ? 'السطر' : 'Line'} {issue.line}
                </div>
                <div className="text-[11px] text-slate-300 line-clamp-2">
                  {issue.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default IssueDetailsPanel;
