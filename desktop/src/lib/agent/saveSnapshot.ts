// desktop/src/lib/agent/saveSnapshot.ts
// Phase 123: Save Project Snapshot to Firestore
// Saves snapshot to projects/{projectId}/snapshot

import type { ProjectSnapshot } from './tools/generateProjectSnapshot';

/**
 * Firestore snapshot document structure
 */
export interface SnapshotDocument extends ProjectSnapshot {
  projectId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * Save snapshot options
 */
export interface SaveSnapshotOptions {
  projectId: string;
  userId: string;
  snapshot: ProjectSnapshot;
  apiEndpoint?: string;
}

/**
 * Save snapshot result
 */
export interface SaveSnapshotResult {
  success: boolean;
  docId?: string;
  error?: string;
}

/**
 * Save project snapshot to Firestore via API
 *
 * Endpoint: POST /api/projects/[projectId]/snapshot
 * Body: { snapshot: ProjectSnapshot }
 */
export async function saveSnapshotToFirestore(
  options: SaveSnapshotOptions
): Promise<SaveSnapshotResult> {
  const {
    projectId,
    userId,
    snapshot,
    apiEndpoint = '/api/projects',
  } = options;

  console.log('[saveSnapshot] Saving for project:', projectId);

  try {
    const response = await fetch(`${apiEndpoint}/${projectId}/snapshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snapshot,
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[saveSnapshot] API error:', error);
      return {
        success: false,
        error: `API error: ${response.status}`,
      };
    }

    const result = await response.json();
    console.log('[saveSnapshot] Saved successfully:', result.docId);

    return {
      success: true,
      docId: result.docId || projectId,
    };
  } catch (err) {
    console.error('[saveSnapshot] Network error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/**
 * Load snapshot from Firestore via API
 *
 * Endpoint: GET /api/projects/[projectId]/snapshot
 */
export async function loadSnapshotFromFirestore(
  projectId: string,
  apiEndpoint: string = '/api/projects'
): Promise<ProjectSnapshot | null> {
  console.log('[loadSnapshot] Loading for project:', projectId);

  try {
    const response = await fetch(`${apiEndpoint}/${projectId}/snapshot`);

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[loadSnapshot] No snapshot found');
        return null;
      }
      console.error('[loadSnapshot] API error:', response.status);
      return null;
    }

    // Check content-type before parsing to avoid JSON parse errors on HTML error pages
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      // Dev server returns HTML - this is expected, just use local fallback
      console.log('[loadSnapshot] Remote returned non-JSON (dev server?), using local fallback');
      return null;
    }

    const data = await response.json();
    console.log('[loadSnapshot] Loaded:', data.snapshot?.projectName);

    return data.snapshot || null;
  } catch (err) {
    console.error('[loadSnapshot] Error:', err);
    return null;
  }
}

/**
 * Save snapshot to local storage as fallback
 */
export function saveSnapshotLocally(
  projectRoot: string,
  snapshot: ProjectSnapshot
): boolean {
  try {
    const key = `f0-snapshot-${btoa(projectRoot)}`;
    localStorage.setItem(key, JSON.stringify(snapshot));
    console.log('[saveSnapshot] Saved locally');
    return true;
  } catch (err) {
    console.error('[saveSnapshot] Local save error:', err);
    return false;
  }
}

/**
 * Load snapshot from local storage
 */
export function loadSnapshotLocally(
  projectRoot: string
): ProjectSnapshot | null {
  try {
    const key = `f0-snapshot-${btoa(projectRoot)}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as ProjectSnapshot;
    }
  } catch (err) {
    console.error('[loadSnapshot] Local load error:', err);
  }
  return null;
}

export default saveSnapshotToFirestore;
