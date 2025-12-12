// src/hooks/useProjectsList.ts
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

export interface Project {
  id: string;
  ownerUid: string;
  name: string;
  status: string;
  type: string;
  slug: string;
  createdAt?: Date;
}

export function useProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'ops_projects'),
      where('ownerUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Project[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as any;
          list.push({
            id: doc.id,
            ownerUid: data.ownerUid,
            name: data.name || 'Untitled',
            status: data.status || 'draft',
            type: data.type || 'web',
            slug: data.slug || doc.id,
            createdAt: data.createdAt?.toDate?.() ?? undefined,
          });
        });
        setProjects(list);
        setLoading(false);
      },
      (err) => {
        console.error('[useProjectsList] error:', err);
        setProjects([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { projects, loading };
}
