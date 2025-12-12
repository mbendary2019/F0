'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { F0Deployment } from '@/types/deployment';

export function useUserDeployments() {
  const [deployments, setDeployments] = useState<F0Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setDeployments([]);
      setLoading(false);
      return;
    }

    // Try with orderBy first, fallback to client-side sorting if index doesn't exist
    const q = query(
      collection(db, 'ops_deployments'),
      where('ownerUid', '==', user.uid),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: F0Deployment[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          items.push({
            id: doc.id,
            ...data,
            // Ensure createdAt is a number
            createdAt: typeof data.createdAt === 'number'
              ? data.createdAt
              : data.createdAt?.toMillis?.() || Date.now(),
          } as F0Deployment);
        });

        // Sort client-side by createdAt descending
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        setDeployments(items);
        setLoading(false);
      },
      (err) => {
        console.error('useUserDeployments error', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { deployments, loading };
}
