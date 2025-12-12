// src/hooks/useIdePatches.ts
'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebaseClient';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { IdePatch } from '@/types/ideEvents';

/**
 * Hook to fetch IDE patches for a specific session
 * Listens to real-time updates from Firestore
 *
 * @param projectId - The project ID
 * @param sessionId - The IDE session ID
 * @returns Array of pending patches
 */
export function useIdePatches(projectId: string | null, sessionId: string | null) {
  const [patches, setPatches] = useState<IdePatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !sessionId) {
      setPatches([]);
      setLoading(false);
      return;
    }

    // Query: projects/{projectId}/ideSessions/{sessionId}/patches
    // Filter: status = 'pending'
    const patchesRef = collection(
      db,
      'projects',
      projectId,
      'ideSessions',
      sessionId,
      'patches'
    );

    const q = query(patchesRef, where('status', '==', 'pending'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: IdePatch[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          list.push({
            patchId: doc.id,
            sessionId: data.sessionId,
            projectId: data.projectId,
            createdBy: data.createdBy,
            ts: data.ts,
            files: data.files || [],
            status: data.status,
            appliedAt: data.appliedAt,
          });
        });
        setPatches(list);
        setLoading(false);
      },
      (err) => {
        console.error('[useIdePatches] Error:', err);
        setPatches([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [projectId, sessionId]);

  return { patches, loading };
}
