// functions/src/projects/memory.ts
// Phase 75: Project Memory System - Long-term context for agent

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

export interface ProjectMemory {
  summary: string;
  architectureNotes: string;
  codingGuidelines: string;
  uiUxGuidelines: string;
  knownIssues: string[];
  importantLinks: string[];
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  revision: number;
}

export const updateProjectMemory = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { projectId, patch } = request.data;

  if (!projectId || !patch) {
    throw new HttpsError('invalid-argument', 'projectId and patch are required');
  }

  const db = getFirestore();
  const projectRef = db.collection('projects').doc(projectId);

  try {
    const snap = await projectRef.get();

    if (!snap.exists) {
      throw new HttpsError('not-found', 'Project not found');
    }

    const projectData = snap.data();
    if (projectData?.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'You do not own this project');
    }

    const current = (projectData?.projectMemory || {}) as Partial<ProjectMemory>;
    const now = new Date().toISOString();
    const nextRevision = (current.revision || 0) + 1;

    const updated: ProjectMemory = {
      summary: patch.summary ?? current.summary ?? '',
      architectureNotes: patch.architectureNotes ?? current.architectureNotes ?? '',
      codingGuidelines: patch.codingGuidelines ?? current.codingGuidelines ?? '',
      uiUxGuidelines: patch.uiUxGuidelines ?? current.uiUxGuidelines ?? '',
      knownIssues: patch.knownIssues ?? current.knownIssues ?? [],
      importantLinks: patch.importantLinks ?? current.importantLinks ?? [],
      lastUpdatedBy: uid || 'agent',
      lastUpdatedAt: now,
      revision: nextRevision,
    };

    await projectRef.set(
      {
        projectMemory: updated,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info(`Project memory updated for ${projectId}`, {
      revision: nextRevision,
      updatedBy: uid,
    });

    return { ok: true, revision: nextRevision };
  } catch (error: any) {
    logger.error('Error updating project memory', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message || 'Failed to update project memory');
  }
});
