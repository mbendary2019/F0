/**
 * Auto-Approval Engine for DSAR Requests
 * Automatically approve/reject requests based on user tier and account age
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { startExport } from './dsar';

// shim in case dsar doesn't export startDeletion yet
const startDeletion = async (...args: any[]) => {
  const mod: any = await import('./dsar');
  if (mod.startDeletion) return mod.startDeletion(...args);
  throw new Error('startDeletion not exported from dsar');
};
import {
  notifyDsarRequest,
  notifyDsarApproved,
  notifyDataExportReady,
} from './notifications';

const db = admin.firestore();

export type PlanTier = 'free' | 'pro' | 'premium' | 'enterprise';
export type Decision = 'auto_approved' | 'auto_rejected' | 'pending';

export interface DSARRecord {
  id: string;
  uid: string;
  type: 'export' | 'deletion';
  plan: PlanTier;
  createdAt: Date;
  accountAgeDays: number;
  status: string;
}

/**
 * Determine if DSAR should be auto-approved, auto-rejected, or kept pending
 */
export function decideDSARApproval(record: DSARRecord): Decision {
  // Rule 1: Premium and Enterprise users get auto-approval
  if (
    (record.plan === 'premium' || record.plan === 'enterprise') &&
    process.env.AUTO_APPROVE_PREMIUM === 'true'
  ) {
    console.log(`✅ Auto-approving ${record.type} for ${record.plan} user ${record.uid}`);
    return 'auto_approved';
  }

  // Rule 2: Reject deletion requests from very new accounts (anti-abuse)
  const minAccountAgeDays = Number(process.env.AUTO_REJECT_NEW_ACCOUNTS_DAYS || 1);
  if (record.type === 'deletion' && record.accountAgeDays < minAccountAgeDays) {
    console.log(
    `❌ Auto-rejecting deletion for new account ${record.uid} (${record.accountAgeDays} days old)`
    );
    return 'auto_rejected';
  }

  // Rule 3: Auto-approve exports for all users (low risk)
  if (record.type === 'export') {
    console.log(`✅ Auto-approving export for user ${record.uid}`);
    return 'auto_approved';
  }

  // Default: require manual review for deletion requests
  console.log(`⏸️  Manual review required for ${record.type} from ${record.uid}`);
  return 'pending';
}

/**
 * Get user's plan tier and account age
 */
async function getUserInfo(uid: string): Promise<{
  plan: PlanTier;
  accountAgeDays: number;
  email: string | null;
}> {
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();

  // Get plan from subscription or default to free
  const plan = (userData?.subscription?.tier?.toLowerCase() || 'free') as PlanTier;

  // Calculate account age
  const createdAt = userData?.createdAt?.toDate() || new Date();
  const accountAgeDays = Math.floor(
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Get email
  const email = userData?.email || null;

  return { plan, accountAgeDays, email };
}

/**
 * Process auto-approved export
 */
async function processAutoApprovedExport(uid: string, requestId: string): Promise<void> {
  try {
    console.log(`🚀 Processing auto-approved export: ${requestId}`);

    // Start export (from Sprint 11)
    await startExport(uid, requestId);

    // Get the updated request with export URL
    const requestDoc = await db.collection('dsar_requests').doc(requestId).get();
    const requestData = requestDoc.data();

    // Send notification with download link
    if (requestData?.exportUrl && requestData?.exportExpiresAt) {
    // Get export size
    const exportDoc = await db
      .collection('dsar_exports')
      .where('requestId', '==', requestId)
      .limit(1)
      .get();

    const sizeBytes = exportDoc.empty ? 0 : exportDoc.docs[0].data().sizeBytes || 0;

    await notifyDataExportReady({
      uid,
      requestId,
      downloadUrl: requestData.exportUrl,
      sizeBytes,
      expiresAt: requestData.exportExpiresAt.toDate(),
    });
    }

    console.log(`✅ Auto-approved export completed: ${requestId}`);
  } catch (error: any) {
    console.error(`❌ Auto-approved export failed for ${requestId}:`, error.message);
    throw error;
  }
}

/**
 * Process auto-approved deletion
 */
async function processAutoApprovedDeletion(uid: string, requestId: string): Promise<void> {
  try {
    console.log(`🚀 Processing auto-approved deletion: ${requestId}`);

    // Start deletion with grace period (from Sprint 11)
    await startDeletion({
    uid,
    reqId: requestId,
    reason: 'Auto-approved deletion request',
    });

    // Calculate deletion date
    const gracePeriodDays = Number(process.env.DELETION_GRACE_PERIOD_DAYS || 30);
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + gracePeriodDays);

    // Send approval notification
    await notifyDsarApproved({
    uid,
    requestId,
    type: 'deletion',
    approvedBy: 'system',
    deletionDate,
    gracePeriodDays,
    });

    console.log(`✅ Auto-approved deletion scheduled: ${requestId}`);
  } catch (error: any) {
    console.error(`❌ Auto-approved deletion failed for ${requestId}:`, error.message);
    throw error;
  }
}

