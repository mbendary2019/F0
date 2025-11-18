/**
 * Dynamic Retention Cleaner
 * Reads retention rules from Firestore config and enforces them
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const db = admin.firestore();

export interface RetentionRule {
  collection: string;
  days: number;
  autoClean: boolean;
}

/**
 * Get retention rules from Firestore config
 */
async function getRetentionRules(): Promise<RetentionRule[]> {
  try {
    const configDoc = await db.collection('config').doc('retention_policies').get();

    if (!configDoc.exists) {
      console.warn('⚠️  No retention_policies config found');
      return [];
    }

    const data = configDoc.data();
    return (data?.rules || []) as RetentionRule[];
  } catch (error: any) {
    console.error('❌ Failed to load retention rules:', error.message);
    return [];
  }
}

/**
 * Clean old documents from a collection
 */
async function cleanCollection(rule: RetentionRule): Promise<number> {
  const { collection, days, autoClean } = rule;

  if (!autoClean) {
    console.log(`⏭️  Skipping ${collection} (autoClean=false)`);
    return 0;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

  console.log(
    `🧹 Cleaning ${collection}: retention=${days} days, cutoff=${cutoffDate.toISOString()}`
  );

  try {
    // Query old documents (max 500 per run to avoid timeouts)
    const snapshot = await db
      .collection(collection)
      .where('createdAt', '<', cutoffTimestamp)
      .limit(500)
      .get();

    if (snapshot.empty) {
      console.log(`✅ No expired documents in ${collection}`);
      return 0;
    }

    // Batch delete
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`✅ Deleted ${snapshot.size} documents from ${collection}`);
    return snapshot.size;
  } catch (error: any) {
    console.error(`❌ Error cleaning ${collection}:`, error.message);
    return 0;
  }
}

/**
 * Scheduled Function: Run retention cleaner every 6 hours
 */
export const retentionCleaner = onSchedule(
  {
    schedule: 'every 6 hours',
    timeZone: 'UTC'
  },
  async (event) => {
    console.log('🧹 Starting dynamic retention cleaner...');

    const rules = await getRetentionRules();

    if (rules.length === 0) {
      console.log('⚠️  No retention rules configured');
      return null;
    }

    console.log(`📋 Found ${rules.length} retention rules`);

    let totalDeleted = 0;

    for (const rule of rules) {
      const deleted = await cleanCollection(rule);
      totalDeleted += deleted;
    }

    console.log(`✅ Retention cleaner completed. Total deleted: ${totalDeleted}`);

    // Log to audit
    await db.collection('audit_logs').add({
      ts: admin.firestore.FieldValue.serverTimestamp(),
      actor: 'system',
      action: 'retention.cleanup',
      resource: 'retention_policies',
      status: 'success',
      metadata: {
        rulesProcessed: rules.length,
        documentsDeleted: totalDeleted,
      },
    });

    return null;
  }
);

/**
 * HTTP Callable: Manually trigger retention cleanup
 * (For testing or admin-triggered cleanup)
 */
export const triggerRetentionCleanup = onCall(async (request) => {
  // Verify admin
  if (!request.auth?.token?.admin) {
    throw new HttpsError(
      'permission-denied',
      'Only admins can trigger retention cleanup'
    );
  }

  console.log(`🔧 Manual retention cleanup triggered by ${request.auth.uid}`);

  const rules = await getRetentionRules();

  if (rules.length === 0) {
    return { success: false, message: 'No retention rules configured', deleted: 0 };
  }

  let totalDeleted = 0;

  for (const rule of rules) {
    const deleted = await cleanCollection(rule);
    totalDeleted += deleted;
  }

  // Log audit
  await db.collection('audit_logs').add({
    ts: admin.firestore.FieldValue.serverTimestamp(),
    actor: request.auth.uid,
    action: 'retention.cleanup.manual',
    resource: 'retention_policies',
    status: 'success',
    metadata: {
      rulesProcessed: rules.length,
      documentsDeleted: totalDeleted,
    },
  });

  return {
    success: true,
    message: `Cleaned ${totalDeleted} documents across ${rules.length} collections`,
    deleted: totalDeleted,
    rules: rules.length,
  };
});
