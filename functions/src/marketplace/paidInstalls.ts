/**
 * Phase 45.2 - Paid Marketplace Item Installation
 * Validates entitlements before allowing paid item installs
 * Updated to Firebase Functions v2
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { hasEntitlement } from '../billing/entitlements';

const db = admin.firestore();

/**
 * Install paid marketplace item (entitlement-gated)
 */
export const installPaidItem = onCall({
  cors: true,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required');
  }

  const itemId: string = request.data?.itemId;
  if (!itemId) {
    throw new HttpsError('invalid-argument', 'itemId required');
  }

  const uid = request.auth.uid;

  // Fetch marketplace item
  const itemDoc = await db.collection('ops_marketplace_paid').doc(itemId).get();
  if (!itemDoc.exists) {
    throw new HttpsError('not-found', 'Item not found');
  }

  const item = itemDoc.data()!;

  // Check if item requires payment
  if (item.requiresPaid) {
    const requiredEntitlement = item.entitlement || 'marketplace_paid';
    const allowed = await hasEntitlement(uid, requiredEntitlement);

    if (!allowed) {
      logger.warn('[marketplace] Install denied - missing entitlement', {
        uid,
        itemId,
        requiredEntitlement,
      });
      throw new HttpsError(
        'permission-denied',
        `This item requires the '${requiredEntitlement}' entitlement. Please upgrade your plan.`
      );
    }
  }

  // Create installation record
  await db.collection('ops_installs').doc(`${uid}_${itemId}`).set({
    uid,
    itemId,
    itemTitle: item.title,
    installedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  }, { merge: true });

  // Log installation
  await db.collection('ops_audit').add({
    action: 'install_paid_item',
    uid,
    itemId,
    itemTitle: item.title,
    requiresPaid: item.requiresPaid || false,
    ts: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info('[marketplace] Paid item installed', {
    uid,
    itemId,
    itemTitle: item.title,
  });

  return {
    success: true,
    item: {
      id: itemId,
      title: item.title,
      description: item.description,
    },
  };
});

/**
 * Check if user can access paid marketplace items
 */
export const checkMarketplaceAccess = onCall({
  cors: true,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required');
  }

  const uid = request.auth.uid;
  const itemId = request.data?.itemId;

  // If checking specific item
  if (itemId) {
    const itemDoc = await db.collection('ops_marketplace_paid').doc(itemId).get();
    if (!itemDoc.exists) {
      throw new HttpsError('not-found', 'Item not found');
    }

    const item = itemDoc.data()!;
    if (!item.requiresPaid) {
      return { allowed: true, reason: 'Item is free' };
    }

    const requiredEntitlement = item.entitlement || 'marketplace_paid';
    const allowed = await hasEntitlement(uid, requiredEntitlement);

    return {
      allowed,
      requiredEntitlement: allowed ? null : requiredEntitlement,
      reason: allowed ? 'User has entitlement' : `Missing ${requiredEntitlement}`,
    };
  }

  // General marketplace access check
  const hasPaidAccess = await hasEntitlement(uid, 'marketplace_paid');

  return {
    allowed: hasPaidAccess,
    hasPaidAccess,
    reason: hasPaidAccess ? 'User has marketplace access' : 'Upgrade required',
  };
});
