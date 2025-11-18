// src/features/agent/PatchMessage.tsx
// Phase 82: Patch Message Component - Display patch info in chat

'use client';

import { useState } from 'react';
import { Patch } from '@/lib/agents/patch/types';

interface PatchMessageProps {
  patchId?: string;
  patches: Array<{
    filePath: string;
    hunksCount: number;
    isNew: boolean;
    isDeleted: boolean;
  }>;
  attempts?: number;
  strategy?: string;
  recoverySteps?: Array<{
    strategy: string;
    success: boolean;
    skipped?: boolean;
  }>;
  onViewDiff?: () => void;
  onApply?: () => void;
  onReject?: () => void;
  locale?: 'ar' | 'en';
  status?: 'pending' | 'applied' | 'failed';
}

export function PatchMessage({
  patchId,
  patches,
  attempts = 1,
  strategy,
  recoverySteps,
  onViewDiff,
  onApply,
  onReject,
  locale = 'en',
  status = 'pending',
}: PatchMessageProps) {
  const [expanded, setExpanded] = useState(false);

  const labels =
    locale === 'ar'
      ? {
          patchReady: 'باتش جاهز للتطبيق',
          patchApplied: 'تم تطبيق الباتش',
          patchFailed: 'فشل تطبيق الباتش',
          filesChanged: 'ملفات متغيرة',
          hunks: 'تغييرات',
          newFile: 'جديد',
          deleted: 'محذوف',
          attempts: 'محاولات',
          viewDiff: 'عرض الكود',
          apply: 'تطبيق',
          reject: 'رفض',
          applied: 'مطبّق',
          recoverySteps: 'خطوات الاسترجاع',
          success: 'نجح',
          skipped: 'تم التخطي',
          failed: 'فشل',
          showDetails: 'عرض التفاصيل',
          hideDetails: 'إخفاء التفاصيل',
        }
      : {
          patchReady: 'Patch ready to apply',
          patchApplied: 'Patch applied',
          patchFailed: 'Patch failed',
          filesChanged: 'files changed',
          hunks: 'hunks',
          newFile: 'new',
          deleted: 'deleted',
          attempts: 'attempts',
          viewDiff: 'View diff',
          apply: 'Apply',
          reject: 'Reject',
          applied: 'Applied',
          recoverySteps: 'Recovery Steps',
          success: 'success',
          skipped: 'skipped',
          failed: 'failed',
          showDetails: 'Show details',
          hideDetails: 'Hide details',
        };

  const statusIcon =
    status === 'applied' ? '🟢' : status === 'failed' ? '🔴' : '🟡';
  const statusText =
    status === 'applied'
      ? labels.patchApplied
      : status === 'failed'
      ? labels.patchFailed
      : labels.patchReady;

  const totalHunks = patches.reduce((sum, p) => sum + p.hunksCount, 0);
  const newFiles = patches.filter((p) => p.isNew).length;
  const deletedFiles = patches.filter((p) => p.isDeleted).length;

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-900/50 p-4 font-mono text-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{statusIcon}</span>
          <div>
            <div className="font-semibold text-white">{statusText}</div>
            <div className="text-xs text-gray-400">
              {patches.length} {labels.filesChanged} • {totalHunks} {labels.hunks}
              {attempts > 1 && ` • ${attempts} ${labels.attempts}`}
            </div>
          </div>
        </div>

        {/* Actions */}
        {status === 'pending' && (
          <div className="flex gap-2">
            {onViewDiff && (
              <button
                onClick={onViewDiff}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition"
              >
                {labels.viewDiff}
              </button>
            )}
            {onApply && (
              <button
                onClick={onApply}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition"
              >
                {labels.apply}
              </button>
            )}
            {onReject && (
              <button
                onClick={onReject}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition"
              >
                {labels.reject}
              </button>
            )}
          </div>
        )}
        {status === 'applied' && (
          <div className="px-3 py-1 bg-green-600/20 text-green-400 rounded text-xs">
            {labels.applied}
          </div>
        )}
      </div>

      {/* File list */}
      <div className="space-y-1 mb-3">
        {patches.slice(0, expanded ? undefined : 3).map((patch, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className="text-blue-400">{patch.filePath}</span>
            <span className="text-gray-500">({patch.hunksCount} {labels.hunks})</span>
            {patch.isNew && (
              <span className="px-2 py-0.5 bg-green-600 text-white rounded">
                {labels.newFile}
              </span>
            )}
            {patch.isDeleted && (
              <span className="px-2 py-0.5 bg-red-600 text-white rounded">
                {labels.deleted}
              </span>
            )}
          </div>
        ))}
      </div>

      {patches.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-400 hover:text-blue-300 mb-3"
        >
          {expanded ? labels.hideDetails : `${labels.showDetails} (${patches.length - 3} more)`}
        </button>
      )}

      {/* Recovery steps */}
      {recoverySteps && recoverySteps.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-2">{labels.recoverySteps}:</div>
          <div className="space-y-1">
            {recoverySteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className={step.success ? 'text-green-400' : step.skipped ? 'text-gray-500' : 'text-red-400'}>
                  {step.success ? '✔' : step.skipped ? '○' : '✖'}
                </span>
                <span className="text-gray-300">{step.strategy}</span>
                <span className="text-gray-500">
                  ({step.success ? labels.success : step.skipped ? labels.skipped : labels.failed})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
