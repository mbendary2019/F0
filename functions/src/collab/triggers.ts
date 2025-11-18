// functions/src/collab/triggers.ts
// Phase 53: Realtime Collaboration - Firestore Triggers

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { db } from '../config';

/**
 * Trigger on session write to maintain presence and enforce rate limits
 */
export const onSessionWrite = onDocumentWritten(
  'collab_rooms/{roomId}/sessions/{sessionId}',
  async (event) => {
    const { roomId, sessionId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    try {
      // 1. Handle session creation (join)
      if (!before && after) {
        console.log(`👤 User ${after.userId} joined room ${roomId}`);

        // Rate limit check: max 10 joins per user per minute
        const oneMinuteAgo = Date.now() - 60 * 1000;
        const recentJoins = await db
          .collection('collab_events')
          .where('type', '==', 'join')
          .where('by', '==', after.userId)
          .where('ts', '>', oneMinuteAgo)
          .get();

        if (recentJoins.size >= 10) {
          console.warn(`⚠️ Rate limit exceeded for user ${after.userId}`);
          // Could delete the session or mark as suspended
          await event.data?.after.ref.delete();
          return;
        }

        // Log join event
        await db.collection('collab_events').add({
          type: 'join',
          roomId,
          sessionId,
          by: after.userId,
          ts: Date.now(),
          meta: {
            displayName: after.displayName,
            role: after.role
          }
        });
      }

      // 2. Handle session update (leftAt changed)
      if (before && after && !before.leftAt && after.leftAt) {
        console.log(`👋 User ${after.userId} left room ${roomId}`);

        // Note: activeCount decrement is handled in leave.ts
        // This trigger is just for logging and cleanup
      }

      // 3. Handle session deletion
      if (before && !after) {
        console.log(`🗑️ Session ${sessionId} deleted from room ${roomId}`);

        // Decrement active count if session was active
        if (!before.leftAt) {
          const roomRef = db.collection('collab_rooms').doc(roomId);
          await roomRef.update({
            activeCount: admin.firestore.FieldValue.increment(-1),
            updatedAt: Date.now()
          });
        }
      }

    } catch (error) {
      console.error('Error in onSessionWrite:', error);
      // Don't throw - triggers should not fail
    }
  }
);

/**
 * Cleanup old sessions (left > 24 hours ago)
 * Scheduled function runs daily
 */
export const cleanupOldSessions = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'UTC'
  },
  async () => {
    try {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      // Find all old sessions across all rooms
      const roomsSnap = await db.collection('collab_rooms').get();

      let deletedCount = 0;

      for (const roomDoc of roomsSnap.docs) {
        const sessionsSnap = await roomDoc.ref
          .collection('sessions')
          .where('leftAt', '<', oneDayAgo)
          .get();

        for (const sessionDoc of sessionsSnap.docs) {
          await sessionDoc.ref.delete();
          deletedCount++;
        }
      }

      console.log(`🧹 Cleaned up ${deletedCount} old sessions`);

    } catch (error) {
      console.error('Error in cleanupOldSessions:', error);
    }
  }
);

/**
 * Monitor room activity and auto-close inactive rooms
 * Runs every hour
 */
export const monitorRoomActivity = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'UTC'
  },
  async () => {
    try {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      // Find rooms with no activity
      const inactiveRooms = await db
        .collection('collab_rooms')
        .where('updatedAt', '<', oneHourAgo)
        .where('activeCount', '==', 0)
        .get();

      let archivedCount = 0;

      for (const roomDoc of inactiveRooms.docs) {
        // Archive room (mark as inactive instead of delete)
        await roomDoc.ref.update({
          archived: true,
          archivedAt: Date.now()
        });

        archivedCount++;
      }

      console.log(`📦 Archived ${archivedCount} inactive rooms`);

    } catch (error) {
      console.error('Error in monitorRoomActivity:', error);
    }
  }
);
