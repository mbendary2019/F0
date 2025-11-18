// src/components/PatchViewerModal.tsx
// Phase 82: Patch Viewer Modal - Full-screen diff viewer

'use client';

import { useState } from 'react';
import { Patch } from '@/lib/agents/patch/types';
import { PatchViewer } from '@/features/agent/PatchViewer';

interface PatchViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patchId?: string;
  patches: Patch[];
  projectId: string;
  attempts?: number;
  recoverySteps?: Array<{
    strategy: string;
    success: boolean;
    skipped?: boolean;
  }>;
  onApply?: () => void;
  onReject?: () => void;
  locale?: 'ar' | 'en';
}

export function PatchViewerModal({
  isOpen,
  onClose,
  patchId,
  patches,
  projectId,
  attempts,
  recoverySteps,
  onApply,
  onReject,
  locale = 'en',
}: PatchViewerModalProps) {
  const [selectedFile, setSelectedFile] = useState(0);

  if (!isOpen) return null;

  const labels =
    locale === 'ar'
      ? {
          patchViewer: 'عارض الباتش',
          close: 'إغلاق',
          apply: 'تطبيق',
          reject: 'رفض',
          files: 'ملفات',
          attempts: 'محاولات',
          recoverySteps: 'خطوات الاسترجاع',
        }
      : {
          patchViewer: 'Patch Viewer',
          close: 'Close',
          apply: 'Apply',
          reject: 'Reject',
          files: 'Files',
          attempts: 'Attempts',
          recoverySteps: 'Recovery Steps',
        };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-7xl h-[90vh] bg-gray-900 rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-white">{labels.patchViewer}</h2>
            {attempts && attempts > 1 && (
              <span className="text-sm text-gray-400">
                {attempts} {labels.attempts}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onApply && (
              <button
                onClick={onApply}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition"
              >
                {labels.apply}
              </button>
            )}
            {onReject && (
              <button
                onClick={onReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
              >
                {labels.reject}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
            >
              {labels.close}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* File Sidebar */}
          <div className="w-64 border-r border-gray-700 overflow-y-auto">
            <div className="p-4">
              <div className="text-sm font-semibold text-gray-400 mb-2">
                {labels.files} ({patches.length})
              </div>
              <div className="space-y-1">
                {patches.map((patch, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedFile(idx)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                      selectedFile === idx
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <div className="truncate">{patch.filePath}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {patch.hunks.length} hunks
                      {patch.isNew && <span className="ml-2 text-green-400">(new)</span>}
                      {patch.isDeleted && <span className="ml-2 text-red-400">(deleted)</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recovery Steps */}
            {recoverySteps && recoverySteps.length > 0 && (
              <div className="p-4 border-t border-gray-700">
                <div className="text-sm font-semibold text-gray-400 mb-2">
                  {labels.recoverySteps}
                </div>
                <div className="space-y-2">
                  {recoverySteps.map((step, idx) => (
                    <div key={idx} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            step.success
                              ? 'text-green-400'
                              : step.skipped
                              ? 'text-gray-500'
                              : 'text-red-400'
                          }
                        >
                          {step.success ? '✔' : step.skipped ? '○' : '✖'}
                        </span>
                        <span className="text-gray-300">{step.strategy}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Patch Viewer */}
          <div className="flex-1 overflow-y-auto p-6">
            {patches[selectedFile] && (
              <PatchViewer
                patch={patches[selectedFile]}
                locale={locale}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
