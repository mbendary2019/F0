/**
 * Cloud Function: exportIncidentsCsv
 * Exports incidents from ops_incidents collection to CSV format
 * Supports filtering by date range, level, and status
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './config';

interface ExportParams {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  level?: 'error' | 'warning' | 'info';
  status?: 'open' | 'ack' | 'resolved';
  limit?: number;
}

export const exportIncidentsCsv = onRequest(
  {
    region: 'us-central1',
    cors: true,
  },
  async (req, res) => {
    try {
      // Only allow GET requests
      if (req.method !== 'GET') {
        res.status(405).send('Method Not Allowed');
        return;
      }

      // Parse query parameters
      const params: ExportParams = {
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        level: req.query.level as any,
        status: req.query.status as any,
        limit: parseInt(req.query.limit as string) || 1000,
      };

      console.log('[exportIncidentsCsv] Export request:', params);

      // Build Firestore query
      let query: FirebaseFirestore.Query = db.collection('ops_incidents');

      // Filter by date range
      if (params.dateFrom) {
        const fromDate = Timestamp.fromDate(new Date(params.dateFrom + 'T00:00:00Z'));
        query = query.where('createdAt', '>=', fromDate);
      }

      if (params.dateTo) {
        const toDate = Timestamp.fromDate(new Date(params.dateTo + 'T23:59:59Z'));
        query = query.where('createdAt', '<=', toDate);
      }

      // Filter by level
      if (params.level) {
        query = query.where('level', '==', params.level);
      }

      // Filter by status
      if (params.status) {
        query = query.where('status', '==', params.status);
      }

      // Order by creation date (descending) and limit
      query = query.orderBy('createdAt', 'desc').limit(params.limit);

      // Execute query
      const snapshot = await query.get();
      console.log(`[exportIncidentsCsv] Found ${snapshot.size} incidents`);

      if (snapshot.empty) {
        res.status(404).send('No incidents found matching the criteria');
        return;
      }

      // Generate CSV
      const csv = generateCsv(snapshot);

      // Set response headers for CSV download
      const filename = `incidents_export_${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Send CSV
      res.status(200).send(csv);
      console.log(`[exportIncidentsCsv] ✅ Export complete: ${snapshot.size} incidents`);
    } catch (error: any) {
      console.error('[exportIncidentsCsv] ❌ Error:', error);
      res.status(500).json({
        error: 'Failed to export incidents',
        message: error.message,
      });
    }
  });

/**
 * Generate CSV from Firestore snapshot
 */
function generateCsv(snapshot: FirebaseFirestore.QuerySnapshot): string {
  // CSV header
  const headers = [
    'ID',
    'Created At',
    'Updated At',
    'Source',
    'Level',
    'Status',
    'Message',
    'Stack Trace',
    'Context',
  ];

  const rows: string[] = [headers.join(',')];

  // Add data rows
  snapshot.forEach((doc) => {
    const data = doc.data();
    const row = [
      escapeCsvValue(doc.id),
      escapeCsvValue(formatTimestamp(data.createdAt)),
      escapeCsvValue(formatTimestamp(data.updatedAt)),
      escapeCsvValue(data.source || ''),
      escapeCsvValue(data.level || ''),
      escapeCsvValue(data.status || ''),
      escapeCsvValue(data.message || ''),
      escapeCsvValue(data.stack || ''),
      escapeCsvValue(JSON.stringify(data.context || {})),
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Format Firestore Timestamp to ISO string
 */
function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '';
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  return String(timestamp);
}

/**
 * Escape CSV value (handle commas, quotes, newlines)
 */
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return '';

  const str = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Callable function version (requires authentication)
 */
export const exportIncidentsCsvCallable = onCall(
  {
    region: 'us-central1',
    cors: true,
  },
  async (request) => {
    const data = (request.data || {}) as ExportParams;

    // Require authentication
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Must be authenticated to export incidents'
      );
    }

    // Optionally require admin role
    if (!request.auth.token.admin) {
      throw new HttpsError(
        'permission-denied',
        'Must be an admin to export incidents'
      );
    }

    try {
      console.log('[exportIncidentsCsvCallable] Export request from:', request.auth.uid);

      // Build query
      let query: FirebaseFirestore.Query = db.collection('ops_incidents');

      if (data.dateFrom) {
        const fromDate = Timestamp.fromDate(new Date(data.dateFrom + 'T00:00:00Z'));
        query = query.where('createdAt', '>=', fromDate);
      }

      if (data.dateTo) {
        const toDate = Timestamp.fromDate(new Date(data.dateTo + 'T23:59:59Z'));
        query = query.where('createdAt', '<=', toDate);
      }

      if (data.level) {
        query = query.where('level', '==', data.level);
      }

      if (data.status) {
        query = query.where('status', '==', data.status);
      }

      query = query.orderBy('createdAt', 'desc').limit(data.limit || 1000);

      const snapshot = await query.get();
      const csv = generateCsv(snapshot);

      return {
        success: true,
        csv,
        count: snapshot.size,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('[exportIncidentsCsvCallable] ❌ Error:', error);
      throw new HttpsError('internal', error.message);
    }
  });
