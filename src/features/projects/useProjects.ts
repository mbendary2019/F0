import { useMemo } from 'react';
import { isMockMode } from '@/lib/mock';
import type { Project } from './types';
import { mockProjects } from '@/mocks/projectsMock';
import { useProjectsFirestore } from './useProjects.firestore';

export function useProjects(): {
  projects: Project[];
  loading: boolean;
  error: Error | null;
} {
  if (isMockMode()) {
    const projects = useMemo(() => mockProjects, []);
    return { projects, loading: false, error: null };
  }
  return useProjectsFirestore();
}
