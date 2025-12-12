// src/lib/api/patches.ts
// Phase 82 Part 2: Patches API Client - Wrapper for cloud functions

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebaseClient';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Apply patch result from cloud function
 */
export interface ApplyPatchResult {
  success: boolean;
  patchId: string;
  filesModified: string[];
  filesCreated: string[];
  filesDeleted: string[];
  error?: string;
}

/**
 * Apply a patch using cloud function
 */
export async function applyPatchClient(
  projectId: string,
  patchId: string,
  userId?: string
): Promise<ApplyPatchResult> {
  try {
    const applyPatchFn = httpsCallable<
      { projectId: string; patchId: string; userId?: string },
      ApplyPatchResult
    >(functions, 'applyPatch');

    const result = await applyPatchFn({ projectId, patchId, userId });

    return result.data;
  } catch (error: any) {
    console.error('[applyPatchClient] Error:', error);
    throw new Error(error.message || 'Failed to apply patch');
  }
}

/**
 * Reject a patch (update status in Firestore)
 */
export async function rejectPatchClient(
  projectId: string,
  patchId: string,
  userId: string = 'user'
): Promise<void> {
  try {
    const patchRef = doc(db, `projects/${projectId}/patches/${patchId}`);

    await updateDoc(patchRef, {
      status: 'rejected',
      rejectedAt: serverTimestamp(),
      rejectedBy: userId,
    });

    console.log('[rejectPatchClient] Patch rejected:', patchId);
  } catch (error: any) {
    console.error('[rejectPatchClient] Error:', error);
    throw new Error(error.message || 'Failed to reject patch');
  }
}

/**
 * Apply patch to GitHub branch and optionally open PR (Phase 83.3)
 */
export interface ApplyPatchToGithubResult {
  ok: boolean;
  branch: string;
  baseBranch: string;
  pullRequestNumber: number | null;
  filesCount: number;
}

export async function applyPatchToGithubBranchClient(options: {
  projectId: string;
  patchId: string;
  targetBranch?: string;
  createNewBranch?: boolean;
  branchName?: string;
  openPullRequest?: boolean;
}): Promise<ApplyPatchToGithubResult> {
  try {
    const applyToGithubFn = httpsCallable<typeof options, ApplyPatchToGithubResult>(
      functions,
      'applyPatchToGithubBranch'
    );

    const result = await applyToGithubFn(options);

    return result.data;
  } catch (error: any) {
    console.error('[applyPatchToGithubBranchClient] Error:', error);
    throw new Error(error.message || 'Failed to apply patch to GitHub');
  }
}

/**
 * Get patch details from Firestore
 */
export async function getPatchDetails(projectId: string, patchId: string) {
  try {
    const patchRef = doc(db, `projects/${projectId}/patches/${patchId}`);
    const { getDoc } = await import('firebase/firestore');
    const patchDoc = await getDoc(patchRef);

    if (!patchDoc.exists()) {
      throw new Error('Patch not found');
    }

    return {
      id: patchDoc.id,
      ...patchDoc.data(),
    };
  } catch (error: any) {
    console.error('[getPatchDetails] Error:', error);
    throw error;
  }
}

/**
 * List all patches for a project
 */
export async function listPatches(projectId: string) {
  try {
    const { collection, query, orderBy, getDocs } = await import('firebase/firestore');
    const patchesCollection = collection(db, `projects/${projectId}/patches`);
    const q = query(patchesCollection, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error: any) {
    console.error('[listPatches] Error:', error);
    throw error;
  }
}
