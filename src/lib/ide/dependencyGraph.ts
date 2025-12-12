/**
 * Phase 85.3: Project Dependency Analysis
 * Build dependency graph, detect cycles, identify hotspots
 */

import type {
  IdeDependencyEdge,
  IdeFileNode,
  IdeProjectIssue,
  IdeProjectAnalysisSummary,
  IdeProjectAnalysisDocument,
} from '@/types/ideBridge';

/**
 * Extract imports from file content using regex
 * Supports: import, require, dynamic import
 */
export function extractImports(
  content: string,
  filePath: string
): Array<{ specifier: string; kind: IdeDependencyEdge['kind'] }> {
  const results: Array<{ specifier: string; kind: IdeDependencyEdge['kind'] }> = [];

  // 1) ESM import statements: import ... from "..."
  const esmImportRegex = /import\s+(?:.*?\s+from\s+)?["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = esmImportRegex.exec(content))) {
    results.push({ specifier: match[1], kind: 'import' });
  }

  // 2) Dynamic import: import("...")
  const dynamicImportRegex = /import\(["']([^"']+)["']\)/g;
  while ((match = dynamicImportRegex.exec(content))) {
    results.push({ specifier: match[1], kind: 'dynamic-import' });
  }

  // 3) CommonJS require: require("...")
  const requireRegex = /require\(["']([^"']+)["']\)/g;
  while ((match = requireRegex.exec(content))) {
    results.push({ specifier: match[1], kind: 'require' });
  }

  // 4) Re-exports: export ... from "..."
  const reexportRegex = /export\s+(?:.*?\s+from\s+)?["']([^"']+)["']/g;
  while ((match = reexportRegex.exec(content))) {
    results.push({ specifier: match[1], kind: 'export' });
  }

  return results;
}

/**
 * Resolve relative import to absolute workspace path
 * e.g., "./utils" from "src/pages/index.tsx" -> "src/pages/utils.ts" or "src/pages/utils.tsx"
 */
