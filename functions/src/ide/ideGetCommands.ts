// functions/src/ide/ideGetCommands.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * IDE Command Polling Endpoint
 *
 * IDE extensions poll this endpoint to get pending commands
 * Returns commands with status='pending', ordered by creation time
 *
 * Query params: sessionId, projectId, after (optional timestamp)
 */
export const ideGetCommands = functions.https.onRequest(async (req, res) => {
  // Allow GET
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { sessionId, projectId, after } = req.query;

  // Validate required parameters
  if (!sessionId || !projectId) {
    res.status(400).json({
      error: 'Missing required parameters: sessionId or projectId'
    });
    return;
  }

  try {
    const db = admin.firestore();

    // Build query: get pending commands
    const ref = db
      .collection('projects')
      .doc(projectId as string)
      .collection('ideSessions')
      .doc(sessionId as string)
      .collection('commands');

    let query = ref
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc');

    // Optional: filter by timestamp (get commands after a certain time)
    if (after) {
      const afterDate = admin.firestore.Timestamp.fromDate(new Date(after as string));
      query = query.where('createdAt', '>', afterDate);
    }

    const snap = await query.get();

    // Map commands to JSON
    const commands = snap.docs.map((doc) => ({
      commandId: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({
      ok: true,
      commands,
      count: commands.length
    });
  } catch (error: any) {
    console.error('[ideGetCommands] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});
