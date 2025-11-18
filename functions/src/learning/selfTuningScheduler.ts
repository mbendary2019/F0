/**
 * Phase 37 - Self-Tuning Scheduler
 * Dynamically adjusts agent execution cadence based on performance metrics
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { FLAGS } from "../config/flags";
import { v4 as uuid } from "uuid";
import { DecisionRecord } from "../types/meta";

const db = admin.firestore();

export const selfTuningScheduler = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "UTC",
    retryCount: 2,
  },
  async (event) => {
    if (!FLAGS.scheduler.autoTune) {
      console.log('[selfTuningScheduler] Auto-tune disabled');
      return;
    }

    try {
      console.log('[selfTuningScheduler] Starting scheduler tuning');

      // Example: adjust Watchdog cadence based on err rate / reward
      const sSnap = await db.collection('ops_stats').doc('Watchdog:24h').get();

      if (!sSnap.exists) {
        console.log('[selfTuningScheduler] No stats for Watchdog:24h');
        return;
      }

      const s = sSnap.data() as any;
      const reward = s.avgReward ?? 0.6;
      const errRate = 1 - (s.successRate ?? 0.95);

      let minutes = 15; // default cadence
      const prevMinutes = s.prevMinutes ?? 15;

      // Adaptive logic
      if (reward < 0.5 || errRate > 0.1) {
        minutes = 5; // tighten checks
      } else if (reward > 0.7 && errRate < 0.03) {
        minutes = 30; // relax checks
      }

      // Apply guardrails
      minutes = Math.max(
        FLAGS.scheduler.minCadenceMins,
        Math.min(FLAGS.scheduler.maxCadenceMins, minutes)
      );

      // Persist desired cadence in config doc
      await db.collection('config').doc('ops_cadence').set(
        {
          Watchdog: { minutes, ts: Date.now() },
        },
        { merge: true }
      );

      // Log decision
      const decision: DecisionRecord = {
        id: uuid(),
        ts: Date.now(),
        actor: 'self-tuning-scheduler',
        component: 'Watchdog',
        before: { minutes: prevMinutes },
        after: { minutes },
        confidence: 0.7,
        reasons: reward < 0.5 ? ['slo_violations'] : ['ok'],
        guardrail: 'passed',
      };

      await db.collection('ops_decisions').add(decision);

      console.log(`[selfTuningScheduler] Watchdog cadence: ${prevMinutes}min → ${minutes}min`);

      // Also tune other components if needed
      await tuneFeedbackLoop();
      await tuneAutoScaler();

      console.log('[selfTuningScheduler] Completed successfully');
    } catch (error) {
      console.error('[selfTuningScheduler] Error:', error);
      throw error;
    }
  }
);

async function tuneFeedbackLoop() {
  const sSnap = await db.collection('ops_stats').doc('FeedbackLoop:24h').get();
  if (!sSnap.exists) return;

  const s = sSnap.data() as any;
  const reward = s.avgReward ?? 0.6;

  let minutes = 15; // default
  if (reward < 0.55) {
    minutes = 10; // more frequent feedback when performance drops
  } else if (reward > 0.75) {
    minutes = 20; // less frequent when stable
  }

  minutes = Math.max(
    FLAGS.scheduler.minCadenceMins,
    Math.min(FLAGS.scheduler.maxCadenceMins, minutes)
  );

  await db.collection('config').doc('ops_cadence').set(
    {
      FeedbackLoop: { minutes, ts: Date.now() },
    },
    { merge: true }
  );

  console.log(`[selfTuningScheduler] FeedbackLoop cadence set to ${minutes}min`);
}

async function tuneAutoScaler() {
  const sSnap = await db.collection('ops_stats').doc('AutoScaler:24h').get();
  if (!sSnap.exists) return;

  const s = sSnap.data() as any;
  const latencyP95 = s.p95Latency ?? 0;

  let minutes = 5; // default - keep responsive
  if (latencyP95 > 2000) {
    minutes = 3; // scale faster under pressure
  } else if (latencyP95 < 500) {
    minutes = 10; // relax when performing well
  }

  minutes = Math.max(
    FLAGS.scheduler.minCadenceMins,
    Math.min(FLAGS.scheduler.maxCadenceMins, minutes)
  );

  await db.collection('config').doc('ops_cadence').set(
    {
      AutoScaler: { minutes, ts: Date.now() },
    },
    { merge: true }
  );

  console.log(`[selfTuningScheduler] AutoScaler cadence set to ${minutes}min`);
}
