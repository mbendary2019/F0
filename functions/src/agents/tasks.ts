/**
 * Task Management with Distributed Locking
 * Prevents race conditions between multiple agents
 */

import * as admin from 'firebase-admin';

/**
 * Slugify text to create stable identifiers
 * Supports Arabic and English characters
 */
export function slugify(s: string): string {
  if (!s) return '';

  return s
    .toLowerCase()
    .trim()
    .replace(/[^\u0600-\u06FF\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Generate deterministic phase key
 */
export function phaseKey(title: string): string {
  const slug = slugify(title);
  return `phase-${slug || 'untitled'}`;
}

/**
 * Generate deterministic task key
 * Format: {phaseKey}__{taskSlug}
 */
export function taskKey(phaseKey: string, title: string): string {
  const slug = slugify(title);
  return `${phaseKey}__${slug || 'untitled'}`;
}

export type TaskInput = {
  projectId: string;
  phaseKey: string;
  title: string;
  description?: string;
  status?: 'todo' | 'doing' | 'done';
  tags?: string[];
  locale?: 'ar' | 'en';
  source?: {
    type: 'agent' | 'user';
    messageId?: string;
    agentId?: string;
  };
};

/**
 * Reserve and upsert task with distributed lock
 * Prevents race conditions between multiple agents
 */
export async function reserveAndUpsertTask(t: TaskInput): Promise<string> {
  const id = taskKey(t.phaseKey, t.title);
  const db = admin.firestore();
  const taskRef = db.doc(`projects/${t.projectId}/tasks/${id}`);
  const keyRef = db.doc(`projects/${t.projectId}/task_keys/${id}`); // Lock reservation

  await db.runTransaction(async (tx) => {
    const keySnap = await tx.get(keyRef);

    // Reserve key if not exists (first-time lock)
    if (!keySnap.exists) {
      tx.create(keyRef, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        reservedBy: t.source?.agentId || 'agent',
      });
    }

    // Check if task exists
    const taskSnap = await tx.get(taskRef);

    if (taskSnap.exists) {
      // Task exists - update without overwriting user state
      const prev = taskSnap.data() as any;

      tx.update(taskRef, {
        description: t.description ?? prev.description ?? '',
        phaseKey: t.phaseKey,
        tags: t.tags ?? prev.tags ?? [],
        locale: t.locale ?? prev.locale ?? 'ar',
        source: t.source ?? prev.source ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // IMPORTANT: Don't overwrite status or progress if user has modified them
      });

      console.log(`✅ [reserveAndUpsertTask] Updated existing: ${id}`);
    } else {
      // Task doesn't exist - create new
      tx.create(taskRef, {
        title: t.title,
        description: t.description ?? '',
        phaseKey: t.phaseKey,
        status: t.status ?? 'todo',
        progress: 0,
        tags: t.tags ?? [],
        locale: t.locale ?? 'ar',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: t.source ?? null,
      });

      console.log(`✅ [reserveAndUpsertTask] Created new: ${id}`);
    }
  });

  return id;
}

/**
 * Reserve and upsert phase
 */
export async function reserveAndUpsertPhase(input: {
  projectId: string;
  title: string;
  order: number;
  status?: 'pending' | 'active' | 'completed';
  locale?: 'ar' | 'en';
}): Promise<string> {
  const id = phaseKey(input.title);
  const db = admin.firestore();
  const phaseRef = db.doc(`projects/${input.projectId}/phases/${id}`);
  const keyRef = db.doc(`projects/${input.projectId}/phase_keys/${id}`);

  await db.runTransaction(async (tx) => {
    const keySnap = await tx.get(keyRef);

    // Reserve key if not exists
    if (!keySnap.exists) {
      tx.create(keyRef, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const phaseSnap = await tx.get(phaseRef);

    if (phaseSnap.exists) {
      // Update existing phase
      const prev = phaseSnap.data() as any;

      tx.update(phaseRef, {
        order: input.order,
        locale: input.locale ?? prev.locale ?? 'ar',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Don't overwrite status if user has modified it
      });

      console.log(`✅ [reserveAndUpsertPhase] Updated existing: ${id}`);
    } else {
      // Create new phase
      tx.create(phaseRef, {
        title: input.title,
        order: input.order,
        status: input.status ?? 'pending',
        progress: 0,
        locale: input.locale ?? 'ar',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ [reserveAndUpsertPhase] Created new: ${id}`);
    }
  });

  return id;
}
