/**
 * Phase 92: Real-time Tasks Hook
 *
 * Subscribes to Firestore tasks collection for live updates
 * Returns tasks array sorted by creation time
 *
 * Phase 93.5 Update:
 * - Supports both 'projects' and 'ops_projects' collections
 * - Filters out archived tasks
 * - Supports new stable ID task format (phase-1-task-1, etc.)
 */

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';

export interface Task {
  id: string;
  title: string;
  description?: string;
  agent?: 'UI_AGENT' | 'DB_AGENT' | 'IDE_AGENT' | 'BACKEND_AGENT' | 'DEPLOY_AGENT';
  type?: string;
  mode?: 'chat' | 'refactor' | 'deploy' | 'plan' | 'explain';
  input?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'NEW' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
  priority?: 'low' | 'medium' | 'high';
  difficulty?: 'low' | 'medium' | 'high';
  phaseId: string;
  createdAt: any;
  updatedAt?: any;
  startedAt?: any;
  completedAt?: any;
  output?: any;
  logs?: string[];
  archived?: boolean;
}

interface UseProjectTasksOptions {
  useOpsCollection?: boolean;
}

export function useProjectTasks(
  projectId: string | null,
  phaseId?: string | null,
  options: UseProjectTasksOptions = {}
) {
  const { useOpsCollection = true } = options; // Default to ops_projects
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const collectionName = useOpsCollection ? 'ops_projects' : 'projects';

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const tasksRef = collection(db, collectionName, projectId, 'tasks');

    // Build query - filter by phaseId if provided
    let q = query(tasksRef, orderBy('createdAt', 'asc'));
    if (phaseId) {
      q = query(tasksRef, where('phaseId', '==', phaseId), orderBy('createdAt', 'asc'));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasksData: Task[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Filter out archived tasks
          if (data.archived) {
            return;
          }
          tasksData.push({
            id: doc.id,
            ...data,
          } as Task);
        });
        setTasks(tasksData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching tasks:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId, phaseId, collectionName]);

  return { tasks, loading, error };
}
