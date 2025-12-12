// desktop/src/lib/ace/aceSnapshots.ts
// Phase 129.3: ACE File Snapshot System
// Creates file snapshots before ACE executes phases for safe rollback
// Phase 129.6: Fixed for browser environment - uses window.f0Desktop

/**
 * A single file's snapshot data
 */
export type FileSnapshotData = {
  /** Original file path */
  filePath: string;
  /** File content at snapshot time */
  content: string;
  /** File existed at snapshot time */
  existed: boolean;
  /** Timestamp of snapshot */
  timestamp: string;
};

/**
 * A complete snapshot of multiple files
 */
export type AceSnapshot = {
  /** Unique snapshot ID */
  id: string;
  /** Reason for creating snapshot */
  reason: string;
  /** Project root path */
  projectRoot: string;
  /** Snapshot creation timestamp */
  createdAt: string;
  /** Files included in snapshot */
  files: FileSnapshotData[];
  /** Metadata */
  meta?: {
    phaseId?: string;
    suggestionId?: string;
    actionCount?: number;
  };
};

/**
 * Snapshot store - in-memory + local file storage
 */
export type AceSnapshotStore = {
  /** All snapshots, most recent first */
  snapshots: AceSnapshot[];
  /** Maximum snapshots to keep */
  maxSnapshots: number;
};

/**
 * Default store
 */
const defaultStore: AceSnapshotStore = {
  snapshots: [],
  maxSnapshots: 20,
};

/**
 * In-memory store (singleton)
 */
let snapshotStore: AceSnapshotStore = { ...defaultStore };

/**
 * Browser-safe path utilities
 */
function isAbsolutePath(filePath: string): boolean {
  // Unix absolute path or Windows absolute path
  return filePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(filePath);
}

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

function getSnapshotDir(projectRoot: string): string {
  return joinPath(projectRoot, '.f0', 'ace-snapshots');
}

/**
 * Generate unique snapshot ID
 */
function generateSnapshotId(): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
  const rand = Math.random().toString(36).substring(2, 6);
  return `ace-snap-${date}-${time}-${rand}`;
}

/**
 * Get f0Desktop API
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getF0Desktop(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).f0Desktop;
}

/**
 * Read file content safely using f0Desktop
 */
async function readFileSafe(filePath: string): Promise<{ content: string; existed: boolean }> {
  try {
    const f0Desktop = getF0Desktop();
    if (!f0Desktop?.readFile) {
      console.warn('[ACE Snapshots] f0Desktop.readFile not available');
      return { content: '', existed: false };
    }

    const content = await f0Desktop.readFile(filePath);
    if (content !== null && content !== undefined) {
      return { content, existed: true };
    }
    return { content: '', existed: false };
  } catch (err) {
    console.error('[ACE Snapshots] Error reading file:', filePath, err);
    return { content: '', existed: false };
  }
}

/**
 * Write file content safely using f0Desktop
 */
async function writeFileSafe(filePath: string, content: string): Promise<boolean> {
  try {
    const f0Desktop = getF0Desktop();
    if (!f0Desktop?.writeFile) {
      console.warn('[ACE Snapshots] f0Desktop.writeFile not available');
      return false;
    }

    await f0Desktop.writeFile(filePath, content);
    return true;
  } catch (err) {
    console.error('[ACE Snapshots] Error writing file:', filePath, err);
    return false;
  }
}

/**
 * Delete file safely using f0Desktop
 */
async function deleteFileSafe(filePath: string): Promise<boolean> {
  try {
    const f0Desktop = getF0Desktop();
    if (!f0Desktop?.deleteFile) {
      console.warn('[ACE Snapshots] f0Desktop.deleteFile not available');
      return false;
    }

    await f0Desktop.deleteFile(filePath);
    return true;
  } catch (err) {
    console.error('[ACE Snapshots] Error deleting file:', filePath, err);
    return false;
  }
}

/**
 * Create a snapshot of specified files
 */
