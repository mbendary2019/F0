// src/hooks/useFileSave.ts
// =============================================================================
// Phase 152.2 – Save file content to Firestore
// Phase 152.3 – Also enqueue to fileWrites for Desktop sync
// =============================================================================
// Phase 152 – Web Code Editor v1 (LOCKED)
// NOTE: Any major behavioral changes should be done in Phase >= 153.
// =============================================================================

'use client';

import { useState, useCallback } from 'react';
import { db } from '@/lib/firebaseClient';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// =============================================================================
// Types
// =============================================================================
export type FileSaveResult = {
  isSaving: boolean;
  error: string | null;
  lastSavedAt: Date | null;
  saveFile: (relativePath: string, content: string) => Promise<boolean>;
};

// =============================================================================
// Hook
// =============================================================================
export function useFileSave(projectId: string | null): FileSaveResult {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const saveFile = useCallback(
    async (relativePath: string, content: string): Promise<boolean> => {
      if (!projectId || !relativePath) {
        console.warn('[152.2][WEB][SAVE] Missing projectId or relativePath');
        return false;
      }

      setIsSaving(true);
      setError(null);

      try {
        // Encode the path for Firestore document ID (replace / with __)
        const docId = relativePath.replace(/\//g, '__');
        const fileRef = doc(db, 'projects', projectId, 'files', docId);

        // Update file content in Firestore
        await updateDoc(fileRef, {
          content,
          lastContentSyncAt: serverTimestamp(),
          lastModifiedBy: 'web',
        });

        console.log('[152.2][WEB][SAVE] File content saved to Firestore', {
          projectId,
          relativePath,
          contentLength: content.length,
        });

        // Phase 152.3: Enqueue to fileWrites for Desktop sync
        const writesCol = collection(db, 'projects', projectId, 'fileWrites');
        await addDoc(writesCol, {
          path: relativePath,
          content,
          requestedAt: serverTimestamp(),
          source: 'web',
          status: 'pending',
        });

        console.log('[152.3][WEB][WRITE_QUEUE] Enqueued file write for Desktop sync', {
          projectId,
          relativePath,
        });

        setLastSavedAt(new Date());
        return true;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[152.2][WEB][SAVE] Failed to save file', err);
        setError(errorMessage);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [projectId]
  );

  return { isSaving, error, lastSavedAt, saveFile };
}

export default useFileSave;
