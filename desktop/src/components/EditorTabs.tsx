// desktop/src/components/EditorTabs.tsx
// Phase 114.2: Editor Tabs UI Component
import React from 'react';
import type { OpenFile, DirtyFilesMap } from '../App';

type EditorTabsProps = {
  openFiles: OpenFile[];
  activeFilePath: string | null;
  dirtyFiles: DirtyFilesMap;
  locale: 'en' | 'ar';
  onActivateFile: (path: string) => void;
  onCloseFile: (path: string) => void;
};

export const EditorTabs: React.FC<EditorTabsProps> = ({
  openFiles,
  activeFilePath,
  dirtyFiles,
  locale,
  onActivateFile,
  onCloseFile,
}) => {
  if (openFiles.length === 0) return null;

  const isRTL = locale === 'ar';

  return (
    <div
      className="f0-editor-tabs"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        const isDirty = dirtyFiles[file.path] === true;

        return (
          <button
            key={file.path}
            type="button"
            className={
              'f0-editor-tab' +
              (isActive ? ' f0-editor-tab-active' : '')
            }
            onClick={() => onActivateFile(file.path)}
            title={file.path}
          >
            {/* Dirty dot */}
            {isDirty && <span className="f0-editor-tab-dirty-dot" />}

            {/* File name */}
            <span className="f0-editor-tab-label">
              {file.name}
            </span>

            {/* Close button */}
            <span
              className="f0-editor-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onCloseFile(file.path);
              }}
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default EditorTabs;
