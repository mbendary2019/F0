// src/lib/rag/cache.ts
// Phase 58: Query cache with TTL for RAG results

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { RecallItem, Strategy } from './types';

const CACHE_COLLECTION = 'ops_rag_cache';
const DEFAULT_TTL_SECONDS = 1200; // 20 minutes

/**
 * Generate cache key from query and strategy
 */
function generateCacheKey(workspaceId: string, query: string, strategy: Strategy): string {
  // Simple hash for cache key (client-side safe)
  const combined = `${workspaceId}|${strategy}|${query}`;
  return btoa(unescape(encodeURIComponent(combined))).slice(0, 40);
}

/**
 * Get cached query results or set if not found
 *
 * @param workspaceId - Workspace ID
 * @param query - User query
 * @param strategy - Retrieval strategy
 * @param data - Data to cache if not found
 * @param ttlSeconds - TTL in seconds (default: 1200)
 * @returns Cache result with hit/miss indicator
 */
export async function getOrSetQueryCache(
  workspaceId: string,
  query: string,
  strategy: Strategy,
  data: RecallItem[] | null,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<{ hit: boolean; value: RecallItem[] | null }> {
  const db = getFirestore();
  const key = generateCacheKey(workspaceId, query, strategy);
  const docRef = doc(collection(db, CACHE_COLLECTION), key);

  try {
    // Try to get from cache
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const cached = snap.data();
      const expireAt = cached.expire_at as Timestamp;

      // Check if still valid
      if (expireAt.toDate() > new Date()) {
        return {
          hit: true,
          value: cached.value as RecallItem[],
        };
      }
    }

    // Cache miss or expired - set new value if data provided
    if (data !== null) {
      const expireAt = new Date(Date.now() + ttlSeconds * 1000);

      await setDoc(
        docRef,
        {
          workspaceId,
          queryHash: key,
          query,
          strategy,
          value: data,
          expire_at: Timestamp.fromDate(expireAt),
          created_at: Timestamp.now(),
          hit_count: 1,
        },
        { merge: false }
      );
    }

    return {
      hit: false,
      value: data,
    };
  } catch (error) {
    console.error('[RAG Cache] Error:', error);
    // On error, return data without caching
    return {
      hit: false,
      value: data,
    };
  }
}

/**
 * Invalidate cache for a specific workspace
 * Useful when workspace data changes significantly
 */
export async function invalidateWorkspaceCache(workspaceId: string): Promise<void> {
  // This would require a Cloud Function to efficiently delete all cache entries
  // For now, we rely on TTL to expire old entries
  console.log(`[RAG Cache] Invalidation requested for workspace: ${workspaceId}`);
  // TODO: Implement batch deletion in Cloud Function
}

/**
 * Get cache statistics for monitoring
 */
export interface CacheStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
}

/**
 * Calculate cache statistics (would need aggregation in production)
 */
export function calculateCacheStats(
  hits: number,
  misses: number
): CacheStats {
  const total = hits + misses;
  return {
    totalQueries: total,
    cacheHits: hits,
    cacheMisses: misses,
    hitRate: total > 0 ? hits / total : 0,
  };
}
