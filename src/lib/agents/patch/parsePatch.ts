// src/lib/agents/patch/parsePatch.ts
// Phase 78: Patch-Based Code Editing - Unified Diff Parser

import { Patch, Hunk, PatchLine, PatchBundle } from './types';

/**
 * Parse a unified diff string into structured Patch objects
 */
export function parsePatch(diffText: string): Patch[] {
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
        // Empty line in context
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
 * Parse a patch bundle (multiple files) from diff text
 */
export function parsePatchBundle(diffText: string, metadata?: any): PatchBundle {
  const patches = parsePatch(diffText);

  return {
    patches,
    summary: `${patches.length} file(s) changed`,
    metadata,
  };
}

/**
 * Extract patch from markdown code block
 */
export function extractPatchFromMarkdown(markdown: string): string | null {
  // Try to find ```diff block
  const diffMatch = markdown.match(/```diff\s*\n([\s\S]*?)```/);
  if (diffMatch) {
    return diffMatch[1].trim();
  }

  // Try to find ```patch block
  const patchMatch = markdown.match(/```patch\s*\n([\s\S]*?)```/);
  if (patchMatch) {
    return patchMatch[1].trim();
  }

  // Try to find any block that starts with 'diff --git'
  const genericMatch = markdown.match(/```[\w]*\s*\n(diff --git[\s\S]*?)```/);
  if (genericMatch) {
    return genericMatch[1].trim();
  }

  return null;
}

/**
 * Validate that a patch is well-formed
 */
export function validatePatch(patch: Patch): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!patch.filePath) {
    errors.push('Missing file path');
  }

  if (patch.hunks.length === 0) {
    errors.push('No hunks found in patch');
  }

  for (const hunk of patch.hunks) {
    if (hunk.oldStart < 1 || hunk.newStart < 1) {
      errors.push(`Invalid hunk line numbers: old=${hunk.oldStart}, new=${hunk.newStart}`);
    }

    if (hunk.lines.length === 0) {
      errors.push('Empty hunk found');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
