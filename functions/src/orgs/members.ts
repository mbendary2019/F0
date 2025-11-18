/**
 * Phase 47 - Member Management
 * Invite, accept, remove members, and update roles
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();

/**
 * Invite a member to organization
 */
export const inviteMember = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login required');

  const { orgId, email, role = 'member' } = req.data || {};
  if (!orgId || !email) {
    throw new HttpsError('invalid-argument', 'orgId and email required');
  }

  const validRoles = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid role. Must be admin, member, or viewer');
  }

  // Check if inviter has permission (owner or admin)
  const inviterDoc = await db.collection('ops_org_members').doc(`${orgId}_${uid}`).get();
  if (!inviterDoc.exists) {
    throw new HttpsError('permission-denied', 'Not a member of this organization');
  }

  const inviterRole = inviterDoc.data()!.role;
  if (!['owner', 'admin'].includes(inviterRole)) {
    throw new HttpsError('permission-denied', 'Only owners and admins can invite members');
  }

  // Check seat availability
  const orgDoc = await db.collection('ops_orgs').doc(orgId).get();
  if (!orgDoc.exists) {
    throw new HttpsError('not-found', 'Organization not found');
  }

  const org = orgDoc.data()!;
  if (org.usedSeats >= org.seats) {
    throw new HttpsError('resource-exhausted', 'No available seats. Please upgrade your plan.');
  }

  // Check if already invited
  const existingInvite = await db.collection('ops_org_invites')
    .where('orgId', '==', orgId)
    .where('email', '==', email.toLowerCase())
    .where('status', '==', 'pending')
    .get();

  if (!existingInvite.empty) {
    throw new HttpsError('already-exists', 'Invite already pending for this email');
  }

  // Create invite
  const inviteId = db.collection('ops_org_invites').doc().id;
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.collection('ops_org_invites').doc(inviteId).set({
    id: inviteId,
    orgId,
    orgName: org.name,
    email: email.toLowerCase(),
    role,
    invitedBy: uid,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
  });

  logger.info('[orgs] Member invited', { orgId, email, role, invitedBy: uid });

  return { success: true, inviteId, expiresAt: expiresAt.toMillis() };
});

/**
 * Accept organization invite
 */
