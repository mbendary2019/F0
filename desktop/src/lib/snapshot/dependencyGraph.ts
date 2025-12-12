// desktop/src/lib/snapshot/dependencyGraph.ts
// Phase 124.1: Dependency Graph Engine
// Builds a "brain map" of the project - who imports who, what affects what

/**
 * A single file's dependency information
 */
export interface FileDependency {
  file: string;
  imports: string[];      // Files this file imports
  importedBy: string[];   // Files that import this file
  exports: string[];      // Named exports from this file
}

/**
 * The complete dependency graph
 */
export interface DependencyGraph {
  totalFiles: number;
  edges: number;           // Total import relationships
  nodes: FileDependency[];
  orphans: string[];       // Files with no imports and not imported by anyone
  entryPoints: string[];   // Files that are imported but don't import others (leaves)
  hubs: string[];          // Files with most connections (>10 importedBy)
  generatedAt: string;
}

/**
 * Summary statistics for quick display
 */
export interface DependencyStats {
  totalFiles: number;
  totalEdges: number;
  orphanCount: number;
  hubCount: number;
  avgImportsPerFile: number;
}

/**
 * Patterns to ignore when scanning
 */
const IGNORE_PATTERNS = [
  /node_modules/i,
  /\.next/i,
  /\.git/i,
  /dist\//i,
  /build\//i,
  /\.f0\//i,
  /\.d\.ts$/i,
  /\.map$/i,
  /\.lock$/i,
  /\.json$/i,
  /\.md$/i,
  /\.css$/i,
  /\.scss$/i,
  /\.svg$/i,
  /\.png$/i,
  /\.jpg$/i,
  /\.ico$/i,
];

/**
 * File extensions we care about for dependency analysis
 * Note: The index stores extensions WITHOUT dots (e.g., "ts" not ".ts")
 */
const CODE_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];

/**
 * Check if a file should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Check if a file is a code file we want to analyze
 * Supports both:
 * - ext field from index (e.g., "ts")
 * - path-based check (e.g., "file.ts")
 */
function isCodeFile(filePath: string, ext?: string): boolean {
  // If ext is provided (from index), use it directly
  if (ext) {
    return CODE_EXTENSIONS.includes(ext.toLowerCase());
  }
  // Fallback to path-based check
  return CODE_EXTENSIONS.some(e => filePath.toLowerCase().endsWith('.' + e));
}

/**
 * Extract imports from file content using regex
 * Handles:
 * - import { x } from './file'
 * - import x from './file'
 * - import * as x from './file'
 * - import './file'
 * - export { x } from './file'
 * - export * from './file'
 * - require('./file')
 * - dynamic import('./file')
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];

  // ES6 imports: import ... from 'path'
  const esImportRegex = /import\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = esImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Export from: export ... from 'path'
  const exportFromRegex = /export\s+(?:(?:[\w*{}\s,]+)\s+)?from\s+['"]([^'"]+)['"]/g;
  while ((match = exportFromRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // CommonJS require: require('path')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Dynamic import: import('path')
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Extract exports from file content
 */
function extractExports(content: string): string[] {
  const exports: string[] = [];

  // Named exports: export { name }
  const namedExportRegex = /export\s*\{\s*([^}]+)\s*\}/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(' ')[0]);
    exports.push(...names.filter(n => n && !n.startsWith('type')));
  }

  // Export const/function/class
  const directExportRegex = /export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)/g;
  while ((match = directExportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  // Default export
  if (/export\s+default/.test(content)) {
    exports.push('default');
  }

  return [...new Set(exports)];
}

/**
 * Resolve a relative import path to an absolute path
 * @param fromFile - The file doing the importing
 * @param importPath - The import path (e.g., '../utils/helper')
 * @param allFiles - List of all files in the project
 */
function resolveImportPath(
  fromFile: string,
  importPath: string,
  allFiles: string[]
): string | null {
  // Skip external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  // Get directory of the importing file
  const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));

  // Resolve relative path
  let resolvedPath: string;
  if (importPath.startsWith('./')) {
    resolvedPath = `${fromDir}/${importPath.substring(2)}`;
  } else if (importPath.startsWith('../')) {
    const parts = fromDir.split('/');
    let upCount = 0;
    let remainingPath = importPath;

    while (remainingPath.startsWith('../')) {
      upCount++;
      remainingPath = remainingPath.substring(3);
    }

    const newParts = parts.slice(0, -upCount);
    resolvedPath = [...newParts, remainingPath].join('/');
  } else if (importPath.startsWith('/')) {
    resolvedPath = importPath.substring(1);
  } else {
    // Alias or absolute path - try to find it
    resolvedPath = importPath;
  }

  // Clean up path
  resolvedPath = resolvedPath.replace(/\/\.\//g, '/').replace(/\/+/g, '/');

  // Try to find the actual file
  const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

  for (const ext of possibleExtensions) {
    const testPath = resolvedPath + ext;
    if (allFiles.includes(testPath)) {
      return testPath;
    }
  }

  // Handle @ aliases (common in Next.js)
  if (importPath.startsWith('@/')) {
    const aliasPath = 'src/' + importPath.substring(2);
    for (const ext of possibleExtensions) {
      const testPath = aliasPath + ext;
      if (allFiles.includes(testPath)) {
        return testPath;
      }
    }
  }

  return null;
}

