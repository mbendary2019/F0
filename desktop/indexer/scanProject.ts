// desktop/indexer/scanProject.ts
// Phase 120.1: Project scanner - walks directory tree and builds index
// Phase 121.2: Added symbol extraction for JS/TS files
// Phase 122.1: Added snippet extraction for full-text search

import * as fs from 'fs';
import * as path from 'path';
import {
  type IndexedFile,
  type IndexedFileLanguage,
  type ProjectIndex,
  getLangFromExt,
  SKIP_DIRS,
  SKIP_FILES,
  INCLUDE_EXTENSIONS,
} from './types';
import { getProjectIndexPath, getIndexDir } from './path';
import { extractSymbolsAndExports } from './parseSymbols';

// Max file size for symbol extraction (100KB)
const MAX_SYMBOL_PARSE_SIZE = 100 * 1024;

// Max snippet size (2KB) - first 2000 chars of file
const MAX_SNIPPET_SIZE = 2000;

// Languages that support symbol extraction
const SYMBOL_LANGUAGES: Set<IndexedFileLanguage> = new Set([
  'typescript',
  'javascript',
  'tsx',
  'jsx',
]);

// Languages that support snippet extraction (text files)
const SNIPPET_LANGUAGES: Set<IndexedFileLanguage> = new Set([
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'json',
  'css',
  'scss',
  'html',
  'markdown',
  'yaml',
  'python',
  'rust',
  'go',
]);

/**
 * Recursively walk a directory and collect files
 */
async function walkDir(
  dir: string,
  projectRoot: string,
  files: IndexedFile[]
): Promise<void> {
  let entries: fs.Dirent[];

  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    // Permission denied or other error - skip this directory
    console.warn(`[indexer] Cannot read directory: ${dir}`);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip excluded directories
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      // Recurse into subdirectory
      await walkDir(fullPath, projectRoot, files);
    } else if (entry.isFile()) {
      // Skip excluded files
      if (SKIP_FILES.has(entry.name)) {
        continue;
      }

      // Get extension
      const ext = path.extname(entry.name).slice(1).toLowerCase();

      // Only include files with known extensions
      if (!INCLUDE_EXTENSIONS.has(ext)) {
        continue;
      }

      // Get file stats
      let stats: fs.Stats;
      try {
        stats = await fs.promises.stat(fullPath);
      } catch {
        continue; // Skip if we can't stat
      }

      const relativePath = path.relative(projectRoot, fullPath);
      const lang = getLangFromExt(ext);

      // Phase 121.2: Extract symbols for JS/TS files
      // Phase 122.1: Extract snippets for text search
      let symbols: string[] | undefined;
      let fileExports: string[] | undefined;
      let snippet: string | undefined;
      let content: string | null = null;

      // Read content for text files (needed for both symbols and snippets)
      if (SNIPPET_LANGUAGES.has(lang) && stats.size <= MAX_SYMBOL_PARSE_SIZE) {
        try {
          content = await fs.promises.readFile(fullPath, 'utf-8');
          // Phase 122.1: Extract snippet (first 2000 chars)
          if (content.length > 0) {
            snippet = content.slice(0, MAX_SNIPPET_SIZE);
          }
        } catch {
          // Skip on read error
        }
      }

      // Extract symbols for JS/TS files
      if (content && SYMBOL_LANGUAGES.has(lang)) {
        try {
          const extracted = extractSymbolsAndExports(content, lang);
          if (extracted.symbols.length > 0) {
            symbols = extracted.symbols;
          }
          if (extracted.exports.length > 0) {
            fileExports = extracted.exports;
          }
        } catch {
          // Skip symbol extraction on parse error
        }
      }

      const indexedFile: IndexedFile = {
        relativePath,
        name: entry.name,
        ext,
        lang,
        sizeBytes: stats.size,
        mtime: stats.mtimeMs,
      };

      // Only add symbols/exports/snippet if they exist
      if (symbols) indexedFile.symbols = symbols;
      if (fileExports) indexedFile.exports = fileExports;
      if (snippet) indexedFile.snippet = snippet;

      files.push(indexedFile);
    }
  }
}

/**
 * Scan a project directory and build an index
 * @param projectRoot - Absolute path to the project root
 * @returns The complete project index
 */
export async function scanProject(projectRoot: string): Promise<ProjectIndex> {
  const files: IndexedFile[] = [];
  const startTime = Date.now();

  console.log(`[indexer] Scanning project: ${projectRoot}`);

  await walkDir(projectRoot, projectRoot, files);

  // Sort files by relative path for consistent ordering
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const index: ProjectIndex = {
    version: 3, // Phase 122: Now includes snippets for text search
    projectRoot,
    indexedAt: Date.now(),
    totalFiles: files.length,
    files,
  };

  const elapsed = Date.now() - startTime;
  console.log(`[indexer] Indexed ${files.length} files in ${elapsed}ms`);

  return index;
}

/**
 * Scan project and save index to disk
 * @param projectRoot - Absolute path to the project root
 * @returns The saved project index
 */
export async function scanAndSaveProject(projectRoot: string): Promise<ProjectIndex> {
  const index = await scanProject(projectRoot);

  // Ensure .f0/index directory exists
  const indexDir = getIndexDir(projectRoot);
  await fs.promises.mkdir(indexDir, { recursive: true });

  // Write index to disk
  const indexPath = getProjectIndexPath(projectRoot);
  await fs.promises.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

  console.log(`[indexer] Saved index to: ${indexPath}`);

  return index;
}

/**
 * Load existing project index from disk
 * @param projectRoot - Absolute path to the project root
 * @returns The project index or null if not found
 */
export async function loadProjectIndex(projectRoot: string): Promise<ProjectIndex | null> {
  const indexPath = getProjectIndexPath(projectRoot);

  try {
    const content = await fs.promises.readFile(indexPath, 'utf-8');
    return JSON.parse(content) as ProjectIndex;
  } catch {
    return null;
  }
}

/**
 * Check if project index exists and is recent (within maxAge ms)
 * @param projectRoot - Absolute path to the project root
 * @param maxAgeMs - Maximum age in milliseconds (default 5 minutes)
 * @returns true if a recent index exists
 */
export async function hasRecentIndex(
  projectRoot: string,
  maxAgeMs: number = 5 * 60 * 1000
): Promise<boolean> {
  const index = await loadProjectIndex(projectRoot);
  if (!index) return false;

  const age = Date.now() - index.indexedAt;
  return age < maxAgeMs;
}
