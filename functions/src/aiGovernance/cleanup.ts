/**
 * AI Governance - Cleanup Scheduled Function
 * Cleans up old AI evaluation runs and PDF reports based on retention policies
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

/**
 * Scheduled cleanup job (runs every 24 hours)
 * - Deletes AI evaluation runs older than retention period
 * - Deletes PDF reports older than 30 days from Cloud Storage
 */
export const aiGovCleanup = onSchedule('every 24 hours', async () => {
  const db = admin.firestore();

  console.log('🧹 Starting AI Governance cleanup...');

  try {
    // Get retention policies
    const cfgSnap = await db.collection('config').doc('retention_policies').get();
    const rules = (cfgSnap.data()?.rules || []) as Array<{
      collection: string;
      days: number;
      autoClean: boolean;
    }>;

    // Find AI evals retention rule
    const aiRule = rules.find((r) => r.collection === 'ai_evals_runs') || {
      days: 30,
      autoClean: true,
    };

    console.log(
      `📋 AI evals retention: ${aiRule.days} days, autoClean=${aiRule.autoClean}`
    );

    // Calculate cutoff timestamp
    const cutoffMs = Date.now() - aiRule.days * 24 * 60 * 60 * 1000;

    // Find old evaluation runs (using collection group query)
    const snaps = await db
      .collectionGroup('runs')
      .where('meta.ts', '<', cutoffMs)
      .get();

    console.log(`📊 Found ${snaps.size} old evaluation runs to clean`);

    if (!snaps.empty && aiRule.autoClean) {
      // Delete in batches of 500 (Firestore limit)
      const batches: admin.firestore.WriteBatch[] = [];
      let currentBatch = db.batch();
      let batchCount = 0;

      snaps.docs.forEach((doc, index) => {
        currentBatch.delete(doc.ref);
        batchCount++;

        // Commit batch every 500 operations
        if (batchCount === 500 || index === snaps.docs.length - 1) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          batchCount = 0;
        }
      });

      // Commit all batches
      await Promise.all(batches.map((batch) => batch.commit()));

      console.log(`✅ Deleted ${snaps.size} old evaluation runs`);

      // Log cleanup action to audit trail
      await db.collection('audit_logs').add({
        ts: admin.firestore.FieldValue.serverTimestamp(),
        actor: 'system',
        action: 'ai_gov.cleanup',
        resource: 'ai_evals',
        status: 'success',
        metadata: {
          deletedCount: snaps.size,
          retentionDays: aiRule.days,
          cutoffTimestamp: cutoffMs,
        },
      });
    } else if (!aiRule.autoClean) {
      console.log('⏭️  Auto-cleanup disabled, skipping evaluation runs');
    } else {
      console.log('✅ No old evaluation runs to clean');
    }

    // Clean up PDF reports from Cloud Storage
    await cleanupReports();
  } catch (error) {
    console.error('❌ Error during AI Governance cleanup:', error);

    // Log error to audit trail
    await db
      .collection('audit_logs')
      .add({
        ts: admin.firestore.FieldValue.serverTimestamp(),
        actor: 'system',
        action: 'ai_gov.cleanup',
        resource: 'ai_evals',
        status: 'error',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
      .catch(() => {}); // Ignore logging errors
  }

  console.log('🧹 AI Governance cleanup complete');
});

/**
 * Clean up PDF reports older than 30 days from Cloud Storage
 */
async function cleanupReports() {
  try {
    const bucket = admin.storage().bucket();

    // List all files in reports/ directory
    const [files] = await bucket.getFiles({ prefix: 'reports/' });

    console.log(`📄 Found ${files.length} PDF reports in storage`);

    const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
    let deletedCount = 0;

    // Delete old reports
    await Promise.all(
      files.map(async (file) => {
        try {
          const [metadata] = await file.getMetadata().catch(() => [null]);
          const createdMs = metadata?.timeCreated
            ? new Date(metadata.timeCreated).getTime()
            : Date.now();

          if (createdMs < cutoffMs) {
            await file.delete().catch(() => {});
            deletedCount++;
          }
        } catch (error) {
          // Skip files that can't be processed
          console.warn(`⚠️  Could not process file: ${file.name}`);
        }
      })
    );

    if (deletedCount > 0) {
      console.log(`✅ Deleted ${deletedCount} old PDF reports from storage`);
    } else {
      console.log('✅ No old PDF reports to clean');
    }
  } catch (error) {
    console.error('❌ Error cleaning up PDF reports:', error);
  }
}
