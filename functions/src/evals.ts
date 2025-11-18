/**
 * Scheduled Evaluation Cloud Functions
 * Nightly evals, hourly red-team, and drift detection
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const db = admin.firestore();

/**
 * Get date key in YYYYMMDD format
 */
function getDateKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * List active experiments
 */
async function listActiveExperiments() {
  const snap = await db
    .collection('eval_experiments')
    .where('active', '==', true)
    .get();

  const experiments: any[] = [];
  snap.forEach((doc) => {
    experiments.push({ id: doc.id, ...doc.data() });
  });

  return experiments;
}

/**
 * Enqueue an evaluation run
 */
async function enqueueRun(params: {
  expId: string;
  model: string;
  promptId: string;
  sampleSize: number;
}): Promise<string> {
  const { expId, model, promptId, sampleSize } = params;

  const runRef = await db.collection('eval_runs').add({
    expId,
    model,
    promptId,
    sampleSize,
    status: 'queued',
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[enqueueRun] Created run ${runRef.id} for experiment ${expId}`);
  return runRef.id;
}

/**
 * Nightly Evaluations
 * Runs all active experiments once per day
 */
export const nightlyEvals = onSchedule({ schedule: 'every 24 hours', timeZone: 'UTC' }, async (event) => {
    console.log('[nightlyEvals] Starting nightly evaluation runs');

    try {
      const experiments = await listActiveExperiments();

      if (experiments.length === 0) {
        console.log('[nightlyEvals] No active experiments found');
        return null;
      }

      console.log(`[nightlyEvals] Found ${experiments.length} active experiments`);

      const runIds: string[] = [];

      for (const exp of experiments) {
        const defaultModel = exp.defaultModel || 'gpt-4o-mini';
        const defaultPromptId = exp.defaultPromptId || 'default';
        const defaultSampleSize = exp.defaultSampleSize || Number(process.env.EVALS_SAMPLE_SIZE || 100);

        const runId = await enqueueRun({
          expId: exp.id,
          model: defaultModel,
          promptId: defaultPromptId,
          sampleSize: defaultSampleSize,
        });

        runIds.push(runId);
      }

      console.log(`[nightlyEvals] Enqueued ${runIds.length} evaluation runs`);
      return null;

    } catch (error: any) {
      console.error('[nightlyEvals] Error:', error);
      throw error;
    }
  });

/**
 * Hourly Red Team Audits
 * Tests critical prompts against adversarial attacks
 */
export const hourlyRedTeam = onSchedule({ schedule: `every ${process.env.REDTEAM_INTERVAL_MINUTES || 60} minutes`, timeZone: 'UTC' }, async (event) => {
    console.log('[hourlyRedTeam] Starting red team audits');

    try {
      // Get prompts marked for red team testing
      const snap = await db
        .collection('prompt_targets')
        .where('redteam', '==', true)
        .get();

      if (snap.empty) {
        console.log('[hourlyRedTeam] No prompts marked for red team testing');
        return null;
      }

      console.log(`[hourlyRedTeam] Found ${snap.size} prompts to audit`);

      const queued: string[] = [];

      for (const doc of snap.docs) {
        const data = doc.data();
        const model = data.model || 'gpt-4o-mini';

        // Add to audit queue
        const queueRef = await db.collection('prompt_audit_queue').add({
          promptId: doc.id,
          model,
          enqueuedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        queued.push(queueRef.id);
      }

      console.log(`[hourlyRedTeam] Queued ${queued.length} audits`);
      return null;

    } catch (error: any) {
      console.error('[hourlyRedTeam] Error:', error);
      throw error;
    }
  });

/**
 * Drift Detector
 * Monitors model performance degradation
 */
export const driftDetector = onSchedule({ schedule: 'every 60 minutes', timeZone: 'UTC' }, async (event) => {
    console.log('[driftDetector] Starting drift detection');

    try {
      const dateKey = getDateKey();

      // Trigger drift check by creating a marker document
      // The actual drift detection logic runs server-side via scheduled task or API call
      await db.collection('drift_checks').add({
        dateKey,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log('[driftDetector] Created drift check marker');

      // Optional: Run drift detection inline (can be resource-intensive)
      // Alternatively, trigger via HTTP function or separate worker
      /*
      const { checkAllModelsDrift } = require('./drift'); // Would need to import server utils
      const result = await checkAllModelsDrift();
      console.log(`[driftDetector] Checked ${result.models_checked} models, found ${result.drift_detected.length} drifting metrics`);
      */

      return null;

    } catch (error: any) {
      console.error('[driftDetector] Error:', error);
      throw error;
    }
  });
