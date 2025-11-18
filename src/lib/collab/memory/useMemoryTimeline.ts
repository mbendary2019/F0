'use client';

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebaseClient';

/**
 * Helper: Safely converts any value to an array
 * Prevents .map() errors on undefined/null
 */
function toList<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export type MemoryItem = {
  id: string;
  roomId: string;
  sessionId: string;
  type: 'auto-summary' | 'manual-pin' | 'system-note';
  content: string;
  createdAt: any; // Timestamp or number
  pinned: boolean;
  stats?: { messages?: number; participants?: number };
  participants?: Array<{ uid: string | null; name: string }>;
  writer?: 'cf' | 'user';
};

export type UseMemoryTimelineOptions = {
  roomId?: string;
  sessionId?: string;
  pageSize?: number;
};

/**
 * Hook to fetch and listen to memory timeline items
 *
 * Usage:
 * ```ts
 * const { items, loading } = useMemoryTimeline({
 *   roomId: 'my-room',
 *   sessionId: 'my-room__20251106',
 *   pageSize: 100
 * });
 * ```
 */
export function useMemoryTimeline(options: UseMemoryTimelineOptions = {}) {
  const { roomId, sessionId, pageSize = 100 } = options;

  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Early return if required params missing
    if (!roomId || !sessionId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const col = collection(db, 'ops_collab_memory');

      // Build query based on filters
      let q = query(col, orderBy('createdAt', 'desc'), limit(pageSize));

      if (roomId && sessionId) {
        // Filter by both room and session
        q = query(
          col,
          where('roomId', '==', roomId),
          where('sessionId', '==', sessionId),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      } else if (roomId) {
        // Filter by room only
        q = query(
          col,
          where('roomId', '==', roomId),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      }

      // Subscribe to real-time updates
      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const memoryItems = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              roomId: data.roomId,
              sessionId: data.sessionId,
              type: data.type,
              content: data.content,
              createdAt: data.createdAt,
              pinned: data.pinned || false,
              stats: data.stats,
              participants: data.participants,
              writer: data.writer,
            } as MemoryItem;
          });

          setItems(memoryItems);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('[useMemoryTimeline] Error:', err);
          setError(err as Error);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('[useMemoryTimeline] Setup error:', err);
      setError(err as Error);
      setLoading(false);
    }
  }, [roomId, sessionId, pageSize]);

  // Memoized safe array conversion
  const safeItems = useMemo(() => toList<MemoryItem>(items), [items]);

  return {
    items: safeItems,
    loading,
    error
  };
}

/**
 * Format timestamp for display
 */
export function formatMemoryTimestamp(ts: any): string {
  if (!ts) return '';

  try {
    if (ts instanceof Timestamp) {
      return ts.toDate().toLocaleString();
    }
    if (ts.toDate) {
      return ts.toDate().toLocaleString();
    }
    if (typeof ts === 'number') {
      return new Date(ts).toLocaleString();
    }
    return String(ts);
  } catch (e) {
    return '';
  }
}
