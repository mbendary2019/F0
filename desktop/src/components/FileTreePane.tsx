// desktop/src/components/FileTreePane.tsx
// Phase 133.1: Added Test Status Dot for file tree
import React from 'react';
import type { F0FileNode } from '../hooks/useProjectState';
import type { DirtyFilesMap } from '../App';
// Phase 133.1: Test Lab integration
import { useTestLab } from '../state/testLabContext';
import { TestStatusDot } from './tests/TestStatusBadge';

type Props = {
  rootPath: string | null;
  tree: F0FileNode[] | null;
  currentFilePath: string | null;
  onFileClick: (path: string) => void;
  /** Phase 113.2: Map of file paths to their dirty state */
  dirtyFiles?: DirtyFilesMap;
  /** Phase 113.3: Locale for bilingual support */
  locale?: 'ar' | 'en';
  /** Phase 113.5: Handler to open file in tabs */
  onOpenFile?: (path: string, name: string, language?: string | null) => void;
  /** Phase 123: Hide the header when used inside tabs */
  hideHeader?: boolean;
};

export const FileTreePane: React.FC<Props> = ({
  rootPath,
  tree,
  currentFilePath,
  onFileClick,
  dirtyFiles = {},
  locale = 'en',
  onOpenFile,
  hideHeader = false,
}) => {
  const isArabic = locale === 'ar';

  // Phase 133.1: Get test lab context for file status
  const { getFileTestStatus } = useTestLab();

  // Phase 113.3: Bilingual labels
  const labels = {
    title: isArabic ? 'الملفات' : 'FILES',
    noFolder: isArabic ? 'لم يتم فتح مجلد بعد.' : 'No folder opened yet.',
    openFolderHint: isArabic ? 'استخدم "فتح مجلد" لتحميل مشروع.' : 'Use "Open Folder" to load a project.',
    unsavedChanges: isArabic ? 'تغييرات غير محفوظة' : 'Unsaved changes',
  };

  if (!tree || !rootPath) {
    return (
      <div className="pane file-tree-pane h-full">
        {!hideHeader && <h2 className="pane-title">{labels.title}</h2>}
        <div className="pane-content">
          <p className="empty-state">{labels.noFolder}</p>
          <p className="empty-state-hint">{labels.openFolderHint}</p>
        </div>
      </div>
    );
  }

  const renderNode = (node: F0FileNode, depth: number) => {
    const isFile = node.type === 'file';
    const isActive = isFile && node.path === currentFilePath;
    // Phase 113.2: Check if this file is dirty
    const isDirty = isFile && dirtyFiles[node.path] === true;
    // Phase 133.1: Get test status for this file
    const testStatus = isFile ? getFileTestStatus(node.path) : null;

    return (
      <div key={node.path}>
        <div
          className={
            'f0-filetree-item ' +
            (isFile ? 'f0-filetree-item-file ' : 'f0-filetree-item-dir ') +
            (isActive ? 'f0-filetree-item-active ' : '')
          }
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => {
            if (isFile) {
              // Phase 113.5: Use onOpenFile for tabs support, fallback to onFileClick
              if (onOpenFile) {
                onOpenFile(node.path, node.name, null);
              } else {
                onFileClick(node.path);
              }
            }
          }}
        >
          <span className="f0-filetree-icon">
            {node.type === 'dir' ? '📁' : '📄'}
          </span>
          <span className="f0-filetree-name">{node.name}</span>
          {/* Phase 133.1: Show test status dot */}
          <TestStatusDot status={testStatus} />
          {/* Phase 113.2: Show dirty indicator */}
          {isDirty && <span className="f0-file-dirty-dot" title={labels.unsavedChanges} />}
        </div>
        {node.children &&
          node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="pane file-tree-pane h-full">
      {!hideHeader && <h2 className="pane-title">{labels.title}</h2>}
      <div className="f0-filetree-scroll">
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
};

export default FileTreePane;
