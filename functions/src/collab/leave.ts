// functions/src/collab/leave.ts
// Phase 53: Realtime Collaboration - Leave Room Handler

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { db } from '../config';

interface LeaveRequest {
  roomId: string;
  sessionId: string;
}

interface LeaveResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Callable function to leave a collaboration room
 * Marks session as left and updates counters
 */
export const leave = functions.https.onCall<LeaveRequest, Promise<LeaveResponse>>(
  async (request) => {
    const { auth, data } = request;

    // 1. Check authentication
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { roomId, sessionId } = data;

    // 2. Validate input
    if (!roomId || !sessionId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'roomId and sessionId are required'
      );
    }

    const userId = auth.uid;

    try {
      // 3. Get session document
      const sessionRef = db
        .collection('collab_rooms')
        .doc(roomId)
        .collection('sessions')
        .doc(sessionId);

      const sessionSnap = await sessionRef.get();

      if (!sessionSnap.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Session not found'
        );
      }

      const sessionData = sessionSnap.data();

      // 4. Verify user owns this session
      if (sessionData?.userId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You can only leave your own session'
        );
      }

      // 5. Mark session as left
      await sessionRef.update({
        leftAt: Date.now()
      });

      // 6. Decrement active count
      const roomRef = db.collection('collab_rooms').doc(roomId);
      await roomRef.update({
        activeCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: Date.now()
      });

      // 7. Log event
      await db.collection('collab_events').add({
        type: 'leave',
        roomId,
        sessionId,
        by: userId,
        ts: Date.now()
      });

      console.log(`✅ User ${userId} left room ${roomId}`);

      return {
        success: true,
        message: 'Left room successfully'
      };

    } catch (error: any) {
      console.error('Error in leave:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to leave collaboration room',
        error.message
      );
    }
  }
);
