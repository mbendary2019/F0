// desktop/src/hooks/useProjectIndex.ts
// Phase 120.1: Hook for project indexing and quick search

import { useState, useEffect, useCallback } from 'react';
import type { ProjectIndex, IndexedFile, SearchResult } from '../../indexer/types';

// Extend Window interface for TypeScript (matches preload.ts)
declare global {
  interface Window {
    f0Desktop?: {
      openFolder: () => Promise<any>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      runCommand: (id: string, projectPath: string, command: string) => void;
      killRunner: (id: string) => void;
      getAllowedCommands: () => Promise<string[]>;
      onRunnerStart: (callback: (payload: any) => void) => () => void;
      onRunnerLog: (callback: (payload: any) => void) => () => void;
      onRunnerEnd: (callback: (payload: any) => void) => () => void;
      onRunnerError: (callback: (payload: any) => void) => () => void;
      getRunnerContext: (lineLimit?: number) => Promise<string>;
      clearRunnerContext: () => Promise<boolean>;
      openExternal: (url: string) => void;
      // Phase 120: Project Indexer APIs
      setProjectRoot: (projectRoot: string) => Promise<boolean>;
      scanProject: (projectRoot?: string) => Promise<ProjectIndex>;
      getProjectIndex: (projectRoot?: string) => Promise<ProjectIndex | null>;
    };
  }
}

/**
 * Fuzzy match scoring algorithm
 * Returns score (higher = better match) and match ranges
 */
function fuzzyMatch(
  query: string,
  target: string
): { score: number; matches: [number, number][] } | null {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  // Empty query matches everything with score 0
  if (!query) {
    return { score: 0, matches: [] };
  }

  let queryIdx = 0;
  let score = 0;
  const matches: [number, number][] = [];
  let consecutiveMatches = 0;
  let lastMatchIdx = -1;

  for (let i = 0; i < targetLower.length && queryIdx < queryLower.length; i++) {
    if (targetLower[i] === queryLower[queryIdx]) {
      // Bonus for consecutive matches
      if (lastMatchIdx === i - 1) {
        consecutiveMatches++;
        score += 2 * consecutiveMatches; // Exponential bonus for consecutive
      } else {
        consecutiveMatches = 1;
        score += 1;
      }

      // Bonus for matching at word boundaries
      if (i === 0 || target[i - 1] === '/' || target[i - 1] === '.' || target[i - 1] === '-' || target[i - 1] === '_') {
        score += 5;
      }

      // Bonus for matching uppercase (camelCase)
      if (target[i] === target[i].toUpperCase() && target[i] !== target[i].toLowerCase()) {
        score += 3;
      }

      // Track match range
      if (matches.length > 0 && matches[matches.length - 1][1] === i) {
        // Extend previous range
        matches[matches.length - 1][1] = i + 1;
      } else {
        // New range
        matches.push([i, i + 1]);
      }

      lastMatchIdx = i;
      queryIdx++;
    }
  }

  // Did we match all query characters?
  if (queryIdx < queryLower.length) {
    return null; // No match
  }

  // Bonus for shorter targets (prefer exact matches)
  score += Math.max(0, 20 - target.length);

  // Bonus for matching file name vs path
  const fileName = target.split('/').pop() || target;
  if (fileName.toLowerCase().includes(queryLower)) {
    score += 10;
  }

  return { score, matches };
}

/**
 * Search files in the index
 */
function searchFiles(
  files: IndexedFile[],
  query: string,
  limit: number = 20
): SearchResult[] {
  if (!query.trim()) {
    // Return recent files when no query
    return files.slice(0, limit).map((file) => ({
      file,
      score: 0,
      matches: [],
    }));
  }

  const results: SearchResult[] = [];

  for (const file of files) {
    // Try matching against relative path
    const pathMatch = fuzzyMatch(query, file.relativePath);
    if (pathMatch) {
      results.push({
        file,
        score: pathMatch.score,
        matches: pathMatch.matches,
      });
      continue;
    }

    // Try matching against just the file name
    const nameMatch = fuzzyMatch(query, file.name);
    if (nameMatch) {
      results.push({
        file,
        score: nameMatch.score,
        matches: nameMatch.matches,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

export type UseProjectIndexReturn = {
  /** The loaded project index (null if not loaded) */
  index: ProjectIndex | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Scan/rescan the project */
  scanProject: () => Promise<void>;
  /** Search files in the index */
  search: (query: string, limit?: number) => SearchResult[];
  /** Total number of indexed files */
  totalFiles: number;
  /** When the index was last updated */
  indexedAt: number | null;
};

/**
 * Hook for project indexing and quick search
 * @param projectRoot - Optional project root path (uses stored root if not provided)
 */
export function useProjectIndex(projectRoot?: string): UseProjectIndexReturn {
  const [index, setIndex] = useState<ProjectIndex | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing index on mount (or auto-scan if not found)
  useEffect(() => {
    const loadIndex = async () => {
      const f0 = window.f0Desktop;
      if (!f0) return;

      // Phase 123: Don't try to load/scan if no project root is set
      if (!projectRoot) {
        console.log('[useProjectIndex] No project root yet, skipping load');
        setIndex(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const existingIndex = await f0.getProjectIndex(projectRoot);
        if (existingIndex) {
          console.log('[useProjectIndex] ✅ Found existing index:', existingIndex.totalFiles, 'files');
          setIndex(existingIndex);
        } else {
          // Phase 123: Auto-scan when no index found
          console.warn('[useProjectIndex] No existing index found → auto-scanning project…');
          const newIndex = await f0.scanProject(projectRoot);
          console.log('[useProjectIndex] ✅ Auto-scan complete:', newIndex.totalFiles, 'files');
          setIndex(newIndex);
        }
      } catch (err) {
        console.error('[useProjectIndex] Failed to load/scan index:', err);
        setError(err instanceof Error ? err.message : 'Failed to load index');
      } finally {
        setIsLoading(false);
      }
    };

    loadIndex();
  }, [projectRoot]);

  // Scan project function
  const scanProject = useCallback(async () => {
    const f0 = window.f0Desktop;
    if (!f0) {
      setError('F0 Desktop API not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newIndex = await f0.scanProject(projectRoot);
      setIndex(newIndex);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan project';
      setError(message);
      console.error('[useProjectIndex] Scan error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectRoot]);

  // Search function (memoized to avoid recreating on each render)
  const search = useCallback(
    (query: string, limit: number = 20): SearchResult[] => {
      if (!index) return [];
      return searchFiles(index.files, query, limit);
    },
    [index]
  );

  // Derived values
  const totalFiles = index?.totalFiles ?? 0;
  const indexedAt = index?.indexedAt ?? null;

  return {
    index,
    isLoading,
    error,
    scanProject,
    search,
    totalFiles,
    indexedAt,
  };
}

export default useProjectIndex;
