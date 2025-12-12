/**
 * Phase 97.1: Project Preview URL Server Helpers
 * Read and update previewUrl for projects
 */

import { adminDb } from '@/lib/firebaseAdmin';

const db = adminDb;

/**
 * Get the preview URL for a project
 * Checks both 'projects' and 'ops_projects' collections
 */
export async function getProjectPreviewUrl(projectId: string): Promise<string | null> {
  // Try projects collection first
  const projectRef = db.collection('projects').doc(projectId);
  const projectSnap = await projectRef.get();

  if (projectSnap.exists) {
    const data = projectSnap.data();
    return (data?.previewUrl as string | undefined) ?? null;
  }

  // Fallback to ops_projects
  const opsRef = db.collection('ops_projects').doc(projectId);
  const opsSnap = await opsRef.get();

  if (opsSnap.exists) {
    const data = opsSnap.data();
    return (data?.previewUrl as string | undefined) ?? null;
  }

  return null;
}

/**
 * Update the preview URL for a project
 */
export async function updateProjectPreviewUrl(params: {
  projectId: string;
  previewUrl: string | null;
}): Promise<void> {
  const { projectId, previewUrl } = params;

  // Build update object
  const update: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (previewUrl === null || previewUrl === '') {
    update.previewUrl = null;
  } else {
    // Validate URL format
    const trimmed = previewUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      throw new Error('Preview URL must start with http:// or https://');
    }
    update.previewUrl = trimmed;
  }

  // Update in projects collection
  const projectRef = db.collection('projects').doc(projectId);
  const projectSnap = await projectRef.get();

  if (projectSnap.exists) {
    await projectRef.update(update);
    console.log(`[projectPreview] Updated previewUrl for project ${projectId}`);
    return;
  }

  // Fallback to ops_projects
  const opsRef = db.collection('ops_projects').doc(projectId);
  const opsSnap = await opsRef.get();

  if (opsSnap.exists) {
    await opsRef.update(update);
    console.log(`[projectPreview] Updated previewUrl for ops_project ${projectId}`);
    return;
  }

  throw new Error('Project not found');
}
