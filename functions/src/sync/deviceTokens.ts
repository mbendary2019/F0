// F0 Phase 35 - Device Token Management

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

/**
 * Register FCM token for a device
 */
export const registerToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { deviceId, fcmToken } = data;

  if (!deviceId || !fcmToken) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'deviceId and fcmToken are required'
    );
  }

  const db = admin.firestore();
  const uid = context.auth.uid;

  try {
    // Update device with FCM token
    const deviceRef = db.doc(`users/${uid}/devices/${deviceId}`);
    await deviceRef.set(
      {
        fcmToken,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Subscribe to user-specific topic
    const userTopic = `user-${uid}`;
    await admin.messaging().subscribeToTopic([fcmToken], userTopic);

    console.log(`Device ${deviceId} registered with FCM token and subscribed to ${userTopic}`);

    return { ok: true, topic: userTopic };
  } catch (error: any) {
    console.error('Register token error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Unregister FCM token for a device
 */
export const unregisterToken = functions.https.onCall(async (data, context) => {
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
    const deviceRef = db.doc(`users/${uid}/devices/${deviceId}`);
    const deviceDoc = await deviceRef.get();

    if (!deviceDoc.exists) {
      return { ok: true, message: 'Device not found' };
    }

    const fcmToken = deviceDoc.get('fcmToken');

    if (fcmToken) {
      // Unsubscribe from user-specific topic
      const userTopic = `user-${uid}`;
      await admin.messaging().unsubscribeFromTopic([fcmToken], userTopic);
    }

    // Remove FCM token from device
    await deviceRef.update({
      fcmToken: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Device ${deviceId} unregistered from FCM`);

    return { ok: true };
  } catch (error: any) {
    console.error('Unregister token error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Subscribe device to a topic (e.g., 'ops', 'jobs-{projectId}')
 */
export const subscribeToTopic = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { deviceId, topic } = data;

  if (!deviceId || !topic) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId and topic are required');
  }

  const db = admin.firestore();
  const uid = context.auth.uid;

  try {
    const deviceRef = db.doc(`users/${uid}/devices/${deviceId}`);
    const deviceDoc = await deviceRef.get();

    if (!deviceDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Device not found');
    }

    const fcmToken = deviceDoc.get('fcmToken');

    if (!fcmToken) {
      throw new functions.https.HttpsError('failed-precondition', 'No FCM token registered');
    }

    await admin.messaging().subscribeToTopic([fcmToken], topic);

    console.log(`Device ${deviceId} subscribed to topic ${topic}`);

    return { ok: true, topic };
  } catch (error: any) {
    console.error('Subscribe to topic error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Unsubscribe device from a topic
 */
export const unsubscribeFromTopic = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { deviceId, topic } = data;

  if (!deviceId || !topic) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId and topic are required');
  }

  const db = admin.firestore();
  const uid = context.auth.uid;

  try {
    const deviceRef = db.doc(`users/${uid}/devices/${deviceId}`);
    const deviceDoc = await deviceRef.get();

    if (!deviceDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Device not found');
    }

    const fcmToken = deviceDoc.get('fcmToken');

    if (!fcmToken) {
      return { ok: true, message: 'No FCM token registered' };
    }

    await admin.messaging().unsubscribeFromTopic([fcmToken], topic);

    console.log(`Device ${deviceId} unsubscribed from topic ${topic}`);

    return { ok: true };
  } catch (error: any) {
    console.error('Unsubscribe from topic error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});


