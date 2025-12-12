// desktop/src/components/SearchPane.tsx
// Phase 122.4: Sidebar Search Pane with include/exclude filters
// VS Code-like search interface in the sidebar

import React, { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import type { ProjectSearchResult, IndexedFileLanguage } from '../../indexer/types';

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

// Check if file matches glob pattern (simplified)
function matchesGlob(filePath: string, pattern: string): boolean {
  if (!pattern.trim()) return true;

  // Split by comma for multiple patterns
  const patterns = pattern.split(',').map(p => p.trim()).filter(Boolean);
  if (patterns.length === 0) return true;

  return patterns.some(p => {
    // Convert glob to regex (simplified)
    const regexStr = p
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    try {
      const regex = new RegExp(regexStr, 'i');
      return regex.test(filePath);
    } catch {
      // If regex is invalid, do simple includes check
      return filePath.toLowerCase().includes(p.toLowerCase());
    }
  });
}

type SearchPaneProps = {
  projectRoot?: string;
  openFiles: { path: string }[];
  onSelectFile: (fullPath: string) => void;
};

// Default exclude patterns (like VS Code/Cursor)
const DEFAULT_EXCLUDE = 'node_modules, .git, .next, dist, build, coverage';

export const SearchPane: React.FC<SearchPaneProps> = ({
  projectRoot,
  openFiles,
  onSelectFile,
}) => {
  const [query, setQuery] = useState('');
  const [includePattern, setIncludePattern] = useState('');
  const [excludePattern, setExcludePattern] = useState(DEFAULT_EXCLUDE);
  const [searchOpenOnly, setSearchOpenOnly] = useState(false);
  const [results, setResults] = useState<ProjectSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [totalFiles, setTotalFiles] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const hasIndexed = useRef(false);

  // Auto-index when component mounts
  useEffect(() => {
    if (!projectRoot || hasIndexed.current) return;

    hasIndexed.current = true;
    const f0 = window.f0Desktop as any;
    if (!f0?.getProjectIndex || !f0?.scanProject) return;

    f0.getProjectIndex(projectRoot).then((existingIndex: any) => {
      if (existingIndex && existingIndex.files?.length > 0) {
        setTotalFiles(existingIndex.files.length);
      } else {
        setIsIndexing(true);
        f0.scanProject(projectRoot).then((newIndex: any) => {
          setTotalFiles(newIndex?.files?.length || 0);
          setIsIndexing(false);
        }).catch(() => setIsIndexing(false));
      }
    }).catch(() => {});
  }, [projectRoot]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !projectRoot || isIndexing) {
      if (!isIndexing) setResults([]);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const f0 = window.f0Desktop as any;
        if (f0?.searchProjectIndex) {
          let searchResults = await f0.searchProjectIndex(
            query,
            'all',
            100,
            projectRoot
          );

          // Filter by include pattern
          if (includePattern.trim()) {
            searchResults = searchResults.filter((r: ProjectSearchResult) =>
              matchesGlob(r.path, includePattern)
            );
          }

          // Filter by exclude pattern
          if (excludePattern.trim()) {
            searchResults = searchResults.filter((r: ProjectSearchResult) =>
              !matchesGlob(r.path, excludePattern)
            );
          }

          // Filter to open files only
          if (searchOpenOnly && openFiles.length > 0) {
            const openPaths = new Set(openFiles.map(f => f.path));
            searchResults = searchResults.filter((r: ProjectSearchResult) => {
              const fullPath = `${projectRoot}/${r.path}`;
              return openPaths.has(fullPath) || openPaths.has(r.path);
            });
          }

          setResults(searchResults.slice(0, 50));
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('[SearchPane] Search error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, includePattern, excludePattern, searchOpenOnly, projectRoot, isIndexing, openFiles]);

  // Handle file selection
  const handleSelectFile = useCallback((result: ProjectSearchResult) => {
    const fullPath = projectRoot
      ? `${projectRoot}/${result.path}`
      : result.path;
    onSelectFile(fullPath);
  }, [projectRoot, onSelectFile]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectFile(results[selectedIndex]);
        }
        break;
    }
  }, [results, selectedIndex, handleSelectFile]);

  // Scroll selected into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Highlight match in text
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

  return (
    <div className="flex flex-col h-full bg-[#0a0015]">
      {/* Search Input - Neon Style */}
      <div className="p-2 border-b border-[#251347] bg-gradient-to-b from-[#0a0015] to-[#08001b]">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7c3aed] text-sm drop-shadow-[0_0_4px_rgba(124,58,237,0.5)]">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            className="w-full bg-[#0f0228] text-[#f5f3ff] placeholder-[#6b5f8a] text-sm pl-8 pr-3 py-2 rounded-md border border-[#251347] focus:border-[#7c3aed] focus:shadow-[0_0_12px_rgba(124,58,237,0.25)] focus:outline-none transition-all duration-200"
          />
          {isLoading && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#7c3aed] animate-pulse drop-shadow-[0_0_4px_rgba(124,58,237,0.8)]">
              ●●●
            </span>
          )}
        </div>
      </div>

      {/* Filters Toggle & Open Files Toggle - Neon Style */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#251347] text-[10px] bg-gradient-to-r from-[#08001b]/50 to-[#0f0228]/50">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all duration-200',
            showFilters
              ? 'bg-gradient-to-b from-[#7c3aed]/25 to-[#7c3aed]/10 text-[#e0dbff] shadow-[0_0_8px_rgba(124,58,237,0.3)] border border-[#7c3aed]/40'
              : 'text-[#6b5f8a] hover:text-[#a89fd4] hover:bg-[#7c3aed]/10 border border-transparent'
          )}
        >
          <span className={clsx(
            'text-[9px] transition-transform duration-200',
            showFilters && 'drop-shadow-[0_0_3px_rgba(124,58,237,0.8)]'
          )}>{showFilters ? '▼' : '▶'}</span>
          <span>Filters</span>
        </button>

        <button
          onClick={() => setSearchOpenOnly(!searchOpenOnly)}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all duration-200',
            searchOpenOnly
              ? 'bg-gradient-to-b from-[#7c3aed]/25 to-[#7c3aed]/10 text-[#e0dbff] shadow-[0_0_8px_rgba(124,58,237,0.3)] border border-[#7c3aed]/40'
              : 'text-[#6b5f8a] hover:text-[#a89fd4] hover:bg-[#7c3aed]/10 border border-transparent'
          )}
          title="Search only in open editors"
        >
          <span className={clsx(
            'w-3 h-3 rounded border flex items-center justify-center text-[8px] transition-all duration-200',
            searchOpenOnly
              ? 'bg-[#7c3aed] border-[#7c3aed] text-white shadow-[0_0_6px_rgba(124,58,237,0.6)]'
              : 'border-[#5a4d7a] hover:border-[#7c3aed]/50'
          )}>
            {searchOpenOnly && '✓'}
          </span>
          <span>Open Editors</span>
        </button>
      </div>

      {/* Filters Panel (collapsible) - Neon Style */}
      {showFilters && (
        <div className="px-2 py-2 border-b border-[#251347] space-y-2 bg-gradient-to-b from-[#0a0015] to-[#08001b]">
          {/* Header with Reset */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#a89fd4] font-medium">Search Filters</span>
            <button
              onClick={() => {
                setIncludePattern('');
                setExcludePattern(DEFAULT_EXCLUDE);
              }}
              className="text-[9px] px-2 py-0.5 rounded text-[#7c3aed] hover:text-[#e0dbff] hover:bg-[#7c3aed]/20 transition-all duration-200 border border-transparent hover:border-[#7c3aed]/30"
            >
              Reset
            </button>
          </div>

          {/* Files to Include */}
          <div>
            <label className="block text-[10px] text-[#6b5f8a] mb-1">
              Files to include
            </label>
            <input
              type="text"
              value={includePattern}
              onChange={(e) => setIncludePattern(e.target.value)}
              placeholder="e.g. *.tsx, src/** (empty = all)"
              className="w-full bg-[#0f0228] text-[#f5f3ff] placeholder-[#5a4d7a] text-xs px-2.5 py-1.5 rounded-md border border-[#251347] focus:border-[#7c3aed] focus:shadow-[0_0_8px_rgba(124,58,237,0.2)] focus:outline-none transition-all duration-200"
            />
          </div>

          {/* Files to Exclude */}
          <div>
            <label className="block text-[10px] text-[#6b5f8a] mb-1">
              Files to exclude
            </label>
            <input
              type="text"
              value={excludePattern}
              onChange={(e) => setExcludePattern(e.target.value)}
              placeholder="e.g. node_modules, *.test.ts"
              className="w-full bg-[#0f0228] text-[#f5f3ff] placeholder-[#5a4d7a] text-xs px-2.5 py-1.5 rounded-md border border-[#251347] focus:border-[#7c3aed] focus:shadow-[0_0_8px_rgba(124,58,237,0.2)] focus:outline-none transition-all duration-200"
            />
          </div>
        </div>
      )}

      {/* Status Bar - Neon Style */}
      <div className="px-2 py-1.5 text-[10px] text-[#6b5f8a] border-b border-[#251347] flex items-center justify-between bg-[#08001b]/50">
        {isIndexing ? (
          <span className="text-[#7c3aed] animate-pulse flex items-center gap-1.5">
            <span className="drop-shadow-[0_0_4px_rgba(124,58,237,0.8)]">⚡</span>
            Indexing project...
          </span>
        ) : (
          <>
            <span className={results.length > 0 ? 'text-[#a89fd4]' : ''}>
              {results.length > 0
                ? `${results.length} result${results.length > 1 ? 's' : ''}`
                : query
                ? 'No results'
                : `${totalFiles} files indexed`}
            </span>
            <span className="text-[#4a4570] font-mono">↑↓ navigate · ⏎ open</span>
          </>
        )}
      </div>

      {/* Results List */}
      <div
        ref={resultsRef}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#342065] scrollbar-track-transparent"
      >
        {results.length === 0 ? (
          <div className="px-3 py-6 text-center text-[#6b5f8a] text-xs">
            {isIndexing ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-xl animate-spin">⚙️</span>
                <span>Indexing project files...</span>
              </div>
            ) : query ? (
              <div className="flex flex-col items-center gap-1">
                <span>No results found</span>
                <span className="text-[10px] text-[#4a4570]">Try different keywords or adjust filters</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span>Type to search in project</span>
                <span className="text-[10px] text-[#4a4570]">Search files, symbols, and content</span>
              </div>
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
                  'px-2 py-1.5 cursor-pointer transition-colors border-l-2',
                  idx === selectedIndex
                    ? 'bg-[#7b5cff]/20 border-[#7b5cff]'
                    : 'hover:bg-white/5 border-transparent'
                )}
              >
                <div className="flex items-center gap-2">
                  {/* File Icon */}
                  <span className="text-xs flex-shrink-0">
                    {FILE_ICONS[lang]}
                  </span>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate text-[#f5f3ff]">
                      {highlightMatch(fileName, query)}
                    </div>
                    <div className="text-[9px] text-[#5a4d7a] truncate">
                      {dirPath}
                    </div>
                  </div>

                  {/* Match Reason */}
                  {result.reason && (
                    <span className="flex-shrink-0 px-1 py-0.5 rounded text-[8px] bg-[#251347] text-[#a89fd4]">
                      {result.reason}
                    </span>
                  )}
                </div>

                {/* Snippet Preview */}
                {result.snippet && (
                  <div className="mt-1 ml-5 text-[10px] text-[#6b5f8a] font-mono truncate bg-[#0a0015]/50 px-1.5 py-0.5 rounded">
                    {highlightMatch(result.snippet, query)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SearchPane;
