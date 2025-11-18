import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Format date as YYYYMMDD
 */
function yyyymmdd(ts: FirebaseFirestore.Timestamp): string {
  const d = ts.toDate();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}${m}${day}`;
}

/**
 * Firestore Trigger: When an AI summary is created,
 * create/update the session and add a memory item.
 *
 * This creates a persistent timeline of all summaries.
 */
export const commitSummaryToMemory = functions.firestore
  .document('ops_collab_summaries/{summaryId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const roomId: string = data.roomId;
    const createdAt: FirebaseFirestore.Timestamp =
      data.ts || admin.firestore.Timestamp.now();
    const sessionId = `${roomId}__${yyyymmdd(createdAt)}`;

    try {
      // 1) Upsert session document
      const sessionRef = db.collection('ops_collab_sessions').doc(sessionId);

      await db.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);

        if (!sessionSnap.exists) {
          // Create new session
          tx.set(
            sessionRef,
            {
              roomId,
              sessionId,
              startedAt: createdAt,
              lastActivityAt: createdAt,
              createdBy: data.requestedBy || null,
              title: data.sessionTitle || null,
              messageCount: data.messageCount || 0,
              summaryCount: 1,
            },
            { merge: true }
          );
        } else {
          // Update existing session
          tx.set(
            sessionRef,
            {
              lastActivityAt: createdAt,
              messageCount: admin.firestore.FieldValue.increment(
                data.messageCount || 0
              ),
              summaryCount: admin.firestore.FieldValue.increment(1),
            },
            { merge: true }
          );
        }
      });

      // 2) Add memory item
      const memRef = db.collection('ops_collab_memory').doc();

      // Extract participants from summary data
      const participants =
        data.participants?.map((name: string) => ({
          name,
          uid: null, // We don't have UIDs in summaries yet
        })) || [];

      await memRef.set({
        roomId,
        sessionId,
        type: 'auto-summary',
        content: data.summary, // AI-generated summary text
        span: data.span || null, // {fromTs, toTs}
        stats: {
          messages: data.messageCount || 0,
          participants: participants.length,
        },
        participants,
        createdAt,
        createdBy: null, // AI-generated, no user
        writer: 'cf',
        pinned: false,
      });

      functions.logger.info('Memory committed', {
        summaryId: context.params.summaryId,
        roomId,
        sessionId,
        messageCount: data.messageCount,
      });

      return true;
    } catch (error) {
      functions.logger.error('Failed to commit memory', {
        error,
        summaryId: context.params.summaryId,
      });
      throw error;
    }
  });
