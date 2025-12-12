/**
 * Phase 84.7: Project Ownership Helper
 * Verify that the authenticated user owns the specified project
 */

import { adminDb } from '@/server/firebaseAdmin';
import { AuthedUser } from './requireUser';

export interface ProjectOwnership {
  projectId: string;
  ownerId: string;
}

/**
 * Verify that the user owns the project
 * Throws an error if the project doesn't exist or user is not the owner
 */
export async function requireProjectOwner(
  user: AuthedUser,
  projectId: string
): Promise<ProjectOwnership> {
  if (!projectId) {
    throw new Error('PROJECT_ID_REQUIRED');
  }

  try {
    const projectDoc = await adminDb.collection('projects').doc(projectId).get();

    if (!projectDoc.exists) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    const projectData = projectDoc.data();
    const ownerId = projectData?.ownerId || projectData?.userId;

    if (!ownerId) {
      console.error('Project missing ownerId/userId:', projectId);
      throw new Error('PROJECT_INVALID');
    }

    if (ownerId !== user.uid) {
      console.warn('Ownership mismatch:', {
        projectId,
        expected: user.uid,
        actual: ownerId,
      });
      throw new Error('NOT_OWNER');
    }

    return {
      projectId,
      ownerId,
    };
  } catch (err: any) {
    // Re-throw known errors
    if (
      err.message === 'PROJECT_NOT_FOUND' ||
      err.message === 'PROJECT_INVALID' ||
      err.message === 'NOT_OWNER'
    ) {
      throw err;
    }

    // Log and throw Firestore errors
    console.error('requireProjectOwner Firestore error:', err);
    throw new Error('DATABASE_ERROR');
  }
}
