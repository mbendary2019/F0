// desktop/src/autoFix/autoFixPatchEngine.ts
// Phase 142.1 – Patch Engine for applying Auto-Fix patches
// Phase 144.5 – Enhanced skip tracking and reduced console spam

import { FilePatch, AutoFixSkipReason } from './autoFixTypes';

export interface PatchEngineDeps {
  /**
   * ترجع محتوى الملف الحالي من الـ FS أو الـ Editor state.
   */
  getFileContent: (filePath: string) => Promise<string | null>;

  /**
   * تطبّق التغيير على الملف (Editor + Disk).
   * لو عندك function موحد للـ edits (زي agent patches)
   * استعمله هنا.
   */
  updateFileContent: (filePath: string, newContent: string) => Promise<void>;
}

export interface ApplyPatchesOptions {
  /**
   * Safety flag: لو true وتلاقي إن before != current
   * هيتعمل Skip للـ patch ويترجع Warning في الـ log.
   */
  strictBeforeCheck?: boolean;

  /**
   * Phase 144.5.3: Quiet mode - reduce console spam (default: false)
   */
  quietMode?: boolean;
}

/**
 * Phase 144.5: Enhanced skip entry with reason
 */
export interface PatchSkipEntry {
  filePath: string;
  reason: AutoFixSkipReason;
  message?: string;
}

export interface ApplyPatchesResult {
  applied: string[]; // filePaths
  skipped: string[]; // filePaths (legacy)
  /** Phase 144.5: Detailed skip entries with reasons */
  skipDetails: PatchSkipEntry[];
}

/**
 * Utility: يجمّع patch واحد نهائي لكل ملف
 * في حالة إن اكتر من Engine لمس نفس الملف.
 * (النسخة البسيطة: نطبّق patches بالترتيب وناخد آخر after).
 */
export async function mergePatchesByFile(
  patches: FilePatch[],
  deps: PatchEngineDeps
): Promise<FilePatch[]> {
  const byFile = new Map<string, FilePatch>();

  for (const patch of patches) {
    const existing = byFile.get(patch.filePath);

    if (!existing) {
      byFile.set(patch.filePath, patch);
    } else {
      // نستخدم existing.before (أول snapshot)
      // و patch.after (آخر نسخة)
      byFile.set(patch.filePath, {
        filePath: patch.filePath,
        before: existing.before,
        after: patch.after,
      });
    }
  }

  // تأكد إن لو في ملفات مفيش لها before (في حالة future engines)
  // نجيب snapshot من الـ FS عشان safety.
  const result: FilePatch[] = [];
  for (const patch of byFile.values()) {
    if (!patch.before) {
      const current = await deps.getFileContent(patch.filePath);
      result.push({
        ...patch,
        before: current ?? '',
      });
    } else {
      result.push(patch);
    }
  }

  return result;
}

/**
 * يطبّق كل الـ patches على الملفات.
 * بيرجع عدد الملفات اللي اتعدلت + أي ملفات اتعملها Skip.
 * Phase 144.5: Enhanced with skip reasons and reduced spam
 */
export async function applyFilePatches(
  patches: FilePatch[],
  deps: PatchEngineDeps,
  options: ApplyPatchesOptions = {}
): Promise<ApplyPatchesResult> {
  const { strictBeforeCheck = true, quietMode = false } = options;

  const merged = await mergePatchesByFile(patches, deps);

  const applied: string[] = [];
  const skipped: string[] = [];
  const skipDetails: PatchSkipEntry[] = [];

  // Phase 144.5.3: Collect skip counts for summary log
  let noContentCount = 0;
  let mismatchCount = 0;
  let errorCount = 0;

  for (const patch of merged) {
    try {
      const current = await deps.getFileContent(patch.filePath);

      if (current === null) {
        // Phase 144.5.3: Don't log individual skips - collect for summary
        noContentCount++;
        skipped.push(patch.filePath);
        skipDetails.push({
          filePath: patch.filePath,
          reason: 'PATCH_NO_CONTENT',
          message: 'File not loaded in IDE',
        });
        continue;
      }

      if (strictBeforeCheck && current !== patch.before) {
        // Phase 144.5.3: Don't log individual mismatches - collect for summary
        mismatchCount++;
        skipped.push(patch.filePath);
        skipDetails.push({
          filePath: patch.filePath,
          reason: 'BEFORE_MISMATCH',
          message: 'File content changed since analysis',
        });
        continue;
      }

      await deps.updateFileContent(patch.filePath, patch.after);
      applied.push(patch.filePath);
      if (!quietMode) {
        console.log('[AutoFixPatchEngine] Applied patch to:', patch.filePath);
      }
    } catch (err) {
      errorCount++;
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (!quietMode) {
        console.error(
          '[AutoFixPatchEngine] Failed to apply patch for file',
          patch.filePath,
          err
        );
      }
      skipped.push(patch.filePath);
      skipDetails.push({
        filePath: patch.filePath,
        reason: 'FIXER_ERROR',
        message,
      });
    }
  }

  // Phase 144.5.3: Single summary log instead of spam
  const totalSkipped = noContentCount + mismatchCount + errorCount;
  if (totalSkipped > 0) {
    console.log(
      `[AutoFixPatchEngine] Summary: ${applied.length} applied, ${totalSkipped} skipped ` +
      `(${noContentCount} no content, ${mismatchCount} mismatch, ${errorCount} errors)`
    );
  } else if (applied.length > 0 && !quietMode) {
    console.log(`[AutoFixPatchEngine] All ${applied.length} patches applied successfully`);
  }

  return { applied, skipped, skipDetails };
}

/**
 * Utility: يعمل backup للـ before snapshots قبل التطبيق
 * ممكن نستخدمها للـ Undo لاحقًا
 */
export function createUndoPatches(patches: FilePatch[]): FilePatch[] {
  return patches.map((patch) => ({
    filePath: patch.filePath,
    before: patch.after,
    after: patch.before,
  }));
}
