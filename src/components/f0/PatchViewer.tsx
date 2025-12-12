// src/components/f0/PatchViewer.tsx
'use client';

import { useState } from 'react';
import { IdePatch } from '@/types/ideEvents';

interface PatchViewerProps {
  patches: IdePatch[];
  onApplyPatch: (patchId: string, selectedFiles: string[]) => Promise<void>;
  onFileSelect?: (filePath: string) => void;
}

export default function PatchViewer({ patches, onApplyPatch, onFileSelect }: PatchViewerProps) {
  const [selectedFiles, setSelectedFiles] = useState<Record<string, Set<string>>>({});
  const [applying, setApplying] = useState<string | null>(null);

  if (patches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-6 py-5 text-center">
        <p className="text-sm text-white/60">
          No pending patches from the AI Agent. Start a conversation to see suggestions.
        </p>
      </div>
    );
  }

  const toggleFile = (patchId: string, filePath: string) => {
    setSelectedFiles((prev) => {
      const patchFiles = prev[patchId] || new Set();
      const newSet = new Set(patchFiles);

      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }

      return {
        ...prev,
        [patchId]: newSet,
      };
    });
  };

  const selectAll = (patchId: string, files: string[]) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [patchId]: new Set(files),
    }));
  };

  const deselectAll = (patchId: string) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [patchId]: new Set(),
    }));
  };

  const handleApply = async (patchId: string) => {
    const selected = Array.from(selectedFiles[patchId] || []);
    if (selected.length === 0) {
      alert('Please select at least one file to apply.');
      return;
    }

    setApplying(patchId);
    try {
      await onApplyPatch(patchId, selected);
    } catch (error) {
      console.error('[PatchViewer] Error applying patch:', error);
      alert('Failed to apply patch. Check console for details.');
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="space-y-4">
      {patches.map((patch) => {
        const patchFiles = selectedFiles[patch.patchId] || new Set();
        const allSelected = patchFiles.size === patch.files.length;

        return (
          <div
            key={patch.patchId}
            className="rounded-xl border border-pink-500/30 bg-pink-500/5 px-6 py-5 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  AI Agent Patch
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {new Date(patch.ts).toLocaleString()} • By {patch.createdBy}
                </p>
              </div>
              <div className="text-xs text-white/60">
                {patch.files.length} file{patch.files.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Files */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/80 font-semibold">
                  Files to apply:
                </p>
                <div className="flex gap-2">
                  {!allSelected && (
                    <button
                      onClick={() => selectAll(patch.patchId, patch.files.map((f) => f.path))}
                      className="text-xs text-pink-300 hover:text-pink-200"
                    >
                      Select All
                    </button>
                  )}
                  {patchFiles.size > 0 && (
                    <button
                      onClick={() => deselectAll(patch.patchId)}
                      className="text-xs text-white/60 hover:text-white/80"
                    >
                      Deselect All
                    </button>
                  )}
                </div>
              </div>

              {patch.files.map((file) => {
                const isSelected = patchFiles.has(file.path);
                return (
                  <label
                    key={file.path}
                    className="flex items-start gap-3 cursor-pointer hover:bg-white/5 rounded p-2"
                    onClick={() => onFileSelect?.(file.path)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleFile(patch.patchId, file.path);
                      }}
                      className="mt-1 accent-pink-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-white font-mono">{file.path}</p>
                      <p className="text-xs text-white/60 mt-0.5">
                        {file.operation === 'add' && '+ Add file'}
                        {file.operation === 'modify' && '~ Modify file'}
                        {file.operation === 'delete' && '- Delete file'}
                        {onFileSelect && (
                          <span className="ml-2 text-violet-300">• Click to preview live</span>
                        )}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => handleApply(patch.patchId)}
                disabled={patchFiles.size === 0 || applying === patch.patchId}
                className="px-4 py-2 text-sm font-semibold text-white bg-pink-500 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {applying === patch.patchId ? 'Applying...' : 'Apply Selected to IDE'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
