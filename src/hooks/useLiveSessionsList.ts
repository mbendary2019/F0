// src/hooks/useLiveSessionsList.ts
'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebaseClient';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { LiveSession } from '@/types/liveSession';

export function useLiveSessionsList() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'liveSessions'),
      where('ownerUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: LiveSession[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as any;
          next.push({
            id: doc.id,
            ownerUid: data.ownerUid,
            projectId: data.projectId,
            projectName: data.projectName ?? undefined,
            status: data.status,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            endedAt: data.endedAt?.toDate?.() ?? null,
          });
        });
        setSessions(next);
        setLoading(false);
      },
      (err) => {
        console.error('[useLiveSessionsList] error:', err);
        setSessions([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { sessions, loading };
}
