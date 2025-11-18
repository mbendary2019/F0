/**
 * Phase 56 Day 2 - Semantic Search API (v1 compatible)
 * Cloud Function for searching memories using semantic + hybrid search
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { cosineSim } from './embeddingTools';
import { getEmbeddingProvider } from '../lib/embeddings/provider';

type Body = {
  query: string;
  roomId?: string;
  sessionId?: string;
  topK?: number;
  hybridBoost?: number;
};

export const searchMemories = functions.https.onCall(async (data: Body, ctx) => {
  const startTime = Date.now();

  if (!ctx.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { query, roomId, sessionId, topK = 10, hybridBoost = 0.35 } = data || {};
  const uid = ctx.auth.uid;

  // Structured logging for monitoring
  functions.logger.info('searchMemories:start', {
    uid,
    queryLength: query?.length || 0,
    roomId: roomId || null,
    sessionId: sessionId || null,
    topK,
    hybridBoost,
  });

  if (!query?.trim()) {
    functions.logger.info('searchMemories:empty', { uid });
    return { items: [] };
  }

  try {
    console.log('[searchMemories] Query:', query.slice(0, 50) + '...', {
      roomId,
      sessionId,
      topK,
      hybridBoost,
    });

    // 1) Embed query
    const provider = await getEmbeddingProvider();
    const { vector: qv } = await provider.embedText(query);
    console.log('[searchMemories] Query vector dimension:', qv.length);

    const db = admin.firestore();

    // 2) Build query with filters
    let q: FirebaseFirestore.Query = db
      .collection('ops_collab_embeddings')
      .where('status', '==', 'ready');

    if (roomId) {
      q = q.where('roomId', '==', roomId);
    }
    if (sessionId) {
      q = q.where('sessionId', '==', sessionId);
    }

    // Fetch candidates (limit 400 for performance)
    const snap = await q.orderBy('createdAt', 'desc').limit(400).get();
    console.log('[searchMemories] Candidates fetched:', snap.size);

    // 3) Calculate cosine similarity + hybrid score
    const items: any[] = [];
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    snap.forEach((d) => {
      const e = d.data() as any;
      if (!e.vector || !Array.isArray(e.vector)) return;

      // Cosine similarity
      const sim = cosineSim(qv, e.vector);

      // Keyword score
      const text: string = e.text || '';
      const textLower = text.toLowerCase();
      const kwHit = queryTerms.some((term) => textLower.includes(term));
      const kwScore = kwHit ? 1 : 0;

      // Hybrid score
      const score = (1 - hybridBoost) * sim + hybridBoost * kwScore;

      items.push({
        id: e.memoryId || d.id,
        roomId: e.roomId || '',
        sessionId: e.sessionId || '',
        text: text.slice(0, 800),
        sim,
        score,
        createdAt: e.createdAt,
      });
    });

    // 4) Sort by score and return top-K
    items.sort((a, b) => b.score - a.score);
    const topResults = items.slice(0, Math.min(topK, 12));

    // Success logging
    functions.logger.info('searchMemories:success', {
      uid,
      resultsCount: topResults.length,
      candidatesEvaluated: snap.size,
      duration: Date.now() - startTime,
    });

    console.log('[searchMemories] Returning', topResults.length, 'results');
    return { items: topResults };
  } catch (error: any) {
    console.error('[searchMemories] Error:', error);

    // Error logging
    functions.logger.error('searchMemories:error', {
      uid,
      error: error.message,
      duration: Date.now() - startTime,
    });

    throw new functions.https.HttpsError('internal', error.message || 'Search failed');
  }
});
