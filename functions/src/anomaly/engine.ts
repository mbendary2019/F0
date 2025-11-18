/**
 * Anomaly Detection Engine
 * Runs periodically to detect anomalies in system metrics
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { zscoreRobust, ewma, fuse, calculateSeverity, Point } from './detectors';
import { buildInsight, formatSlackMessage, Metric } from './insights';

// Slack webhook import (optional)
let Webhook: any;
try {
  Webhook = require('@slack/webhook').IncomingWebhook;
} catch {
  console.warn('[anomalyEngine] @slack/webhook not installed');
}

const slackUrl = process.env.SLACK_WEBHOOK_URL;

// Time windows in milliseconds
const WINDOWS = [
  { ms: 60_000, label: '1m' },
  { ms: 5 * 60_000, label: '5m' },
  { ms: 15 * 60_000, label: '15m' }
] as const;

/**
 * Anomaly Detection Engine
 * Runs every minute to detect anomalies
 */
export const anomalyEngine = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = getFirestore();
    const now = Date.now();

    console.log('[anomalyEngine] Starting detection cycle');

    const metrics: Metric[] = ['errors', 'calls', 'latency_p95'];
    let detectedCount = 0;

    for (const metric of metrics) {
      for (const window of WINDOWS) {
        try {
          // Fetch time series data
          const series = await fetchTimeSeries(db, metric, window.ms, now);

          if (series.length < 8) {
            console.log(`[anomalyEngine] Insufficient data for ${metric}/${window.label}`);
            continue;
          }

          // Get tuning config
          const tuning = await getTuningConfig(db, metric, window.label);

          // Run detectors
          const zScoreResult = zscoreRobust(series, { sensitivity: tuning.sensitivity });
          const ewmaResult = ewma(series, { sensitivity: tuning.sensitivity });
          
          // Fuse results
          const fusedResult = fuse(
            zScoreResult,
            ewmaResult,
            tuning.fusionWeights[0],
            tuning.fusionWeights[1]
          );

          // If anomaly detected, record it
          if (fusedResult.anomaly) {
            const severity = calculateSeverity(fusedResult.score);
            
            // Calculate delta
            const delta = series.length > 1
              ? ((series[series.length - 1].v - series[0].v) / series[0].v) * 100
              : 0;

            // Generate insight
            const insight = buildInsight(metric, severity, {
              score: fusedResult.score,
              window: window.label,
              delta,
              n: series.length,
              last: series[series.length - 1]?.v
            });

            // Store anomaly event
            const eventRef = await db.collection('anomaly_events').add({
              ts: now,
              metric,
              window: window.label,
              score: fusedResult.score,
              severity,
              reason: fusedResult.reason,
              delta,
              insight: {
                title: insight.title,
                description: insight.description,
                causes: insight.possibleCauses.slice(0, 3),
                actions: insight.suggestedActions.slice(0, 3)
              },
              ctx: {
                n: series.length,
                last: series[series.length - 1]?.v ?? null,
                detectors: {
                  zscore: zScoreResult.score,
                  ewma: ewmaResult.score
                }
              },
              acknowledged: false
            });

            detectedCount++;
            console.log(`[anomalyEngine] Anomaly detected: ${metric}/${window.label} - ${severity} - score: ${fusedResult.score.toFixed(2)}`);

            // Send Slack notification for high severity
            if (severity === 'high' && slackUrl && Webhook) {
              try {
                const webhook = new Webhook(slackUrl);
                const message = formatSlackMessage(insight);
                await webhook.send(message);
                console.log('[anomalyEngine] Slack notification sent');
              } catch (err) {
                console.error('[anomalyEngine] Failed to send Slack notification:', err);
              }
            }
          }
        } catch (err) {
          console.error(`[anomalyEngine] Error processing ${metric}/${window.label}:`, err);
        }
      }
    }

    console.log(`[anomalyEngine] Detection cycle complete. Found ${detectedCount} anomalies.`);
    return null;
  });

/**
 * Fetch time series data for a metric and window
 */
async function fetchTimeSeries(
  db: FirebaseFirestore.Firestore,
  metric: Metric,
  windowMs: number,
  now: number
): Promise<Point[]> {
  const since = now - windowMs;

  try {
    // Try to fetch from api_metrics_daily if available
    const today = new Date(now).toISOString().slice(0, 10);
    const metricsDoc = await db.collection('api_metrics_daily').doc(today).get();

    if (metricsDoc.exists) {
      const data = metricsDoc.data();
      if (data?.latencies && metric === 'latency_p95') {
        // Use latency data
        const points: Point[] = data.latencies
          .slice(-Math.floor(windowMs / 60000))
          .map((v: number, i: number) => ({
            t: now - (windowMs - i * 60000),
            v
          }));
        return points;
      }
    }

    // Fallback: Use admin_audit as proxy
    const snap = await db
      .collection('admin_audit')
      .where('ts', '>=', since)
      .orderBy('ts')
      .get();

    // Bucket by minute
    const buckets = new Map<number, number>();
    snap.docs.forEach(doc => {
      const ts = doc.get('ts');
      const bucket = Math.floor(ts / 60_000) * 60_000;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });

    // Convert to points
    const points: Point[] = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([t, v]) => ({ t, v }));

    // If metric is errors, simulate some variance
    if (metric === 'errors') {
      return points.map(p => ({ ...p, v: Math.max(0, p.v * 0.1) }));
    }

    return points;
  } catch (err) {
    console.error('[fetchTimeSeries] Error:', err);
    return [];
  }
}

/**
 * Get tuning configuration for metric/window
 */
async function getTuningConfig(
  db: FirebaseFirestore.Firestore,
  metric: Metric,
  window: string
): Promise<{
  sensitivity: number;
  fusionWeights: [number, number];
  minSupport: number;
}> {
  try {
    const tuningDoc = await db
      .collection('anomaly_tuning')
      .doc(`${metric}_${window}`)
      .get();

    if (tuningDoc.exists) {
      const data = tuningDoc.data()!;
      return {
        sensitivity: data.sensitivity ?? 3,
        fusionWeights: data.fusionWeights ?? [0.5, 0.5],
        minSupport: data.minSupport ?? 8
      };
    }
  } catch (err) {
    console.error('[getTuningConfig] Error:', err);
  }

  // Default config
  return {
    sensitivity: 3,
    fusionWeights: [0.5, 0.5],
    minSupport: 8
  };
}

/**
 * Clean up old anomaly events (older than 30 days)
 */
export const cleanupAnomalyEvents = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = getFirestore();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    try {
      const oldEvents = await db
        .collection('anomaly_events')
        .where('ts', '<', thirtyDaysAgo)
        .limit(500)
        .get();

      if (oldEvents.empty) {
        console.log('[cleanupAnomalyEvents] No old events to clean');
        return null;
      }

      const batch = db.batch();
      oldEvents.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`[cleanupAnomalyEvents] Deleted ${oldEvents.size} old events`);
    } catch (err) {
      console.error('[cleanupAnomalyEvents] Error:', err);
    }

    return null;
  });

