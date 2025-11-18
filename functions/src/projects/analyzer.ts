// functions/src/projects/analyzer.ts
// Phase 74: Project Analysis Backend - Save analysis to Firestore

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

export const saveProjectAnalysis = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { projectId, analysis } = request.data;

  if (!projectId || !analysis) {
    throw new HttpsError('invalid-argument', 'projectId and analysis are required');
  }

  const db = getFirestore();
  const projectRef = db.collection('projects').doc(projectId);

  try {
    // Verify project exists and user has access
    const snap = await projectRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Project not found');
    }

    const projectData = snap.data();
    if (projectData?.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'You do not own this project');
    }

    // Save analysis to Firestore
    await projectRef.set(
      {
        projectAnalysis: analysis,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info(`Project analysis saved for ${projectId}`, {
      projectType: analysis.projectType,
      framework: analysis.framework?.name,
      fileCount: analysis.fileCount,
    });

    return { ok: true, projectId };
  } catch (error: any) {
    logger.error('Error saving project analysis', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message || 'Failed to save project analysis');
  }
});
