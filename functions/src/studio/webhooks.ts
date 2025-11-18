/**
 * Studio Webhooks — AI Job Status Updates
 *
 * Receives webhook callbacks from external AI providers (Runway, Veo)
 * and updates job status in Firestore.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import {db} from '../config';
import {Timestamp, FieldValue} from 'firebase-admin/firestore';
import * as crypto from 'crypto';

interface WebhookPayload {
  jobId: string;
  externalJobId?: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress?: number;
  outputUrl?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

/**
 * Verify webhook signature (optional but recommended)
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

/**
 * Update job status in Firestore
 */
async function updateJobStatus(payload: WebhookPayload): Promise<void> {
  const jobRef = db.collection('studio_jobs').doc(payload.jobId);

  const updateData: any = {
    status: payload.status,
    updatedAt: Timestamp.now(),
  };

  if (payload.progress !== undefined) {
    updateData.progress = payload.progress;
  }

  if (payload.outputUrl) {
    updateData.outputUrl = payload.outputUrl;
  }

  if (payload.errorMessage) {
    updateData.errorMessage = payload.errorMessage;
  }

  if (payload.status === 'done') {
    updateData.completedAt = Timestamp.now();
  }

  if (payload.externalJobId) {
    updateData.externalJobId = payload.externalJobId;
  }

  await jobRef.update(updateData);

  // Also update the associated asset if outputUrl is provided
  if (payload.outputUrl) {
    const jobDoc = await jobRef.get();
    if (jobDoc.exists) {
      const jobData = jobDoc.data();
      if (jobData?.assetId) {
        await db.collection('studio_assets').doc(jobData.assetId).update({
          jobStatus: payload.status,
          outputUrl: payload.outputUrl,
          updatedAt: Timestamp.now(),
        });
      }
    }
  }
}

/**
 * Webhook Endpoint — Runway
 */
export const runwayWebhook = onRequest(
  {
    region: 'us-central1',
    cors: true,
  },
  async (req, res) => {
    try {
      // Only accept POST requests
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
      }

      // Verify signature (optional, if Runway provides webhook signing)
      const signature = req.headers['x-runway-signature'] as string;
      const webhookSecret = process.env.RUNWAY_WEBHOOK_SECRET;

      if (webhookSecret && signature) {
        const rawBody = JSON.stringify(req.body);
        const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
        if (!isValid) {
          console.error('Invalid webhook signature');
          res.status(401).send('Unauthorized');
          return;
        }
      }

      const payload: WebhookPayload = req.body;

      console.log('Runway webhook received:', payload);

      // Validate required fields
      if (!payload.jobId || !payload.status) {
        res.status(400).send('Missing required fields: jobId, status');
        return;
      }

      // Update job status
      await updateJobStatus(payload);

      res.status(200).json({success: true, message: 'Job status updated'});
    } catch (error: any) {
      console.error('Runway webhook error:', error);
      res.status(500).json({error: error.message});
    }
  });

/**
 * Webhook Endpoint — Veo
 */
export const veoWebhook = onRequest(
  {
    region: 'us-central1',
    cors: true,
  },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
      }

      // Verify signature (if Veo provides webhook signing)
      const signature = req.headers['x-veo-signature'] as string;
      const webhookSecret = process.env.VEO_WEBHOOK_SECRET;

      if (webhookSecret && signature) {
        const rawBody = JSON.stringify(req.body);
        const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
        if (!isValid) {
          console.error('Invalid webhook signature');
          res.status(401).send('Unauthorized');
          return;
        }
      }

      const payload: WebhookPayload = req.body;

      console.log('Veo webhook received:', payload);

      if (!payload.jobId || !payload.status) {
        res.status(400).send('Missing required fields: jobId, status');
        return;
      }

      await updateJobStatus(payload);

      res.status(200).json({success: true, message: 'Job status updated'});
    } catch (error: any) {
      console.error('Veo webhook error:', error);
      res.status(500).json({error: error.message});
    }
  });

/**
 * Generic Webhook Endpoint
 *
 * Can be used for testing or for providers that don't require separate endpoints.
 */
export const studioWebhook = onRequest(
  {
    region: 'us-central1',
    cors: true,
  },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
      }

      const payload: WebhookPayload = req.body;

      console.log('Studio webhook received:', payload);

      if (!payload.jobId || !payload.status) {
        res.status(400).send('Missing required fields: jobId, status');
        return;
      }

      await updateJobStatus(payload);

      res.status(200).json({success: true, message: 'Job status updated'});
    } catch (error: any) {
      console.error('Studio webhook error:', error);
      res.status(500).json({error: error.message});
    }
  });

/**
 * Firestore Trigger — Send Notification on Job Completion
 *
 * Optional: Send push notification or email when a job is completed.
 */
export const onJobComplete = onDocumentUpdated(
  'studio_jobs/{jobId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Check if status changed to 'done' or 'failed'
    if (before.status !== after.status && (after.status === 'done' || after.status === 'failed')) {
      console.log(`Job ${event.params.jobId} completed with status: ${after.status}`);

      // TODO: Send notification to user
      // Example: Send push notification via FCM
      // Example: Send email via SendGrid
      // Example: Create in-app notification

      // For now, just log it
      console.log(`User ${after.userId} should be notified about job completion`);
    }
  });
