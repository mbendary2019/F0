// desktop/src/lib/ace/aceImpact.ts
// Phase 128.4: Impact Analysis - Dependency Graph for ACE

import type { AceFileScore, AceSuggestion } from './aceTypes';

/**
 * Dependency edge in the graph
 */
export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'export' | 'extends' | 'implements';
}

/**
 * File node with dependencies
 */
export interface DependencyNode {
  filePath: string;
  imports: string[];
  importedBy: string[];
  depth: number;
}

/**
 * Impact analysis result for a suggestion
 */
export interface ImpactAnalysis {
  suggestionId: string;
  directFiles: string[];
  indirectFiles: string[];
  totalImpact: number;
  riskLevel: 'low' | 'medium' | 'high';
  impactDescription: string;
  impactDescriptionAr: string;
}

/**
 * Build a dependency graph from file contents
 */
export function buildDependencyGraph(
  fileContents: Map<string, string>
): Map<string, DependencyNode> {
  const graph = new Map<string, DependencyNode>();

  // Initialize nodes
  for (const [filePath] of fileContents) {
    graph.set(filePath, {
      filePath,
      imports: [],
      importedBy: [],
      depth: 0,
    });
  }

  // Parse imports from each file
  for (const [filePath, content] of fileContents) {
    const imports = extractImports(content, filePath);
    const node = graph.get(filePath);
    if (node) {
      node.imports = imports;
    }

    // Update importedBy for each imported file
    for (const importPath of imports) {
      const importedNode = graph.get(importPath);
      if (importedNode) {
        importedNode.importedBy.push(filePath);
      }
    }
  }

  // Calculate depth (BFS from root files)
  calculateDepths(graph);

  return graph;
}

/**
 * Extract import paths from file content
 */
function extractImports(content: string, currentFile: string): string[] {
  const imports: string[] = [];
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match;

  // ES imports
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = resolveImportPath(match[1], currentFile);
    if (importPath) {
      imports.push(importPath);
    }
  }

  // CommonJS requires
  while ((match = requireRegex.exec(content)) !== null) {
    const importPath = resolveImportPath(match[1], currentFile);
    if (importPath) {
      imports.push(importPath);
    }
  }

  return imports;
}

/**
 * Resolve relative import path to absolute
 */
function resolveImportPath(importPath: string, currentFile: string): string | null {
  // Skip external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  // Get directory of current file
  const currentDir = currentFile.split('/').slice(0, -1).join('/');

  // Resolve relative path
  let resolved: string;
  if (importPath.startsWith('./')) {
    resolved = currentDir + '/' + importPath.slice(2);
  } else if (importPath.startsWith('../')) {
    const parts = currentDir.split('/');
    const importParts = importPath.split('/');
    let upCount = 0;
    for (const part of importParts) {
      if (part === '..') upCount++;
      else break;
    }
    resolved = parts.slice(0, -upCount).join('/') + '/' + importParts.slice(upCount).join('/');
  } else {
    resolved = importPath;
  }

  // Add extension if missing
  if (!resolved.match(/\.(ts|tsx|js|jsx|json)$/)) {
    resolved += '.ts'; // Default to .ts
  }

  return resolved;
}

/**
 * Calculate depth of each node using BFS
 */
function calculateDepths(graph: Map<string, DependencyNode>): void {
  // Find root files (not imported by anyone)
  const roots: string[] = [];
  for (const [filePath, node] of graph) {
    if (node.importedBy.length === 0) {
      roots.push(filePath);
    }
  }

  // BFS from roots
  const visited = new Set<string>();
  const queue: Array<{ path: string; depth: number }> = roots.map((p) => ({
    path: p,
    depth: 0,
  }));

  while (queue.length > 0) {
    const { path, depth } = queue.shift()!;
    if (visited.has(path)) continue;
    visited.add(path);

    const node = graph.get(path);
    if (node) {
      node.depth = depth;
      for (const importPath of node.imports) {
        if (!visited.has(importPath)) {
          queue.push({ path: importPath, depth: depth + 1 });
        }
      }
    }
  }
}

/**
 * Get all files that would be affected by changing a file
 */
export function getAffectedFiles(
  filePath: string,
  graph: Map<string, DependencyNode>,
  maxDepth: number = 3
): string[] {
  const affected = new Set<string>();
  const queue: Array<{ path: string; depth: number }> = [{ path: filePath, depth: 0 }];

  while (queue.length > 0) {
    const { path, depth } = queue.shift()!;
    if (affected.has(path) || depth > maxDepth) continue;
    affected.add(path);

    const node = graph.get(path);
    if (node) {
      // Files that import this file are affected
      for (const importer of node.importedBy) {
        if (!affected.has(importer)) {
          queue.push({ path: importer, depth: depth + 1 });
        }
      }
    }
  }

  // Remove the original file from affected set
  affected.delete(filePath);
  return Array.from(affected);
}

