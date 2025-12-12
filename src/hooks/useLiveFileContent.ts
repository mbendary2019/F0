// src/hooks/useLiveFileContent.ts
'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { reduceFileEvents, LiveFileState } from '@/lib/liveFileDelta';
import { IdeEventEnvelope } from '@/types/ideEvents';

export function useLiveFileContent(
  projectId: string | null,
  sessionId: string | null,
  filePath: string | null
) {
  const [state, setState] = useState<LiveFileState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !sessionId || !filePath) {
      setState(null);
      setLoading(false);
      return;
    }

    const eventsRef = collection(
      db,
      'projects',
      projectId,
      'ideSessions',
      sessionId,
      'events'
    );

    // Query events for this file, ordered by timestamp
    // Note: This requires a Firestore index on (payload.path, ts)
    // For now, we'll fetch all events and filter client-side
    const q = query(eventsRef, orderBy('ts', 'asc'));

    const unsub = onSnapshot(q, (snap) => {
      const events: IdeEventEnvelope[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as IdeEventEnvelope;
        events.push(data);
      });

      // Filter and reduce events for this file
      const result = reduceFileEvents(events, filePath);
      setState(result);
      setLoading(false);
    });

    return () => unsub();
  }, [projectId, sessionId, filePath]);

  return { state, loading };
}
