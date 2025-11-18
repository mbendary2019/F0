/**
 * DSAR (Data Subject Access Request) Utilities
 * GDPR/CCPA compliance - data export and deletion
 */

import { db, storage } from '@/lib/firebase-admin';
import { PII_MAP } from './piiMap';
import { alert } from './alerts';

export interface DsarRequest {
  id: string;
  uid: string;
  type: 'export' | 'deletion';
  status: 'pending' | 'processing' | 'ready' | 'approved' | 'denied' | 'completed';
  requestedAt: Date;
  processedAt?: Date;
  approvedBy?: string;
  deniedBy?: string;
  denialReason?: string;
  exportUrl?: string;
  exportExpiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface DsarExport {
  id: string;
  uid: string;
  requestId: string;
  fileUrl: string;
  expiresAt: Date;
  createdAt: Date;
  sizeBytes: number;
}

export interface DeletionTask {
  id: string;
  uid: string;
  requestId: string;
  scheduledFor: Date;
  reason?: string;
  status: 'pending' | 'cancelled' | 'completed';
  createdAt: Date;
}

/**
 * Start data export process for a user
 */
export async function startExport(uid: string, reqId: string): Promise<void> {
  try {
    // Update request status
    await db.collection('dsar_requests').doc(reqId).update({
      status: 'processing',
      processedAt: new Date(),
    });

    // Collect all user data according to PII_MAP
    const userData: Record<string, any> = {};

    for (const collection of PII_MAP) {
      const collectionData: any[] = [];

      // Query based on uidField
      const query = db.collection(collection.name).where(collection.uidField, '==', uid);
      const snapshot = await query.get();

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Extract only PII fields
        const extractedData: Record<string, any> = { id: doc.id };
        for (const field of collection.fields) {
          if (data[field] !== undefined) {
            extractedData[field] = data[field];
          }
        }

        // Handle subcollections
        if (collection.subcollections) {
          for (const subCol of collection.subcollections) {
            const subSnapshot = await db
              .collection(collection.name)
              .doc(doc.id)
              .collection(subCol.name)
              .get();

            extractedData[subCol.name] = subSnapshot.docs.map((subDoc) => {
              const subData = subDoc.data();
              const extracted: Record<string, any> = { id: subDoc.id };
              for (const field of subCol.fields) {
                if (subData[field] !== undefined) {
                  extracted[field] = subData[field];
                }
              }
              return extracted;
            });
          }
        }

        collectionData.push(extractedData);
      }

      userData[collection.name] = collectionData;
    }

    // Add metadata
    const exportData = {
      exportedAt: new Date().toISOString(),
      uid,
      requestId: reqId,
      collections: userData,
    };

    // Convert to JSON
    const jsonContent = JSON.stringify(exportData, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');

    // Upload to Cloud Storage
    const bucketName = process.env.EXPORT_STORAGE_BUCKET || 'f0-exports';
    const bucket = storage.bucket(bucketName);
    const fileName = `dsar-exports/${uid}/${reqId}/user-data-${Date.now()}.json`;
    const file = bucket.file(fileName);

    await file.save(buffer, {
      contentType: 'application/json',
      metadata: {
        uid,
        requestId: reqId,
        exportedAt: new Date().toISOString(),
      },
    });

    // Generate signed URL
    const ttlSeconds = Number(process.env.EXPORT_SIGNED_URL_TTL_SECONDS || 86400); // 24 hours
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + ttlSeconds * 1000,
    });

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // Create export record
    const exportId = db.collection('dsar_exports').doc().id;
    await db.collection('dsar_exports').doc(exportId).set({
      id: exportId,
      uid,
      requestId: reqId,
      fileUrl: signedUrl,
      expiresAt,
      createdAt: new Date(),
      sizeBytes: buffer.length,
    });

    // Update request
    await db.collection('dsar_requests').doc(reqId).update({
      status: 'ready',
      exportUrl: signedUrl,
      exportExpiresAt: expiresAt,
    });

    console.log(`✅ Data export completed for user ${uid}, request ${reqId}`);
  } catch (error: any) {
    console.error('❌ Error starting export:', error);

    // Update request status to failed
    await db.collection('dsar_requests').doc(reqId).update({
      status: 'denied',
      denialReason: `Export failed: ${error.message}`,
    });

    throw error;
  }
}

/**
 * Start deletion process (with grace period)
 */
export async function startDeletion(params: {
  uid: string;
  reqId: string;
  reason?: string;
}): Promise<void> {
  const { uid, reqId, reason } = params;

  try {
    // Calculate scheduled deletion date (grace period)
    const gracePeriodDays = Number(process.env.DELETION_GRACE_PERIOD_DAYS || 30);
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + gracePeriodDays);

    // Create deletion task
    const taskId = db.collection('deletion_queue').doc().id;
    await db.collection('deletion_queue').doc(taskId).set({
      id: taskId,
      uid,
      requestId: reqId,
      scheduledFor,
      reason,
      status: 'pending',
      createdAt: new Date(),
    });

    // Update request
    await db.collection('dsar_requests').doc(reqId).update({
      status: 'approved',
      approvedAt: new Date(),
      metadata: {
        deletionTaskId: taskId,
        scheduledFor,
      },
    });

    // Create critical alert for admin
    await alert({
      severity: 'critical',
      kind: 'account_deletion_scheduled',
      message: `User ${uid} account deletion scheduled for ${scheduledFor.toISOString()}`,
      context: {
        uid,
        requestId: reqId,
        taskId,
        scheduledFor: scheduledFor.toISOString(),
        gracePeriodDays,
      },
    });

    console.log(`✅ Deletion scheduled for user ${uid} on ${scheduledFor.toISOString()}`);
  } catch (error: any) {
    console.error('❌ Error starting deletion:', error);
    throw error;
  }
}