/**
 * Read file content via f0Desktop bridge
 */
async function readFileContent(
  projectRoot: string,
  filePath: string
): Promise<string | null> {
  if (typeof window !== 'undefined' && (window as any).f0Desktop?.readFile) {
    try {
      const fullPath = filePath.startsWith(projectRoot)
        ? filePath
        : `${projectRoot}/${filePath}`;
      const content = await (window as any).f0Desktop.readFile(fullPath);
      return content;
    } catch (err) {
      console.warn('[dependencyGraph] readFile error for', filePath, err);
      return null;
    }
  }
  console.warn('[dependencyGraph] f0Desktop.readFile not available');
  return null;
}

/**
 * Index file type - matches the ProjectIndex structure from indexer/types.ts
 */
interface IndexFile {
  relativePath?: string;
  path?: string;  // Fallback for older index formats
  ext?: string;
  name?: string;
}

/**
 * Build the dependency graph for a project
 */
export async function buildDependencyGraph(
  projectRoot: string,
  index: { files: Array<IndexFile> }
): Promise<DependencyGraph> {
  console.log('[dependencyGraph] Building dependency graph...');

  // Debug: Log first few files to understand index structure
  if (index.files.length > 0) {
    const sample = index.files[0];
    console.log('[dependencyGraph] Sample file from index:', {
      relativePath: sample.relativePath,
      path: sample.path,
      ext: sample.ext,
      name: sample.name,
    });
  }

  // Filter to valid code files only
  // Support both relativePath (new index) and path (old format)
  const codeFiles = index.files
    .filter(f => {
      const filePath = f.relativePath || f.path;
      if (!filePath || typeof filePath !== 'string') return false;

      // Use ext field if available, otherwise check path
      const isCode = isCodeFile(filePath, f.ext);
      const ignored = shouldIgnore(filePath);

      return isCode && !ignored;
    })
    .map(f => (f.relativePath || f.path) as string);

  console.log(`[dependencyGraph] Found ${codeFiles.length} code files to analyze`);

  // Map to store each file's imports
  const fileImports = new Map<string, string[]>();
  const fileExports = new Map<string, string[]>();

  // Process each file
  let processedCount = 0;
  let readSuccessCount = 0;

  // Log first file to debug
  if (codeFiles.length > 0) {
    console.log('[dependencyGraph] First code file:', codeFiles[0]);
  }

  for (const filePath of codeFiles) {
    const content = await readFileContent(projectRoot, filePath);
    if (!content) {
      if (processedCount < 3) {
        console.log('[dependencyGraph] No content for:', filePath);
      }
      processedCount++;
      continue;
    }
    readSuccessCount++;

    // Extract raw imports
    const rawImports = extractImports(content);

    // Resolve to actual files
    const resolvedImports = rawImports
      .map(imp => resolveImportPath(filePath, imp, codeFiles))
      .filter((p): p is string => p !== null);

    fileImports.set(filePath, resolvedImports);

    // Extract exports
    const exports = extractExports(content);
    fileExports.set(filePath, exports);

    processedCount++;
    if (processedCount % 100 === 0) {
      console.log(`[dependencyGraph] Processed ${processedCount}/${codeFiles.length} files`);
    }
  }

  // Build reverse map (importedBy)
  const importedByMap = new Map<string, string[]>();
  for (const filePath of codeFiles) {
    importedByMap.set(filePath, []);
  }

  for (const [filePath, imports] of fileImports) {
    for (const importedFile of imports) {
      const existing = importedByMap.get(importedFile) || [];
      existing.push(filePath);
      importedByMap.set(importedFile, existing);
    }
  }

  // Build nodes
  const nodes: FileDependency[] = codeFiles.map(filePath => ({
    file: filePath,
    imports: fileImports.get(filePath) || [],
    importedBy: importedByMap.get(filePath) || [],
    exports: fileExports.get(filePath) || [],
  }));

  // Calculate statistics
  let totalEdges = 0;
  const orphans: string[] = [];
  const entryPoints: string[] = [];
  const hubs: string[] = [];

  for (const node of nodes) {
    totalEdges += node.imports.length;

    // Orphan: no imports and not imported
    if (node.imports.length === 0 && node.importedBy.length === 0) {
      orphans.push(node.file);
    }

    // Entry point: imported but doesn't import others (utility files, hooks, etc.)
    if (node.imports.length === 0 && node.importedBy.length > 0) {
      entryPoints.push(node.file);
    }

    // Hub: many files depend on this
    if (node.importedBy.length >= 10) {
      hubs.push(node.file);
    }
  }

  const graph: DependencyGraph = {
    totalFiles: codeFiles.length,
    edges: totalEdges,
    nodes,
    orphans,
    entryPoints,
    hubs,
    generatedAt: new Date().toISOString(),
  };

  console.log(`[dependencyGraph] Complete: ${graph.totalFiles} files, ${graph.edges} edges, ${orphans.length} orphans, ${hubs.length} hubs`);

  return graph;
}

