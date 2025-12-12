// src/hooks/useAiActivity.ts
'use client';

import { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebaseClient';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

export function useAiActivity() {
  const [entry, setEntry] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setEntry('Your AI Agent is ready to help with your next task.');
      return;
    }

    const uid = user.uid;

    // آخر LOG للمستخدم من ops_aiLogs
    const logsRef = collection(db, 'ops_aiLogs');
    const q = query(
      logsRef,
      where('ownerUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setEntry(
            'Your AI Agent is ready to help with your next task.'
          );
          return;
        }

        const log = snap.docs[0].data();
        setEntry(
          log.summary ||
            log.message ||
            'AI found new improvements for your project.'
        );
      },
      (err) => {
        console.error('[useAiActivity] error:', err);
        setEntry('Your AI Agent is ready to help with your next task.');
      }
    );

    return () => unsub();
  }, []);

  return entry;
}
