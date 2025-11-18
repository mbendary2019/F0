import { doc, writeBatch, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Phase, Task, ChatMessage } from '@/types/project';
import { logActivity } from './activity';
import { phaseIdFromTitle, taskIdFromTitle, planFingerprint } from '@/lib/plan/hash';

export async function upsertPhasesAndTasks(projectId: string, phases: Phase[], tasksByPhase: Record<string, Task[]>) {
  const now = Date.now();

  // Calculate fingerprint to detect changes
  const phaseStructure = phases.map(p => ({
    title: p.title,
    tasks: (tasksByPhase[p.id] || []).map(t => t.title)
  }));
  const fingerprint = planFingerprint(phaseStructure);

  // Check if plan changed
  const projectDoc = await getDoc(doc(db, `projects/${projectId}`));
  const prevFingerprint = projectDoc.data()?.plan?.fingerprint;

  if (prevFingerprint === fingerprint) {
    console.log('⏭️ Plan unchanged - skipping update');
    return { skipped: true };
  }

  // Update project metadata
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

  // Batch write phases and tasks
  const batch = writeBatch(db);

  for (const ph of phases) {
    // Use deterministic ID if not provided
    const phaseId = ph.id || phaseIdFromTitle(ph.title);
    const pRef = doc(db, `projects/${projectId}/phases/${phaseId}`);
    batch.set(pRef, { ...ph, id: phaseId, updatedAt: now }, { merge: true });

    const tasks = tasksByPhase[ph.id] || tasksByPhase[phaseId] || [];
    for (const t of tasks) {
      // Use deterministic ID if not provided
      const taskId = t.id || taskIdFromTitle(ph.title, t.title);
      const tRef = doc(db, `projects/${projectId}/tasks/${taskId}`);
      batch.set(tRef, { ...t, id: taskId, phaseId, updatedAt: now }, { merge: true });
    }
  }
  await batch.commit();
  await logActivity(projectId, `Plan updated: ${phases.length} phases`);

  return { skipped: false, fingerprint };
}

export async function syncFromAgentReply(projectId: string, reply: ChatMessage) {
  // هذه تقوم بتحويل رد الوكيل إلى phases + tasks
  const { extractPhasesFromText, draftTasksForPhase } = await import('./phaseParser');
  const phases = extractPhasesFromText(reply.text);
  const tasksByPhase: Record<string, Task[]> = {};
  for (const ph of phases) {
    tasksByPhase[ph.id] = draftTasksForPhase(ph.id, reply.text);
  }
  await upsertPhasesAndTasks(projectId, phases, tasksByPhase);
}
