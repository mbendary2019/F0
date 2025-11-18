// src/lib/agents/patch/applyBundle.ts
// Phase 78: Patch-Based Code Editing - Multi-File Bundle Applier

import { PatchBundle, BundleResult, PatchResult } from './types';
import { applyPatch } from './applyPatch';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Apply a bundle of patches to multiple files
 * Similar to `git apply` behavior
 */
export async function applyPatchBundle(
  bundle: PatchBundle,
  options?: {
    workingDir?: string;
    dryRun?: boolean;
    createMissing?: boolean;
  }
): Promise<BundleResult> {
  const workingDir = options?.workingDir || process.cwd();
  const dryRun = options?.dryRun ?? false;
  const createMissing = options?.createMissing ?? false;

  const results: PatchResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const patch of bundle.patches) {
    try {
      const filePath = path.resolve(workingDir, patch.filePath);

      // Handle new file creation
      if (patch.isNew) {
        if (existsSync(filePath) && !createMissing) {
          results.push({
            success: false,
            filePath: patch.filePath,
            error: 'File already exists (new file patch)',
          });
          failed++;
          continue;
        }

        // Generate content from patch (all lines should be 'add' type)
        const newContent = patch.hunks
          .flatMap((hunk) => hunk.lines)
          .filter((line) => line.type === 'add')
          .map((line) => line.content)
          .join('\n');

        if (!dryRun) {
          await writeFile(filePath, newContent, 'utf-8');
        }

        results.push({
          success: true,
          filePath: patch.filePath,
          content: newContent,
        });
        succeeded++;
        continue;
      }

      // Handle file deletion
      if (patch.isDeleted) {
        if (!existsSync(filePath)) {
          results.push({
            success: false,
            filePath: patch.filePath,
            error: 'File does not exist (delete patch)',
          });
          failed++;
          continue;
        }

        // In dry-run mode, just validate the file exists
        if (!dryRun) {
          const { unlink } = await import('fs/promises');
          await unlink(filePath);
        }

        results.push({
          success: true,
          filePath: patch.filePath,
        });
        succeeded++;
        continue;
      }

      // Handle file modification (standard patch)
      if (!existsSync(filePath)) {
        results.push({
          success: false,
          filePath: patch.filePath,
          error: 'File does not exist',
        });
        failed++;
        continue;
      }

      const originalContent = await readFile(filePath, 'utf-8');
      const patchResult = await applyPatch(originalContent, patch);

      if (patchResult.success && patchResult.content && !dryRun) {
        await writeFile(filePath, patchResult.content, 'utf-8');
      }

      results.push(patchResult);
      if (patchResult.success) {
        succeeded++;
      } else {
        failed++;
      }
    } catch (error: any) {
      results.push({
        success: false,
        filePath: patch.filePath,
        error: error.message || 'Unknown error applying patch',
      });
      failed++;
    }
  }

  return {
    success: failed === 0,
    total: bundle.patches.length,
    succeeded,
    failed,
    results,
    summary: bundle.summary,
  };
}

/**
 * Validate that a bundle can be applied without actually applying it
 */
export async function canApplyBundle(
  bundle: PatchBundle,
  workingDir?: string
): Promise<BundleResult> {
  return applyPatchBundle(bundle, { workingDir, dryRun: true });
}

/**
 * Apply bundle with automatic rollback on failure
 * NOTE: This requires backup/restore logic - simplified for now
 */
export async function applyBundleWithRollback(
  bundle: PatchBundle,
  workingDir?: string
): Promise<BundleResult> {
  // First validate
  const validation = await canApplyBundle(bundle, workingDir);
  if (!validation.success) {
    return {
      ...validation,
      summary: 'Pre-validation failed - no changes made',
    };
  }

  // Apply (in the future, we could backup files first)
  return applyPatchBundle(bundle, { workingDir });
}
