// functions/src/optimization/runProjectOptimization.ts
// Phase 138.0.7: Cloud Function to start a project optimization run
// Uses firebase-functions v6 API (single CallableRequest parameter)
// Creates an OptimizationRun document and returns its ID

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { OptimizationRun, RunProjectOptimizationResponse } from './types';
import { optimizationRunsCollection } from './model';

interface RunOptimizationData {
  projectId: string;
}

interface GetStatusData {
  projectId: string;
  runId: string;
}

interface CancelRunData {
  projectId: string;
  runId: string;
}

/**
 * Callable function to start a new optimization run for a project
 * Uses v2 API: single request parameter with data and auth
 *
 * @param request.data.projectId - The project ID to optimize
 * @returns RunProjectOptimizationResponse with runId, status, createdAt
 */
export const runProjectOptimization = onCall(
  async (request: CallableRequest<RunOptimizationData>): Promise<RunProjectOptimizationResponse> => {
    logger.info('[Optimization] Function called (v2 API)', {
      hasAuth: !!request.auth,
      uid: request.auth?.uid,
      data: JSON.stringify(request.data),
    });

    // Check authentication - in v2, auth is on the request object
    const uid = request.auth?.uid;
    if (!uid) {
      logger.warn('[Optimization] No auth - rejecting', {
        auth: JSON.stringify(request.auth),
      });
      throw new HttpsError(
        'unauthenticated',
        'You must be logged in to run project optimization.'
      );
    }

    // Validate projectId - in v2, data is on request.data
    const projectId = request.data?.projectId;
    if (!projectId) {
      throw new HttpsError(
        'invalid-argument',
        'projectId is required.'
      );
    }

    // TODO Phase 138.1+: Verify user has access to this project
    // e.g. check projects/{projectId}.ownerUid === uid or collaborator

    const now = new Date().toISOString();

    // Create optimization run document
    const colRef = optimizationRunsCollection(projectId);
    const docRef = colRef.doc();

    const run: OptimizationRun = {
      id: docRef.id,
      projectId,
      startedByUid: uid,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(run);

    logger.info('[Optimization] Created run', {
      projectId,
      runId: run.id,
      startedByUid: uid,
    });

    return {
      runId: run.id,
      status: run.status,
      createdAt: run.createdAt,
    };
  }
);

/**
 * Callable function to get optimization run status
 *
 * @param request.data.projectId - The project ID
 * @param request.data.runId - The optimization run ID
 * @returns OptimizationRun or null
 */
export const getOptimizationRunStatus = onCall(
  async (request: CallableRequest<GetStatusData>): Promise<OptimizationRun | null> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError(
        'unauthenticated',
        'You must be logged in.'
      );
    }

    const { projectId, runId } = request.data || {};
    if (!projectId || !runId) {
      throw new HttpsError(
        'invalid-argument',
        'projectId and runId are required.'
      );
    }

    const docRef = optimizationRunsCollection(projectId).doc(runId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return null;
    }

    return snap.data() as OptimizationRun;
  }
);

/**
 * Callable function to cancel an optimization run
 *
 * @param request.data.projectId - The project ID
 * @param request.data.runId - The optimization run ID
 * @returns Success status
 */
export const cancelOptimizationRun = onCall(
  async (request: CallableRequest<CancelRunData>): Promise<{ success: boolean }> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError(
        'unauthenticated',
        'You must be logged in.'
      );
    }

    const { projectId, runId } = request.data || {};
    if (!projectId || !runId) {
      throw new HttpsError(
        'invalid-argument',
        'projectId and runId are required.'
      );
    }

    const docRef = optimizationRunsCollection(projectId).doc(runId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new HttpsError(
        'not-found',
        'Optimization run not found.'
      );
    }

    const run = snap.data() as OptimizationRun;

    // Only allow canceling runs that are in progress
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
      throw new HttpsError(
        'failed-precondition',
        `Cannot cancel run with status: ${run.status}`
      );
    }

    await docRef.update({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });

    logger.info('[Optimization] Cancelled run', { projectId, runId });

    return { success: true };
  }
);
