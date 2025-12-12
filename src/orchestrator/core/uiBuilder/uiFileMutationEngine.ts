// orchestrator/core/uiBuilder/uiFileMutationEngine.ts
// =============================================================================
// Phase 167.3 – File Mutation Engine
// Applies generated code changes to the project (Firestore VFS or Local)
// =============================================================================

import {
  UiCodegenResult,
  UiFileChange,
  UiFileTarget,
  UiApplyResult,
  UiRollbackRecord,
} from './uiGenerationPlanTypes';

import { getFirestore } from 'firebase-admin/firestore';

// =============================================================================
// Types
// =============================================================================

export interface FileWriteTarget {
  type: 'vfs' | 'local' | 'github';
  projectId: string;
  basePath?: string; // For local: project root path
}

export interface FileWriteJob {
  id: string;
  projectId: string;
  filePath: string;
  content: string;
  action: 'create' | 'modify' | 'delete';
  status: 'pending' | 'applied' | 'failed';
  error?: string;
  createdAt: number;
  appliedAt?: number;
}

// =============================================================================
// Constants
// =============================================================================

const VFS_COLLECTION = 'projectFiles';
const FILE_WRITES_COLLECTION = 'fileWrites';
const ROLLBACK_COLLECTION = 'uiRollbacks';

// Sensitive paths that should not be modified
const PROTECTED_PATHS = [
  '.env',
  '.env.local',
  '.env.production',
  'firebase.json',
  'firestore.rules',
  'storage.rules',
  'package.json',
  'tsconfig.json',
  'next.config.js',
  'tailwind.config',
];

// =============================================================================
// ID Generators
// =============================================================================

function generateJobId(): string {
  return `write_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function generateRollbackId(): string {
  return `rollback_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// =============================================================================
// Safety Checks
// =============================================================================

/**
 * Check if a path is protected
 */
function isProtectedPath(path: string): boolean {
  const normalizedPath = path.toLowerCase();

  for (const protected_ of PROTECTED_PATHS) {
    if (normalizedPath.includes(protected_.toLowerCase())) {
      return true;
    }
  }

  // Don't allow modifying files outside src/
  if (!normalizedPath.startsWith('src/') && !normalizedPath.startsWith('./src/')) {
    // Allow public/ for assets
    if (!normalizedPath.startsWith('public/') && !normalizedPath.startsWith('./public/')) {
      return true;
    }
  }

  return false;
}

/**
 * Validate file content
 */
function validateContent(content: string, language: string): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Empty content' };
  }

  if (content.length > 500000) {
    return { valid: false, error: 'File too large (>500KB)' };
  }

  // Basic syntax checks for TypeScript/JSX
  if (language === 'tsx' || language === 'ts') {
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;

    if (Math.abs(openBraces - closeBraces) > 2) {
      return { valid: false, error: 'Unbalanced braces' };
    }

    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;

    if (Math.abs(openParens - closeParens) > 2) {
      return { valid: false, error: 'Unbalanced parentheses' };
    }
  }

  return { valid: true };
}

// =============================================================================
// VFS Operations (Firestore)
// =============================================================================

let db: FirebaseFirestore.Firestore | null = null;

function getDb(): FirebaseFirestore.Firestore {
  if (!db) {
    db = getFirestore();
  }
  return db;
}

/**
 * Get existing file content from VFS
 */
