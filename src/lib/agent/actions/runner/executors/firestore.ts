// src/lib/agent/actions/runner/executors/firestore.ts

import {
  AnyAction,
  ActionExecutionResult,
} from '@/lib/agent/actions/actionTypes';
import { firestoreAdmin } from '@/lib/server/firebase';

function now() {
  return Date.now();
}

/**
 * Main entry point for FIRESTORE actions:
 * - CREATE_FIRESTORE_DOC
 * - UPDATE_FIRESTORE_DOC
 * - DELETE_FIRESTORE_DOC
 */
export async function runFirestoreAction(
  action: AnyAction
): Promise<ActionExecutionResult> {
  const start = now();
  const logs: string[] = [];

  try {
    switch (action.action) {
      case 'CREATE_FIRESTORE_DOC':
        return await handleCreateDoc(action, logs, start);

      case 'UPDATE_FIRESTORE_DOC':
        return await handleUpdateDoc(action, logs, start);

      case 'DELETE_FIRESTORE_DOC':
        return await handleDeleteDoc(action, logs, start);

      default:
        return {
          status: 'ERROR',
          startedAt: start,
          finishedAt: now(),
          logs: [
            `❌ [FIRESTORE] Unsupported action: ${(action as any).action}`,
          ],
          error: {
            message: `Unsupported FIRESTORE action: ${(action as any).action}`,
          },
        };
    }
  } catch (err: any) {
    logs.push('❌ [FIRESTORE] Exception during execution');
    logs.push(String(err?.message || err));

    return {
      status: 'ERROR',
      startedAt: start,
      finishedAt: now(),
      logs,
      error: {
        message: String(err?.message || 'Unknown Firestore error'),
        details: err,
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                               Handlers                                     */
/* -------------------------------------------------------------------------- */

async function handleCreateDoc(
  action: any,
  logs: string[],
  startedAt: number
): Promise<ActionExecutionResult> {
  const { collectionPath, docId, data } = action;

  if (!collectionPath) {
    throw new Error('[FIRESTORE] CREATE_FIRESTORE_DOC missing collectionPath');
  }

  const col = firestoreAdmin.collection(collectionPath);

  logs.push(
    `🔥 [CREATE_FIRESTORE_DOC] collection: ${collectionPath}, docId: ${
      docId || '(auto)'
    }`
  );

  let ref;
  if (docId) {
    ref = col.doc(docId);
    await ref.set(data ?? {}, { merge: false });
  } else {
    ref = await col.add(data ?? {});
  }

  logs.push(`✅ Document created: ${ref.path}`);

  return {
    status: 'SUCCESS',
    startedAt,
    finishedAt: now(),
    logs,
    output: {
      operation: 'CREATE_FIRESTORE_DOC',
      path: ref.path,
      collectionPath,
      docId: ref.id,
    },
  };
}

async function handleUpdateDoc(
  action: any,
  logs: string[],
  startedAt: number
): Promise<ActionExecutionResult> {
  const { collectionPath, docId, data, merge = true } = action;

  if (!collectionPath || !docId) {
    throw new Error(
      '[FIRESTORE] UPDATE_FIRESTORE_DOC missing collectionPath or docId'
    );
  }

  const ref = firestoreAdmin.collection(collectionPath).doc(docId);

  logs.push(
    `📝 [UPDATE_FIRESTORE_DOC] ${collectionPath}/${docId} (merge: ${merge})`
  );

  if (!data || Object.keys(data).length === 0) {
    logs.push('⚠️ No update data provided, skipping.');
    return {
      status: 'SUCCESS',
      startedAt,
      finishedAt: now(),
      logs,
      output: {
        operation: 'UPDATE_FIRESTORE_DOC',
        path: ref.path,
        updated: false,
      },
    };
  }

  if (merge) {
    await ref.set(data, { merge: true });
  } else {
    await ref.update(data);
  }

  logs.push('✅ Document updated.');

  return {
    status: 'SUCCESS',
    startedAt,
    finishedAt: now(),
    logs,
    output: {
      operation: 'UPDATE_FIRESTORE_DOC',
      path: ref.path,
      updated: true,
    },
  };
}

async function handleDeleteDoc(
  action: any,
  logs: string[],
  startedAt: number
): Promise<ActionExecutionResult> {
  const { collectionPath, docId } = action;

  if (!collectionPath || !docId) {
    throw new Error(
      '[FIRESTORE] DELETE_FIRESTORE_DOC missing collectionPath or docId'
    );
  }

  const ref = firestoreAdmin.collection(collectionPath).doc(docId);

  logs.push(`🗑 [DELETE_FIRESTORE_DOC] ${collectionPath}/${docId}`);

  await ref.delete();

  logs.push('✅ Document deleted.');

  return {
    status: 'SUCCESS',
    startedAt,
    finishedAt: now(),
    logs,
    output: {
      operation: 'DELETE_FIRESTORE_DOC',
      path: ref.path,
      deleted: true,
    },
  };
}
