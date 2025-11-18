// F0 Phase 35 - Queue Worker (Process Offline Queues)

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { sendPush } from '../push/notifier';

/**
 * Process pending queues periodically
 * Runs every minute to check and notify devices about pending updates
 */
export const processQueues = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  const db = admin.firestore();

  try {
    // Get all queues with pending items
    const queuesSnapshot = await db.collectionGroup('queues').get();

    let processed = 0;
    let notified = 0;

    for (const queueDoc of queuesSnapshot.docs) {
      const pending = (queueDoc.get('pending') || []).slice(0, 20); // Process max 20 items

      if (pending.length === 0) continue;

      processed++;

      // Get device info
      const deviceId = queueDoc.id;
      const userRef = queueDoc.ref.parent.parent!;
      const deviceDoc = await userRef.collection('devices').doc(deviceId).get();

      if (!deviceDoc.exists) continue;

      const fcmToken = deviceDoc.get('fcmToken');
      const uid = userRef.id;

      // Send notification if device has FCM token
      if (fcmToken) {
        try {
          await sendPush({
            userId: uid,
            title: 'Sync Update',
            body: `You have ${pending.length} pending update${pending.length > 1 ? 's' : ''}`,
            data: {
              kind: 'queue.update',
              count: String(pending.length),
              deviceId,
            },
          });

          notified++;
        } catch (error) {
          console.error(`Failed to notify device ${deviceId}:`, error);
        }
      }

      // Update processed cursor
      const lastItem = pending[pending.length - 1];
      await queueDoc.ref.update({
        processedCursor: lastItem.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    console.log(`Processed ${processed} queues, notified ${notified} devices`);
  } catch (error) {
    console.error('Process queues error:', error);
  }
});

/**
 * Enqueue item for a device (callable function)
 */
export const enqueueItem = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { deviceId, kind, payload } = data;

  if (!deviceId || !kind || !payload) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'deviceId, kind, and payload are required'
    );
  }

  const db = admin.firestore();
  const uid = context.auth.uid;

  try {
    const queueRef = db.doc(`users/${uid}/queues/${deviceId}`);

    const item = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      kind,
      payload,
      createdAt: Date.now(),
    };

    await queueRef.set(
      {
        pending: admin.firestore.FieldValue.arrayUnion(item),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`Item enqueued for device ${deviceId}`);

    return { ok: true, itemId: item.id };
  } catch (error: any) {
    console.error('Enqueue item error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Dequeue item for a device (callable function)
 */
export const dequeueItem = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { deviceId, itemId } = data;

  if (!deviceId || !itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId and itemId are required');
  }

  const db = admin.firestore();
  const uid = context.auth.uid;

  try {
    const queueRef = db.doc(`users/${uid}/queues/${deviceId}`);
    const queueDoc = await queueRef.get();

    if (!queueDoc.exists) {
      return { ok: true, message: 'Queue not found' };
    }

    const pending = queueDoc.get('pending') || [];
    const item = pending.find((i: any) => i.id === itemId);

    if (!item) {
      return { ok: true, message: 'Item not found' };
    }

    // Remove item from pending
    await queueRef.update({
      pending: admin.firestore.FieldValue.arrayRemove(item),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Item ${itemId} dequeued for device ${deviceId}`);

    return { ok: true, item };
  } catch (error: any) {
    console.error('Dequeue item error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Clear queue for a device
 */
export const clearQueue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { deviceId } = data;

  if (!deviceId) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId is required');
  }

  const db = admin.firestore();
  const uid = context.auth.uid;

  try {
    const queueRef = db.doc(`users/${uid}/queues/${deviceId}`);
    await queueRef.delete();

    console.log(`Queue cleared for device ${deviceId}`);

    return { ok: true };
  } catch (error: any) {
    console.error('Clear queue error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});


