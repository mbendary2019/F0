// src/lib/agents/patch/types.ts
// Phase 78: Patch-Based Code Editing - Type Definitions

/**
 * Represents a single line in a patch hunk
 */
export interface PatchLine {
  type: 'context' | 'add' | 'remove';
  content: string;
  lineNumber?: number; // Original line number for context
}

/**
 * Represents a hunk (chunk of changes) in a patch
 */
export interface Hunk {
  oldStart: number;      // Starting line in original file
  oldLines: number;      // Number of lines in original
  newStart: number;      // Starting line in new file
  newLines: number;      // Number of lines in new file
  header?: string;       // Optional hunk header (e.g., function name)
  lines: PatchLine[];
}

/**
 * Represents a patch for a single file
 */
export interface Patch {
  filePath: string;
  oldPath?: string;      // For renamed files
  newPath?: string;      // For renamed files
  isNew: boolean;        // Is this a new file?
  isDeleted: boolean;    // Is this a deleted file?
  hunks: Hunk[];
}

/**
 * Represents a bundle of patches (multi-file changes)
 */
export interface PatchBundle {
  patches: Patch[];
  summary?: string;      // Overall summary of changes
  metadata?: {
    author?: string;
    timestamp?: string;
    taskKind?: string;
  };
}

/**
 * Result of applying a patch
 */
export interface PatchResult {
  success: boolean;
  filePath: string;
  content?: string;      // New file content if successful
  error?: string;        // Error message if failed
  conflicts?: {
    line: number;
    reason: string;
  }[];
}

/**
 * Result of applying a patch bundle
 */
export interface BundleResult {
  success: boolean;
  results: PatchResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}
