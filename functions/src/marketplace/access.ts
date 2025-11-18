/**
 * Phase 45.2 - Marketplace Access Control
 *
 * Checks if a user has the required entitlements to access paid marketplace items
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const checkMarketplaceAccess = onCall({
  cors: true,
}, async (request) => {
  // Require authentication
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Login required');
  }

  const itemId = request.data?.itemId as string;
  if (!itemId) {
    throw new HttpsError('invalid-argument', 'itemId is required');
  }

  // Get marketplace item
  const itemDoc = await db.collection('ops_marketplace_paid').doc(itemId).get();

  if (!itemDoc.exists) {
    throw new HttpsError('not-found', 'Marketplace item not found');
  }

  const item = itemDoc.data()!;

  // If item doesn't require paid access, allow
  if (!item.requiresPaid) {
    return {
      allowed: true,
      reason: 'Item is free',
    };
  }

  // Get user's entitlements
  const userPlanDoc = await db.collection('ops_user_plans').doc(uid).get();
  const userEntitlements: string[] = userPlanDoc.data()?.entitlements || [];
  const userLimits = userPlanDoc.data()?.limits || {};

  // Check if user has marketplace paid access
  const hasMarketplacePaid = userLimits.marketplacePaid === true;

  if (!hasMarketplacePaid) {
    return {
      allowed: false,
      reason: 'Requires paid plan for marketplace access',
      requiredEntitlement: 'marketplacePaid',
      upgradeUrl: '/pricing',
    };
  }

  // Check specific entitlement if required
  if (item.entitlement) {
    const hasEntitlement = userEntitlements.includes(item.entitlement);

    if (!hasEntitlement) {
      return {
        allowed: false,
        reason: `Requires ${item.entitlement} entitlement`,
        requiredEntitlement: item.entitlement,
        upgradeUrl: '/pricing',
      };
    }
  }

  // Access granted
  return {
    allowed: true,
    reason: 'User has required entitlements',
  };
});