/**
 * Analyze impact of a suggestion
 */
export function analyzeImpact(
  suggestion: AceSuggestion,
  graph: Map<string, DependencyNode>,
  fileScores: AceFileScore[]
): ImpactAnalysis {
  const directFiles = suggestion.targetFiles;
  const indirectFilesSet = new Set<string>();

  // Get all affected files for each target
  for (const targetFile of directFiles) {
    const affected = getAffectedFiles(targetFile, graph);
    for (const f of affected) {
      indirectFilesSet.add(f);
    }
  }

  // Remove direct files from indirect
  for (const f of directFiles) {
    indirectFilesSet.delete(f);
  }

  const indirectFiles = Array.from(indirectFilesSet);

  // Calculate total impact score
  const directScore = directFiles.length * 3;
  const indirectScore = indirectFiles.length * 1;
  const totalImpact = directScore + indirectScore;

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high';
  if (totalImpact <= 5) {
    riskLevel = 'low';
  } else if (totalImpact <= 15) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  // Build description
  const impactDescription = buildImpactDescription(directFiles, indirectFiles, riskLevel, 'en');
  const impactDescriptionAr = buildImpactDescription(directFiles, indirectFiles, riskLevel, 'ar');

  return {
    suggestionId: suggestion.id,
    directFiles,
    indirectFiles,
    totalImpact,
    riskLevel,
    impactDescription,
    impactDescriptionAr,
  };
}

/**
 * Build human-readable impact description
 */
function buildImpactDescription(
  directFiles: string[],
  indirectFiles: string[],
  riskLevel: 'low' | 'medium' | 'high',
  locale: 'en' | 'ar'
): string {
  if (locale === 'ar') {
    const riskLabels = {
      low: 'منخفض',
      medium: 'متوسط',
      high: 'مرتفع',
    };
    return `التأثير المباشر: ${directFiles.length} ملف | التأثير غير المباشر: ${indirectFiles.length} ملف | مستوى الخطر: ${riskLabels[riskLevel]}`;
  }

  const riskLabels = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };
  return `Direct impact: ${directFiles.length} files | Indirect impact: ${indirectFiles.length} files | Risk: ${riskLabels[riskLevel]}`;
}

/**
 * Get impact analysis for multiple suggestions
 */
export function analyzeAllSuggestionImpacts(
  suggestions: AceSuggestion[],
  graph: Map<string, DependencyNode>,
  fileScores: AceFileScore[]
): Map<string, ImpactAnalysis> {
  const results = new Map<string, ImpactAnalysis>();

  for (const suggestion of suggestions) {
    const impact = analyzeImpact(suggestion, graph, fileScores);
    results.set(suggestion.id, impact);
  }

  return results;
}

/**
 * Sort suggestions by impact (safest first)
 */
export function sortSuggestionsByImpact(
  suggestions: AceSuggestion[],
  impacts: Map<string, ImpactAnalysis>
): AceSuggestion[] {
  return [...suggestions].sort((a, b) => {
    const impactA = impacts.get(a.id);
    const impactB = impacts.get(b.id);

    if (!impactA || !impactB) return 0;

    // Sort by risk level first (low risk first)
    const riskOrder = { low: 0, medium: 1, high: 2 };
    const riskDiff = riskOrder[impactA.riskLevel] - riskOrder[impactB.riskLevel];
    if (riskDiff !== 0) return riskDiff;

    // Then by total impact (lower first)
    return impactA.totalImpact - impactB.totalImpact;
  });
}

/**
 * Get high-risk files (imported by many)
 */
export function getHighRiskFiles(
  graph: Map<string, DependencyNode>,
  threshold: number = 5
): DependencyNode[] {
  const highRisk: DependencyNode[] = [];

  for (const [, node] of graph) {
    if (node.importedBy.length >= threshold) {
      highRisk.push(node);
    }
  }

  return highRisk.sort((a, b) => b.importedBy.length - a.importedBy.length);
}

export default {
  buildDependencyGraph,
  getAffectedFiles,
  analyzeImpact,
  analyzeAllSuggestionImpacts,
  sortSuggestionsByImpact,
  getHighRiskFiles,
};
