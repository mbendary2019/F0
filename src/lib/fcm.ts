// F0 Phase 35 - Firebase Cloud Messaging (FCM) Client

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { httpsCallable } from 'firebase/functions';
import { app, functions } from '@/lib/firebase';

/**
 * Initialize FCM and register token
 */
export async function initFcm(deviceId: string): Promise<string | null> {
  try {
    // Check if FCM is supported (browser only)
    if (!(await isSupported())) {
      console.warn('FCM not supported in this environment');
      return null;
    }

    const messaging = getMessaging(app);

    // Get VAPID key from environment
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    if (!vapidKey) {
      console.error('NEXT_PUBLIC_FIREBASE_VAPID_KEY not set');
      return null;
    }

    // Request notification permission
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return null;
    }

    // Get FCM token
    const token = await getToken(messaging, { vapidKey });

    if (!token) {
      console.error('Failed to get FCM token');
      return null;
    }

    console.log('✅ FCM token obtained:', token);

    // Register token with backend
    const registerTokenFn = httpsCallable(functions, 'registerToken');
    await registerTokenFn({ deviceId, fcmToken: token });

    console.log(`✅ FCM token registered for device ${deviceId}`);

    // Listen for foreground messages
    onMessage(messaging, (payload) => {
      console.log('📩 FCM message received:', payload);

      // Show in-app notification or toast
      if (payload.notification) {
        const { title, body } = payload.notification;

        // You can use a toast library here (e.g., react-hot-toast)
        console.log(`Notification: ${title} - ${body}`);

        // Optional: Show browser notification if tab is not active
        if (document.hidden && title) {
          new Notification(title, {
            body,
            icon: '/icon.png',
          });
        }
      }
    });

    return token;
  } catch (error) {
    console.error('FCM initialization error:', error);
    return null;
  }
}

/**
 * Unregister FCM token
 */
export async function unregisterFcm(deviceId: string): Promise<void> {
  try {
    const unregisterTokenFn = httpsCallable(functions, 'unregisterToken');
    await unregisterTokenFn({ deviceId });

    console.log(`✅ FCM token unregistered for device ${deviceId}`);
  } catch (error) {
    console.error('FCM unregistration error:', error);
  }
}

/**
 * Subscribe to a topic
 */
export async function subscribeToTopic(deviceId: string, topic: string): Promise<void> {
  try {
    const subscribeToTopicFn = httpsCallable(functions, 'subscribeToTopic');
    await subscribeToTopicFn({ deviceId, topic });

    console.log(`✅ Subscribed to topic ${topic} for device ${deviceId}`);
  } catch (error) {
    console.error('Topic subscription error:', error);
  }
}

/**
 * Unsubscribe from a topic
 */
export async function unsubscribeFromTopic(deviceId: string, topic: string): Promise<void> {
  try {
    const unsubscribeFromTopicFn = httpsCallable(functions, 'unsubscribeFromTopic');
    await unsubscribeFromTopicFn({ deviceId, topic });

    console.log(`✅ Unsubscribed from topic ${topic} for device ${deviceId}`);
  } catch (error) {
    console.error('Topic unsubscription error:', error);
  }
}


