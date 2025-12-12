// desktop/src/components/ProjectSearchPanel.tsx
// Phase 122.3: Full-Text Search Panel (Cmd+Shift+F)
// Searches file content using project index snippets
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import type { ProjectSearchResult, ProjectSearchType, IndexedFileLanguage } from '../../indexer/types';

// File type icons
const FILE_ICONS: Record<IndexedFileLanguage, string> = {
  typescript: '📘',
  javascript: '📙',
  tsx: '⚛️',
  jsx: '⚛️',
  json: '📋',
  css: '🎨',
  scss: '🎨',
  html: '🌐',
  markdown: '📝',
  yaml: '⚙️',
  python: '🐍',
  rust: '🦀',
  go: '🐹',
  other: '📄',
};

// Get language from file extension
function getLangFromPath(path: string): IndexedFileLanguage {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const extMap: Record<string, IndexedFileLanguage> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'html',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    rs: 'rust',
    go: 'go',
  };
  return extMap[ext] || 'other';
}

type ProjectSearchPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  projectRoot?: string;
  onSelectFile: (fullPath: string) => void;
};

export const ProjectSearchPanel: React.FC<ProjectSearchPanelProps> = ({
  isOpen,
  onClose,
  projectRoot,
  onSelectFile,
}) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<ProjectSearchType>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<ProjectSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [totalFiles, setTotalFiles] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasCheckedIndex = useRef(false);

  // Debounced search - wait for indexing to finish
  useEffect(() => {
    if (!isOpen || !query.trim() || !projectRoot || isIndexing) {
      if (!isIndexing) setResults([]);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        // Use the preload API if available
        // Cast needed because f0Desktop type declaration merging is incomplete
        const f0 = window.f0Desktop as any;
        if (f0?.searchProjectIndex) {
          const searchResults = await f0.searchProjectIndex(
            query,
            searchType,
            30,
            projectRoot
          );
          setResults(searchResults);
        }
      } catch (err) {
        console.error('[ProjectSearchPanel] Search error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200); // 200ms debounce

    return () => clearTimeout(timer);
  }, [query, searchType, projectRoot, isOpen, isIndexing]);

  // Focus input when opening + auto-index if needed
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);

      // Check and auto-create index if needed
      if (projectRoot && !hasCheckedIndex.current) {
        hasCheckedIndex.current = true;
        const f0 = window.f0Desktop as any;
        if (f0?.getProjectIndex && f0?.scanProject) {
          // Check if index exists
          f0.getProjectIndex(projectRoot).then((existingIndex: any) => {
            if (existingIndex && existingIndex.files?.length > 0) {
              setTotalFiles(existingIndex.files.length);
              console.log('[ProjectSearchPanel] Found existing index with', existingIndex.files.length, 'files');
            } else {
              // No index exists, create one
              console.log('[ProjectSearchPanel] No index found, starting scan...');
              setIsIndexing(true);
              f0.scanProject(projectRoot).then((newIndex: any) => {
                setTotalFiles(newIndex?.files?.length || 0);
                console.log('[ProjectSearchPanel] Index created with', newIndex?.files?.length || 0, 'files');
                setIsIndexing(false);
              }).catch((err: any) => {
                console.error('[ProjectSearchPanel] Scan failed:', err);
                setIsIndexing(false);
              });
            }
          }).catch((err: any) => {
            console.error('[ProjectSearchPanel] getProjectIndex failed:', err);
          });
        }
      }
    } else {
      // Reset the check flag when panel closes
      hasCheckedIndex.current = false;
    }
  }, [isOpen, projectRoot]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelectFile(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          // Cycle through search types
          e.preventDefault();
          const types: ProjectSearchType[] = ['all', 'file', 'symbol', 'export', 'text'];
          const currentIdx = types.indexOf(searchType);
          setSearchType(types[(currentIdx + 1) % types.length]);
          break;
      }
    },
    [results, selectedIndex, onClose, searchType]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle file selection
  const handleSelectFile = (result: ProjectSearchResult) => {
    const fullPath = projectRoot
      ? `${projectRoot}/${result.path}`
      : result.path;
    onSelectFile(fullPath);
    onClose();
  };

  // Highlight query in text
  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text;

    return (
      <>
        <span className="text-[#a89fd4]">{text.slice(0, index)}</span>
        <span className="text-[#f5f3ff] font-medium bg-[#7b5cff]/30 px-0.5 rounded">
          {text.slice(index, index + searchQuery.length)}
        </span>
        <span className="text-[#a89fd4]">{text.slice(index + searchQuery.length)}</span>
      </>
    );
  };

  if (!isOpen) return null;

  const searchTypeLabels: Record<ProjectSearchType, string> = {
    all: 'All',
    file: 'Files',
    symbol: 'Symbols',
    export: 'Exports',
    text: 'Text',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-3xl mx-4 rounded-xl border border-[#3a2070] bg-gradient-to-b from-[#0f0025] to-[#080018] shadow-[0_25px_80px_rgba(0,0,0,0.8)]">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-[#2a1555] px-4 py-3">
          <span className="text-[#7b5cff] text-lg">🔎</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search in project files..."
            className="flex-1 bg-transparent text-[#f5f3ff] placeholder-[#6b5f8a] text-sm outline-none"
          />
          {isIndexing && (
            <span className="text-[10px] text-[#ff9f43] animate-pulse">Indexing project...</span>
          )}
          {isLoading && !isIndexing && (
            <span className="text-[10px] text-[#7b5cff] animate-pulse">Searching...</span>
          )}
          {totalFiles > 0 && !isIndexing && (
            <span className="text-[10px] text-[#5a4d7a]">{totalFiles} files</span>
          )}
        </div>

        {/* Search Type Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-[#2a1555]">
          {(['all', 'file', 'symbol', 'export', 'text'] as ProjectSearchType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSearchType(type)}
              className={clsx(
                'px-3 py-1 rounded text-xs transition-colors',
                searchType === type
                  ? 'bg-[#7b5cff]/30 text-[#f5f3ff]'
                  : 'text-[#6b5f8a] hover:text-[#a89fd4] hover:bg-white/5'
              )}
            >
              {searchTypeLabels[type]}
            </button>
          ))}
          <span className="ml-auto text-[9px] text-[#5a4d7a]">
            Press Tab to cycle
          </span>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[55vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[#342065] scrollbar-track-transparent"
        >
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#6b5f8a] text-sm">
              {isIndexing ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl animate-spin">⚙️</span>
                  <span>Indexing project files...</span>
                  <span className="text-xs text-[#5a4d7a]">This only happens once</span>
                </div>
              ) : query ? (
                'No results found'
              ) : totalFiles === 0 ? (
                'No project loaded'
              ) : (
                'Type to search in project...'
              )}
            </div>
          ) : (
            results.map((result, idx) => {
              const lang = getLangFromPath(result.path);
              const fileName = result.path.split('/').pop() || result.path;
              const dirPath = result.path.split('/').slice(0, -1).join('/');

              return (
                <div
                  key={`${result.path}-${idx}`}
                  onClick={() => handleSelectFile(result)}
                  className={clsx(
                    'px-4 py-2.5 cursor-pointer transition-colors border-l-2',
                    idx === selectedIndex
                      ? 'bg-[#7b5cff]/20 border-[#7b5cff]'
                      : 'hover:bg-white/5 border-transparent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* File Icon */}
                    <span className="text-base flex-shrink-0">
                      {FILE_ICONS[lang]}
                    </span>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      {/* File Name */}
                      <div className="text-sm truncate text-[#f5f3ff]">
                        {highlightMatch(fileName, query)}
                      </div>
                      {/* File Path */}
                      <div className="text-[10px] text-[#5a4d7a] truncate">
                        {dirPath}
                      </div>
                    </div>

                    {/* Match Reason Badge */}
                    {result.reason && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] bg-[#251347] text-[#a89fd4]">
                        {result.reason}
                      </span>
                    )}

                    {/* Score */}
                    <span className="flex-shrink-0 text-[9px] text-[#5a4d7a]">
                      {Math.round(result.score)}
                    </span>
                  </div>

                  {/* Snippet Preview (for text matches) */}
                  {result.snippet && (
                    <div className="mt-2 ml-8 text-[11px] text-[#6b5f8a] font-mono truncate bg-[#0a0015]/50 px-2 py-1 rounded">
                      {highlightMatch(result.snippet, query)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#2a1555] px-4 py-2 text-[10px] text-[#5a4d7a]">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#1a0a35] text-[#a89fd4] mr-1">↑↓</kbd>
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#1a0a35] text-[#a89fd4] mr-1">↵</kbd>
              Open
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#1a0a35] text-[#a89fd4] mr-1">Tab</kbd>
              Filter
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#1a0a35] text-[#a89fd4] mr-1">Esc</kbd>
              Close
            </span>
          </div>
          <span>
            {results.length} results
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProjectSearchPanel;
