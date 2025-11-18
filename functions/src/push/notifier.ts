// F0 Phase 35 - Push Notification Sender

import * as admin from 'firebase-admin';

export interface PushNotification {
  userId?: string;
  topic?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
}

/**
 * Send push notification to user (all devices) or topic
 */
export async function sendPush(push: PushNotification): Promise<{ ok: boolean; count?: number }> {
  const db = admin.firestore();

  try {
    // Topic-based notification
    if (push.topic) {
      const message: admin.messaging.Message = {
        topic: push.topic,
        notification: {
          title: push.title,
          body: push.body,
          imageUrl: push.imageUrl,
        },
        data: push.data,
        webpush: push.clickAction
          ? {
              fcmOptions: {
                link: push.clickAction,
              },
            }
          : undefined,
      };

      await admin.messaging().send(message);
      console.log(`Push sent to topic: ${push.topic}`);
      return { ok: true };
    }

    // User-based notification (all devices)
    if (push.userId) {
      const devicesSnapshot = await db.collection(`users/${push.userId}/devices`).get();

      const tokens = devicesSnapshot.docs
        .map((doc) => doc.get('fcmToken'))
        .filter(Boolean) as string[];

      if (tokens.length === 0) {
        console.log(`No FCM tokens found for user ${push.userId}`);
        return { ok: true, count: 0 };
      }

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: push.title,
          body: push.body,
          imageUrl: push.imageUrl,
        },
        data: push.data,
        webpush: push.clickAction
          ? {
              fcmOptions: {
                link: push.clickAction,
              },
            }
          : undefined,
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      console.log(
        `Push sent to ${response.successCount}/${tokens.length} devices for user ${push.userId}`
      );

      return { ok: true, count: response.successCount };
    }

    throw new Error('Either userId or topic must be provided');
  } catch (error: any) {
    console.error('Send push error:', error);
    throw error;
  }
}

/**
 * Send push to multiple users
 */
export async function sendPushBatch(
  pushes: PushNotification[]
): Promise<{ ok: boolean; results: any[] }> {
  const results = await Promise.allSettled(pushes.map((push) => sendPush(push)));

  return {
    ok: true,
    results: results.map((result) =>
      result.status === 'fulfilled' ? result.value : { ok: false, error: result.reason }
    ),
  };
}

/**
 * Topic helpers
 */
export function topicForUser(uid: string): string {
  return `user-${uid}`;
}

export function topicForProject(projectId: string): string {
  return `project-${projectId}`;
}

export function topicForOps(): string {
  return 'ops';
}


