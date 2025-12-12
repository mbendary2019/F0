/**
 * Phase 92: Real-time Phases Hook
 *
 * Subscribes to Firestore phases collection for live updates
 * Returns phases array sorted by index (stable ID order)
 *
 * Phase 93.5 Update:
 * - Supports both 'projects' and 'ops_projects' collections
 * - Filters out archived phases
 * - Uses 'index' for ordering (stable IDs use index: 1, 2, 3...)
 */

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';

export interface Phase {
  id: string;
  title: string;
  index?: number; // New stable ID field
  order?: number; // Legacy field
  status: 'pending' | 'active' | 'completed' | 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
  completion?: number; // 0-100 percentage
  createdAt?: any;
  tasksCount?: number;
  completedTasksCount?: number;
  startedAt?: any;
  completedAt?: any;
  archived?: boolean;
}

interface UseProjectPhasesOptions {
  useOpsCollection?: boolean;
}

export function useProjectPhases(
  projectId: string | null,
  options: UseProjectPhasesOptions = {}
) {
  const { useOpsCollection = true } = options; // Default to ops_projects
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const collectionName = useOpsCollection ? 'ops_projects' : 'projects';

  useEffect(() => {
    if (!projectId) {
      setPhases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const phasesRef = collection(db, collectionName, projectId, 'phases');
    // Order by index (stable IDs) with fallback to order (legacy)
    const q = query(phasesRef, orderBy('index', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const phasesData: Phase[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Filter out archived phases
          if (data.archived) {
            return;
          }
          phasesData.push({
            id: doc.id,
            ...data,
          } as Phase);
        });
        setPhases(phasesData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching phases:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId, collectionName]);

  return { phases, loading, error };
}
