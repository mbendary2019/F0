// src/lib/fs/sortFileTree.ts
// =============================================================================
// Phase 151.1.2 – File Tree Sort Helper
// Sorts file tree: folders first, then files, both alphabetically
// =============================================================================

import type { FileTreeMap, FileTreeNode } from './buildFileTree';

/**
 * Sorted node for array-based tree rendering
 */
export interface SortedFileTreeNode extends FileTreeNode {
  children?: SortedFileTreeNode[];
}

/**
 * Compare function for sorting nodes
 * Folders come first, then files, both sorted alphabetically (case-insensitive)
 */
function compareNodes(a: FileTreeNode, b: FileTreeNode): number {
  // Folders first
  if (a.isFolder && !b.isFolder) return -1;
  if (!a.isFolder && b.isFolder) return 1;

  // Alphabetical (case-insensitive)
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

/**
 * Sort a file tree map into an array of sorted nodes
 * Recursively sorts children as well
 *
 * @param tree - FileTreeMap to sort
 * @returns Array of sorted nodes with children as arrays
 *
 * @example
 * ```ts
 * const tree = buildFileTree(files);
 * const sorted = sortFileTree(tree);
 * // Result:
 * // [
 * //   { name: 'src', isFolder: true, children: [...] },
 * //   { name: 'package.json', isFolder: false }
 * // ]
 * ```
 */
export function sortFileTree(tree: FileTreeMap): SortedFileTreeNode[] {
  const nodes = Object.values(tree);

  return nodes.sort(compareNodes).map((node) => ({
    ...node,
    children: node.children ? sortFileTree(node.children) : undefined,
  }));
}

/**
 * Flatten a sorted tree into a list for virtualized rendering
 * Includes depth information for indentation
 *
 * @param tree - Sorted tree nodes
 * @param depth - Current depth (defaults to 0)
 * @param expanded - Set of expanded folder paths
 * @returns Flat array of nodes with depth info
 */
export interface FlatFileNode extends SortedFileTreeNode {
  depth: number;
  /** Phase 151.2: Whether this folder is expanded (for icon rendering) */
  isExpanded: boolean;
}

export function flattenTree(
  tree: SortedFileTreeNode[],
  depth: number = 0,
  expanded: Set<string> = new Set()
): FlatFileNode[] {
  const result: FlatFileNode[] = [];

  for (const node of tree) {
    const isExpanded = node.isFolder && expanded.has(node.path);
    result.push({ ...node, depth, isExpanded });

    // If folder is expanded and has children, add them
    if (isExpanded && node.children) {
      result.push(...flattenTree(node.children, depth + 1, expanded));
    }
  }

  return result;
}

export default sortFileTree;
