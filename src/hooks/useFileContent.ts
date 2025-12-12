// src/hooks/useFileContent.ts
// =============================================================================
// Phase 151.3.2 – Web Hook for single file content
// Fetches file content from Firestore for display in CodeViewer
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';

export type FileContentState = {
  loading: boolean;
  notFound: boolean;
  isText: boolean;
  content: string;
  language: string | null;
  size: number;
  relativePath: string | null;
};

const INITIAL_STATE: FileContentState = {
  loading: true,
  notFound: false,
  isText: true,
  content: '',
  language: null,
  size: 0,
  relativePath: null,
};

/**
 * Hook to fetch file content from Firestore
 * @param projectId - The project ID
 * @param relativePath - The file path relative to project root (e.g., "src/app/page.tsx")
 */
export function useFileContent(
  projectId: string | null,
  relativePath: string | null
): FileContentState {
  const [state, setState] = useState<FileContentState>(INITIAL_STATE);

  useEffect(() => {
    // Reset if no project or path
    if (!projectId || !relativePath) {
      setState({
        ...INITIAL_STATE,
        loading: false,
        notFound: !relativePath,
        relativePath: null,
      });
      return;
    }

    // Encode the path for Firestore document ID (replace / with __)
    const docId = relativePath.replace(/\//g, '__');
    const ref = doc(db, 'projects', projectId, 'files', docId);

    setState((prev) => ({ ...prev, loading: true, relativePath }));

    console.log('[151.3][WEB][FILE_CONTENT] Subscribing to', { projectId, relativePath, docId });

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setState({
            loading: false,
            notFound: true,
            isText: true,
            content: '',
            language: null,
            size: 0,
            relativePath,
          });
          console.warn('[151.3][WEB][FILE_CONTENT] Not found', { projectId, relativePath });
          return;
        }

        const data = snap.data();
        const content = data.content ?? data.snippet ?? '';

        setState({
          loading: false,
          notFound: false,
          isText: data.isText !== false,
          content,
          language: data.lang ?? data.language ?? null,
          size: data.sizeBytes ?? data.size ?? content.length,
          relativePath,
        });

        console.log('[151.3][WEB][FILE_CONTENT] Loaded', {
          projectId,
          relativePath,
          size: content.length,
          language: data.lang ?? data.language,
        });
      },
      (err) => {
        console.error('[151.3][WEB][FILE_CONTENT] Error', err);
        setState((prev) => ({
          ...prev,
          loading: false,
          notFound: true,
        }));
      }
    );

    return () => unsub();
  }, [projectId, relativePath]);

  return state;
}

export default useFileContent;