export const acceptInvite = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  const email = req.auth?.token?.email;
  if (!uid || !email) throw new HttpsError('unauthenticated', 'Login required');

  const { inviteId } = req.data || {};
  if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId required');

  const inviteDoc = await db.collection('ops_org_invites').doc(inviteId).get();
  if (!inviteDoc.exists) {
    throw new HttpsError('not-found', 'Invite not found');
  }

  const invite = inviteDoc.data()!;

  // Validate invite
  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    throw new HttpsError('permission-denied', 'This invite is for a different email address');
  }

  if (invite.status !== 'pending') {
    throw new HttpsError('failed-precondition', `Invite already ${invite.status}`);
  }

  if (invite.expiresAt.toMillis() < Date.now()) {
    await db.collection('ops_org_invites').doc(inviteId).update({
      status: 'expired',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    throw new HttpsError('deadline-exceeded', 'Invite has expired');
  }

  // Check if already a member
  const existingMember = await db.collection('ops_org_members')
    .doc(`${invite.orgId}_${uid}`)
    .get();

  if (existingMember.exists) {
    throw new HttpsError('already-exists', 'Already a member of this organization');
  }

  // Check seat availability again
  const orgDoc = await db.collection('ops_orgs').doc(invite.orgId).get();
  if (!orgDoc.exists) {
    throw new HttpsError('not-found', 'Organization not found');
  }

  const org = orgDoc.data()!;
  if (org.usedSeats >= org.seats) {
    throw new HttpsError('resource-exhausted', 'No available seats');
  }

  await db.runTransaction(async (tx) => {
    // Add member
    tx.set(db.collection('ops_org_members').doc(`${invite.orgId}_${uid}`), {
      orgId: invite.orgId,
      uid,
      role: invite.role,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Increment used seats
    tx.update(db.collection('ops_orgs').doc(invite.orgId), {
      usedSeats: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark invite as accepted
    tx.update(db.collection('ops_org_invites').doc(inviteId), {
      status: 'accepted',
      acceptedBy: uid,
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  logger.info('[orgs] Invite accepted', { inviteId, orgId: invite.orgId, uid, email });

  return { success: true, orgId: invite.orgId, role: invite.role };
});

/**
 * Remove member from organization
 */
export const removeMember = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login required');

  const { orgId, memberUid } = req.data || {};
  if (!orgId || !memberUid) {
    throw new HttpsError('invalid-argument', 'orgId and memberUid required');
  }

  // Check if requester has permission
  const requesterDoc = await db.collection('ops_org_members').doc(`${orgId}_${uid}`).get();
  if (!requesterDoc.exists) {
    throw new HttpsError('permission-denied', 'Not a member of this organization');
  }

  const requesterRole = requesterDoc.data()!.role;

  // Check target member exists
  const targetDoc = await db.collection('ops_org_members').doc(`${orgId}_${memberUid}`).get();
  if (!targetDoc.exists) {
    throw new HttpsError('not-found', 'Member not found');
  }

  const targetRole = targetDoc.data()!.role;

  // Permission checks
  if (targetRole === 'owner') {
    throw new HttpsError('permission-denied', 'Cannot remove organization owner');
  }

  if (requesterRole === 'member' || requesterRole === 'viewer') {
    throw new HttpsError('permission-denied', 'Only owners and admins can remove members');
  }

  if (requesterRole === 'admin' && targetRole === 'admin' && uid !== memberUid) {
    throw new HttpsError('permission-denied', 'Admins cannot remove other admins');
  }

  await db.runTransaction(async (tx) => {
    // Remove member
    tx.delete(db.collection('ops_org_members').doc(`${orgId}_${memberUid}`));

    // Decrement used seats
    tx.update(db.collection('ops_orgs').doc(orgId), {
      usedSeats: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  logger.info('[orgs] Member removed', { orgId, memberUid, removedBy: uid });

  return { success: true, orgId, memberUid };
});

/**
 * Update member role
 */
export const updateRole = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login required');

  const { orgId, memberUid, newRole } = req.data || {};
  if (!orgId || !memberUid || !newRole) {
    throw new HttpsError('invalid-argument', 'orgId, memberUid, and newRole required');
  }

  const validRoles = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(newRole)) {
    throw new HttpsError('invalid-argument', 'Invalid role');
  }

  // Check if requester is owner or admin
  const requesterDoc = await db.collection('ops_org_members').doc(`${orgId}_${uid}`).get();
  if (!requesterDoc.exists) {
    throw new HttpsError('permission-denied', 'Not a member of this organization');
  }

  const requesterRole = requesterDoc.data()!.role;
  if (!['owner', 'admin'].includes(requesterRole)) {
    throw new HttpsError('permission-denied', 'Only owners and admins can update roles');
  }

  // Check target member exists
  const targetDoc = await db.collection('ops_org_members').doc(`${orgId}_${memberUid}`).get();
  if (!targetDoc.exists) {
    throw new HttpsError('not-found', 'Member not found');
  }

  const targetRole = targetDoc.data()!.role;

  // Cannot change owner role
  if (targetRole === 'owner') {
    throw new HttpsError('permission-denied', 'Cannot change owner role');
  }

  // Admins cannot change other admins' roles
  if (requesterRole === 'admin' && targetRole === 'admin' && uid !== memberUid) {
    throw new HttpsError('permission-denied', 'Admins cannot change other admins\' roles');
  }

  await db.collection('ops_org_members').doc(`${orgId}_${memberUid}`).update({
    role: newRole,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info('[orgs] Role updated', { orgId, memberUid, oldRole: targetRole, newRole, updatedBy: uid });

  return { success: true, orgId, memberUid, newRole };
});
