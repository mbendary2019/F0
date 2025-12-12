// src/hooks/useLiveSessionsStats.ts
'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseClient';

export function useLiveSessionsStats() {
  const [activeCount, setActiveCount] = useState(0);
  const [delta, setDelta] = useState(0); // +X this week

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setActiveCount(0);
      setDelta(0);
      return;
    }

    const uid = user.uid;
    const sessionsRef = collection(db, 'liveSessions');

    // 1) Active sessions
    const q1 = query(
      sessionsRef,
      where('ownerUid', '==', uid),
      where('status', '==', 'active')
    );

    const unsub1 = onSnapshot(
      q1,
      (snap) => {
        setActiveCount(snap.size);
      },
      (err) => {
        console.error('[useLiveSessionsStats] active sessions error:', err);
        setActiveCount(0);
      }
    );

    // 2) Sessions created this week
    const sevenDaysAgo = Timestamp.fromMillis(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    );
    const q2 = query(sessionsRef, where('ownerUid', '==', uid));

    const unsub2 = onSnapshot(
      q2,
      (snap) => {
        let count = 0;
        snap.forEach((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt;

          if (createdAt instanceof Timestamp) {
            if (createdAt.toMillis() >= sevenDaysAgo.toMillis()) {
              count++;
            }
          }
        });
        setDelta(count);
      },
      (err) => {
        console.error('[useLiveSessionsStats] delta error:', err);
        setDelta(0);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  return { activeCount, delta };
}
