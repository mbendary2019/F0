// F0 Phase 35 - Device Handoff (Deep Link Transfer)

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { sendPush } from '../push/notifier';

/**
 * Create a handoff request (transfer context to another device)
 */
export const createHandoff = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { fromDevice, toDevice, payload } = data;

  if (!fromDevice || !toDevice || !payload) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'fromDevice, toDevice, and payload are required'
    );
  }

  if (!payload.type) {
    throw new functions.https.HttpsError('invalid-argument', 'payload.type is required');
  }

  const db = admin.firestore();
  const uid = context.auth.uid;

  try {
    // Verify toDevice belongs to the same user
    const toDeviceDoc = await db.doc(`users/${uid}/devices/${toDevice}`).get();
    if (!toDeviceDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target device not found');
    }

    // Create handoff
    const handoffRef = await db.collection('handshake').add({
      userId: uid,
      fromDevice,
      toDevice,
      payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      consumed: false,
    });

    // Generate deep link
    const deepLink = generateDeepLink(payload);

    // Send push notification to target device
    const fcmToken = toDeviceDoc.get('fcmToken');
    if (fcmToken) {
      const title = getHandoffTitle(payload.type);
      const body = getHandoffBody(payload);

      await sendPush({
        userId: uid,
        title,
        body,
        data: {
          kind: 'handoff',
          handoffId: handoffRef.id,
          type: payload.type,
          deepLink,
        },
        clickAction: deepLink,
      });
    }

    console.log(`Handoff created: ${handoffRef.id} (${fromDevice} → ${toDevice})`);

    return { ok: true, id: handoffRef.id, deepLink };
  } catch (error: any) {
    console.error('Create handoff error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Consume (accept) a handoff
 */
export const consumeHandoff = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { handoffId, deviceId } = data;

  if (!handoffId || !deviceId) {
    throw new functions.https.HttpsError('invalid-argument', 'handoffId and deviceId are required');
  }

  const db = admin.firestore();
  const uid = context.auth.uid;

  try {
    const handoffRef = db.collection('handshake').doc(handoffId);
    const handoffDoc = await handoffRef.get();

    if (!handoffDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Handoff not found');
    }

    const handoff = handoffDoc.data()!;

    // Verify ownership
    if (handoff.userId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not your handoff');
    }

    // Verify target device
    if (handoff.toDevice !== deviceId) {
      throw new functions.https.HttpsError('permission-denied', 'Wrong device');
    }

    // Check expiration
    if (Date.now() > handoff.expiresAt) {
      throw new functions.https.HttpsError('failed-precondition', 'Handoff expired');
    }

    // Check if already consumed
    if (handoff.consumed) {
      throw new functions.https.HttpsError('failed-precondition', 'Handoff already consumed');
    }

    // Mark as consumed
    await handoffRef.update({
      consumed: true,
      consumedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Handoff consumed: ${handoffId}`);

    return { ok: true, payload: handoff.payload };
  } catch (error: any) {
    console.error('Consume handoff error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cleanup expired handoffs (scheduled)
 */
export const cleanupHandoffs = functions.pubsub.schedule('every 15 minutes').onRun(async () => {
  const db = admin.firestore();
  const now = Date.now();

  try {
    const expiredSnapshot = await db
      .collection('handshake')
      .where('expiresAt', '<', now)
      .limit(100)
      .get();

    const batch = db.batch();
    expiredSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();

    console.log(`Cleaned up ${expiredSnapshot.size} expired handoffs`);
  } catch (error) {
    console.error('Cleanup handoffs error:', error);
  }
});

// Helper functions

function generateDeepLink(payload: any): string {
  switch (payload.type) {
    case 'open-project':
      return `f0://open?project=${payload.projectId}`;
    case 'open-session':
      return `f0://session/${payload.jobId}`;
    case 'open-file':
      return `f0://file/${payload.fileId}`;
    default:
      return 'f0://';
  }
}

function getHandoffTitle(type: string): string {
  switch (type) {
    case 'open-project':
      return 'Open Project';
    case 'open-session':
      return 'Open Session';
    case 'open-file':
      return 'Open File';
    default:
      return 'Handoff';
  }
}

function getHandoffBody(payload: any): string {
  switch (payload.type) {
    case 'open-project':
      return `Continue working on project ${payload.projectId}`;
    case 'open-session':
      return `View session ${payload.jobId}`;
    case 'open-file':
      return `Open file ${payload.fileId}`;
    default:
      return 'Tap to continue';
  }
}


