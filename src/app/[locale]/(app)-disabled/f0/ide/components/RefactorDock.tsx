/**
 * Phase 85.5.3: Refactor Preview Dock
 * Bottom panel that shows sandbox changes with selective commit capability
 */

import { useState } from 'react';

interface RefactorDockProps {
  isOpen: boolean;
  sandboxDiff: {
    added: string[];
    modified: string[];
    removed: string[];
  } | null;
  selectedFiles: Set<string>;
  onToggle: () => void;
  onSelectFile: (filePath: string) => void;
  onToggleFileSelection: (filePath: string) => void;
  onCommitSelected: () => void;
  onDiscardSandbox: () => void;
}

type TabType = 'modified' | 'added' | 'removed';

export default function RefactorDock({
  isOpen,
  sandboxDiff,
  selectedFiles,
  onToggle,
  onSelectFile,
  onToggleFileSelection,
  onCommitSelected,
  onDiscardSandbox,
}: RefactorDockProps) {
  const [activeTab, setActiveTab] = useState<TabType>('modified');

  if (!sandboxDiff) return null;

  const totalChanges =
    sandboxDiff.modified.length +
    sandboxDiff.added.length +
    sandboxDiff.removed.length;

  const selectedCount = selectedFiles.size;

  // Get short path (last 2 segments)
  const getShortPath = (path: string) => {
    const parts = path.split('/');
    if (parts.length <= 2) return path;
    return '.../' + parts.slice(-2).join('/');
  };

  // Get file extension for icon
  const getFileIcon = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return '🔷';
      case 'js':
      case 'jsx':
        return '🟨';
      case 'json':
        return '📋';
      case 'css':
      case 'scss':
        return '🎨';
      case 'md':
        return '📝';
      default:
        return '📄';
    }
  };

  const renderFileList = (files: string[], badge: string, badgeColor: string) => {
    if (files.length === 0) {
      return (
        <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
          No {activeTab} files
        </div>
      );
    }

    return (
      <div className="overflow-y-auto max-h-48">
        {files.map((filePath) => {
          const isSelected = selectedFiles.has(filePath);
          return (
            <div
              key={filePath}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer border-b border-gray-800"
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleFileSelection(filePath)}
                className="w-4 h-4 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              />

              {/* File info - clickable to open diff */}
              <div
                className="flex-1 flex items-center gap-2"
                onClick={() => onSelectFile(filePath)}
              >
                <span className="text-lg">{getFileIcon(filePath)}</span>
                <span
                  className="text-sm text-gray-300 font-mono"
                  title={filePath}
                >
                  {getShortPath(filePath)}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${badgeColor}`}
                >
                  {badge}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="border-t border-gray-700 bg-gray-900">
      {/* Dock Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-850 border-b border-gray-700">
        <div className="flex items-center gap-4">
          {/* Toggle Button */}
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white transition-colors"
            title={isOpen ? 'Collapse dock' : 'Expand dock'}
          >
            {isOpen ? '▼' : '▲'} Refactor Preview
          </button>

          {/* Stats */}
          {isOpen && (
            <span className="text-xs text-gray-500">
              {totalChanges} change{totalChanges !== 1 ? 's' : ''} • {selectedCount} selected
            </span>
          )}
        </div>

        {/* Actions (only when open) */}
        {isOpen && (
          <div className="flex items-center gap-2">
            <button
              onClick={onCommitSelected}
              disabled={selectedCount === 0}
              className="text-xs px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Commit selected files to Firestore"
            >
              ✅ Commit Selected ({selectedCount})
            </button>
            <button
              onClick={onDiscardSandbox}
              className="text-xs px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="Discard entire sandbox"
            >
              🗑️ Discard Sandbox
            </button>
          </div>
        )}
      </div>

      {/* Dock Content */}
      {isOpen && (
        <div className="bg-gray-900">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('modified')}
              className={`px-4 py-2 text-sm transition-colors ${
                activeTab === 'modified'
                  ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Modified ({sandboxDiff.modified.length})
            </button>
            <button
              onClick={() => setActiveTab('added')}
              className={`px-4 py-2 text-sm transition-colors ${
                activeTab === 'added'
                  ? 'bg-gray-800 text-white border-b-2 border-green-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Added ({sandboxDiff.added.length})
            </button>
            <button
              onClick={() => setActiveTab('removed')}
              className={`px-4 py-2 text-sm transition-colors ${
                activeTab === 'removed'
                  ? 'bg-gray-800 text-white border-b-2 border-red-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Removed ({sandboxDiff.removed.length})
            </button>
          </div>

          {/* File Lists */}
          <div className="bg-gray-900">
            {activeTab === 'modified' &&
              renderFileList(
                sandboxDiff.modified,
                'M',
                'bg-blue-900 text-blue-200'
              )}
            {activeTab === 'added' &&
              renderFileList(
                sandboxDiff.added,
                'A',
                'bg-green-900 text-green-200'
              )}
            {activeTab === 'removed' &&
              renderFileList(
                sandboxDiff.removed,
                'D',
                'bg-red-900 text-red-200'
              )}
          </div>
        </div>
      )}
    </div>
  );
}
