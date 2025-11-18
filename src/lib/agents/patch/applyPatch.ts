// src/lib/agents/patch/applyPatch.ts
// Phase 78: Patch-Based Code Editing - Patch Applier Engine

import { Patch, Hunk, PatchResult } from './types';

/**
 * Apply a single patch to file content
 */
export async function applyPatch(originalContent: string, patch: Patch): Promise<PatchResult> {
  try {
    const originalLines = originalContent.split('\n');
    let result: string[] = [];
    let originalIndex = 0;

    for (const hunk of patch.hunks) {
      // Copy lines before this hunk
      while (originalIndex < hunk.oldStart - 1) {
        result.push(originalLines[originalIndex]);
        originalIndex++;
      }

      // Apply the hunk
      const hunkResult = applyHunk(originalLines, hunk, originalIndex);
      if (!hunkResult.success) {
        return {
          success: false,
          filePath: patch.filePath,
          error: hunkResult.error,
          conflicts: hunkResult.conflicts,
        };
      }

      result = result.concat(hunkResult.lines);
      originalIndex = hunkResult.newIndex;
    }

    // Copy remaining lines
    while (originalIndex < originalLines.length) {
      result.push(originalLines[originalIndex]);
      originalIndex++;
    }

    return {
      success: true,
      filePath: patch.filePath,
      content: result.join('\n'),
    };
  } catch (error: any) {
    return {
      success: false,
      filePath: patch.filePath,
      error: error.message || 'Unknown error applying patch',
    };
  }
}

/**
 * Apply a single hunk to the original lines
 */
function applyHunk(
  originalLines: string[],
  hunk: Hunk,
  startIndex: number
): {
  success: boolean;
  lines: string[];
  newIndex: number;
  error?: string;
  conflicts?: { line: number; reason: string }[];
} {
  const result: string[] = [];
  let originalIndex = startIndex;
  const conflicts: { line: number; reason: string }[] = [];

  for (const patchLine of hunk.lines) {
    switch (patchLine.type) {
      case 'context':
        // Context line must match
        if (originalIndex >= originalLines.length) {
          conflicts.push({
            line: originalIndex + 1,
            reason: 'Context line expected but reached end of file',
          });
          return {
            success: false,
            lines: [],
            newIndex: originalIndex,
            error: `Hunk failed: context mismatch at line ${originalIndex + 1}`,
            conflicts,
          };
        }

        const expectedContext = patchLine.content;
        const actualLine = originalLines[originalIndex];

        // Allow whitespace-tolerant matching
        if (actualLine.trim() !== expectedContext.trim()) {
          conflicts.push({
            line: originalIndex + 1,
            reason: `Context mismatch: expected "${expectedContext}" but got "${actualLine}"`,
          });
          return {
            success: false,
            lines: [],
            newIndex: originalIndex,
            error: `Context mismatch at line ${originalIndex + 1}`,
            conflicts,
          };
        }

        result.push(actualLine);
        originalIndex++;
        break;

      case 'remove':
        // Remove line must match
        if (originalIndex >= originalLines.length) {
          conflicts.push({
            line: originalIndex + 1,
            reason: 'Line to remove not found (end of file reached)',
          });
          return {
            success: false,
            lines: [],
            newIndex: originalIndex,
            error: `Cannot remove line at ${originalIndex + 1}: end of file`,
            conflicts,
          };
        }

        const expectedRemove = patchLine.content;
        const actualRemove = originalLines[originalIndex];

        if (actualRemove.trim() !== expectedRemove.trim()) {
          conflicts.push({
            line: originalIndex + 1,
            reason: `Remove mismatch: expected "${expectedRemove}" but got "${actualRemove}"`,
          });
          return {
            success: false,
            lines: [],
            newIndex: originalIndex,
            error: `Remove mismatch at line ${originalIndex + 1}`,
            conflicts,
          };
        }

        // Don't add to result (line is removed)
        originalIndex++;
        break;

      case 'add':
        // Add new line
        result.push(patchLine.content);
        // Don't increment originalIndex (we're inserting)
        break;
    }
  }

  return {
    success: true,
    lines: result,
    newIndex: originalIndex,
  };
}

/**
 * Fuzzy patch application with tolerance for whitespace and minor changes
 */
export async function applyPatchFuzzy(
  originalContent: string,
  patch: Patch,
  tolerance: number = 2
): Promise<PatchResult> {
  // Try exact match first
  const exactResult = await applyPatch(originalContent, patch);
  if (exactResult.success) {
    return exactResult;
  }

  // TODO: Implement fuzzy matching with configurable tolerance
  // For now, just return the exact result
  return exactResult;
}

/**
 * Dry-run patch application (check if patch can be applied without modifying)
 */
export async function canApplyPatch(originalContent: string, patch: Patch): Promise<boolean> {
  const result = await applyPatch(originalContent, patch);
  return result.success;
}
