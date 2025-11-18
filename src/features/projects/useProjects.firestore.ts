import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import type { Project } from './types';

export function useProjectsFirestore(): {
  projects: Project[];
  loading: boolean;
  error: Error | null;
} {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  // Track auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid || null);
      if (!user) {
        setProjects([]);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Load projects for current user
  useEffect(() => {
    if (!currentUid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'projects'),
      where('ownerUid', '==', currentUid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Project[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            name: data.name || 'Untitled',
            slug: data.slug || doc.id,
            description: data.description,
            stack: data.stack,
            ownerUid: data.ownerUid,
          });
        });
        setProjects(list);
        setLoading(false);
      },
      (err) => {
        console.error('[useProjectsFirestore] error:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentUid]);

  return { projects, loading, error };
}
