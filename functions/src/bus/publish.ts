/**
 * Phase 40 - AI-to-AI Collaboration Bus - Publish Helper
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

export async function publish(
  from: string,
  to: string,
  type: 'intent' | 'status' | 'proposal' | 'ack' | 'nack',
  payload: any
) {
  await db.collection('ops_bus_messages').add({
    id: String(Date.now()),
    ts: Date.now(),
    from,
    to,
    type,
    payload,
  });
}
