/**
 * Patch Engine for VS Code Extension
 * Adapted from Phase 78 patch engine (src/lib/agents/patch/)
 * Self-contained implementation for applying unified diffs
 */

/**
 * Represents a single line in a patch hunk
 */
interface PatchLine {
  type: 'context' | 'add' | 'remove';
  content: string;
}

/**
 * Represents a hunk (chunk of changes) in a patch
 */
interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header?: string;
  lines: PatchLine[];
}

/**
 * Represents a patch for a single file
 */
export interface Patch {
  filePath: string;
  oldPath?: string;
  newPath?: string;
  isNew: boolean;
  isDeleted: boolean;
  hunks: Hunk[];
}

/**
 * Result of applying a patch
 */
export interface PatchResult {
  success: boolean;
  filePath: string;
  content?: string;
  error?: string;
  conflicts?: { line: number; reason: string }[];
}

/**
 * Parse a unified diff string into structured Patch objects
 */
export function parseUnifiedDiff(diffText: string): Patch[] {
  const patches: Patch[] = [];
  const lines = diffText.split('\n');

  let currentPatch: Patch | null = null;
  let currentHunk: Hunk | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Start of a new file patch
    if (line.startsWith('diff --git ')) {
      if (currentPatch) {
        if (currentHunk) {
          currentPatch.hunks.push(currentHunk);
          currentHunk = null;
        }
        patches.push(currentPatch);
      }

      // Extract file paths
      const match = line.match(/diff --git a\/(.*?) b\/(.*?)$/);
      if (match) {
        currentPatch = {
          filePath: match[2],
          oldPath: match[1],
          newPath: match[2],
          isNew: false,
          isDeleted: false,
          hunks: [],
        };
      }
    }

    // Old file path (---)
    else if (line.startsWith('--- ')) {
      if (currentPatch) {
        const path = line.slice(4).replace(/^a\//, '');
        if (path === '/dev/null') {
          currentPatch.isNew = true;
        }
      }
    }

    // New file path (+++)
    else if (line.startsWith('+++ ')) {
      if (currentPatch) {
        const path = line.slice(4).replace(/^b\//, '');
        if (path === '/dev/null') {
          currentPatch.isDeleted = true;
        }
      }
    }

    // Hunk header (@@ -old +new @@)
    else if (line.startsWith('@@')) {
      if (currentHunk && currentPatch) {
        currentPatch.hunks.push(currentHunk);
      }

      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)?/);
      if (match) {
        currentHunk = {
          oldStart: parseInt(match[1], 10),
          oldLines: match[2] ? parseInt(match[2], 10) : 1,
          newStart: parseInt(match[3], 10),
          newLines: match[4] ? parseInt(match[4], 10) : 1,
          header: match[5]?.trim(),
          lines: [],
        };
      }
    }

    // Hunk content lines
    else if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'add',
          content: line.slice(1),
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'remove',
          content: line.slice(1),
        });
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'context',
          content: line.slice(1),
        });
      } else if (line === '') {
        currentHunk.lines.push({
          type: 'context',
          content: '',
        });
      }
    }

    i++;
  }

  // Add final patch and hunk
  if (currentHunk && currentPatch) {
    currentPatch.hunks.push(currentHunk);
  }
  if (currentPatch) {
    patches.push(currentPatch);
  }

  return patches;
}

/**
 * Apply a single patch to file content
 */
export function applyPatchToContent(originalContent: string, patch: Patch): PatchResult {
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
