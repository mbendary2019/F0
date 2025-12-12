// functions/src/ide/ideSendCommand.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * IDE Command Sending Endpoint
 *
 * Sends commands from Dashboard to IDE
 * Commands include: APPLY_PATCH, OPEN_FILE
 *
 * Storage path: projects/{projectId}/ideSessions/{sessionId}/commands/{commandId}
 */
export const ideSendCommand = functions.https.onRequest(async (req, res) => {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const command = req.body;

  // Validate required fields
  if (!command.commandId || !command.sessionId || !command.projectId) {
    res.status(400).json({
      error: 'Missing required fields: commandId, sessionId, or projectId'
    });
    return;
  }

  if (!command.kind || !command.ts) {
    res.status(400).json({
      error: 'Missing required fields: kind or ts'
    });
    return;
  }

  try {
    const db = admin.firestore();

    // Store command in Firestore
    // Path: projects/{projectId}/ideSessions/{sessionId}/commands/{commandId}
    await db
      .collection('projects')
      .doc(command.projectId)
      .collection('ideSessions')
      .doc(command.sessionId)
      .collection('commands')
      .doc(command.commandId)
      .set({
        commandId: command.commandId,
        sessionId: command.sessionId,
        projectId: command.projectId,
        kind: command.kind,
        ts: command.ts,
        payload: command.payload || {},
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.status(200).json({ ok: true, commandId: command.commandId });
  } catch (error: any) {
    console.error('[ideSendCommand] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});