/**
 * Firestore trigger: Auto-process DSAR requests when created
 */
export const autoProcessDSAR = onDocumentCreated('dsar_requests/{requestId}', async (event) => {
  const snap = event.data;
  const data = snap?.data();
  const requestId = event.params.requestId;

  if (!data) {
    console.error(`❌ No data found for request ${requestId}`);
    return;
  }

  console.log(`📋 New DSAR request ${requestId}: ${data.type}`);

  try {
    // Get user info
    const { plan, accountAgeDays, email } = await getUserInfo(data.uid);

    // Build DSAR record
    const record: DSARRecord = {
      id: requestId,
      uid: data.uid,
      type: data.type,
      plan,
      createdAt: data.requestedAt?.toDate() || new Date(),
      accountAgeDays,
      status: data.status,
    };

    // Decide approval
    const decision = decideDSARApproval(record);

    // Log audit
    await db.collection('audit_logs').add({
      ts: admin.firestore.FieldValue.serverTimestamp(),
      actor: 'system',
      action: 'dsar.auto_decision',
      resource: `dsar_requests/${requestId}`,
      status: 'success',
      metadata: {
        requestId,
        uid: data.uid,
        type: data.type,
        decision,
        plan,
        accountAgeDays,
      },
    });

    // Handle decision
    if (decision === 'auto_approved') {
      // Update status
      await snap.ref.update({
        status: 'approved',
        approvedBy: 'system',
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          ...data.metadata,
          autoApproved: true,
          decision,
        },
      });

      // Send initial notification
      await notifyDsarRequest({
        uid: data.uid,
        requestId,
        type: data.type,
        status: 'approved',
        autoApproved: true,
      });

      // Process based on type
      if (data.type === 'export') {
        await processAutoApprovedExport(data.uid, requestId);
      } else if (data.type === 'deletion') {
        await processAutoApprovedDeletion(data.uid, requestId);
      }
    } else if (decision === 'auto_rejected') {
      // Update status
      await snap.ref.update({
        status: 'denied',
        deniedBy: 'system',
        deniedAt: admin.firestore.FieldValue.serverTimestamp(),
        denialReason: `Account too new (${accountAgeDays} days old). Minimum age: ${
          process.env.AUTO_REJECT_NEW_ACCOUNTS_DAYS || 1
        } days.`,
        metadata: {
          ...data.metadata,
          autoRejected: true,
          decision,
        },
      });

      // Send rejection notification
      await notifyDsarRequest({
        uid: data.uid,
        requestId,
        type: data.type,
        status: 'denied',
        autoApproved: false,
      });
    } else {
      // Pending - requires manual review
      // Send notification that request is under review
      await notifyDsarRequest({
        uid: data.uid,
        requestId,
        type: data.type,
        status: 'pending',
        autoApproved: false,
      });

      console.log(`⏸️  Request ${requestId} pending manual review`);
    }
  } catch (error: any) {
    console.error(`❌ Auto-processing failed for ${requestId}:`, error.message);

    // Log error
    await db.collection('audit_logs').add({
      ts: admin.firestore.FieldValue.serverTimestamp(),
      actor: 'system',
      action: 'dsar.auto_decision',
      resource: `dsar_requests/${requestId}`,
      status: 'error',
      metadata: {
        requestId,
        error: error.message,
      },
    });

    // Don't throw - let manual review handle it
  }
});
