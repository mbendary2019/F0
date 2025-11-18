// functions/src/collab/snapshot.ts
// Phase 53: Realtime Collaboration - Snapshot Export

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { db } from '../config';

interface SnapshotRequest {
  roomId: string;
  content: string; // Y.js state as base64 or plain text
  format?: 'yjs' | 'text';
}

interface SnapshotResponse {
  success: boolean;
  snapshotUrl?: string;
  snapshotId?: string;
  error?: string;
}

/**
 * HTTP callable function to create a snapshot of the current document state
 * Admin or room owner only
 */
export const snapshot = functions.https.onCall<SnapshotRequest, Promise<SnapshotResponse>>(
  async (request) => {
    const { auth, data } = request;

    // 1. Check authentication
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { roomId, content, format = 'text' } = data;

    // 2. Validate input
    if (!roomId || !content) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'roomId and content are required'
      );
    }

    const userId = auth.uid;

    try {
      // 3. Get room
      const roomRef = db.collection('collab_rooms').doc(roomId);
      const roomSnap = await roomRef.get();

      if (!roomSnap.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Room not found'
        );
      }

      const roomData = roomSnap.data();

      // 4. Check permissions (owner or admin)
      const isAdmin = auth.token.admin === true;
      const isOwner = roomData?.createdBy === userId;

      if (!isAdmin && !isOwner) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only room owner or admin can create snapshots'
        );
      }

      // 5. Generate snapshot ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const snapshotId = `${roomId}_${timestamp}`;
      const fileName = `${snapshotId}.${format === 'yjs' ? 'json' : 'txt'}`;

      // 6. Save to Storage
      const bucket = admin.storage().bucket();
      const file = bucket.file(`collab_exports/${roomId}/${fileName}`);

      await file.save(content, {
        contentType: format === 'yjs' ? 'application/json' : 'text/plain',
        metadata: {
          roomId,
          exportedBy: userId,
          exportedAt: Date.now().toString(),
          format
        }
      });

      // 7. Make file publicly readable (optional, or use signed URL)
      // await file.makePublic();
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // 8. Log event
      await db.collection('collab_events').add({
        type: 'snapshot',
        roomId,
        snapshotId,
        by: userId,
        ts: Date.now(),
        meta: {
          bytes: Buffer.from(content).length,
          format,
          fileName
        }
      });

      console.log(`✅ Snapshot created for room ${roomId}: ${snapshotId}`);

      return {
        success: true,
        snapshotUrl: signedUrl,
        snapshotId
      };

    } catch (error: any) {
      console.error('Error in snapshot:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to create snapshot',
        error.message
      );
    }
  }
);
