'use client';

/**
 * Phase 97.1: Hook to fetch project details including previewUrl
 * Uses Firestore real-time listener for live updates
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import type { F0Project } from '@/types/project';

interface UseProjectDetailsResult {
  project: F0Project | null;
  loading: boolean;
  error: string | null;
}

export function useProjectDetails(projectId: string | undefined): UseProjectDetailsResult {
  const [project, setProject] = useState<F0Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Listen to project document in real-time
    const projectRef = doc(db, 'projects', projectId);

    const unsubscribe = onSnapshot(
      projectRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setProject({
            id: docSnapshot.id,
            ownerUid: data.ownerUid || '',
            name: data.name || '',
            shortDescription: data.shortDescription,
            techStack: data.techStack,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            status: data.status || 'active',
            projectType: data.projectType,
            platforms: data.platforms,
            framework: data.framework,
            usesFirebase: data.usesFirebase,
            usesStripe: data.usesStripe,
            usesVercel: data.usesVercel,
            branding: data.branding,
            previewUrl: data.previewUrl,
          } as F0Project);
        } else {
          setProject(null);
          setError('Project not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('[useProjectDetails] Error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  return { project, loading, error };
}
