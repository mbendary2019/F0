// F0 Phase 35 - Presence & Heartbeat Functions

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

/**
 * Heartbeat function - updates device and user presence
 */
export const heartbeat = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { deviceId, appVersion, capabilities } = data;

  if (!deviceId) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId is required');
  }

  const db = admin.firestore();
  const uid = context.auth.uid;

  try {
    // Update device presence
    const deviceRef = db.doc(`users/${uid}/devices/${deviceId}`);
    await deviceRef.set(
      {
        appVersion,
        capabilities,
        status: {
          online: true,
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
          heartbeat: Date.now(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Update user lastSeen
    const userRef = db.doc(`users/${uid}`);
    await userRef.set(
      {
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true };
  } catch (error: any) {
    console.error('Heartbeat error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Mark device as offline (called on disconnect or timeout)
 */
export const markOffline = functions.https.onCall(async (data, context) => {
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
    await deviceRef.update({
      'status.online': false,
      'status.lastSeen': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  } catch (error: any) {
    console.error('Mark offline error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cleanup stale devices (scheduled function)
 * Runs every hour to mark devices offline if heartbeat is older than 5 minutes
 */
export const cleanupStaleDevices = functions.pubsub
  .schedule('every 60 minutes')
  .onRun(async () => {
    const db = admin.firestore();
    const staleThreshold = Date.now() - 5 * 60 * 1000; // 5 minutes ago

    try {
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        const devicesSnapshot = await userDoc.ref.collection('devices').get();

        for (const deviceDoc of devicesSnapshot.docs) {
          const status = deviceDoc.get('status');
          if (status?.online && status?.heartbeat < staleThreshold) {
            console.log(`Marking device ${deviceDoc.id} as offline (stale)`);
            await deviceDoc.ref.update({
              'status.online': false,
              'status.lastSeen': admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }

      console.log('Stale device cleanup completed');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

/**
 * Get user presence (including all devices)
 */
export const getPresence = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { targetUid } = data;
  const uid = targetUid || context.auth.uid;

  const db = admin.firestore();

  try {
    const userDoc = await db.doc(`users/${uid}`).get();
    const devicesSnapshot = await db.collection(`users/${uid}/devices`).get();

    const devices = devicesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const onlineDevices = devices.filter((d: any) => d.status?.online);

    return {
      ok: true,
      presence: {
        uid,
        online: onlineDevices.length > 0,
        lastSeen: userDoc.get('lastSeen'),
        devices: devices.length,
        activeDevice: onlineDevices[0]?.id || null,
        allDevices: devices,
      },
    };
  } catch (error: any) {
    console.error('Get presence error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});


