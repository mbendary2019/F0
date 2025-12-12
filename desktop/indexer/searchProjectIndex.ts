// desktop/indexer/searchProjectIndex.ts
// Phase 121.3: SEARCH_PROJECT_INDEX tool for Agent
// Allows Agent to search files, symbols, and exports in the project index
// Phase 122.2: Added text search support for full-text search in snippets

import {
  type ProjectIndex,
  type ProjectSearchResult,
  type ProjectSearchType,
} from './types';
import { loadProjectIndex } from './scanProject';

/**
 * Phase 122.3: Load project index in renderer via f0Desktop bridge
 * Falls back to Node.js fs for main process / testing
 */
async function loadProjectIndexForRenderer(projectRoot: string): Promise<ProjectIndex | null> {
  const indexPath = `${projectRoot}/.f0/index/project-index.json`;

  // Check if we're in renderer with f0Desktop bridge
  if (typeof window !== 'undefined' && (window as any).f0Desktop?.readFile) {
    try {
      console.log('[searchProjectIndex] Loading index via f0Desktop:', indexPath);
      const content = await (window as any).f0Desktop.readFile(indexPath);
      if (content) {
        const parsed = JSON.parse(content) as ProjectIndex;
        console.log('[searchProjectIndex] Index loaded, files:', parsed.files?.length);
        return parsed;
      }
      console.warn('[searchProjectIndex] Index file empty or not found');
      return null;
    } catch (err) {
      console.warn('[searchProjectIndex] Failed to load index via f0Desktop:', err);
      return null;
    }
  }

  // Fallback to Node.js fs (for main process / testing)
  return loadProjectIndex(projectRoot);
}

/**
 * Calculate fuzzy match score between query and target
 * Higher score = better match
 */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact match
  if (t === q) return 100;

  // Starts with query (high score)
  if (t.startsWith(q)) return 80;

  // Contains query as substring
  if (t.includes(q)) return 60;

  // Fuzzy character matching
  let qIdx = 0;
  let score = 0;
  let consecutive = 0;

  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      qIdx++;
      consecutive++;
      // Bonus for consecutive matches
      score += consecutive * 2;
    } else {
      consecutive = 0;
    }
  }

  // Did we match all query characters?
  if (qIdx < q.length) return 0;

  // Normalize by query length
  return Math.min(50, score);
}

/**
 * Search for files by name/path
 */
