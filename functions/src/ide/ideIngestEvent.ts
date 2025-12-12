// functions/src/ide/ideIngestEvent.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * IDE Event Ingestion Endpoint
 *
 * Receives events from IDE extensions (VS Code, Cursor)
 * Events include: FILE_SNAPSHOT, FILE_CHANGED, SELECTION_CHANGED, HEARTBEAT, etc.
 *
 * Storage path: projects/{projectId}/ideSessions/{sessionId}/events/{eventId}
 */
export const ideIngestEvent = functions.https.onRequest(async (req, res) => {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const event = req.body;

  // Validate required fields
  if (!event.eventId || !event.sessionId || !event.projectId) {
    res.status(400).json({
      error: 'Missing required fields: eventId, sessionId, or projectId'
    });
    return;
  }

  if (!event.kind || !event.ts) {
    res.status(400).json({
      error: 'Missing required fields: kind or ts'
    });
    return;
  }

  try {
    const db = admin.firestore();

    // Store event in Firestore
    // Path: projects/{projectId}/ideSessions/{sessionId}/events/{eventId}
    await db
      .collection('projects')
      .doc(event.projectId)
      .collection('ideSessions')
      .doc(event.sessionId)
      .collection('events')
      .doc(event.eventId)
      .set({
        eventId: event.eventId,
        sessionId: event.sessionId,
        projectId: event.projectId,
        source: event.source || 'ide',
        kind: event.kind,
        ts: event.ts,
        payload: event.payload || {},
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Update session lastEventAt timestamp
    await db
      .collection('projects')
      .doc(event.projectId)
      .collection('ideSessions')
      .doc(event.sessionId)
      .set(
        {
          lastEventAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'active',
        },
        { merge: true }
      );

    res.status(200).json({ ok: true, eventId: event.eventId });
  } catch (error: any) {
    console.error('[ideIngestEvent] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});
