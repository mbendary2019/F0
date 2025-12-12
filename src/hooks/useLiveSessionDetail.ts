// src/hooks/useLiveSessionDetail.ts
'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebaseClient';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { LiveSession, LiveSessionEvent } from '@/types/liveSession';

export function useLiveSessionDetail(sessionId: string) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [events, setEvents] = useState<LiveSessionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    const sessionRef = doc(db, 'liveSessions', sessionId);
    const unsubSession = onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) {
          setSession(null);
          setLoading(false);
          return;
        }
        const data = snap.data() as any;
        setSession({
          id: snap.id,
          ownerUid: data.ownerUid,
          projectId: data.projectId,
          projectName: data.projectName ?? undefined,
          status: data.status,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
          endedAt: data.endedAt?.toDate?.() ?? null,
        });
        setLoading(false);
      },
      (err) => {
        console.error('[useLiveSessionDetail] session error:', err);
        setLoading(false);
      }
    );

    const eventsRef = collection(db, 'liveSessions', sessionId, 'events');
    const q = query(eventsRef, orderBy('createdAt', 'asc'));

    const unsubEvents = onSnapshot(
      q,
      (snap) => {
        const next: LiveSessionEvent[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as any;
          next.push({
            id: doc.id,
            ownerUid: data.ownerUid,
            sessionId: data.sessionId,
            type: data.type,
            message: data.message,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            meta: data.meta ?? undefined,
          });
        });
        setEvents(next);
      },
      (err) => {
        console.error('[useLiveSessionDetail] events error:', err);
      }
    );

    return () => {
      unsubSession();
      unsubEvents();
    };
  }, [sessionId]);

  return { session, events, loading };
}