export function resolveImport(
  specifier: string,
  fromPath: string,
  allFiles: Array<{ path: string; languageId?: string }>
): string | null {
  // Skip node_modules, external packages
  if (!specifier.startsWith('.')) {
    return null;
  }

  // Get directory of importing file
  const fromDir = fromPath.split('/').slice(0, -1).join('/');

  // Resolve relative path
  let resolved = specifier;
  if (specifier.startsWith('./')) {
    resolved = `${fromDir}/${specifier.slice(2)}`;
  } else if (specifier.startsWith('../')) {
    const parts = fromDir.split('/');
    const upCount = specifier.match(/\.\.\//g)?.length ?? 0;
    const remainingPath = specifier.replace(/\.\.\//g, '');
    const newDir = parts.slice(0, parts.length - upCount).join('/');
    resolved = `${newDir}/${remainingPath}`;
  }

  // Normalize path (remove ./)
  resolved = resolved.replace(/\/\.\//g, '/');

  // Try common extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  for (const ext of extensions) {
    const candidate = `${resolved}${ext}`;
    if (allFiles.some((f) => f.path === candidate)) {
      return candidate;
    }
  }

  // Try index files
  const indexExtensions = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
  for (const indexExt of indexExtensions) {
    const candidate = `${resolved}${indexExt}`;
    if (allFiles.some((f) => f.path === candidate)) {
      return candidate;
    }
  }

  // Not found in workspace
  return null;
}

/**
 * Build dependency graph from files
 */
export function buildDependencyGraph(
  files: Array<{ path: string; content: string; languageId?: string }>
): { nodes: IdeFileNode[]; edges: IdeDependencyEdge[] } {
  const nodes: IdeFileNode[] = [];
  const edges: IdeDependencyEdge[] = [];

  for (const file of files) {
    const imports = extractImports(file.content, file.path);
    const dependsOn: string[] = [];

    for (const imp of imports) {
      const resolved = resolveImport(imp.specifier, file.path, files);
      if (resolved) {
        dependsOn.push(resolved);
        edges.push({
          from: file.path,
          to: resolved,
          kind: imp.kind,
        });
      }
    }

    nodes.push({
      path: file.path,
      languageId: file.languageId,
      imports: imports.map((i) => i.specifier),
      dependsOn,
      dependents: [], // computed later
      fanIn: 0,       // computed later
      fanOut: dependsOn.length,
    });
  }

  // Compute dependents and fanIn
  for (const edge of edges) {
    const target = nodes.find((n) => n.path === edge.to);
    if (target) {
      if (!target.dependents) target.dependents = [];
      if (!target.dependents.includes(edge.from)) {
        target.dependents.push(edge.from);
      }
      target.fanIn = (target.fanIn ?? 0) + 1;
    }
  }

  return { nodes, edges };
}

/**
 * Detect cycles using DFS
 */
export function detectCycles(nodes: IdeFileNode[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const pathStack: string[] = [];

  function dfs(path: string) {
    if (stack.has(path)) {
      // Found cycle
      const cycleStart = pathStack.indexOf(path);
      const cycle = pathStack.slice(cycleStart);
      cycle.push(path); // Close the cycle
      cycles.push(cycle);
      return;
    }

    if (visited.has(path)) {
      return;
    }

    visited.add(path);
    stack.add(path);
    pathStack.push(path);

    const node = nodes.find((n) => n.path === path);
    if (node) {
      for (const dep of node.dependsOn) {
        dfs(dep);
      }
    }

    stack.delete(path);
    pathStack.pop();
  }

  for (const node of nodes) {
    if (!visited.has(node.path)) {
      dfs(node.path);
    }
  }

  return cycles;
}

/**
 * Analyze dependency graph and generate summary
 */
export function analyzeDependencyGraph(
  projectId: string,
  graph: { nodes: IdeFileNode[]; edges: IdeDependencyEdge[] }
): IdeProjectAnalysisDocument {
  const { nodes, edges } = graph;

  // Detect cycles
  const cycles = detectCycles(nodes);

  // Top fan-in (hotspots - files that many others depend on)
  const topFanIn = [...nodes]
    .filter((n) => (n.fanIn ?? 0) > 0)
    .sort((a, b) => (b.fanIn ?? 0) - (a.fanIn ?? 0))
    .slice(0, 10)
    .map((n) => ({ path: n.path, fanIn: n.fanIn ?? 0 }));

  // Top fan-out (files that depend on many others)
  const topFanOut = [...nodes]
    .filter((n) => (n.fanOut ?? 0) > 0)
    .sort((a, b) => (b.fanOut ?? 0) - (a.fanOut ?? 0))
    .slice(0, 10)
    .map((n) => ({ path: n.path, fanOut: n.fanOut ?? 0 }));

  // Detect issues
  const issues: IdeProjectIssue[] = [];

  // Issue: Cycles
  cycles.forEach((cycle, idx) => {
    issues.push({
      id: `cycle-${idx}`,
      kind: 'cycle',
      severity: 'warning',
      title: `Circular Dependency (${cycle.length} files)`,
      description: `Circular dependency detected: ${cycle.join(' → ')}`,
      files: cycle,
    });
  });

  // Issue: High fan-in (>10 dependents)
  nodes.forEach((node) => {
    if ((node.fanIn ?? 0) > 10) {
      issues.push({
        id: `high-fan-in-${node.path}`,
        kind: 'high-fan-in',
        severity: 'info',
        title: `High Fan-In: ${node.path}`,
        description: `${node.fanIn} files depend on this file. Consider splitting.`,
        files: [node.path],
      });
    }
  });

  // Issue: High fan-out (>15 dependencies)
  nodes.forEach((node) => {
    if ((node.fanOut ?? 0) > 15) {
      issues.push({
        id: `high-fan-out-${node.path}`,
        kind: 'high-fan-out',
        severity: 'info',
        title: `High Fan-Out: ${node.path}`,
        description: `This file depends on ${node.fanOut} other files. Consider refactoring.`,
        files: [node.path],
      });
    }
  });

  // Issue: Orphan files (no dependents, no dependencies)
  nodes.forEach((node) => {
    if ((node.fanIn ?? 0) === 0 && (node.fanOut ?? 0) === 0) {
      issues.push({
        id: `orphan-${node.path}`,
        kind: 'orphan',
        severity: 'info',
        title: `Orphan File: ${node.path}`,
        description: `This file has no dependencies and no dependents. May be unused.`,
        files: [node.path],
      });
    }
  });

  const summary: IdeProjectAnalysisSummary = {
    projectId,
    fileCount: nodes.length,
    edgeCount: edges.length,
    createdAt: Date.now(),
    topFanIn,
    topFanOut,
    cycles,
    issues,
  };

  return {
    summary,
    files: nodes,
    edges,
  };
}
