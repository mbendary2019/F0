// src/hooks/useDeployments.ts
'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { auth } from '@/lib/firebaseClient';

export type DeploymentItem = {
  id: string;
  projectName: string;
  branch: string;
  env: 'production' | 'preview';
  provider: 'vercel' | 'firebase' | 'github-actions';
  status: 'success' | 'failed' | 'in_progress';
  createdAt: Date | null;
};

export function useDeployments() {
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setDeployments([]);
      setLoading(false);
      return;
    }

    // نجيب كل الـ deployments بتاعة اليوزر ده ومرتّبة من الأحدث للأقدم
    const q = query(
      collection(db, 'deployments'),
      where('ownerUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: DeploymentItem[] = snap.docs.map((doc) => {
          const data = doc.data() as any;

          let created: Date | null = null;
          if (data.createdAt instanceof Timestamp) {
            created = data.createdAt.toDate();
          } else if (typeof data.createdAt === 'number') {
            created = new Date(data.createdAt);
          }

          return {
            id: doc.id,
            projectName: data.projectName ?? 'Untitled project',
            branch: data.branch ?? 'main',
            env: (data.env ?? 'production') as DeploymentItem['env'],
            provider: (data.provider ?? 'vercel') as DeploymentItem['provider'],
            status: (data.status ?? 'success') as DeploymentItem['status'],
            createdAt: created,
          };
        });

        setDeployments(items);
        setLoading(false);
      },
      (err) => {
        console.error('[useDeployments] snapshot error', err);
        setDeployments([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { deployments, loading };
}
