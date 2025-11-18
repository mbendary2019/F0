/**
 * Phase 48 - Export Audit CSV Function
 * Generates CSV export of audit trail entries
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './client';

interface ExportAuditCsvPayload {
  from?: string;
  to?: string;
  orgId?: string;
  limit?: number;
}

export const exportAuditCsv = onCall<ExportAuditCsvPayload>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const auth = req.auth;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to export audit logs');
    }

    const { from, to, orgId, limit = 2000 } = req.data || {};

    // Build query
    let query: FirebaseFirestore.Query = db
      .collection('ops_audit')
      .orderBy('ts', 'desc');

    // Apply filters
    if (orgId) {
      query = query.where('orgId', '==', orgId);
    }

    // Apply limit (max 5000)
    query = query.limit(Math.min(limit, 5000));

    // Execute query
    const snapshot = await query.get();

    // Build CSV
    const headers = [
      'Timestamp',
      'Actor UID',
      'Actor Email',
      'Org ID',
      'Action',
      'Object',
      'IP Address',
      'User Agent',
    ];

    let csv = headers.join(',') + '\n';

    snapshot.forEach((doc) => {
      const audit: any = doc.data();

      // Convert timestamp
      const ts = audit.ts?.toDate
        ? audit.ts.toDate().toISOString()
        : new Date(audit.ts).toISOString();

      // Escape and sanitize fields
      const escapeCsv = (val: any): string => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape quotes and wrap in quotes if contains comma/newline
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const row = [
        escapeCsv(ts),
        escapeCsv(audit.actorUid || ''),
        escapeCsv(audit.actorEmail || ''),
        escapeCsv(audit.orgId || ''),
        escapeCsv(audit.action || ''),
        escapeCsv(audit.object || ''),
        escapeCsv(audit.ip || ''),
        escapeCsv(audit.userAgent || ''),
      ];

      csv += row.join(',') + '\n';
    });

    return {
      csv,
      count: snapshot.size,
      exportedAt: new Date().toISOString(),
    };
  }
);
