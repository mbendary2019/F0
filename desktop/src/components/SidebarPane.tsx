// desktop/src/components/SidebarPane.tsx
// Phase 123: Sidebar with Files and Search tabs (like VS Code/Cursor)
// Phase 136.2: Added Security tab for Security Center
// Phase 137.2: Added Tests tab for Tests Center

import React, { useState } from 'react';
import FileTreePane from './FileTreePane';
import SearchPane from './SearchPane';
import { ProjectSecurityView } from '../views/ProjectSecurityView';
import { ProjectTestsView } from '../views/ProjectTestsView';
import type { F0FileNode } from '../hooks/useProjectState';
import type { DirtyFilesMap } from '../App';

type SidebarTab = 'files' | 'search' | 'security' | 'tests';

type SidebarPaneProps = {
  rootPath: string | null;
  tree: F0FileNode[] | null;
  currentFilePath: string | null;
  onFileClick: (path: string) => void;
  dirtyFiles?: DirtyFilesMap;
  locale?: 'ar' | 'en';
  onOpenFile?: (path: string, name: string, language?: string | null) => void;
  openFiles?: { path: string }[];
};

export const SidebarPane: React.FC<SidebarPaneProps> = ({
  rootPath,
  tree,
  currentFilePath,
  onFileClick,
  dirtyFiles = {},
  locale = 'en',
  onOpenFile,
  openFiles = [],
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('files');
  const isArabic = locale === 'ar';

  const labels = {
    files: isArabic ? 'الملفات' : 'Files',
    search: isArabic ? 'بحث' : 'Search',
    security: isArabic ? 'الأمان' : 'Security',
    tests: isArabic ? 'الاختبارات' : 'Tests',
  };

  return (
    <div className="h-full flex flex-col bg-[#050816]">
      {/* Tab Header - Neon Style */}
      <div className="flex border-b border-[#251347] flex-shrink-0 bg-gradient-to-r from-[#08001b] to-[#0f0228]">
        <button
          className={`flex-1 px-3 py-2.5 text-[11px] font-medium transition-all duration-200 border-b-2 ${
            activeTab === 'files'
              ? 'text-[#e0dbff] border-[#7c3aed] bg-gradient-to-b from-[#7c3aed]/20 to-transparent shadow-[0_2px_12px_rgba(124,58,237,0.3)]'
              : 'text-[#6b5f8a] border-transparent hover:text-[#a89fd4] hover:bg-[#7c3aed]/5'
          }`}
          onClick={() => setActiveTab('files')}
        >
          <span className="flex items-center justify-center gap-1.5">
            <span className={activeTab === 'files' ? 'drop-shadow-[0_0_4px_rgba(124,58,237,0.8)]' : ''}>📁</span>
            <span>{labels.files}</span>
          </span>
        </button>
        <button
          className={`flex-1 px-3 py-2.5 text-[11px] font-medium transition-all duration-200 border-b-2 ${
            activeTab === 'search'
              ? 'text-[#e0dbff] border-[#7c3aed] bg-gradient-to-b from-[#7c3aed]/20 to-transparent shadow-[0_2px_12px_rgba(124,58,237,0.3)]'
              : 'text-[#6b5f8a] border-transparent hover:text-[#a89fd4] hover:bg-[#7c3aed]/5'
          }`}
          onClick={() => setActiveTab('search')}
        >
          <span className="flex items-center justify-center gap-1.5">
            <span className={activeTab === 'search' ? 'drop-shadow-[0_0_4px_rgba(124,58,237,0.8)]' : ''}>🔍</span>
            <span>{labels.search}</span>
          </span>
        </button>
        {/* Phase 136.2: Security Tab */}
        <button
          className={`flex-1 px-3 py-2.5 text-[11px] font-medium transition-all duration-200 border-b-2 ${
            activeTab === 'security'
              ? 'text-[#e0dbff] border-[#7c3aed] bg-gradient-to-b from-[#7c3aed]/20 to-transparent shadow-[0_2px_12px_rgba(124,58,237,0.3)]'
              : 'text-[#6b5f8a] border-transparent hover:text-[#a89fd4] hover:bg-[#7c3aed]/5'
          }`}
          onClick={() => setActiveTab('security')}
        >
          <span className="flex items-center justify-center gap-1.5">
            <span className={activeTab === 'security' ? 'drop-shadow-[0_0_4px_rgba(124,58,237,0.8)]' : ''}>🛡️</span>
            <span>{labels.security}</span>
          </span>
        </button>
        {/* Phase 137.2: Tests Tab */}
        <button
          className={`flex-1 px-3 py-2.5 text-[11px] font-medium transition-all duration-200 border-b-2 ${
            activeTab === 'tests'
              ? 'text-[#e0dbff] border-[#7c3aed] bg-gradient-to-b from-[#7c3aed]/20 to-transparent shadow-[0_2px_12px_rgba(124,58,237,0.3)]'
              : 'text-[#6b5f8a] border-transparent hover:text-[#a89fd4] hover:bg-[#7c3aed]/5'
          }`}
          onClick={() => setActiveTab('tests')}
        >
          <span className="flex items-center justify-center gap-1.5">
            <span className={activeTab === 'tests' ? 'drop-shadow-[0_0_4px_rgba(124,58,237,0.8)]' : ''}>🧪</span>
            <span>{labels.tests}</span>
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && (
          <FileTreePane
            rootPath={rootPath}
            tree={tree}
            currentFilePath={currentFilePath}
            onFileClick={onFileClick}
            dirtyFiles={dirtyFiles}
            locale={locale}
            onOpenFile={onOpenFile}
            hideHeader={true}
          />
        )}

        {activeTab === 'search' && (
          <SearchPane
            projectRoot={rootPath || undefined}
            openFiles={openFiles}
            onSelectFile={(fullPath) => {
              // Extract filename from path
              const name = fullPath.split('/').pop() || fullPath;
              if (onOpenFile) {
                onOpenFile(fullPath, name, null);
              } else {
                onFileClick(fullPath);
              }
            }}
          />
        )}

        {/* Phase 136.2: Security Tab Content */}
        {activeTab === 'security' && (
          <div className="h-full overflow-y-auto p-2">
            <ProjectSecurityView locale={locale} />
          </div>
        )}

        {/* Phase 137.2: Tests Tab Content */}
        {activeTab === 'tests' && (
          <div className="h-full overflow-y-auto p-2">
            <ProjectTestsView locale={locale} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarPane;
