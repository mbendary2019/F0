/**
 * Phase 53 Day 7: Automatic Embedding Generation
 * Firestore trigger that generates embeddings for new memory items
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getEmbeddingProvider } from '../lib/embeddings/provider';

const db = admin.firestore();

/**
 * Firestore Trigger: When a new memory item is created,
 * automatically generate its embedding for semantic search.
 *
 * This runs once per memory item creation.
 */
export const generateMemoryEmbedding = functions.firestore
  .document('ops_collab_memory/{memoryId}')
  .onCreate(async (snap, context) => {
    const memoryId = context.params.memoryId;
    const memory = snap.data();

    const { roomId, sessionId, content, type } = memory;

    functions.logger.info('[generateMemoryEmbedding] Processing', {
      memoryId,
      roomId,
      sessionId,
      type,
      contentLength: content?.length || 0,
    });

    try {
      // Check if embedding already exists (防止重复)
      const existingEmbeddings = await db
        .collection('ops_collab_embeddings')
        .where('memoryId', '==', memoryId)
        .limit(1)
        .get();

      if (!existingEmbeddings.empty) {
        functions.logger.info('[generateMemoryEmbedding] Embedding already exists, skipping', {
          memoryId,
        });
        return;
      }

      // Prepare text for embedding: include type for context
      const textToEmbed = `[${type}] ${content}`;

      // Generate embedding
      const provider = getEmbeddingProvider();
      const { vector, model, dim } = await provider.embedText(textToEmbed);

      // Store embedding in Firestore
      await db.collection('ops_collab_embeddings').add({
        memoryId,
        roomId,
        sessionId,
        vector,
        model,
        dim,
        status: 'ready',
        error: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info('[generateMemoryEmbedding] Success', {
        memoryId,
        model,
        dim,
      });
    } catch (error) {
      // Store error state for monitoring and retry
      await db.collection('ops_collab_embeddings').add({
        memoryId,
        roomId,
        sessionId,
        vector: [],
        model: 'n/a',
        dim: 0,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.error('[generateMemoryEmbedding] Failed', {
        memoryId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Don't throw - we've recorded the error
    }
  });
