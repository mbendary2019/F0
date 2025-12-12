// src/features/agent/PatchMessage.tsx
// Phase 82: Patch Message Component - Display patch info in chat

'use client';

import { useState } from 'react';
import { Patch } from '@/lib/agents/patch/types';
import { applyPatchClient, rejectPatchClient, applyPatchToGithubBranchClient } from '@/lib/api/patches';

interface PatchMessageProps {
  projectId: string;
  patchId: string;
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
  locale?: 'ar' | 'en';
  status?: 'pending' | 'applied' | 'failed' | 'rejected';
  hasGithub?: boolean; // Phase 83.3: Show GitHub button only if project is linked
  defaultBranch?: string; // Phase 83.3: Default branch for GitHub
}

export function PatchMessage({
  projectId,
  patchId,
  patches,
  attempts = 1,
  strategy,
  recoverySteps,
  onViewDiff,
  locale = 'en',
  status = 'pending',
  hasGithub = false,
  defaultBranch = 'main',
}: PatchMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isApplyingToGithub, setIsApplyingToGithub] = useState(false);
  const [localStatus, setLocalStatus] = useState(status);
  const [githubInfo, setGithubInfo] = useState<{ branch?: string; prNumber?: number | null } | null>(null);

  // Handle apply patch
  const handleApply = async () => {
    setIsApplying(true);
    try {
      await applyPatchClient(projectId, patchId);
      setLocalStatus('applied');
      // TODO: Show success toast
    } catch (error: any) {
      console.error('Failed to apply patch:', error);
      // TODO: Show error toast
    } finally {
      setIsApplying(false);
    }
  };

  // Handle reject patch
  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await rejectPatchClient(projectId, patchId);
      setLocalStatus('rejected');
      // TODO: Show success toast
    } catch (error: any) {
      console.error('Failed to reject patch:', error);
      // TODO: Show error toast
    } finally {
      setIsRejecting(false);
    }
  };

  // Handle apply patch to GitHub
  const handleApplyToGithub = async () => {
    if (!hasGithub) return;

    setIsApplyingToGithub(true);

    try {
      const res = await applyPatchToGithubBranchClient({
        projectId,
        patchId,
        targetBranch: defaultBranch,
        createNewBranch: true,
        branchName: `f0/patch-${patchId}`,
        openPullRequest: true,
      });

      setGithubInfo({
        branch: res.branch,
        prNumber: res.pullRequestNumber,
      });

      // TODO: Show success toast with GitHub info
    } catch (error: any) {
      console.error('Failed to apply patch to GitHub:', error);
      // TODO: Show error toast
    } finally {
      setIsApplyingToGithub(false);
    }
  };

  const labels =
    locale === 'ar'
      ? {
          patchReady: 'باتش جاهز للتطبيق',
          patchApplied: 'تم تطبيق الباتش',
          patchFailed: 'فشل تطبيق الباتش',
          patchRejected: 'تم رفض الباتش',
          filesChanged: 'ملفات متغيرة',
          hunks: 'تغييرات',
          newFile: 'جديد',
          deleted: 'محذوف',
          attempts: 'محاولات',
          viewDiff: 'عرض الكود',
          apply: 'تطبيق',
          reject: 'رفض',
          applied: 'مطبّق',
          rejected: 'تم الرفض',
          applying: 'جاري التطبيق...',
          rejecting: 'جاري الرفض...',
          applyToGithub: 'تطبيق على GitHub',
          applyingToGithub: 'جاري التطبيق على GitHub...',
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
          patchRejected: 'Patch rejected',
          filesChanged: 'files changed',
          hunks: 'hunks',
          newFile: 'new',
          deleted: 'deleted',
          attempts: 'attempts',
          viewDiff: 'View diff',
          apply: 'Apply',
          reject: 'Reject',
          applied: 'Applied',
          rejected: 'Rejected',
          applying: 'Applying...',
          rejecting: 'Rejecting...',
          applyToGithub: 'Apply to GitHub',
          applyingToGithub: 'Applying to GitHub...',
          recoverySteps: 'Recovery Steps',
          success: 'success',
          skipped: 'skipped',
          failed: 'failed',
          showDetails: 'Show details',
          hideDetails: 'Hide details',
        };

  const statusIcon =
    localStatus === 'applied' ? '🟢' : localStatus === 'failed' || localStatus === 'rejected' ? '🔴' : '🟡';
  const statusText =
    localStatus === 'applied'
      ? labels.patchApplied
      : localStatus === 'failed'
      ? labels.patchFailed
      : localStatus === 'rejected'
      ? labels.patchRejected
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
        {localStatus === 'pending' && (
          <div className="flex gap-2">
            {onViewDiff && (
              <button
                onClick={onViewDiff}
                disabled={isApplying || isRejecting || isApplyingToGithub}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {labels.viewDiff}
              </button>
            )}
            {hasGithub && (
              <button
                onClick={handleApplyToGithub}
                disabled={isApplying || isRejecting || isApplyingToGithub}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplyingToGithub ? labels.applyingToGithub : labels.applyToGithub}
              </button>
            )}
            <button
              onClick={handleApply}
              disabled={isApplying || isRejecting || isApplyingToGithub}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? labels.applying : labels.apply}
            </button>
            <button
              onClick={handleReject}
              disabled={isApplying || isRejecting || isApplyingToGithub}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRejecting ? labels.rejecting : labels.reject}
            </button>
          </div>
        )}
        {localStatus === 'applied' && (
          <div className="px-3 py-1 bg-green-600/20 text-green-400 rounded text-xs">
            {labels.applied}
          </div>
        )}
        {localStatus === 'rejected' && (
          <div className="px-3 py-1 bg-red-600/20 text-red-400 rounded text-xs">
            {labels.rejected}
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

      {/* GitHub info */}
      {githubInfo && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-purple-400 mb-1">
            🔗 {locale === 'ar' ? 'تم التطبيق على GitHub' : 'Applied to GitHub'}
          </div>
          <div className="space-y-1 text-xs text-gray-300">
            <div>
              {locale === 'ar' ? 'الفرع:' : 'Branch:'} <span className="font-mono text-purple-300">{githubInfo.branch}</span>
            </div>
            {githubInfo.prNumber && (
              <div>
                {locale === 'ar' ? 'طلب السحب:' : 'Pull Request:'}{' '}
                <span className="font-mono text-purple-300">#{githubInfo.prNumber}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