/**
 * Execute permanent deletion (called after grace period)
 */
export async function executeDeletion(taskId: string): Promise<void> {
  const taskDoc = await db.collection('deletion_queue').doc(taskId).get();

  if (!taskDoc.exists) {
    throw new Error(`Deletion task ${taskId} not found`);
  }

  const task = taskDoc.data() as DeletionTask;

  if (task.status !== 'pending') {
    console.log(`⏭️  Deletion task ${taskId} already ${task.status}, skipping`);
    return;
  }

  // Check if scheduled time has arrived
  if (new Date() < task.scheduledFor) {
    console.log(`⏰ Deletion task ${taskId} not due yet (scheduled for ${task.scheduledFor})`);
    return;
  }

  const { uid } = task;

  try {
    // Delete from all PII collections
    for (const collection of PII_MAP) {
      const query = db.collection(collection.name).where(collection.uidField, '==', uid);
      const snapshot = await query.get();

      for (const doc of snapshot.docs) {
        // Delete subcollections first
        if (collection.subcollections) {
          for (const subCol of collection.subcollections) {
            const subSnapshot = await db
              .collection(collection.name)
              .doc(doc.id)
              .collection(subCol.name)
              .get();

            for (const subDoc of subSnapshot.docs) {
              await subDoc.ref.delete();
            }
          }
        }

        // Delete document
        await doc.ref.delete();
      }

      console.log(`✅ Deleted ${snapshot.size} documents from ${collection.name}`);
    }

    // Delete Firebase Auth user
    try {
      await db.collection('users').doc(uid).delete();
      console.log(`✅ Deleted user document for ${uid}`);
    } catch (error: any) {
      console.warn(`⚠️  Could not delete Auth user ${uid}:`, error.message);
    }

    // Mark task as completed
    await db.collection('deletion_queue').doc(taskId).update({
      status: 'completed',
      completedAt: new Date(),
    });

    // Update request
    await db.collection('dsar_requests').doc(task.requestId).update({
      status: 'completed',
      completedAt: new Date(),
    });

    // Create alert
    await alert({
      severity: 'critical',
      kind: 'account_deletion_completed',
      message: `User ${uid} account permanently deleted`,
      context: {
        uid,
        taskId,
        requestId: task.requestId,
      },
    });

    console.log(`✅ Permanent deletion completed for user ${uid}`);
  } catch (error: any) {
    console.error('❌ Error executing deletion:', error);

    // Log error but don't retry automatically
    await db.collection('deletion_queue').doc(taskId).update({
      status: 'pending', // Keep as pending for manual review
      lastError: error.message,
      lastErrorAt: new Date(),
    });

    throw error;
  }
}

/**
 * Cancel scheduled deletion (during grace period)
 */
export async function cancelDeletion(taskId: string, reason?: string): Promise<void> {
  const taskDoc = await db.collection('deletion_queue').doc(taskId).get();

  if (!taskDoc.exists) {
    throw new Error(`Deletion task ${taskId} not found`);
  }

  const task = taskDoc.data() as DeletionTask;

  if (task.status !== 'pending') {
    throw new Error(`Cannot cancel deletion task ${taskId} with status ${task.status}`);
  }

  await db.collection('deletion_queue').doc(taskId).update({
    status: 'cancelled',
    cancelledAt: new Date(),
    cancellationReason: reason,
  });

  await db.collection('dsar_requests').doc(task.requestId).update({
    status: 'denied',
    deniedBy: 'system',
    denialReason: reason || 'Deletion cancelled',
  });

  console.log(`✅ Deletion cancelled for task ${taskId}`);
}

/**
 * Check if user can request export (cooldown period)
 */
export async function canRequestExport(uid: string): Promise<{
  allowed: boolean;
  reason?: string;
  nextAllowedAt?: Date;
}> {
  const cooldownDays = Number(process.env.DSAR_REQUEST_COOLDOWN_DAYS || 30);

  const recentRequests = await db
    .collection('dsar_requests')
    .where('uid', '==', uid)
    .where('type', '==', 'export')
    .orderBy('requestedAt', 'desc')
    .limit(1)
    .get();

  if (recentRequests.empty) {
    return { allowed: true };
  }

  const lastRequest = recentRequests.docs[0].data();
  const lastRequestDate = lastRequest.requestedAt.toDate();
  const nextAllowedAt = new Date(lastRequestDate);
  nextAllowedAt.setDate(nextAllowedAt.getDate() + cooldownDays);

  if (new Date() < nextAllowedAt) {
    return {
      allowed: false,
      reason: `You can request another export on ${nextAllowedAt.toLocaleDateString()}`,
      nextAllowedAt,
    };
  }

  return { allowed: true };
}
