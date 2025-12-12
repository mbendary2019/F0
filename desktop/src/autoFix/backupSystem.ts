// desktop/src/autoFix/backupSystem.ts
// Phase 144.2.0 – Pre-Patch Backup System for Auto-Fix

import type { AutoFixBackupSession, AutoFixBackupFile, FilePatch } from './autoFixTypes';

export interface BackupSystemDeps {
  /** Project root path */
  projectRoot: string;

  /** Read file content */
  readFile: (filePath: string) => Promise<string | null>;

  /** Write file content */
  writeFile: (filePath: string, content: string) => Promise<void>;

  /** Create directory if not exists */
  ensureDir: (dirPath: string) => Promise<void>;

  /** Check if file exists */
  fileExists: (filePath: string) => Promise<boolean>;

  /** Get relative path from project root */
  relativePath: (filePath: string) => string;

  /** List files in directory */
  listDir?: (dirPath: string) => Promise<string[]>;
}

/**
 * Generate backup folder path for current timestamp
 */
export function getBackupFolderPath(projectRoot: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${projectRoot}/.f0/auto-fix-backups/${timestamp}`;
}

/**
 * Create backup session for files about to be patched
 */
export async function createBackupSession(
  patches: FilePatch[],
  deps: BackupSystemDeps
): Promise<AutoFixBackupSession | null> {
  const { projectRoot, writeFile, ensureDir, relativePath } = deps;

  if (patches.length === 0) {
    console.log('[AutoFixBackup] No patches to backup');
    return null;
  }

  const timestamp = new Date().toISOString();
  const backupDir = getBackupFolderPath(projectRoot);

  console.log(`[AutoFixBackup] Creating backup at: ${backupDir}`);

  try {
    // Create backup directory
    await ensureDir(backupDir);

    const files: AutoFixBackupFile[] = [];

    // Backup each file
    for (const patch of patches) {
      try {
        const relPath = relativePath(patch.filePath);
        const backupFilePath = `${backupDir}/${relPath}`;

        // Create subdirectory for file if needed
        const fileDir = backupFilePath.substring(0, backupFilePath.lastIndexOf('/'));
        await ensureDir(fileDir);

        // Write original content to backup
        await writeFile(backupFilePath, patch.before);

        files.push({
          path: relPath,
          sizeBefore: patch.before.length,
          sizeAfter: patch.after.length,
          issuesFixed: 0, // Will be updated later
        });

        console.log(`[AutoFixBackup] Backed up: ${relPath}`);
      } catch (err) {
        console.warn(`[AutoFixBackup] Failed to backup file: ${patch.filePath}`, err);
      }
    }

    // Write manifest
    const session: AutoFixBackupSession = {
      timestamp,
      projectRoot,
      backupDir,
      files,
      totalFilesBackedUp: files.length,
    };

    await writeFile(`${backupDir}/manifest.json`, JSON.stringify(session, null, 2));

    console.log(`[AutoFixBackup] Created backup: ${timestamp} (${files.length} files)`);

    return session;
  } catch (err) {
    console.error('[AutoFixBackup] Failed to create backup session:', err);
    return null;
  }
}

/**
 * Get list of available backup sessions
 */
export async function listBackupSessions(
  deps: BackupSystemDeps
): Promise<AutoFixBackupSession[]> {
  const { projectRoot, readFile, listDir } = deps;

  if (!listDir) {
    console.warn('[AutoFixBackup] listDir not available');
    return [];
  }

  const backupsDir = `${projectRoot}/.f0/auto-fix-backups`;

  try {
    const folders = await listDir(backupsDir);
    const sessions: AutoFixBackupSession[] = [];

    for (const folder of folders) {
      try {
        const manifestPath = `${backupsDir}/${folder}/manifest.json`;
        const manifestContent = await readFile(manifestPath);
        if (manifestContent) {
          const session = JSON.parse(manifestContent) as AutoFixBackupSession;
          sessions.push(session);
        }
      } catch {
        // Skip invalid backup folders
      }
    }

    // Sort by timestamp (newest first)
    sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return sessions;
  } catch {
    return [];
  }
}

/**
 * Get the most recent backup session
 */
export async function getLastBackupSession(
  deps: BackupSystemDeps
): Promise<AutoFixBackupSession | null> {
  const sessions = await listBackupSessions(deps);
  return sessions[0] ?? null;
}

/**
 * Rollback to a specific backup session
 */
export async function rollbackToBackup(
  session: AutoFixBackupSession,
  deps: BackupSystemDeps
): Promise<{
  success: boolean;
  restoredFiles: string[];
  errors: string[];
}> {
  const { writeFile, readFile } = deps;

  console.log(`[AutoFixBackup] Rolling back to: ${session.timestamp}`);

  const restoredFiles: string[] = [];
  const errors: string[] = [];

  for (const file of session.files) {
    try {
      const backupFilePath = `${session.backupDir}/${file.path}`;
      const content = await readFile(backupFilePath);

      if (content === null) {
        errors.push(`Backup file not found: ${file.path}`);
        continue;
      }

      // Restore the original file
      const originalFilePath = `${session.projectRoot}/${file.path}`;
      await writeFile(originalFilePath, content);

      restoredFiles.push(file.path);
      console.log(`[AutoFixBackup] Restored: ${file.path}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Failed to restore ${file.path}: ${message}`);
      console.error(`[AutoFixBackup] Failed to restore: ${file.path}`, err);
    }
  }

  const success = errors.length === 0;

  console.log(
    `[AutoFixBackup] Rollback ${success ? 'successful' : 'completed with errors'}: ` +
    `${restoredFiles.length} restored, ${errors.length} errors`
  );

  return { success, restoredFiles, errors };
}

/**
 * Delete a backup session
 */
export async function deleteBackupSession(
  session: AutoFixBackupSession,
  deps: BackupSystemDeps & { deleteDir?: (dirPath: string) => Promise<void> }
): Promise<boolean> {
  if (!deps.deleteDir) {
    console.warn('[AutoFixBackup] deleteDir not available');
    return false;
  }

  try {
    await deps.deleteDir(session.backupDir);
    console.log(`[AutoFixBackup] Deleted backup: ${session.timestamp}`);
    return true;
  } catch (err) {
    console.error('[AutoFixBackup] Failed to delete backup:', err);
    return false;
  }
}

/**
 * Clean up old backups (keep only the last N)
 */
export async function cleanupOldBackups(
  deps: BackupSystemDeps & { deleteDir?: (dirPath: string) => Promise<void> },
  keepCount: number = 5
): Promise<number> {
  const sessions = await listBackupSessions(deps);

  if (sessions.length <= keepCount) {
    return 0;
  }

  const toDelete = sessions.slice(keepCount);
  let deleted = 0;

  for (const session of toDelete) {
    const success = await deleteBackupSession(session, deps);
    if (success) deleted++;
  }

  console.log(`[AutoFixBackup] Cleaned up ${deleted} old backups`);
  return deleted;
}
