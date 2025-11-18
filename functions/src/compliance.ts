/**
 * Compliance Cloud Functions
 * GDPR/DSAR automation and retention policies
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const db = admin.firestore();

/**
 * DEPRECATED in Sprint 12
 * Trigger data export when DSAR request is created
 * This has been replaced by autoProcessDSAR which includes auto-approval logic
 *
 * To restore old behavior, uncomment this and remove autoProcessDSAR from index.ts
 */
// Commented out - replaced by autoProcessDSAR
export const onDsarRequest = () => {
  console.log('onDsarRequest is deprecated - use autoProcessDSAR instead');
};

/**
 * Daily retention policy sweep
 * Deletes old data according to retention policies
 */
export const retentionSweep = onSchedule({ schedule: '0 2 * * *', timeZone: 'UTC' }, async (event) => {
  console.log('🧹 Starting retention sweep...');

  // Parse retention policies from env
  let retentionPolicies: Record<string, number> = {};
  try {
    const policiesJson = process.env.RETENTION_POLICIES_JSON || '{}';
    retentionPolicies = JSON.parse(policiesJson);
  } catch (error: any) {
    console.error('❌ Failed to parse RETENTION_POLICIES_JSON:', error.message);
    return;
  }

  const now = new Date();
  let totalDeleted = 0;

  for (const [collection, retentionDays] of Object.entries(retentionPolicies)) {
    try {
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      console.log(
        `🗑️  Processing ${collection} (retention: ${retentionDays} days, cutoff: ${cutoffDate.toISOString()})`
      );

      // Query documents older than retention period
      const query = db
        .collection(collection)
        .where('createdAt', '<', cutoffDate)
        .limit(500); // Process in batches

      const snapshot = await query.get();

      if (snapshot.empty) {
        console.log(`✅ No expired documents in ${collection}`);
        continue;
      }

      // Delete in batches
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += snapshot.size;

      console.log(`✅ Deleted ${snapshot.size} documents from ${collection}`);
    } catch (error: any) {
      console.error(`❌ Error processing ${collection}:`, error.message);
    }
  }

  console.log(`✅ Retention sweep completed. Total deleted: ${totalDeleted}`);
  return null;
  });

/**
 * Process pending deletions (after grace period)
 * Runs hourly to check for deletion tasks due for execution
 */
export const processDeletions = onSchedule({ schedule: '0 * * * *', timeZone: 'UTC' }, async (event) => {
  console.log('🗑️  Checking for pending deletions...');

  const now = new Date();

  // Find deletion tasks that are due
  const tasksSnapshot = await db
    .collection('deletion_queue')
    .where('status', '==', 'pending')
      .where('scheduledFor', '<=', now)
      .limit(10) // Process max 10 per run
      .get();

    if (tasksSnapshot.empty) {
      console.log('✅ No pending deletions due');
      return null;
    }

    console.log(`📋 Found ${tasksSnapshot.size} deletion tasks to process`);

    for (const taskDoc of tasksSnapshot.docs) {
      const taskId = taskDoc.id;
      const task = taskDoc.data();

      try {
        console.log(`🗑️  Processing deletion task ${taskId} for user ${task.uid}`);

        // Import from compiled JS
        const { executeDeletion } = require('./dsar');
        await executeDeletion(taskId);

        console.log(`✅ Deletion completed for task ${taskId}`);
      } catch (error: any) {
        console.error(`❌ Deletion failed for task ${taskId}:`, error.message);
        // Error is logged in executeDeletion, will be retried next run
      }
    }

    return null;
  });

/**
 * Clean up expired export URLs
 * Deletes export files and records after expiration
 */
export const cleanupExpiredExports = onSchedule({ schedule: '0 3 * * *', timeZone: 'UTC' }, async (event) => {
  console.log('🧹 Cleaning up expired exports...');

  const now = new Date();

  const exportsSnapshot = await db
    .collection('dsar_exports')
    .where('expiresAt', '<', now)
    .limit(100)
    .get();

  if (exportsSnapshot.empty) {
    console.log('✅ No expired exports to clean');
    return null;
  }

  const bucketName = process.env.EXPORT_STORAGE_BUCKET || 'f0-exports';
  const bucket = admin.storage().bucket(bucketName);

  let deletedCount = 0;

  for (const exportDoc of exportsSnapshot.docs) {
    const exportData = exportDoc.data();

    try {
      // Delete from storage
      const fileName = `dsar-exports/${exportData.uid}/${exportData.requestId}/user-data-*.json`;
      const [files] = await bucket.getFiles({ prefix: fileName.replace('*', '') });

      for (const file of files) {
        await file.delete();
        console.log(`🗑️  Deleted file: ${file.name}`);
      }

      // Delete Firestore record
      await exportDoc.ref.delete();
      deletedCount++;

      console.log(`✅ Cleaned up export ${exportDoc.id}`);
    } catch (error: any) {
      console.error(`❌ Error cleaning export ${exportDoc.id}:`, error.message);
    }
  }

  console.log(`✅ Cleaned up ${deletedCount} expired exports`);
  return null;
});
