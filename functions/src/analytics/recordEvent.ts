/**
 * Phase 48 - Record Event Function
 * Records analytics events to ops_events collection
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './client';
import { FieldValue } from 'firebase-admin/firestore';

interface RecordEventPayload {
  type: 'api' | 'tokens' | 'auth' | 'billing' | 'org';
  key: string;
  n?: number;
  orgId?: string;
  meta?: Record<string, any>;
}

export const recordEvent = onCall<RecordEventPayload>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
    maxInstances: 100,
  },
  async (req) => {
    const { uid } = req.auth ?? ({} as any);
    const { type, key, n, orgId, meta } = req.data || {};

    // Validation
    if (!type || !key) {
      throw new HttpsError('invalid-argument', 'Missing required fields: type, key');
    }

    const validTypes = ['api', 'tokens', 'auth', 'billing', 'org'];
    if (!validTypes.includes(type)) {
      throw new HttpsError(
        'invalid-argument',
        `Invalid type. Must be one of: ${validTypes.join(', ')}`
      );
    }

    // Write event
    await db.collection('ops_events').add({
      ts: FieldValue.serverTimestamp(),
      uid: uid || null,
      orgId: orgId || null,
      type,
      key,
      n: n ?? 1,
      meta: meta ?? {},
    });

    return { success: true };
  }
);
