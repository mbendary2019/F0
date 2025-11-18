/**
 * Poll Deploy Status — Cloud Function
 *
 * Retrieves the current status of a deployment job
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {db} from '../config';
import * as logger from 'firebase-functions/logger';

export const pollDeployStatus = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    const data = request.data as {jobId: string};
    const auth = request.auth;

    // Check authentication
    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = auth.uid;
    const {jobId} = data;

    if (!jobId) {
      throw new HttpsError('invalid-argument', 'Missing required field: jobId');
    }

    try {
      const jobDoc = await db.collection('ops_deploy_jobs').doc(jobId).get();

      if (!jobDoc.exists) {
        throw new HttpsError('not-found', 'Deployment job not found');
      }

      const jobData = jobDoc.data();

      // Check if user has access to this job
      if (jobData?.userId !== userId && !(auth.token as any)?.admin) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      // Calculate progress based on status
      let progress = 0;
      switch (jobData?.status) {
        case 'queued':
          progress = 10;
          break;
        case 'deploying':
          progress = 50;
          break;
        case 'success':
        case 'failed':
        case 'cancelled':
          progress = 100;
          break;
      }

      // Calculate duration if deployment is complete
      let duration: number | undefined;
      if (jobData?.startTime && jobData?.endTime) {
        duration = jobData.endTime.toMillis() - jobData.startTime.toMillis();
      }

      return {
        jobId,
        status: jobData?.status,
        progress,
        logs: jobData?.logs || [],
        resultUrl: jobData?.resultUrl,
        deploymentId: jobData?.deploymentId,
        errorMessage: jobData?.errorMessage,
        duration,
        startTime: jobData?.startTime?.toMillis(),
        endTime: jobData?.endTime?.toMillis(),
      };
    } catch (error: any) {
      logger.error('Error polling deploy status:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Get Deployment History — Cloud Function
 *
 * Retrieves recent deployment jobs for a user
 */
export const getDeployHistory = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    const data = request.data as {limit?: number};
    const auth = request.auth;

    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = auth.uid;
    const limit = data.limit || 10;

    try {
      const snapshot = await db
        .collection('ops_deploy_jobs')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const jobs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        jobs,
        total: jobs.length,
      };
    } catch (error: any) {
      logger.error('Error getting deploy history:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);
