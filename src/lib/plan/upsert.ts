/**
 * Idempotent plan upsertion system
 * Prevents duplicate phases/tasks by using deterministic IDs
 */

import { doc, setDoc, getDoc, collection, addDoc, increment } from 'firebase/firestore';
import { phaseIdFromTitle, taskIdFromTitle, planFingerprint } from './hash';

export interface Phase {
  title: string;
  tasks: Array<string | { title: string; desc?: string; tags?: string[] }>;
}

export interface UpsertOptions {
  skipIfUnchanged?: boolean; // Skip update if fingerprint matches
  logActivity?: boolean; // Log to activity collection
}

/**
 * Upsert plan with idempotency - updates existing docs instead of creating duplicates
 */
export async function upsertPlan(
  db: any,
  projectId: string,
  phases: Phase[],
  options: UpsertOptions = { skipIfUnchanged: true, logActivity: true }
) {
  const now = Date.now();
  const fingerprint = planFingerprint(phases);

  // Check if plan changed
  if (options.skipIfUnchanged) {
    const projectDoc = await getDoc(doc(db, `projects/${projectId}`));
    const prevFingerprint = projectDoc.data()?.plan?.fingerprint;

    if (prevFingerprint === fingerprint) {
      console.log('⏭️ Plan unchanged - skipping update');
      return { skipped: true, fingerprint };
    }
  }

  // Update project metadata with new fingerprint
  await setDoc(
    doc(db, `projects/${projectId}`),
    {
      plan: {
        fingerprint,
        updatedAt: now,
        phasesCount: phases.length,
        version: increment(1)
      }
    },
    { merge: true }
  );

  // Upsert phases and tasks
  for (const phase of phases) {
    const phaseId = phaseIdFromTitle(phase.title);

    // Upsert phase document
    await setDoc(
      doc(db, `projects/${projectId}/phases/${phaseId}`),
      {
        id: phaseId,
        title: phase.title,
        status: 'open',
        progress: 0,
        updatedAt: now
      },
      { merge: true }
    );

    // Upsert tasks for this phase
    for (const task of phase.tasks) {
      const taskTitle = typeof task === 'string' ? task : task.title;
      const taskDesc = typeof task === 'object' ? task.desc : undefined;
      const taskTags = typeof task === 'object' ? task.tags : undefined;

      const taskId = taskIdFromTitle(phase.title, taskTitle);

      await setDoc(
        doc(db, `projects/${projectId}/tasks/${taskId}`),
        {
          id: taskId,
          phaseId,
          title: taskTitle,
          desc: taskDesc || '',
          tags: taskTags || [],
          status: 'open',
          source: 'agent',
          updatedAt: now
        },
        { merge: true }
      );
    }
  }

  // Log activity
  if (options.logActivity) {
    await addDoc(collection(db, `projects/${projectId}/activity`), {
      type: 'plan_updated',
      title: 'Plan updated by agent',
      meta: {
        phasesCount: phases.length,
        tasksCount: phases.reduce((sum, p) => sum + p.tasks.length, 0),
        fingerprint
      },
      createdAt: now
    });
  }

  return { skipped: false, fingerprint, phasesCount: phases.length };
}
