/**
 * Phase 47 - Organization Management
 * Create, update, and delete organizations with seat limits
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();

/**
 * Create a new organization
 */
export const createOrg = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login required');

  const { name, seats = 5 } = req.data || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'Organization name required');
  }

  if (typeof seats !== 'number' || seats < 1 || seats > 1000) {
    throw new HttpsError('invalid-argument', 'Seats must be between 1 and 1000');
  }

  const orgId = db.collection('ops_orgs').doc().id;

  await db.runTransaction(async (tx) => {
    // Create org
    tx.set(db.collection('ops_orgs').doc(orgId), {
      id: orgId,
      name: name.trim(),
      seats,
      usedSeats: 1, // creator takes 1 seat
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Add creator as owner
    tx.set(db.collection('ops_org_members').doc(`${orgId}_${uid}`), {
      orgId,
      uid,
      role: 'owner',
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  logger.info('[orgs] Organization created', { orgId, name, uid, seats });

  return { success: true, orgId, name, seats };
});

/**
 * Update organization details
 */
export const updateOrg = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login required');

  const { orgId, name } = req.data || {};
  if (!orgId) throw new HttpsError('invalid-argument', 'orgId required');

  // Check if user is owner or admin
  const memberDoc = await db.collection('ops_org_members').doc(`${orgId}_${uid}`).get();
  if (!memberDoc.exists) {
    throw new HttpsError('permission-denied', 'Not a member of this organization');
  }

  const role = memberDoc.data()!.role;
  if (!['owner', 'admin'].includes(role)) {
    throw new HttpsError('permission-denied', 'Only owners and admins can update organization');
  }

  const updates: any = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (name && typeof name === 'string' && name.trim().length > 0) {
    updates.name = name.trim();
  }

  await db.collection('ops_orgs').doc(orgId).update(updates);

  logger.info('[orgs] Organization updated', { orgId, uid, updates });

  return { success: true, orgId };
});

/**
 * Delete organization (owner only)
 */
export const deleteOrg = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login required');

  const { orgId } = req.data || {};
  if (!orgId) throw new HttpsError('invalid-argument', 'orgId required');

  // Check if user is owner
  const memberDoc = await db.collection('ops_org_members').doc(`${orgId}_${uid}`).get();
  if (!memberDoc.exists || memberDoc.data()!.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only organization owner can delete');
  }

  await db.runTransaction(async (tx) => {
    // Delete org
    tx.delete(db.collection('ops_orgs').doc(orgId));

    // Delete all members
    const membersSnap = await db.collection('ops_org_members')
      .where('orgId', '==', orgId)
      .get();

    membersSnap.docs.forEach((doc) => {
      tx.delete(doc.ref);
    });

    // Delete all pending invites
    const invitesSnap = await db.collection('ops_org_invites')
      .where('orgId', '==', orgId)
      .get();

    invitesSnap.docs.forEach((doc) => {
      tx.delete(doc.ref);
    });
  });

  logger.info('[orgs] Organization deleted', { orgId, uid });

  return { success: true, orgId };
});
