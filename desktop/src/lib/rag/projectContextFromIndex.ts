// desktop/src/lib/rag/projectContextFromIndex.ts
// Phase 122.0: RAG-Lite Helper - Get relevant files from project index
// Uses the indexer's search to find context files without embeddings

import { searchProjectIndex } from '../../../indexer/searchProjectIndex';
// Note: ProjectSearchType used for type casting in searchProjectIndex calls

/**
 * A file with its content for LLM context
 */
export interface ContextFile {
  path: string;
  content: string;
  score?: number;
  reason?: string;
}

/**
 * Strategy for finding context files
 */
export type ContextStrategy = 'by-symbol' | 'by-text' | 'hybrid';

/**
 * Options for getting context files
 */
export interface GetContextOptions {
  projectRoot: string;
  query: string;
  strategy?: ContextStrategy;
  maxFiles?: number;
  maxCharsPerFile?: number;
}

/**
 * Read file content safely
 */
async function readFileContent(
  projectRoot: string,
  relativePath: string,
  maxChars: number
): Promise<string | null> {
  try {
    // In Electron, use the f0Desktop bridge
    if (typeof window !== 'undefined' && (window as any).f0Desktop?.readFile) {
      const absPath = `${projectRoot}/${relativePath}`;
      const content = await (window as any).f0Desktop.readFile(absPath);
      return content ? content.slice(0, maxChars) : null;
    }

    // In Node.js environment (for testing)
    if (typeof require !== 'undefined') {
      const fs = require('fs').promises;
      const path = require('path');
      const absPath = path.join(projectRoot, relativePath);
      const content = await fs.readFile(absPath, 'utf-8');
      return content.slice(0, maxChars);
    }

    return null;
  } catch (err) {
    console.warn('[RAG] Failed to read file:', relativePath, err);
    return null;
  }
}

/**
 * Get context files from the project index based on a query
 *
 * @param options - Configuration options
 * @returns Array of files with their content, sorted by relevance
 */
export async function getContextFilesFromIndex(
  options: GetContextOptions
): Promise<ContextFile[]> {
  const {
    projectRoot,
    query,
    strategy = 'hybrid',
    maxFiles = 6,
    maxCharsPerFile = 4000,
  } = options;

  // Collect search results
  const results: { path: string; score: number; reason?: string }[] = [];

  const addResults = (
    matches: { path: string; score: number; reason?: string }[]
  ) => {
    for (const m of matches) {
      results.push(m);
    }
  };

  // 1) Search by symbols (functions, classes, exports)
  if (strategy === 'by-symbol' || strategy === 'hybrid') {
    const symbolRes = await searchProjectIndex(projectRoot, query, 'symbol', maxFiles * 2);
    addResults(symbolRes);

    const exportRes = await searchProjectIndex(projectRoot, query, 'export', maxFiles);
    addResults(exportRes);

    const fileRes = await searchProjectIndex(projectRoot, query, 'file', maxFiles);
    addResults(fileRes);
  }

  // 2) Search by text content
  if (strategy === 'by-text' || strategy === 'hybrid') {
    const textRes = await searchProjectIndex(projectRoot, query, 'text', maxFiles * 2);
    addResults(textRes);
  }

  // Deduplicate by path, keeping highest score
  const unique = new Map<string, { score: number; reason?: string }>();
  for (const r of results) {
    const existing = unique.get(r.path);
    if (!existing || r.score > existing.score) {
      unique.set(r.path, { score: r.score, reason: r.reason });
    }
  }

  // Sort by score and take top N
  const sorted = Array.from(unique.entries())
    .map(([path, data]) => ({ path, ...data }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);

  // Read file contents
  const contextFiles: ContextFile[] = [];

  for (const r of sorted) {
    const content = await readFileContent(projectRoot, r.path, maxCharsPerFile);
    if (content) {
      contextFiles.push({
        path: r.path,
        content,
        score: r.score,
        reason: r.reason,
      });
    }
  }

  return contextFiles;
}

/**
 * Get context files using the "all" search (fastest)
 */
export async function getQuickContext(
  projectRoot: string,
  query: string,
  maxFiles: number = 5
): Promise<ContextFile[]> {
  const results = await searchProjectIndex(projectRoot, query, 'all', maxFiles);

  const contextFiles: ContextFile[] = [];

  for (const r of results) {
    const content = await readFileContent(projectRoot, r.path, 4000);
    if (content) {
      contextFiles.push({
        path: r.path,
        content,
        score: r.score,
        reason: r.reason,
      });
    }
  }

  return contextFiles;
}

export default getContextFilesFromIndex;
