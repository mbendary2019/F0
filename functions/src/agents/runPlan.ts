import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { reserveAndUpsertTask, reserveAndUpsertPhase } from './tasks';

// Initialize admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Generate SHA1 hash of a string
 */
const sha1 = (str: string): string => {
  return crypto.createHash('sha1').update(str).digest('hex');
};

/**
 * onRunPlan - Execute plan without duplication
 * Creates/updates phases and tasks with deterministic IDs using canonical slugs
 */
export const onRunPlan = functions.https.onCall(async (data: any, context: any) => {
  const { projectId, plan, locale = 'ar' } = data;

  // Validation
  if (!projectId || !plan) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      locale === 'ar' ? 'projectId أو plan مفقود' : 'projectId or plan required'
    );
  }

  // Check auth (skip in emulator for development)
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  if (!context.auth?.uid && !isEmulator) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      locale === 'ar' ? 'يجب تسجيل الدخول' : 'Authentication required'
    );
  }

  const projectRef = db.collection('projects').doc(projectId);
  const metaRef = projectRef.collection('meta').doc('runner');

  // Prevent duplicate execution of same plan (check content hash)
  const planHash = sha1(JSON.stringify(plan));
  const metaSnap = await metaRef.get();

  if (metaSnap.exists && metaSnap.get('lastPlanHash') === planHash) {
    return {
      ok: true,
      skipped: true,
      message:
        locale === 'ar'
          ? '⏭️ نفس الخطة تم تنفيذها مسبقاً'
          : '⏭️ Same plan already executed',
    };
  }

  let phaseCount = 0;
  let taskCount = 0;

  // Process each phase using reserveAndUpsert for distributed lock
  for (const ph of plan.phases || []) {
    const pKey = await reserveAndUpsertPhase({
      projectId,
      title: ph.title || ph.name || 'Untitled Phase',
      order: phaseCount,
      status: ph.status ?? 'pending',
      locale: locale as 'ar' | 'en',
    });

    phaseCount++;

    // Process tasks in this phase
    for (const tk of ph.tasks || []) {
      await reserveAndUpsertTask({
        projectId,
        phaseKey: pKey,
        title: tk.title || 'Untitled Task',
        description: tk.desc ?? '',
        tags: tk.tags ?? [],
        status: tk.status ?? 'todo',
        locale: locale as 'ar' | 'en',
        source: {
          type: 'agent',
          agentId: 'onRunPlan',
        },
      });

      taskCount++;
    }
  }

  // Log execution activity and update metadata in batch
  const batch = db.batch();

  const execRef = projectRef.collection('activity').doc();
  batch.set(execRef, {
    type: 'system',
    action: 'run_plan',
    title:
      locale === 'ar'
        ? `تم تنفيذ الخطة: ${phaseCount} مراحل، ${taskCount} مهام`
        : `Plan executed: ${phaseCount} phases, ${taskCount} tasks`,
    user: context.auth?.uid || 'anonymous',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update project metadata and store plan hash
  batch.set(
    projectRef,
    {
      meta: {
        planExecuted: true,
        planVersion: 1,
        lastExecutedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Store plan hash to prevent re-execution of same plan
  batch.set(
    metaRef,
    {
      lastPlanHash: planHash,
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Commit metadata updates
  await batch.commit();

  return {
    ok: true,
    message:
      locale === 'ar'
        ? `✅ تم التنفيذ بنجاح: ${phaseCount} مراحل و ${taskCount} مهام`
        : `✅ Executed successfully: ${phaseCount} phases and ${taskCount} tasks`,
    stats: {
      phases: phaseCount,
      tasks: taskCount,
    },
  };
});
