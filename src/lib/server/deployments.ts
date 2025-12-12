/**
 * Phase 97.2: Deployments Server Helpers
 * Get latest successful deployment and sync preview URL
 */

import { adminDb } from '@/lib/firebaseAdmin';
import { updateProjectPreviewUrl } from '@/lib/server/projectPreview';
import type { DeploymentEnv, DeploymentStatus } from '@/types/deployment';

const db = adminDb;

export interface DeploymentRecord {
  id: string;
  projectId: string;
  ownerUid: string;
  projectName: string;
  status: DeploymentStatus;
  env: DeploymentEnv;
  url?: string | null;
  branch: string;
  label?: string;
  provider: 'vercel' | 'github-actions' | 'other';
  createdAt: number;
  finishedAt?: number | null;
}

/**
 * Get the latest successful deployment for a project
 * @param projectId - The project ID
 * @param env - Optional environment filter ('production' | 'preview')
 */
export async function getLatestSuccessfulDeployment(
  projectId: string,
  env: DeploymentEnv | null = null
): Promise<DeploymentRecord | null> {
  let queryRef = db
    .collection('ops_deployments')
    .where('projectId', '==', projectId)
    .where('status', '==', 'success');

  if (env) {
    queryRef = queryRef.where('env', '==', env);
  }

  // Note: orderBy requires a composite index. We'll sort client-side for safety.
  const snap = await queryRef.get();

  if (snap.empty) return null;

  // Sort by createdAt descending (most recent first)
  const docs = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      projectId: data.projectId,
      ownerUid: data.ownerUid,
      projectName: data.projectName,
      status: data.status as DeploymentStatus,
      env: data.env as DeploymentEnv,
      url: data.url ?? null,
      branch: data.branch,
      label: data.label,
      provider: data.provider,
      createdAt:
        typeof data.createdAt === 'number'
          ? data.createdAt
          : data.createdAt?.toMillis?.() || Date.now(),
      finishedAt: data.finishedAt ?? null,
    } as DeploymentRecord;
  });

  docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return docs[0] || null;
}

/**
 * Sync project preview URL with the latest successful deployment
 * Called automatically after a deployment succeeds
 */
export async function syncProjectPreviewUrlWithLatestDeployment(params: {
  projectId: string;
  env?: DeploymentEnv | null;
}): Promise<{ synced: boolean; url: string | null }> {
  const { projectId, env = null } = params;

  const latest = await getLatestSuccessfulDeployment(projectId, env);

  if (!latest?.url) {
    console.log(
      `[deployments] No successful deployment with URL found for project ${projectId}`
    );
    return { synced: false, url: null };
  }

  try {
    await updateProjectPreviewUrl({
      projectId,
      previewUrl: latest.url,
    });

    console.log(
      `[deployments] Synced previewUrl for project ${projectId} to ${latest.url}`
    );
    return { synced: true, url: latest.url };
  } catch (err) {
    console.error(`[deployments] Failed to sync previewUrl:`, err);
    return { synced: false, url: latest.url };
  }
}

/**
 * Get all deployments for a project (most recent first)
 */
export async function getProjectDeployments(
  projectId: string,
  limit = 10
): Promise<DeploymentRecord[]> {
  const snap = await db
    .collection('ops_deployments')
    .where('projectId', '==', projectId)
    .get();

  const docs = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      projectId: data.projectId,
      ownerUid: data.ownerUid,
      projectName: data.projectName,
      status: data.status as DeploymentStatus,
      env: data.env as DeploymentEnv,
      url: data.url ?? null,
      branch: data.branch,
      label: data.label,
      provider: data.provider,
      createdAt:
        typeof data.createdAt === 'number'
          ? data.createdAt
          : data.createdAt?.toMillis?.() || Date.now(),
      finishedAt: data.finishedAt ?? null,
    } as DeploymentRecord;
  });

  // Sort by createdAt descending
  docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return docs.slice(0, limit);
}
