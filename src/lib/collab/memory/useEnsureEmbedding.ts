/**
 * Phase 53 Day 7: Embedding Status Monitoring Hook
 * Tracks embedding generation status and provides retry functionality
 */

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  getFirestore,
} from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';

export type EmbeddingStatus = 'loading' | 'missing' | 'ready' | 'error';

export type EmbeddingDoc = {
  id: string;
  memoryId: string;
  status: 'ready' | 'error';
  model: string;
  dim: number;
  error?: string | null;
  updatedAt?: any;
  createdAt?: any;
};

export type UseEnsureEmbeddingResult = {
  status: EmbeddingStatus;
  docs: EmbeddingDoc[];
  loading: boolean;
  error: string | null;
  regenerate: () => Promise<void>;
};

/**
 * Monitor embedding status for a memory item
 *
 * @param memoryId - The memory document ID to track
 * @returns Embedding status, documents, and regenerate function
 *
 * @example
 * ```tsx
 * const { status, regenerate } = useEnsureEmbedding(memoryId);
 *
 * return (
 *   <div>
 *     {status === 'ready' && '✅ Embedding ready'}
 *     {status === 'missing' && '⏳ Generating embedding...'}
 *     {status === 'error' && (
 *       <button onClick={regenerate}>Retry embedding</button>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useEnsureEmbedding(
  memoryId: string | null
): UseEnsureEmbeddingResult {
  const db = getFirestore();
  const fns = getFunctions();

  const [docs, setDocs] = useState<EmbeddingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen to embeddings for this memory item
  useEffect(() => {
    if (!memoryId) {
      setDocs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'ops_collab_embeddings'),
      where('memoryId', '==', memoryId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const embeddingDocs: EmbeddingDoc[] = [];

        snapshot.forEach((doc) => {
          embeddingDocs.push({
            id: doc.id,
            ...(doc.data() as Omit<EmbeddingDoc, 'id'>),
          });
        });

        setDocs(embeddingDocs);
        setLoading(false);
      },
      (err) => {
        console.error('[useEnsureEmbedding] Snapshot error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, memoryId]);

  // Calculate overall status
  const status = useMemo<EmbeddingStatus>(() => {
    if (loading) return 'loading';
    if (docs.length === 0) return 'missing';

    // Check if any embedding has error status
    const hasError = docs.some((doc) => doc.status === 'error');
    if (hasError) return 'error';

    // All embeddings are ready
    return 'ready';
  }, [docs, loading]);

  // Regenerate embedding (calls Cloud Function)
  const regenerate = useCallback(async () => {
    if (!memoryId) {
      console.warn('[useEnsureEmbedding] No memoryId to regenerate');
      return;
    }

    try {
      console.log('[useEnsureEmbedding] Regenerating embedding for', memoryId);

      const regenerateEmbeddingFn = httpsCallable(fns, 'regenerateEmbedding');
      await regenerateEmbeddingFn({ memoryId });

      console.log('[useEnsureEmbedding] Regeneration triggered');
    } catch (err) {
      console.error('[useEnsureEmbedding] Regeneration failed:', err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [fns, memoryId]);

  return {
    status,
    docs,
    loading,
    error,
    regenerate,
  };
}

/**
 * Format embedding status for display
 */
export function formatEmbeddingStatus(status: EmbeddingStatus): string {
  switch (status) {
    case 'loading':
      return '⏳ Loading...';
    case 'missing':
      return '⚙️ Generating embedding...';
    case 'ready':
      return '✅ Ready';
    case 'error':
      return '❌ Error';
    default:
      return '❓ Unknown';
  }
}

/**
 * Get status color for UI
 */
export function getEmbeddingStatusColor(status: EmbeddingStatus): string {
  switch (status) {
    case 'loading':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'missing':
      return 'text-blue-600 dark:text-blue-400';
    case 'ready':
      return 'text-green-600 dark:text-green-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}
