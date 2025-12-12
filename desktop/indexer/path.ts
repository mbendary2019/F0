// desktop/indexer/path.ts
// Phase 120.0: Path helpers for project indexer

import * as path from 'path';

/**
 * Get the path to the project index file
 * @param projectRoot - Absolute path to project root
 * @returns Absolute path to .f0/index/project-index.json
 */
export function getProjectIndexPath(projectRoot: string): string {
  return path.join(projectRoot, '.f0', 'index', 'project-index.json');
}

/**
 * Get the path to the .f0/index directory
 * @param projectRoot - Absolute path to project root
 * @returns Absolute path to .f0/index/
 */
export function getIndexDir(projectRoot: string): string {
  return path.join(projectRoot, '.f0', 'index');
}

/**
 * Get the .f0 directory path
 * @param projectRoot - Absolute path to project root
 * @returns Absolute path to .f0/
 */
export function getF0Dir(projectRoot: string): string {
  return path.join(projectRoot, '.f0');
}
