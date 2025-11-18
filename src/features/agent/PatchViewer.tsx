// src/features/agent/PatchViewer.tsx
// Phase 78: Patch-Based Code Editing - Patch Viewer UI Component

'use client';

import { useState } from 'react';
import { Patch, PatchLine } from '@/lib/agents/patch/types';

interface PatchViewerProps {
  patch: Patch;
  locale?: 'ar' | 'en';
  onApply?: () => void;
  onReject?: () => void;
}

export function PatchViewer({ patch, locale = 'en', onApply, onReject }: PatchViewerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const labels =
    locale === 'ar'
      ? {
          file: 'ملف',
          newFile: 'ملف جديد',
          deleted: 'محذوف',
          apply: 'تطبيق',
          reject: 'رفض',
          expand: 'توسيع',
          collapse: 'طي',
        }
      : {
          file: 'File',
          newFile: 'New file',
          deleted: 'Deleted',
          apply: 'Apply',
          reject: 'Reject',
          expand: 'Expand',
          collapse: 'Collapse',
        };

  return (
    <div className="border border-gray-700 rounded-md overflow-hidden bg-gray-900 font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white"
            aria-label={isExpanded ? labels.collapse : labels.expand}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <span className="text-white font-semibold">{patch.filePath}</span>
          {patch.isNew && (
            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
              {labels.newFile}
            </span>
          )}
          {patch.isDeleted && (
            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">
              {labels.deleted}
            </span>
          )}
        </div>

        {/* Actions */}
        {(onApply || onReject) && (
          <div className="flex gap-2">
            {onApply && (
              <button
                onClick={onApply}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
              >
                {labels.apply}
              </button>
            )}
            {onReject && (
              <button
                onClick={onReject}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
              >
                {labels.reject}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hunks */}
      {isExpanded && (
        <div className="divide-y divide-gray-800">
          {patch.hunks.map((hunk, hunkIdx) => (
            <div key={hunkIdx} className="p-0">
              {/* Hunk header */}
              <div className="px-4 py-1 bg-blue-900/30 text-blue-300 text-xs">
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                {hunk.header && <span className="ml-2 text-gray-400">{hunk.header}</span>}
              </div>

              {/* Hunk lines */}
              <div>
                {hunk.lines.map((line, lineIdx) => (
                  <PatchLineView key={lineIdx} line={line} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PatchLineView({ line }: { line: PatchLine }) {
  const bgColor =
    line.type === 'add'
      ? 'bg-green-900/20'
      : line.type === 'remove'
      ? 'bg-red-900/20'
      : 'bg-transparent';

  const textColor =
    line.type === 'add' ? 'text-green-300' : line.type === 'remove' ? 'text-red-300' : 'text-gray-400';

  const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

  return (
    <div className={`flex ${bgColor} ${textColor} hover:bg-gray-800/50 px-4 py-0.5`}>
      <span className="select-none w-4 flex-shrink-0">{prefix}</span>
      <span className="flex-1 whitespace-pre">{line.content}</span>
    </div>
  );
}

/**
 * Multi-patch bundle viewer
 */
interface PatchBundleViewerProps {
  patches: Patch[];
  locale?: 'ar' | 'en';
  onApplyAll?: () => void;
  onRejectAll?: () => void;
}

export function PatchBundleViewer({
  patches,
  locale = 'en',
  onApplyAll,
  onRejectAll,
}: PatchBundleViewerProps) {
  const labels =
    locale === 'ar'
      ? {
          filesChanged: 'ملفات متغيرة',
          applyAll: 'تطبيق الكل',
          rejectAll: 'رفض الكل',
        }
      : {
          filesChanged: 'files changed',
          applyAll: 'Apply All',
          rejectAll: 'Reject All',
        };

  return (
    <div className="space-y-4">
      {/* Bundle header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {patches.length} {labels.filesChanged}
        </div>
        {(onApplyAll || onRejectAll) && (
          <div className="flex gap-2">
            {onApplyAll && (
              <button
                onClick={onApplyAll}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
              >
                {labels.applyAll}
              </button>
            )}
            {onRejectAll && (
              <button
                onClick={onRejectAll}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
              >
                {labels.rejectAll}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Individual patches */}
      {patches.map((patch, idx) => (
        <PatchViewer key={idx} patch={patch} locale={locale} />
      ))}
    </div>
  );
}
