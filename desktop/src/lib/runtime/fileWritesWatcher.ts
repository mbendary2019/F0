// desktop/src/lib/runtime/fileWritesWatcher.ts
// =============================================================================
// Phase 152.3 – Desktop watcher for web file writes
// Listens to fileWrites queue and applies changes to local filesystem
// =============================================================================
// Phase 152 – Web Code Editor v1 (LOCKED)
// NOTE: Any major behavioral changes should be done in Phase >= 153.
// =============================================================================

import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================
type FileWriteDoc = {
  path: string;
  content: string;
  requestedAt: Date;
  source: 'web';
  status: 'pending' | 'applied' | 'failed';
  appliedAt?: Date;
  error?: string;
};

type FileWritesWatcherOptions = {
  projectId: string;
  projectRoot: string;
  firestore: FirebaseFirestore.Firestore;
  onApplied?: (path: string) => void;
  onError?: (path: string, error: string) => void;
};

// =============================================================================
// Watcher Function
// =============================================================================
export function startFileWritesWatcher({
  projectId,
  projectRoot,
  firestore,
  onApplied,
  onError,
}: FileWritesWatcherOptions): Unsubscribe {
  console.log('[152.3][DESKTOP][FILE_WRITES] Starting watcher', {
    projectId,
    projectRoot,
  });

  const writesRef = collection(firestore, 'projects', projectId, 'fileWrites');
  const q = query(writesRef, where('status', '==', 'pending'));

  const unsub = onSnapshot(
    q,
    async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'added') continue;

        const docSnap = change.doc;
        const data = docSnap.data() as FileWriteDoc;
        const docId = docSnap.id;

        const relativePath = data.path;
        const content = data.content;

        console.log('[152.3][DESKTOP][FILE_WRITE] Processing pending write', {
          docId,
          relativePath,
          contentLength: content?.length || 0,
        });

        // Build full file path
        const filePath = path.join(projectRoot, relativePath);
        const fileDir = path.dirname(filePath);

        try {
          // Ensure directory exists
          if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
            console.log('[152.3][DESKTOP][FILE_WRITE] Created directory', { fileDir });
          }

          // Write file
          fs.writeFileSync(filePath, content, 'utf8');

          // Mark as applied in Firestore
          await updateDoc(doc(writesRef, docId), {
            status: 'applied',
            appliedAt: serverTimestamp(),
          });

          console.log('[152.3][DESKTOP][FILE_WRITE] Applied successfully', {
            relativePath,
            filePath,
          });

          onApplied?.(relativePath);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error('[152.3][DESKTOP][FILE_WRITE] Failed to apply', {
            relativePath,
            error: errorMessage,
          });

          // Mark as failed in Firestore
          await updateDoc(doc(writesRef, docId), {
            status: 'failed',
            error: errorMessage,
          });

          onError?.(relativePath, errorMessage);
        }
      }
    },
    (error) => {
      console.error('[152.3][DESKTOP][FILE_WRITES] Listener error', error);
    }
  );

  return unsub;
}

export default startFileWritesWatcher;
