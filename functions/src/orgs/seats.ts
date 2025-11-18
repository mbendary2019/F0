/**
 * Phase 47 - Seat Management
 * Update organization seat limits
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();

/**
 * Update organization seat limit (owner only)
 */
export const updateSeats = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login required');

  const { orgId, newSeats } = req.data || {};
  if (!orgId || typeof newSeats !== 'number') {
    throw new HttpsError('invalid-argument', 'orgId and newSeats required');
  }

  if (newSeats < 1 || newSeats > 1000) {
    throw new HttpsError('invalid-argument', 'Seats must be between 1 and 1000');
  }

  // Check if user is owner
  const memberDoc = await db.collection('ops_org_members').doc(`${orgId}_${uid}`).get();
  if (!memberDoc.exists || memberDoc.data()!.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only organization owner can update seats');
  }

  // Check current org state
  const orgDoc = await db.collection('ops_orgs').doc(orgId).get();
  if (!orgDoc.exists) {
    throw new HttpsError('not-found', 'Organization not found');
  }

  const org = orgDoc.data()!;

  // Cannot reduce seats below current usage
  if (newSeats < org.usedSeats) {
    throw new HttpsError(
      'failed-precondition',
      `Cannot reduce seats to ${newSeats}. Currently using ${org.usedSeats} seats. Remove members first.`
    );
  }

  await db.collection('ops_orgs').doc(orgId).update({
    seats: newSeats,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Audit log
  await db.collection('ops_audit').add({
    action: 'update_seats',
    orgId,
    uid,
    oldSeats: org.seats,
    newSeats,
    ts: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info('[orgs] Seats updated', { orgId, oldSeats: org.seats, newSeats, uid });

  return { success: true, orgId, seats: newSeats, usedSeats: org.usedSeats };
});