function searchFiles(
  index: ProjectIndex,
  query: string,
  limit: number
): ProjectSearchResult[] {
  const results: ProjectSearchResult[] = [];

  for (const file of index.files) {
    // Try matching against filename first (higher weight)
    let score = fuzzyScore(query, file.name);

    // Also try matching against relative path
    const pathScore = fuzzyScore(query, file.relativePath);
    if (pathScore > score) {
      score = pathScore * 0.8; // Slight penalty for path match vs filename
    }

    if (score > 0) {
      results.push({
        path: file.relativePath,
        score,
        reason: 'filename',
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Search for symbols (functions, classes, hooks, etc.)
 */
function searchSymbols(
  index: ProjectIndex,
  query: string,
  limit: number
): ProjectSearchResult[] {
  const results: ProjectSearchResult[] = [];

  for (const file of index.files) {
    if (!file.symbols || file.symbols.length === 0) continue;

    for (const symbol of file.symbols) {
      const score = fuzzyScore(query, symbol);
      if (score > 0) {
        results.push({
          path: file.relativePath,
          score,
          reason: `symbol: ${symbol}`,
        });
        // Only add one match per file to avoid duplicates
        break;
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Search for exports
 */
function searchExports(
  index: ProjectIndex,
  query: string,
  limit: number
): ProjectSearchResult[] {
  const results: ProjectSearchResult[] = [];

  for (const file of index.files) {
    if (!file.exports || file.exports.length === 0) continue;

    for (const exportName of file.exports) {
      const score = fuzzyScore(query, exportName);
      if (score > 0) {
        results.push({
          path: file.relativePath,
          score,
          reason: `export: ${exportName}`,
        });
        // Only add one match per file to avoid duplicates
        break;
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Phase 122.2: Score text match in snippet
 * Returns score based on position and presence of query in snippet
 */
function scoreTextMatch(snippet: string | undefined, query: string): number {
  if (!snippet) return 0;

  const q = query.toLowerCase();
  const s = snippet.toLowerCase();

  if (!s.includes(q)) return 0;

  // Base score for having the match
  let score = 40;

  // Bonus for match position (earlier = better)
  const index = s.indexOf(q);
  if (index < 100) score += 20;
  if (index < 20) score += 10;

  return score;
}

/**
 * Phase 122.2: Extract a snippet around the match for display
 */
function extractMatchSnippet(snippet: string, query: string): string {
  const q = query.toLowerCase();
  const s = snippet.toLowerCase();
  const index = s.indexOf(q);

  if (index === -1) return snippet.slice(0, 200);

  // Get ~50 chars before and ~150 chars after the match
  const start = Math.max(0, index - 50);
  const end = Math.min(snippet.length, index + query.length + 150);

  let result = snippet.slice(start, end);

  // Add ellipsis if truncated
  if (start > 0) result = '...' + result;
  if (end < snippet.length) result = result + '...';

  return result;
}

/**
 * Phase 122.2: Search for text in file snippets
 */
function searchText(
  index: ProjectIndex,
  query: string,
  limit: number
): ProjectSearchResult[] {
  const results: ProjectSearchResult[] = [];

  for (const file of index.files) {
    if (!file.snippet) continue;

    const score = scoreTextMatch(file.snippet, query);
    if (score > 0) {
      results.push({
        path: file.relativePath,
        score,
        reason: 'text match',
        snippet: extractMatchSnippet(file.snippet, query),
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Search across all (files, symbols, exports, text) and merge results
 */
function searchAll(
  index: ProjectIndex,
  query: string,
  limit: number
): ProjectSearchResult[] {
  // Get results from all search types
  const fileResults = searchFiles(index, query, limit);
  const symbolResults = searchSymbols(index, query, limit);
  const exportResults = searchExports(index, query, limit);
  const textResults = searchText(index, query, limit);

  // Merge and deduplicate by path, keeping highest score
  const byPath = new Map<string, ProjectSearchResult>();

  const addResult = (result: ProjectSearchResult) => {
    const existing = byPath.get(result.path);
    if (!existing || result.score > existing.score) {
      byPath.set(result.path, result);
    }
  };

  // Add all results (symbols/exports get slight priority boost)
  symbolResults.forEach((r) => addResult({ ...r, score: r.score * 1.1 }));
  exportResults.forEach((r) => addResult({ ...r, score: r.score * 1.05 }));
  fileResults.forEach(addResult);
  textResults.forEach(addResult);

  // Sort by score descending
  const merged = Array.from(byPath.values());
  merged.sort((a, b) => b.score - a.score);

  return merged.slice(0, limit);
}

/**
 * Main search function for Agent tool
 * @param projectRoot - Absolute path to the project root
 * @param query - Search query string
 * @param type - Search type: 'file', 'symbol', 'export', or 'all'
 * @param limit - Maximum number of results (default 20)
 * @returns Array of search results with path, score, and reason
 */
export async function searchProjectIndex(
  projectRoot: string,
  query: string,
  type: ProjectSearchType = 'all',
  limit: number = 20
): Promise<ProjectSearchResult[]> {
  // Phase 122.3: Use renderer-compatible loader (f0Desktop bridge)
  const index = await loadProjectIndexForRenderer(projectRoot);

  if (!index) {
    console.warn(`[searchProjectIndex] No index found for: ${projectRoot}`);
    return [];
  }

  // Validate query
  if (!query || query.trim().length === 0) {
    return [];
  }

  const trimmedQuery = query.trim();

  // Route to appropriate search function
  switch (type) {
    case 'file':
      return searchFiles(index, trimmedQuery, limit);
    case 'symbol':
      return searchSymbols(index, trimmedQuery, limit);
    case 'export':
      return searchExports(index, trimmedQuery, limit);
    case 'text':
      return searchText(index, trimmedQuery, limit);
    case 'all':
    default:
      return searchAll(index, trimmedQuery, limit);
  }
}

export default searchProjectIndex;
