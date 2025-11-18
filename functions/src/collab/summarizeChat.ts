import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

type ChatMessage = {
  roomId: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  createdAt: FirebaseFirestore.Timestamp;
};

type SummaryDoc = {
  roomId: string;
  ts: FirebaseFirestore.Timestamp;
  from: 'ai-agent';
  windowMs: number;
  messageCount: number;
  participants: string[];
  summary: string;
  topics: string[];
  lang?: string;
  pinned: boolean;
};

/**
 * Call F0 Orchestrator for AI summarization
 * TODO: Replace with real orchestrator call
 */
async function callF0Orchestrator(
  messages: ChatMessage[]
): Promise<{ summary: string; topics: string[]; lang?: string }> {
  if (messages.length === 0) {
    return {
      summary: 'No messages in this interval.',
      topics: [],
      lang: undefined,
    };
  }

  // Simple fallback summarization
  const plain = messages.map((m) => `- ${m.userName}: ${m.text}`).join('\n');

  // Extract simple topics (words that appear multiple times)
  const words = messages
    .flatMap(m => m.text.toLowerCase().split(/\s+/))
    .filter(w => w.length > 3);
  const wordCount = new Map<string, number>();
  words.forEach(w => wordCount.set(w, (wordCount.get(w) || 0) + 1));
  const topics = Array.from(wordCount.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Detect language (simple heuristic)
  const hasArabic = messages.some(m => /[\u0600-\u06FF]/.test(m.text));
  const lang = hasArabic ? 'ar' : 'en';

  // Generate summary
  const userNames = Array.from(new Set(messages.map(m => m.userName)));
  const summary = `${userNames.join(', ')} discussed ${topics.length > 0 ? topics.join(', ') : 'various topics'} (${messages.length} messages)`;

  // TODO: Replace with actual F0 Orchestrator API call
  // Example:
  // const response = await fetch('http://localhost:8080/api/orchestrator/summarize', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ messages: plain, model: 'gpt-4' })
  // });
  // const { summary, topics, lang } = await response.json();

  return { summary, topics, lang };
}

/**
 * Cloud Function: Summarize chat messages for a room
 * Callable via Firebase SDK from client
 */
export const summarizeRoom = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required to summarize chat'
      );
    }

    // Validate input
    const roomId: string = data?.roomId;
    const windowMs: number = Number(data?.windowMs ?? 60_000);

    if (!roomId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'roomId is required'
      );
    }

    if (windowMs < 1000 || windowMs > 3600_000) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'windowMs must be between 1s and 1 hour'
      );
    }

    try {
      const now = admin.firestore.Timestamp.now();
      const since = admin.firestore.Timestamp.fromMillis(
        now.toMillis() - windowMs
      );

      // Fetch recent messages for the room
      const snap = await db
        .collection('ops_collab_messages')
        .where('roomId', '==', roomId)
        .where('createdAt', '>=', since)
        .orderBy('createdAt', 'asc')
        .limit(200) // Safety limit
        .get();

      const msgs: ChatMessage[] = snap.docs.map((d) => d.data() as ChatMessage);

      // Skip if no messages
      if (msgs.length === 0) {
        return {
          summary: 'No messages in this interval.',
          messageCount: 0,
          participants: [],
        };
      }

      // Extract participants
      const participants = Array.from(
        new Set(msgs.map((m) => m.userName).filter(Boolean))
      );

      // Call AI summarization
      const { summary, topics, lang } = await callF0Orchestrator(msgs);

      // Create summary document
      const doc: SummaryDoc = {
        roomId,
        ts: now,
        from: 'ai-agent',
        windowMs,
        messageCount: msgs.length,
        participants,
        summary,
        topics,
        lang,
        pinned: false,
      };

      // Save to Firestore
      const ref = await db.collection('ops_collab_summaries').add(doc);

      functions.logger.info('Chat summary created', {
        summaryId: ref.id,
        roomId,
        messageCount: msgs.length,
      });

      return {
        id: ref.id,
        ...doc,
        ts: doc.ts.toMillis(), // Convert to epoch for client
      };
    } catch (error) {
      functions.logger.error('Failed to create summary', { error, roomId });
      throw new functions.https.HttpsError(
        'internal',
        'Failed to create summary',
        error
      );
    }
  });
