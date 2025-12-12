// src/app/[locale]/projects/[id]/patches/page.tsx
// Phase 82 Part 2: Patches History Page - View all patches for a project

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { listPatches } from '@/lib/api/patches';
import { PatchViewerModal } from '@/components/PatchViewerModal';
import { Patch } from '@/lib/agents/patch/types';

interface PatchRecord {
  id: string;
  status: 'pending' | 'applied' | 'failed' | 'rejected' | 'partially_applied';
  patches: Patch[];
  createdAt: any;
  appliedAt?: any;
  attempts?: number;
  recoverySteps?: Array<{
    strategy: string;
    success: boolean;
    skipped?: boolean;
  }>;
  github?: {
    status?: 'applied_to_branch' | 'pr_opened' | 'merged' | 'failed' | 'rejected';
    branch?: string;
    baseBranch?: string;
    pullRequestNumber?: number | null;
    filesCount?: number;
    appliedAt?: any;
    appliedBy?: string;
  };
}

export default function PatchesHistoryPage() {
  const params = useParams();
  const projectId = params.id as string;
  const locale = (params.locale as 'ar' | 'en') || 'en';

  const [patches, setPatches] = useState<PatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatch, setSelectedPatch] = useState<PatchRecord | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const labels =
    locale === 'ar'
      ? {
          title: 'تاريخ الباتشات',
          loading: 'جاري التحميل...',
          error: 'خطأ في تحميل البيانات',
          noPatches: 'لا توجد باتشات',
          filterAll: 'الكل',
          filterPending: 'قيد الانتظار',
          filterApplied: 'مطبّق',
          filterFailed: 'فشل',
          filterRejected: 'مرفوض',
          id: 'المعرف',
          status: 'الحالة',
          files: 'ملفات',
          attempts: 'محاولات',
          created: 'تم الإنشاء',
          actions: 'إجراءات',
          view: 'عرض',
          pending: 'قيد الانتظار',
          applied: 'مطبّق',
          failed: 'فشل',
          rejected: 'مرفوض',
          partially_applied: 'مطبّق جزئياً',
        }
      : {
          title: 'Patches History',
          loading: 'Loading...',
          error: 'Error loading data',
          noPatches: 'No patches found',
          filterAll: 'All',
          filterPending: 'Pending',
          filterApplied: 'Applied',
          filterFailed: 'Failed',
          filterRejected: 'Rejected',
          id: 'ID',
          status: 'Status',
          files: 'Files',
          attempts: 'Attempts',
          created: 'Created',
          actions: 'Actions',
          view: 'View',
          pending: 'Pending',
          applied: 'Applied',
          failed: 'Failed',
          rejected: 'Rejected',
          partially_applied: 'Partially Applied',
        };

  // Load patches
  useEffect(() => {
    async function loadPatches() {
      try {
        setLoading(true);
        const data = await listPatches(projectId);
        setPatches(data as PatchRecord[]);
      } catch (err: any) {
        console.error('Failed to load patches:', err);
        setError(err.message || 'Failed to load patches');
      } finally {
        setLoading(false);
      }
    }

    loadPatches();
  }, [projectId]);

  // Filter patches
  const filteredPatches =
    filterStatus === 'all'
      ? patches
      : patches.filter((p) => p.status === filterStatus);

  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-600/20 text-yellow-400',
      applied: 'bg-green-600/20 text-green-400',
      failed: 'bg-red-600/20 text-red-400',
      rejected: 'bg-red-600/20 text-red-400',
      partially_applied: 'bg-orange-600/20 text-orange-400',
    };

    const statusLabels = {
      pending: labels.pending,
      applied: labels.applied,
      failed: labels.failed,
      rejected: labels.rejected,
      partially_applied: labels.partially_applied,
    };

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          colors[status as keyof typeof colors] || 'bg-gray-600/20 text-gray-400'
        }`}
      >
        {statusLabels[status as keyof typeof statusLabels] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">{labels.loading}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">
          {labels.error}: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">{labels.title}</h1>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded text-sm transition ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {labels.filterAll}
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1 rounded text-sm transition ${
              filterStatus === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {labels.filterPending}
          </button>
          <button
            onClick={() => setFilterStatus('applied')}
            className={`px-3 py-1 rounded text-sm transition ${
              filterStatus === 'applied'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {labels.filterApplied}
          </button>
          <button
            onClick={() => setFilterStatus('failed')}
            className={`px-3 py-1 rounded text-sm transition ${
              filterStatus === 'failed'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {labels.filterFailed}
          </button>
          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-3 py-1 rounded text-sm transition ${
              filterStatus === 'rejected'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {labels.filterRejected}
          </button>
        </div>
      </div>

      {/* Table */}
      {filteredPatches.length === 0 ? (
        <div className="text-center text-gray-400 py-12">{labels.noPatches}</div>
      ) : (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {labels.id}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {labels.status}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {labels.files}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {labels.attempts}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {labels.created}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {labels.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredPatches.map((patch) => (
                <tr key={patch.id} className="hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 text-sm text-gray-300 font-mono">
                    {patch.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-sm">{getStatusBadge(patch.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {patch.patches?.length || 0} {labels.files.toLowerCase()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {patch.attempts || 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatDate(patch.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => setSelectedPatch(patch)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition"
                    >
                      {labels.view}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Patch Viewer Modal */}
      {selectedPatch && (
        <PatchViewerModal
          isOpen={!!selectedPatch}
          onClose={() => setSelectedPatch(null)}
          patchId={selectedPatch.id}
          patches={selectedPatch.patches || []}
          projectId={projectId}
          attempts={selectedPatch.attempts}
          recoverySteps={selectedPatch.recoverySteps}
          locale={locale}
        />
      )}
    </div>
  );
}