/**
 * Get summary statistics (for UI display)
 */
export function getDependencyStats(graph: DependencyGraph): DependencyStats {
  return {
    totalFiles: graph.totalFiles,
    totalEdges: graph.edges,
    orphanCount: graph.orphans.length,
    hubCount: graph.hubs.length,
    avgImportsPerFile: graph.totalFiles > 0
      ? Math.round((graph.edges / graph.totalFiles) * 10) / 10
      : 0,
  };
}

/**
 * Find all files affected if a given file changes
 * (All files that directly or indirectly import this file)
 */
export function findAffectedFiles(
  graph: DependencyGraph,
  changedFile: string,
  maxDepth: number = 5
): string[] {
  const affected = new Set<string>();
  const queue: Array<{ file: string; depth: number }> = [{ file: changedFile, depth: 0 }];

  // Build quick lookup
  const nodeMap = new Map<string, FileDependency>();
  for (const node of graph.nodes) {
    nodeMap.set(node.file, node);
  }

  while (queue.length > 0) {
    const { file, depth } = queue.shift()!;

    if (depth > maxDepth) continue;
    if (affected.has(file)) continue;

    affected.add(file);

    const node = nodeMap.get(file);
    if (node) {
      for (const importer of node.importedBy) {
        if (!affected.has(importer)) {
          queue.push({ file: importer, depth: depth + 1 });
        }
      }
    }
  }

  // Remove the original file from the result
  affected.delete(changedFile);

  return Array.from(affected);
}

/**
 * Find all dependencies of a file
 * (All files that this file directly or indirectly imports)
 */
export function findDependencies(
  graph: DependencyGraph,
  file: string,
  maxDepth: number = 5
): string[] {
  const dependencies = new Set<string>();
  const queue: Array<{ file: string; depth: number }> = [{ file, depth: 0 }];

  // Build quick lookup
  const nodeMap = new Map<string, FileDependency>();
  for (const node of graph.nodes) {
    nodeMap.set(node.file, node);
  }

  while (queue.length > 0) {
    const { file: currentFile, depth } = queue.shift()!;

    if (depth > maxDepth) continue;
    if (dependencies.has(currentFile)) continue;

    dependencies.add(currentFile);

    const node = nodeMap.get(currentFile);
    if (node) {
      for (const imported of node.imports) {
        if (!dependencies.has(imported)) {
          queue.push({ file: imported, depth: depth + 1 });
        }
      }
    }
  }

  // Remove the original file from the result
  dependencies.delete(file);

  return Array.from(dependencies);
}

/**
 * Find files that use a specific export
 */
export function findUsagesOfExport(
  graph: DependencyGraph,
  filePath: string,
  exportName: string
): string[] {
  const node = graph.nodes.find(n => n.file === filePath);
  if (!node) return [];

  // For now, return all files that import this file
  // In the future, we could parse the actual import statements
  return node.importedBy;
}

export default buildDependencyGraph;
