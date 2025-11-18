/**
 * Task Management with Idempotent Upsert
 * Prevents task duplication using deterministic IDs and transactions
 */

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { taskKey, phaseKey } from '@/lib/ids';

export type TaskInput = {
  projectId: string;
  phaseKey: string;
  title: string;
  description?: string;
  status?: 'todo' | 'doing' | 'done';
  tags?: string[];
  source?: {
    type: 'agent' | 'user';
    messageId?: string;
    agentId?: string;
  };
};

/**
 * Upsert task with transaction guarantee
 * - If task exists: updates description, phaseKey, source (preserves user status)
 * - If task doesn't exist: creates new task with default status
 */
export async function upsertTask(t: TaskInput): Promise<string> {
  const id = taskKey(t.phaseKey, t.title);
  const ref = doc(db, 'projects', t.projectId, 'tasks', id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (snap.exists()) {
      // Task exists - update without overwriting user state
      const prev = snap.data() as any;

      tx.update(ref, {
        description: t.description ?? prev.description ?? '',
        phaseKey: t.phaseKey,
        tags: t.tags ?? prev.tags ?? [],
        source: t.source ?? prev.source ?? null,
        updatedAt: serverTimestamp(),
        // IMPORTANT: Don't overwrite status or progress if user has modified them
      });

      console.log(`✅ [upsertTask] Updated existing: ${id}`);
    } else {
      // Task doesn't exist - create new
      tx.set(ref, {
        title: t.title,
        description: t.description ?? '',
        phaseKey: t.phaseKey,
        status: t.status ?? 'todo',
        progress: 0,
        tags: t.tags ?? [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: t.source ?? null,
      });

      console.log(`✅ [upsertTask] Created new: ${id}`);
    }
  });

  return id;
}

/**
 * Upsert phase with transaction guarantee
 */
export async function upsertPhase(input: {
  projectId: string;
  title: string;
  order: number;
  status?: 'pending' | 'active' | 'completed';
  locale?: 'ar' | 'en';
}): Promise<string> {
  const id = phaseKey(input.title);
  const ref = doc(db, 'projects', input.projectId, 'phases', id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (snap.exists()) {
      // Update existing phase
      const prev = snap.data() as any;

      tx.update(ref, {
        order: input.order,
        locale: input.locale ?? prev.locale ?? 'ar',
        updatedAt: serverTimestamp(),
        // Don't overwrite status if user has modified it
      });

      console.log(`✅ [upsertPhase] Updated existing: ${id}`);
    } else {
      // Create new phase
      tx.set(ref, {
        title: input.title,
        order: input.order,
        status: input.status ?? 'pending',
        progress: 0,
        locale: input.locale ?? 'ar',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log(`✅ [upsertPhase] Created new: ${id}`);
    }
  });

  return id;
}

/**
 * Batch upsert tasks for a phase
 * More efficient than individual upserts
 */
export async function upsertTasksBatch(
  projectId: string,
  phaseKey: string,
  tasks: Array<{
    title: string;
    description?: string;
    tags?: string[];
  }>,
  source?: TaskInput['source']
): Promise<string[]> {
  const ids: string[] = [];

  // Use sequential upserts to maintain transaction guarantees
  // Note: Firestore doesn't support batch transactions across documents
  for (const task of tasks) {
    const id = await upsertTask({
      projectId,
      phaseKey,
      title: task.title,
      description: task.description,
      tags: task.tags,
      source,
    });
    ids.push(id);
  }

  return ids;
}