async function getVfsFileContent(
  projectId: string,
  filePath: string,
): Promise<string | null> {
  try {
    const doc = await getDb()
      .collection(VFS_COLLECTION)
      .doc(`${projectId}_${filePath.replace(/\//g, '_')}`)
      .get();

    if (doc.exists) {
      const data = doc.data();
      return data?.content || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write file to VFS (Firestore)
 */
async function writeToVfs(
  projectId: string,
  filePath: string,
  content: string,
  action: 'create' | 'modify',
): Promise<void> {
  const docId = `${projectId}_${filePath.replace(/\//g, '_')}`;
  const now = Date.now();

  await getDb()
    .collection(VFS_COLLECTION)
    .doc(docId)
    .set({
      projectId,
      path: filePath,
      content,
      language: filePath.split('.').pop() || 'txt',
      size: content.length,
      lastModified: now,
      createdAt: action === 'create' ? now : undefined,
      updatedAt: now,
      source: 'ui-builder',
    }, { merge: true });
}

/**
 * Delete file from VFS
 */
async function deleteFromVfs(projectId: string, filePath: string): Promise<void> {
  const docId = `${projectId}_${filePath.replace(/\//g, '_')}`;
  await getDb().collection(VFS_COLLECTION).doc(docId).delete();
}

// =============================================================================
// File Writes Queue (for async processing)
// =============================================================================

/**
 * Queue a file write job
 */
async function queueFileWrite(
  projectId: string,
  change: UiFileChange,
): Promise<FileWriteJob> {
  const job: FileWriteJob = {
    id: generateJobId(),
    projectId,
    filePath: change.target.path,
    content: change.newContent || '',
    action: change.action,
    status: 'pending',
    createdAt: Date.now(),
  };

  await getDb()
    .collection(FILE_WRITES_COLLECTION)
    .doc(job.id)
    .set(job);

  return job;
}

/**
 * Update file write job status
 */
async function updateJobStatus(
  jobId: string,
  status: 'applied' | 'failed',
  error?: string,
): Promise<void> {
  await getDb()
    .collection(FILE_WRITES_COLLECTION)
    .doc(jobId)
    .update({
      status,
      error,
      appliedAt: Date.now(),
    });
}

// =============================================================================
// Rollback Management
// =============================================================================

/**
 * Create rollback record
 */
async function createRollback(
  planId: string,
  projectId: string,
  originalFiles: Array<{ path: string; content: string | null }>,
): Promise<UiRollbackRecord> {
  const rollback: UiRollbackRecord = {
    id: generateRollbackId(),
    planId,
    projectId,
    originalFiles,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  await getDb()
    .collection(ROLLBACK_COLLECTION)
    .doc(rollback.id)
    .set(rollback);

  return rollback;
}

/**
 * Execute rollback
 */
export async function executeRollback(rollbackId: string): Promise<{
  success: boolean;
  restoredFiles: string[];
  error?: string;
}> {
  console.log('[167.3][MUTATION] Executing rollback:', rollbackId);

  try {
    const doc = await getDb().collection(ROLLBACK_COLLECTION).doc(rollbackId).get();

    if (!doc.exists) {
      return { success: false, restoredFiles: [], error: 'Rollback not found' };
    }

    const rollback = doc.data() as UiRollbackRecord;
    const restoredFiles: string[] = [];

    for (const file of rollback.originalFiles) {
      if (file.content === null) {
        // File didn't exist before - delete it
        await deleteFromVfs(rollback.projectId, file.path);
      } else {
        // Restore original content
        await writeToVfs(rollback.projectId, file.path, file.content, 'modify');
      }
      restoredFiles.push(file.path);
    }

    // Mark rollback as used
    await getDb()
      .collection(ROLLBACK_COLLECTION)
      .doc(rollbackId)
      .update({ executedAt: Date.now() });

    console.log('[167.3][MUTATION] Rollback complete:', restoredFiles.length, 'files restored');

    return { success: true, restoredFiles };
  } catch (error) {
    console.error('[167.3][MUTATION] Rollback failed:', error);
    return {
      success: false,
      restoredFiles: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Main Apply Function
// =============================================================================

/**
 * Apply UI codegen result to project files
 */
export async function applyUiCodegenResult(
  result: UiCodegenResult,
  options: {
    target?: FileWriteTarget;
    createRollback?: boolean;
    dryRun?: boolean;
  } = {},
): Promise<UiApplyResult> {
  const startTime = Date.now();
  console.log('[167.3][MUTATION] Applying', result.files.length, 'file changes');

  const { createRollback: shouldCreateRollback = true, dryRun = false } = options;
  const projectId = result.projectId;

  const appliedFiles: UiFileTarget[] = [];
  const failedFiles: Array<{ target: UiFileTarget; error: string }> = [];
  const originalFiles: Array<{ path: string; content: string | null }> = [];

  for (const change of result.files) {
    const filePath = change.target.path;

    // Safety check
    if (isProtectedPath(filePath)) {
      failedFiles.push({
        target: change.target,
        error: 'Protected path - cannot modify',
      });
      continue;
    }

    // Validate content
    if (change.newContent) {
      const validation = validateContent(change.newContent, change.language);
      if (!validation.valid) {
        failedFiles.push({
          target: change.target,
          error: validation.error || 'Invalid content',
        });
        continue;
      }
    }

    // Get original content for rollback
    if (shouldCreateRollback && !dryRun) {
      const originalContent = await getVfsFileContent(projectId, filePath);
      originalFiles.push({ path: filePath, content: originalContent });
    }

    // Apply change
    if (!dryRun) {
      try {
        if (change.action === 'delete') {
          await deleteFromVfs(projectId, filePath);
        } else {
          await writeToVfs(projectId, filePath, change.newContent || '', change.action);
        }

        appliedFiles.push(change.target);
        console.log('[167.3][MUTATION] Applied:', filePath);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Write failed';
        failedFiles.push({ target: change.target, error: errMsg });
        console.error('[167.3][MUTATION] Failed:', filePath, errMsg);
      }
    } else {
      // Dry run - just mark as applied
      appliedFiles.push(change.target);
    }
  }

  // Create rollback record
  let rollbackId: string | undefined;
  if (shouldCreateRollback && !dryRun && originalFiles.length > 0) {
    const rollback = await createRollback(result.planId, projectId, originalFiles);
    rollbackId = rollback.id;
  }

  const applyTimeMs = Date.now() - startTime;

  const applyResult: UiApplyResult = {
    planId: result.planId,
    projectId,
    success: failedFiles.length === 0,
    appliedFiles,
    failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
    rollbackAvailable: !!rollbackId,
    rollbackId,
    summary: buildSummary(appliedFiles, failedFiles, dryRun),
    applyTimeMs,
  };

  console.log('[167.3][MUTATION] Apply complete:',
    appliedFiles.length, 'applied,',
    failedFiles.length, 'failed,',
    applyTimeMs, 'ms');

  return applyResult;
}

/**
 * Build human-readable summary
 */
function buildSummary(
  applied: UiFileTarget[],
  failed: Array<{ target: UiFileTarget; error: string }>,
  dryRun: boolean,
): string {
  const lines: string[] = [];

  if (dryRun) {
    lines.push('DRY RUN - No changes applied');
    lines.push('');
  }

  if (applied.length > 0) {
    lines.push(`${dryRun ? 'Would apply' : 'Applied'} ${applied.length} file(s):`);
    for (const file of applied) {
      lines.push(`  - ${file.path} (${file.kind})`);
    }
  }

  if (failed.length > 0) {
    lines.push('');
    lines.push(`Failed ${failed.length} file(s):`);
    for (const { target, error } of failed) {
      lines.push(`  - ${target.path}: ${error}`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Queue multiple file changes for async processing
 */
export async function queueFileChanges(
  result: UiCodegenResult,
): Promise<{
  queued: number;
  jobIds: string[];
}> {
  console.log('[167.3][MUTATION] Queueing', result.files.length, 'file changes');

  const jobIds: string[] = [];

  for (const change of result.files) {
    if (isProtectedPath(change.target.path)) {
      continue;
    }

    const job = await queueFileWrite(result.projectId, change);
    jobIds.push(job.id);
  }

  return { queued: jobIds.length, jobIds };
}

/**
 * Process queued file writes
 */
export async function processQueuedWrites(
  projectId: string,
  limit = 10,
): Promise<{
  processed: number;
  success: number;
  failed: number;
}> {
  console.log('[167.3][MUTATION] Processing queued writes for:', projectId);

  const snap = await getDb()
    .collection(FILE_WRITES_COLLECTION)
    .where('projectId', '==', projectId)
    .where('status', '==', 'pending')
    .limit(limit)
    .get();

  let success = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const job = doc.data() as FileWriteJob;

    try {
      if (job.action === 'delete') {
        await deleteFromVfs(projectId, job.filePath);
      } else {
        await writeToVfs(projectId, job.filePath, job.content, job.action);
      }

      await updateJobStatus(job.id, 'applied');
      success++;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed';
      await updateJobStatus(job.id, 'failed', errMsg);
      failed++;
    }
  }

  return { processed: snap.size, success, failed };
}

// =============================================================================
// Utility Exports
// =============================================================================

export {
  isProtectedPath,
  validateContent,
  getVfsFileContent,
  writeToVfs,
  deleteFromVfs,
  createRollback,
};

console.log('[167.3][UI_BUILDER] FileMutationEngine loaded');
