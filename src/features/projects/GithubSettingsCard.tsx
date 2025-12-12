// src/features/projects/GithubSettingsCard.tsx
// Phase 83.1: GitHub Repository Settings Card

'use client';

import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebaseClient';

type GithubInfo = {
  owner: string;
  repo: string;
  defaultBranch: string;
  linkedAt?: any;
  linkedBy?: string;
  lastSyncedAt?: any;
  lastSyncedBranch?: string;
} | null;

interface GithubSettingsCardProps {
  projectId: string;
  github: GithubInfo;
  locale?: 'ar' | 'en';
}

export function GithubSettingsCard({ projectId, github, locale = 'en' }: GithubSettingsCardProps) {
  const isArabic = locale === 'ar';

  const [owner, setOwner] = useState(github?.owner ?? '');
  const [repo, setRepo] = useState(github?.repo ?? '');
  const [defaultBranch, setDefaultBranch] = useState(github?.defaultBranch ?? 'main');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<{ branch?: string; filesCount?: number } | null>(null);

  const handleSave = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    setSyncInfo(null);

    try {
      const fn = httpsCallable(functions, 'linkGithubRepo');
      const res: any = await fn({ projectId, owner, repo, defaultBranch });

      if (res?.data?.ok) {
        const msg = isArabic
          ? `تم الربط بنجاح: ${res.data.owner}/${res.data.repo} (${res.data.defaultBranch})`
          : `Linked successfully to ${res.data.owner}/${res.data.repo} (branch: ${res.data.defaultBranch})`;
        setSuccess(msg);
      } else {
        setSuccess(isArabic ? 'تم الحفظ بنجاح' : 'Saved successfully');
      }
    } catch (e: any) {
      console.error('[GithubSettingsCard] Error:', e);
      const errorMsg = e.message ?? (isArabic ? 'فشل ربط المستودع' : 'Failed to link repository');
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async () => {
    if (!github) {
      setError(isArabic ? 'يجب ربط المستودع أولاً' : 'Please link a repository first');
      return;
    }

    setIsSyncing(true);
    setError(null);
    setSuccess(null);
    setSyncInfo(null);

    try {
      const fn = httpsCallable(functions, 'syncFromGithubToVfs');
      const res: any = await fn({
        projectId,
        branch: github.defaultBranch || 'main',
      });

      if (res?.data?.ok) {
        setSyncInfo({
          branch: res.data.branch,
          filesCount: res.data.filesCount,
        });
        const msg = isArabic
          ? `تمت المزامنة بنجاح: ${res.data.filesCount} ملف من ${github.owner}/${github.repo}@${res.data.branch}`
          : `Synced ${res.data.filesCount} files from ${github.owner}/${github.repo}@${res.data.branch}`;
        setSuccess(msg);
      }
    } catch (e: any) {
      console.error('[GithubSettingsCard] Sync error:', e);
      const errorMsg = e.message ?? (isArabic ? 'فشلت المزامنة من GitHub' : 'Failed to sync from GitHub');
      setError(errorMsg);
    } finally {
      setIsSyncing(false);
    }
  };

  const labels = isArabic
    ? {
        title: 'مستودع GitHub',
        description: 'اربط هذا المشروع بمستودع GitHub حقيقي ليتمكن F0 من المزامنة وإنشاء فروع و PR.',
        owner: 'المالك (Owner)',
        ownerPlaceholder: 'مثال: mbendary2019',
        ownerHelp: 'اسم صاحب المستودع في GitHub (User أو Organization).',
        repository: 'اسم المستودع (Repository)',
        repoPlaceholder: 'مثال: F0',
        repoHelp: 'اسم الريبو بدون الرابط الكامل.',
        branch: 'الفرع الافتراضي (Default Branch)',
        branchPlaceholder: 'main',
        branchHelp: 'الفرع الأساسي للمشروع (عادة main أو master).',
        linkButton: github ? 'تحديث الربط' : 'ربط المستودع',
        linkingButton: 'جاري الربط...',
        linkedStatus: 'مرتبط:',
        syncButton: 'مزامنة من GitHub → VFS',
        syncingButton: 'جاري المزامنة...',
        lastSynced: 'آخر مزامنة:',
      }
    : {
        title: 'GitHub Repository',
        description: 'Link this project to a real GitHub repository so F0 can sync, create branches, and PRs.',
        owner: 'Owner',
        ownerPlaceholder: 'e.g., mbendary2019',
        ownerHelp: 'The GitHub username or organization that owns the repo.',
        repository: 'Repository',
        repoPlaceholder: 'e.g., F0',
        repoHelp: 'The repository name without the full URL.',
        branch: 'Default Branch',
        branchPlaceholder: 'main',
        branchHelp: 'The main branch of the project (usually main or master).',
        linkButton: github ? 'Update Link' : 'Link Repository',
        linkingButton: 'Linking...',
        linkedStatus: 'Linked:',
        syncButton: 'Sync from GitHub → VFS',
        syncingButton: 'Syncing...',
        lastSynced: 'Last synced:',
      };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="font-semibold text-lg text-gray-900">
            {labels.title}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {labels.description}
          </p>
        </div>
        {github && (
          <span className="text-xs font-mono bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full whitespace-nowrap">
            {github.owner}/{github.repo} ({github.defaultBranch})
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Owner */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {labels.owner}
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder={labels.ownerPlaceholder}
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500">
            {labels.ownerHelp}
          </p>
        </div>

        {/* Repository */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {labels.repository}
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder={labels.repoPlaceholder}
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500">
            {labels.repoHelp}
          </p>
        </div>

        {/* Default Branch */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {labels.branch}
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
            placeholder={labels.branchPlaceholder}
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500">
            {labels.branchHelp}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSubmitting || !owner || !repo}
            className="inline-flex items-center rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? labels.linkingButton : labels.linkButton}
          </button>

          {github && !isSubmitting && !isSyncing && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSyncing ? labels.syncingButton : labels.syncButton}
            </button>
          )}

          {github && !isSubmitting && !isSyncing && (
            <span className="text-sm text-gray-600">
              ✅ {labels.linkedStatus} {github.owner}/{github.repo}
            </span>
          )}
        </div>

        {github?.lastSyncedAt && (
          <div className="text-xs text-gray-500">
            {labels.lastSynced} {new Date(github.lastSyncedAt.seconds * 1000).toLocaleString()}
            {github.lastSyncedBranch && ` (${github.lastSyncedBranch})`}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3">
          <p className="text-sm text-green-700">
            {success}
          </p>
        </div>
      )}
    </div>
  );
}
