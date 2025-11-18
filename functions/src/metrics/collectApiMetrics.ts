/**
 * Collect API Metrics Cloud Function
 * Scheduled function to aggregate API metrics daily
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Collects and aggregates API metrics every 5 minutes
 * Creates/updates daily metric documents in api_metrics_daily collection
 * 
 * TODO: Connect to real logging/analytics source
 * For now, this is a placeholder that can be extended with:
 * - Cloud Logging API queries
 * - Analytics events
 * - Custom instrumentation data
 */
export const collectApiMetrics = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = getFirestore();
    const today = new Date().toISOString().slice(0, 10);
    const ref = db.collection('api_metrics_daily').doc(today);

    try {
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        
        const baseData = doc.exists ? doc.data()! : {
          date: today,
          endpoints: {},
          calls: 0,
          errors: 0,
          latencies: [],
          p95: 0,
          lastUpdated: Date.now(),
        };

        // TODO: Query real metrics from your logging/analytics source
        // Example sources:
        // - Cloud Logging API
        // - Custom analytics collection
        // - Third-party APM tools
        
        // Placeholder: Increment based on admin_audit as a proxy for activity
        try {
          const last5min = Date.now() - (5 * 60 * 1000);
          const recentActivity = await db
            .collection('admin_audit')
            .where('ts', '>=', last5min)
            .get();
          
          const activityCount = recentActivity.size;
          baseData.calls += activityCount;
          
          // Update timestamp
          baseData.lastUpdated = Date.now();
          
          // Calculate p95 if we have latencies
          if (baseData.latencies && baseData.latencies.length > 0) {
            const sorted = [...baseData.latencies].sort((a, b) => a - b);
            const p95Index = Math.floor(sorted.length * 0.95);
            baseData.p95 = sorted[p95Index] || 0;
          }
          
        } catch (err) {
          console.error('[collectApiMetrics] Error fetching activity:', err);
        }

        tx.set(ref, baseData, { merge: true });
      });

      console.log(`[collectApiMetrics] Updated metrics for ${today}`);
      return null;
    } catch (error) {
      console.error('[collectApiMetrics] Error:', error);
      throw error;
    }
  });