export async function createSnapshot(
  projectRoot: string,
  filePaths: string[],
  reason: string,
  meta?: AceSnapshot['meta']
): Promise<AceSnapshot> {
  const id = generateSnapshotId();
  const timestamp = new Date().toISOString();

  console.log('[ACE Snapshots] Creating snapshot:', id, 'for', filePaths.length, 'files');

  // Read all files
  const files: FileSnapshotData[] = [];
  for (const filePath of filePaths) {
    const fullPath = isAbsolutePath(filePath) ? filePath : joinPath(projectRoot, filePath);
    const { content, existed } = await readFileSafe(fullPath);
    files.push({
      filePath: fullPath,
      content,
      existed,
      timestamp,
    });
  }

  const snapshot: AceSnapshot = {
    id,
    reason,
    projectRoot,
    createdAt: timestamp,
    files,
    meta,
  };

  // Add to store (most recent first)
  snapshotStore.snapshots.unshift(snapshot);

  // Trim old snapshots
  if (snapshotStore.snapshots.length > snapshotStore.maxSnapshots) {
    snapshotStore.snapshots = snapshotStore.snapshots.slice(0, snapshotStore.maxSnapshots);
  }

  // Save snapshot to disk for persistence (optional, may fail in browser)
  await saveSnapshotToDisk(projectRoot, snapshot);

  console.log('[ACE Snapshots] Snapshot created:', id);
  return snapshot;
}

/**
 * Restore files from a snapshot
 */
export async function restoreSnapshot(
  snapshotId: string
): Promise<{ success: boolean; filesRestored: number; errors: string[] }> {
  const snapshot = snapshotStore.snapshots.find(s => s.id === snapshotId);

  if (!snapshot) {
    return { success: false, filesRestored: 0, errors: ['Snapshot not found: ' + snapshotId] };
  }

  console.log('[ACE Snapshots] Restoring snapshot:', snapshotId);

  let filesRestored = 0;
  const errors: string[] = [];

  for (const file of snapshot.files) {
    if (file.existed) {
      // File existed - restore content
      const success = await writeFileSafe(file.filePath, file.content);
      if (success) {
        filesRestored++;
      } else {
        errors.push(`Failed to restore: ${file.filePath}`);
      }
    } else {
      // File didn't exist - delete if it was created
      const success = await deleteFileSafe(file.filePath);
      if (success) {
        filesRestored++;
      } else {
        errors.push(`Failed to delete: ${file.filePath}`);
      }
    }
  }

  console.log('[ACE Snapshots] Restored', filesRestored, 'files from snapshot:', snapshotId);

  return {
    success: errors.length === 0,
    filesRestored,
    errors,
  };
}

/**
 * Get a snapshot by ID
 */
export function getSnapshot(snapshotId: string): AceSnapshot | null {
  return snapshotStore.snapshots.find(s => s.id === snapshotId) || null;
}

/**
 * Get all snapshots
 */
export function getAllSnapshots(): AceSnapshot[] {
  return [...snapshotStore.snapshots];
}

/**
 * Get recent snapshots
 */
export function getRecentSnapshots(n: number = 5): AceSnapshot[] {
  return snapshotStore.snapshots.slice(0, n);
}

/**
 * Delete a snapshot
 */
