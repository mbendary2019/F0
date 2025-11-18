/**
 * Phase 48 - Log Audit Function
 * Records audit trail entries for security-sensitive actions
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './client';
import { FieldValue } from 'firebase-admin/firestore';

interface LogAuditPayload {
  action: string;
  orgId?: string;
  object?: string;
  diff?: any;
}

export const logAudit = onCall<LogAuditPayload>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
    maxInstances: 100,
  },
  async (req) => {
    const auth = req.auth;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to log audit entries');
    }

    const { action, orgId, object, diff } = req.data || {};

    // Validation
    if (!action) {
      throw new HttpsError('invalid-argument', 'Missing required field: action');
    }

    // Extract actor info
    const actorUid = auth.uid;
    const actorEmail = auth.token?.email || null;

    // Extract request metadata
    const ip = req.rawRequest.ip || req.rawRequest.socket?.remoteAddress || null;
    const userAgent = req.rawRequest.get('user-agent') || null;

    // Write audit entry
    await db.collection('ops_audit').add({
      ts: FieldValue.serverTimestamp(),
      actorUid,
      actorEmail,
      orgId: orgId || null,
      action,
      object: object || null,
      diff: diff || null,
      ip,
      userAgent,
    });

    return { success: true };
  }
);
