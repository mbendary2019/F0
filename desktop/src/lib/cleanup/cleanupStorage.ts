// desktop/src/lib/cleanup/cleanupStorage.ts
// Phase 129.0: Cleanup Session Storage (Local .f0 folder)

import type {
  CleanupSession,
  CleanupSessionsStorage,
  CleanupSessionHistoryEntry,
} from './cleanupTypes';

const STORAGE_FILE = 'cleanup-sessions.json';
const MAX_SESSIONS = 5;
const MAX_HISTORY = 10;

/**
 * Get cleanup sessions storage path
 */
function getStoragePath(projectRoot: string): string {
  return `${projectRoot}/.f0/${STORAGE_FILE}`;
}

/**
 * Load cleanup sessions from storage
 */
export async function loadCleanupSessions(
  projectRoot: string,
): Promise<CleanupSessionsStorage> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f0Desktop = (window as any).f0Desktop;
    if (!f0Desktop?.readFile) {
      console.warn('[CleanupStorage] f0Desktop not available');
      return createEmptyStorage();
    }

    const path = getStoragePath(projectRoot);
    const content = await f0Desktop.readFile(path);

    if (!content) {
      return createEmptyStorage();
    }

    const data = JSON.parse(content) as CleanupSessionsStorage;

    // Validate version
    if (data.version !== 1) {
      console.warn('[CleanupStorage] Unknown storage version, resetting');
      return createEmptyStorage();
    }

    console.log('[CleanupStorage] Loaded', data.sessions.length, 'sessions');
    return data;
  } catch (err) {
    // File doesn't exist or parse error
    console.log('[CleanupStorage] No existing storage, creating new');
    return createEmptyStorage();
  }
}

/**
 * Save cleanup sessions to storage
 */
export async function saveCleanupSessions(
  projectRoot: string,
  storage: CleanupSessionsStorage,
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f0Desktop = (window as any).f0Desktop;
    if (!f0Desktop?.writeFile) {
      console.warn('[CleanupStorage] f0Desktop not available');
      return false;
    }

    // Ensure .f0 directory exists
    const f0Dir = `${projectRoot}/.f0`;
    try {
      await f0Desktop.readFile(`${f0Dir}/.gitkeep`);
    } catch {
      // Directory might not exist, try to create marker file
      await f0Desktop.writeFile(`${f0Dir}/.gitkeep`, '');
    }

    const path = getStoragePath(projectRoot);
    const content = JSON.stringify(storage, null, 2);
    await f0Desktop.writeFile(path, content);

    console.log('[CleanupStorage] Saved', storage.sessions.length, 'sessions');
    return true;
  } catch (err) {
    console.error('[CleanupStorage] Failed to save:', err);
    return false;
  }
}

/**
 * Create empty storage
 */
function createEmptyStorage(): CleanupSessionsStorage {
  return {
    version: 1,
    sessions: [],
    history: [],
  };
}

/**
 * Save a session (add or update)
 */
export async function saveSession(
  projectRoot: string,
  session: CleanupSession,
): Promise<boolean> {
  const storage = await loadCleanupSessions(projectRoot);

  // Find existing session index
  const existingIndex = storage.sessions.findIndex(s => s.id === session.id);

  if (existingIndex >= 0) {
    // Update existing
    storage.sessions[existingIndex] = session;
  } else {
    // Add new, trim if needed
    storage.sessions.unshift(session);
    if (storage.sessions.length > MAX_SESSIONS) {
      storage.sessions = storage.sessions.slice(0, MAX_SESSIONS);
    }
  }

  storage.lastSessionId = session.id;

  return saveCleanupSessions(projectRoot, storage);
}

/**
 * Add session to history (after completion)
 */
export async function addToHistory(
  projectRoot: string,
  session: CleanupSession,
): Promise<boolean> {
  if (session.status !== 'completed') {
    return false;
  }

  const storage = await loadCleanupSessions(projectRoot);

  const entry: CleanupSessionHistoryEntry = {
    id: session.id,
    projectRoot: session.projectRoot,
    completedAt: session.completedAt || new Date().toISOString(),
    scope: session.scope,
    intensity: session.intensity,
    healthBefore: session.healthBefore?.score || 0,
    healthAfter: session.healthAfter?.score || 0,
    issuesFixed: session.summary?.issuesFixed || 0,
    durationMs: session.summary?.durationMs || 0,
  };

  // Add to history, trim if needed
  storage.history.unshift(entry);
  if (storage.history.length > MAX_HISTORY) {
    storage.history = storage.history.slice(0, MAX_HISTORY);
  }

  // Remove from active sessions
  storage.sessions = storage.sessions.filter(s => s.id !== session.id);

  return saveCleanupSessions(projectRoot, storage);
}

/**
 * Get the most recent session (if any)
 */
export async function getLastSession(
  projectRoot: string,
): Promise<CleanupSession | null> {
  const storage = await loadCleanupSessions(projectRoot);

  if (storage.lastSessionId) {
    return storage.sessions.find(s => s.id === storage.lastSessionId) || null;
  }

  return storage.sessions[0] || null;
}

/**
 * Get session history
 */
export async function getSessionHistory(
  projectRoot: string,
): Promise<CleanupSessionHistoryEntry[]> {
  const storage = await loadCleanupSessions(projectRoot);
  return storage.history;
}

/**
 * Delete a session
 */
export async function deleteSession(
  projectRoot: string,
  sessionId: string,
): Promise<boolean> {
  const storage = await loadCleanupSessions(projectRoot);

  storage.sessions = storage.sessions.filter(s => s.id !== sessionId);

  if (storage.lastSessionId === sessionId) {
    storage.lastSessionId = storage.sessions[0]?.id;
  }

  return saveCleanupSessions(projectRoot, storage);
}
