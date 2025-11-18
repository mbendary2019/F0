/**
 * Phase 44 - Marketplace Install Handler
 * Safely installs marketplace items with policy checks and audit logging
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { policyGuardCheck } from '../policy/guard';

const db = admin.firestore();

/**
 * Request marketplace item installation
 * - Checks policy guard
 * - Logs audit trail
 * - Returns install confirmation (no arbitrary code execution)
 */
export const requestInstall = onCall(
  { memory: '256MiB' },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login required');
    }

    const itemId = request.data?.itemId;
    if (!itemId) {
      throw new HttpsError('invalid-argument', 'itemId required');
    }

    // Fetch item
    const itemDoc = await db.collection('ops_marketplace_items').doc(itemId).get();
    if (!itemDoc.exists) {
      throw new HttpsError('not-found', 'Item not found');
    }

    const item = itemDoc.data()!;

    // Policy guard check
    const policy = await policyGuardCheck('marketplace.install', {
      itemId,
      uid: request.auth.uid,
      category: item.category,
    });

    if (!policy.allowed) {
      throw new HttpsError('permission-denied', `Policy guard blocked: ${policy.reason}`);
    }

    // Audit log
    await db.collection('ops_audit').add({
      type: 'marketplace.install',
      itemId,
      uid: request.auth.uid,
      email: request.auth.token?.email || 'unknown',
      ts: admin.firestore.FieldValue.serverTimestamp(),
      installScript: item.installScript,
      policyReason: policy.reason,
    });

    console.log(`[marketplace.install] User ${request.auth.uid} installed ${itemId}`);

    // Safe install simulation
    // In production, installScript references allowed config changes
    // (e.g., apply branding preset, enable feature flags)
    // NO arbitrary server-side code execution

    return { ok: true, itemId, message: 'Install requested successfully' };
  }
);
