/**
 * Phase 85.5.1: Sandbox Mode Engine
 * Allows users to experiment with patches and changes in isolation
 * before applying them to the real project
 */

import { applyUnifiedDiff } from '@/lib/patch/applyPatch';

export interface IdeFileMap {
  [filePath: string]: {
    path: string;
    content: string;
    languageId: string;
  };
}

export interface IdeSandbox {
  id: string;
  createdAt: number;
  original: IdeFileMap; // Snapshot when sandbox was created
  working: IdeFileMap; // Current state with patches applied
  appliedPatches: Array<{
    filePath: string;
    diff: string;
  }>;
  dirtyFiles: Set<string>; // Files modified in sandbox
}

/**
 * Creates a new sandbox from current file state
 * Deep clones files to prevent accidental mutations
 */
export function createSandbox(files: IdeFileMap): IdeSandbox {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    original: JSON.parse(JSON.stringify(files)),
    working: JSON.parse(JSON.stringify(files)),
    appliedPatches: [],
    dirtyFiles: new Set(),
  };
}

/**
 * Resets sandbox to original state
 * Discards all applied patches
 */
export function resetSandbox(sandbox: IdeSandbox): void {
  sandbox.working = JSON.parse(JSON.stringify(sandbox.original));
  sandbox.appliedPatches = [];
  sandbox.dirtyFiles.clear();
}

/**
 * Applies a patch to the sandbox (NOT to real files)
 * Uses the same patch engine as real application
 */
export function applyPatchToSandbox(
  sandbox: IdeSandbox,
  filePath: string,
  diff: string
): void {
  const original = sandbox.working[filePath]?.content ?? '';
  const updated = applyUnifiedDiff(original, diff);

  sandbox.working[filePath] = {
    ...sandbox.working[filePath],
    path: filePath,
    content: updated,
    languageId: sandbox.working[filePath]?.languageId || 'typescript',
  };

  sandbox.dirtyFiles.add(filePath);
  sandbox.appliedPatches.push({ filePath, diff });
}

/**
 * Compares sandbox state with real project files
 * Returns differences for user review
 */
export function compareSandbox(
  sandbox: IdeSandbox,
  realFiles: IdeFileMap
): {
  added: string[];
  removed: string[];
  modified: string[];
} {
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  // Find added and modified files
  for (const filePath in sandbox.working) {
    if (!realFiles[filePath]) {
      added.push(filePath);
    } else if (sandbox.working[filePath].content !== realFiles[filePath].content) {
      modified.push(filePath);
    }
  }

  // Find removed files
  for (const filePath in realFiles) {
    if (!sandbox.working[filePath]) {
      removed.push(filePath);
    }
  }

  return { added, removed, modified };
}

/**
 * Exports sandbox changes as a summary
 * Useful for logging and debugging
 */
export function exportSandboxSummary(sandbox: IdeSandbox): {
  id: string;
  createdAt: number;
  patchCount: number;
  dirtyFileCount: number;
  dirtyFiles: string[];
} {
  return {
    id: sandbox.id,
    createdAt: sandbox.createdAt,
    patchCount: sandbox.appliedPatches.length,
    dirtyFileCount: sandbox.dirtyFiles.size,
    dirtyFiles: Array.from(sandbox.dirtyFiles),
  };
}
