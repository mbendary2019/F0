'use client';

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';

export type PinMemoryParams = {
  roomId: string;
  sessionId: string;
  content: string;
  me: {
    uid: string;
    name: string;
  };
};

/**
 * Manually pin a memory/note to the timeline
 *
 * Usage:
 * ```ts
 * await pinMemory({
 *   roomId: 'my-room',
 *   sessionId: 'my-room__20251106',
 *   content: 'Important decision: Use GPT-4 for all summaries',
 *   me: { uid: 'user123', name: 'John Doe' }
 * });
 * ```
 */
export async function pinMemory(params: PinMemoryParams): Promise<string> {
  const { roomId, sessionId, content, me } = params;

  if (!content.trim()) {
    throw new Error('Content cannot be empty');
  }

  if (!me.uid || !me.name) {
    throw new Error('User information is required');
  }

  try {
    const docRef = await addDoc(collection(db, 'ops_collab_memory'), {
      roomId,
      sessionId,
      type: 'manual-pin',
      content: content.trim(),
      span: null,
      stats: null,
      participants: [],
      createdAt: serverTimestamp(),
      createdBy: {
        uid: me.uid,
        name: me.name,
      },
      writer: 'user',
      pinned: true,
    });

    console.info('[pinMemory] Memory pinned:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[pinMemory] Failed to pin memory:', error);
    throw error;
  }
}