export function deleteSnapshot(snapshotId: string): boolean {
  const index = snapshotStore.snapshots.findIndex(s => s.id === snapshotId);
  if (index !== -1) {
    snapshotStore.snapshots.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Clear all snapshots
 */
export function clearAllSnapshots(): void {
  snapshotStore.snapshots = [];
}

/**
 * Save snapshot to disk for persistence (uses localStorage as fallback)
 */
async function saveSnapshotToDisk(projectRoot: string, snapshot: AceSnapshot): Promise<void> {
  try {
    // Try to save via f0Desktop if available
    const f0Desktop = getF0Desktop();
    if (f0Desktop?.writeFile) {
      const dir = getSnapshotDir(projectRoot);
      const filePath = joinPath(dir, `${snapshot.id}.json`);

      // Note: This may fail if directory doesn't exist
      // In production, we'd need ensureDir support
      try {
        await f0Desktop.writeFile(filePath, JSON.stringify(snapshot, null, 2));
        console.log('[ACE Snapshots] Saved to disk:', filePath);
        return;
      } catch {
        // Fall through to localStorage
      }
    }

    // Fallback: save to localStorage
    const key = `ace-snapshot-${snapshot.id}`;
    localStorage.setItem(key, JSON.stringify(snapshot));

    // Also maintain list of snapshot IDs
    const idsKey = `ace-snapshot-ids-${projectRoot}`;
    const existingIds = JSON.parse(localStorage.getItem(idsKey) || '[]');
    if (!existingIds.includes(snapshot.id)) {
      existingIds.unshift(snapshot.id);
      // Keep only last 20
      const trimmed = existingIds.slice(0, 20);
      localStorage.setItem(idsKey, JSON.stringify(trimmed));
    }

    console.log('[ACE Snapshots] Saved to localStorage:', snapshot.id);
  } catch (err) {
    console.error('[ACE Snapshots] Error saving snapshot:', err);
  }
}

/**
 * Load snapshots from disk/localStorage
 */
export async function loadSnapshotsFromDisk(projectRoot: string): Promise<void> {
  try {
    const snapshots: AceSnapshot[] = [];

    // Try loading from localStorage
    const idsKey = `ace-snapshot-ids-${projectRoot}`;
    const ids = JSON.parse(localStorage.getItem(idsKey) || '[]');

    for (const id of ids) {
      try {
        const key = `ace-snapshot-${id}`;
        const data = localStorage.getItem(key);
        if (data) {
          const snapshot = JSON.parse(data) as AceSnapshot;
          snapshots.push(snapshot);
        }
      } catch (err) {
        console.error('[ACE Snapshots] Error loading snapshot:', id, err);
      }
    }

    // Sort by creation date (most recent first)
    snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Merge with existing in-memory snapshots (prefer disk versions)
    const existingIds = new Set(snapshotStore.snapshots.map(s => s.id));
    for (const snapshot of snapshots) {
      if (!existingIds.has(snapshot.id)) {
        snapshotStore.snapshots.push(snapshot);
      }
    }

    // Sort again and trim
    snapshotStore.snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    snapshotStore.snapshots = snapshotStore.snapshots.slice(0, snapshotStore.maxSnapshots);

    console.log('[ACE Snapshots] Loaded', snapshots.length, 'snapshots');
  } catch (err) {
    console.error('[ACE Snapshots] Error loading snapshots:', err);
  }
}

/**
 * Get snapshot summary for display
 */
export function getSnapshotSummary(
  snapshot: AceSnapshot,
  locale: 'ar' | 'en' = 'en'
): {
  id: string;
  reason: string;
  filesCount: number;
  createdAt: string;
  timeAgo: string;
} {
  const isArabic = locale === 'ar';
  const now = new Date();
  const created = new Date(snapshot.createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  let timeAgo: string;
  if (diffMins < 1) {
    timeAgo = isArabic ? 'الآن' : 'just now';
  } else if (diffMins < 60) {
    timeAgo = isArabic ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
  } else if (diffHours < 24) {
    timeAgo = isArabic ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
  } else {
    const diffDays = Math.floor(diffMs / 86400000);
    timeAgo = isArabic ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  }

  return {
    id: snapshot.id,
    reason: snapshot.reason,
    filesCount: snapshot.files.length,
    createdAt: snapshot.createdAt,
    timeAgo,
  };
}

/**
 * Create snapshot creator function for ACE Executor
 */
export function createSnapshotCreator(
  projectRoot: string,
  getFilesForPhase: (phaseId: string) => string[]
): (reason: string) => Promise<string> {
  return async (reason: string): Promise<string> => {
    // Extract phase ID from reason (format: ACE_PHASE_START:phase-id)
    const phaseMatch = reason.match(/ACE_PHASE_START:(.+)/);
    const phaseId = phaseMatch ? phaseMatch[1] : undefined;

    // Get files to snapshot
    const files = phaseId ? getFilesForPhase(phaseId) : [];

    if (files.length === 0) {
      console.log('[ACE Snapshots] No files to snapshot for:', reason);
      // Create empty snapshot anyway for tracking
      const snapshot = await createSnapshot(projectRoot, [], reason, { phaseId });
      return snapshot.id;
    }

    const snapshot = await createSnapshot(projectRoot, files, reason, {
      phaseId,
      actionCount: files.length,
    });

    return snapshot.id;
  };
}

export default {
  createSnapshot,
  restoreSnapshot,
  getSnapshot,
  getAllSnapshots,
  getRecentSnapshots,
  deleteSnapshot,
  clearAllSnapshots,
  loadSnapshotsFromDisk,
  getSnapshotSummary,
  createSnapshotCreator,
};
