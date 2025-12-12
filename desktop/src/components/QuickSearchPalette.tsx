// desktop/src/components/QuickSearchPalette.tsx
// Phase 120.3: Quick File Search Palette (Cmd+P)
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import { useProjectIndex } from '../hooks/useProjectIndex';
import type { SearchResult, IndexedFileLanguage } from '../../indexer/types';

// File type icons (emoji for simplicity - can be replaced with proper icons)
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

type QuickSearchPaletteProps = {
  isOpen: boolean;
  onClose: () => void;
  projectRoot?: string;
  onSelectFile: (fullPath: string) => void;
};

export const QuickSearchPalette: React.FC<QuickSearchPaletteProps> = ({
  isOpen,
  onClose,
  projectRoot,
  onSelectFile,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { search, isLoading, totalFiles, scanProject, indexedAt } = useProjectIndex(projectRoot);

  // Search results
  const results = search(query, 20);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      // Auto-scan if no index exists
      if (totalFiles === 0) {
        scanProject();
      }
    }
  }, [isOpen, totalFiles, scanProject]);

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
      }
    },
    [results, selectedIndex, onClose]
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
  const handleSelectFile = (result: SearchResult) => {
    const fullPath = projectRoot
      ? `${projectRoot}/${result.file.relativePath}`
      : result.file.relativePath;
    onSelectFile(fullPath);
    onClose();
  };

  // Highlight matched characters
  const renderHighlightedText = (text: string, matches: [number, number][]) => {
    if (matches.length === 0) {
      return <span>{text}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const [start, end] of matches) {
      if (start > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`} className="text-[#a89fd4]">
            {text.slice(lastIndex, start)}
          </span>
        );
      }
      parts.push(
        <span key={`match-${start}`} className="text-[#f5f3ff] font-medium bg-[#7b5cff]/30 px-0.5 rounded">
          {text.slice(start, end)}
        </span>
      );
      lastIndex = end;
    }

    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="text-[#a89fd4]">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return <>{parts}</>;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div className="relative w-full max-w-2xl mx-4 rounded-xl border border-[#3a2070] bg-gradient-to-b from-[#0f0025] to-[#080018] shadow-[0_25px_80px_rgba(0,0,0,0.8)]">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-[#2a1555] px-4 py-3">
          <span className="text-[#7b5cff] text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name..."
            className="flex-1 bg-transparent text-[#f5f3ff] placeholder-[#6b5f8a] text-sm outline-none"
          />
          {isLoading && (
            <span className="text-[10px] text-[#7b5cff] animate-pulse">Indexing...</span>
          )}
          <span className="text-[10px] text-[#5a4d7a]">
            {totalFiles} files
          </span>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[#342065] scrollbar-track-transparent"
        >
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#6b5f8a] text-sm">
              {query ? 'No files found' : 'Type to search...'}
            </div>
          ) : (
            results.map((result, idx) => (
              <div
                key={result.file.relativePath}
                onClick={() => handleSelectFile(result)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                  idx === selectedIndex
                    ? 'bg-[#7b5cff]/20 border-l-2 border-[#7b5cff]'
                    : 'hover:bg-white/5 border-l-2 border-transparent'
                )}
              >
                {/* File Icon */}
                <span className="text-base flex-shrink-0">
                  {FILE_ICONS[result.file.lang]}
                </span>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  {/* File Name */}
                  <div className="text-sm truncate">
                    {renderHighlightedText(result.file.name, result.matches)}
                  </div>
                  {/* File Path */}
                  <div className="text-[10px] text-[#5a4d7a] truncate">
                    {result.file.relativePath}
                  </div>
                </div>

                {/* File Extension Badge */}
                <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase bg-[#251347] text-[#a89fd4]">
                  {result.file.ext}
                </span>
              </div>
            ))
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
              <kbd className="px-1.5 py-0.5 rounded bg-[#1a0a35] text-[#a89fd4] mr-1">Esc</kbd>
              Close
            </span>
          </div>
          {indexedAt && (
            <span>
              Indexed {new Date(indexedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickSearchPalette;
