/**
 * Export Deploy Logs — Cloud Function
 *
 * Exports deployment logs to CSV format
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {db} from '../config';
import {Timestamp} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

interface ExportParams {
  jobId?: string;
  startDate?: string;
  endDate?: string;
  target?: string;
  env?: string;
  status?: string;
  limit?: number;
}

/**
 * Generate CSV from deployment jobs
 */
function generateCsv(jobs: any[]): string {
  const headers = [
    'Job ID',
    'Target',
    'Environment',
    'Status',
    'Start Time',
    'End Time',
    'Duration (s)',
    'Result URL',
    'Error Message',
    'User ID',
  ];

  const rows = jobs.map((job) => {
    const duration = job.startTime && job.endTime
      ? ((job.endTime.toMillis() - job.startTime.toMillis()) / 1000).toFixed(2)
      : 'N/A';

    return [
      job.id || '',
      job.target || '',
      job.env || '',
      job.status || '',
      job.startTime ? job.startTime.toDate().toISOString() : '',
      job.endTime ? job.endTime.toDate().toISOString() : '',
      duration,
      job.resultUrl || '',
      job.errorMessage || '',
      job.userId || '',
    ].map((field) => `"${String(field).replace(/"/g, '""')}"`);
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Export Deploy Logs HTTP Endpoint
 */
export const exportDeployLogs = onRequest(
  {
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (req, res) => {
    try {
      // Check authentication (simple token check)
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).send('Unauthorized');
        return;
      }

      // Parse query parameters
      const params: ExportParams = {
        jobId: req.query.jobId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        target: req.query.target as string,
        env: req.query.env as string,
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 100,
      };

      let query: FirebaseFirestore.Query = db.collection('ops_deploy_jobs');

      // Apply filters
      if (params.jobId) {
        const doc = await db.collection('ops_deploy_jobs').doc(params.jobId).get();
        if (!doc.exists) {
          res.status(404).send('Job not found');
          return;
        }
        const csv = generateCsv([{id: doc.id, ...doc.data()}]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="deploy_${params.jobId}.csv"`);
        res.status(200).send(csv);
        return;
      }

      if (params.startDate) {
        query = query.where('createdAt', '>=', Timestamp.fromDate(new Date(params.startDate)));
      }

      if (params.endDate) {
        query = query.where('createdAt', '<=', Timestamp.fromDate(new Date(params.endDate)));
      }

      if (params.target) {
        query = query.where('target', '==', params.target);
      }

      if (params.env) {
        query = query.where('env', '==', params.env);
      }

      if (params.status) {
        query = query.where('status', '==', params.status);
      }

      // Execute query
      const snapshot = await query.orderBy('createdAt', 'desc').limit(params.limit).get();

      const jobs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const csv = generateCsv(jobs);

      // Send CSV response
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="deployments_${new Date().toISOString().slice(0, 10)}.csv"`
      );
      res.status(200).send(csv);
    } catch (error: any) {
      logger.error('Export error:', error);
      res.status(500).json({error: error.message});
    }
  }
);

/**
 * Export Deploy Logs Callable Function
 */
export const exportDeployLogsCallable = onCall(
  {
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    const data = request.data as ExportParams;
    const auth = request.auth;

    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = auth.uid;
    const isAdmin = (auth.token as any)?.admin === true;

    try {
      let query: FirebaseFirestore.Query = db.collection('ops_deploy_jobs');

      // Non-admin users can only see their own jobs
      if (!isAdmin) {
        query = query.where('userId', '==', userId);
      }

      if (data.startDate) {
        query = query.where('createdAt', '>=', Timestamp.fromDate(new Date(data.startDate)));
      }

      if (data.endDate) {
        query = query.where('createdAt', '<=', Timestamp.fromDate(new Date(data.endDate)));
      }

      if (data.target) {
        query = query.where('target', '==', data.target);
      }

      if (data.status) {
        query = query.where('status', '==', data.status);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').limit(data.limit || 100).get();

      const jobs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const csv = generateCsv(jobs);

      return {
        csv,
        count: jobs.length,
      };
    } catch (error: any) {
      logger.error('Export error:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);
