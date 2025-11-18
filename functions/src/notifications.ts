/**
 * Notifications System
 * Email + In-App notifications for compliance events
 */

import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

const db = admin.firestore();

export type NotificationType =
  | 'dsar_request'
  | 'dsar_approved'
  | 'dsar_denied'
  | 'data_export_ready'
  | 'account_deleted';

export type NotificationChannel = 'email' | 'inApp';

export interface NotificationParams {
  uid: string;
  type: NotificationType;
  channels: NotificationChannel[];
  meta?: Record<string, any>;
  email?: string;
}

/**
 * Create nodemailer transporter
 */
function createMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false, // Use STARTTLS
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

/**
 * Get email subject by notification type
 */
function getSubjectFromType(type: NotificationType): string {
  const subjects: Record<NotificationType, string> = {
    dsar_request: 'We received your data request',
    dsar_approved: 'Your request was approved',
    dsar_denied: 'Your request was denied',
    data_export_ready: 'Your data export is ready',
    account_deleted: 'Your account has been deleted',
  };
  return subjects[type];
}

/**
 * Render email template
 */
function renderTemplate(type: NotificationType, data: Record<string, any>): string {
  const templatePath = path.join(__dirname, '..', 'templates', `${type}.hbs`);

  if (!fs.existsSync(templatePath)) {
    console.warn(`Template not found: ${templatePath}, using fallback`);
    return `<html><body><h1>${getSubjectFromType(type)}</h1><pre>${JSON.stringify(
      data,
      null,
      2
    )}</pre></body></html>`;
  }

  const templateSource = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateSource);
  return template(data);
}

/**
 * Send in-app notification
 */
async function sendInAppNotification(
  uid: string,
  type: NotificationType,
  meta: Record<string, any>
): Promise<void> {
  try {
    await db
      .collection('notifications')
      .doc(uid)
      .collection('items')
      .add({
        type,
        meta,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });

    console.log(`✅ In-app notification sent to ${uid}: ${type}`);
  } catch (error: any) {
    console.error(`❌ Failed to send in-app notification to ${uid}:`, error.message);
    throw error;
  }
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  email: string,
  type: NotificationType,
  meta: Record<string, any>
): Promise<void> {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️  SMTP not configured, skipping email notification');
      return;
    }

    const html = renderTemplate(type, meta);
    const subject = getSubjectFromType(type);

    const transporter = createMailer();

    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || 'F0 Compliance'}" <${
        process.env.MAIL_FROM_EMAIL || 'noreply@example.com'
      }>`,
      to: email,
      subject,
      html,
    });

    console.log(`✅ Email sent to ${email}: ${type}`);
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${email}:`, error.message);
    // Don't throw - email failures shouldn't break the flow
  }
}

/**
 * Send notification via specified channels
 */
export async function sendNotification(params: NotificationParams): Promise<void> {
  const { uid, type, channels, meta = {}, email } = params;

  console.log(`📬 Sending notification to ${uid}: ${type} via [${channels.join(', ')}]`);

  const promises: Promise<void>[] = [];

  // In-app notification
  if (channels.includes('inApp')) {
    promises.push(sendInAppNotification(uid, type, meta));
  }

  // Email notification
  if (channels.includes('email') && email) {
    promises.push(sendEmailNotification(email, type, meta));
  }

  await Promise.allSettled(promises);
}

/**
 * Get user's email for notifications
 */
export async function getUserEmail(uid: string): Promise<string | null> {
  try {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord.email || null;
  } catch (error: any) {
    console.error(`Failed to get email for user ${uid}:`, error.message);
    return null;
  }
}

/**
 * Helper: Send DSAR request notification
 */
export async function notifyDsarRequest(params: {
  uid: string;
  requestId: string;
  type: 'export' | 'deletion';
  status: string;
  autoApproved?: boolean;
}): Promise<void> {
  const email = await getUserEmail(params.uid);

  await sendNotification({
    uid: params.uid,
    type: 'dsar_request',
    channels: ['email', 'inApp'],
    email: email || undefined,
    meta: {
      requestId: params.requestId,
      type: params.type,
      status: params.status,
      autoApproved: params.autoApproved || false,
      isExport: params.type === 'export',
      isDeletion: params.type === 'deletion',
      submittedAt: new Date().toISOString(),
    },
  });
}

/**
 * Helper: Send DSAR approved notification
 */
export async function notifyDsarApproved(params: {
  uid: string;
  requestId: string;
  type: 'export' | 'deletion';
  approvedBy?: string;
  deletionDate?: Date;
  gracePeriodDays?: number;
}): Promise<void> {
  const email = await getUserEmail(params.uid);

  await sendNotification({
    uid: params.uid,
    type: 'dsar_approved',
    channels: ['email', 'inApp'],
    email: email || undefined,
    meta: {
      requestId: params.requestId,
      type: params.type,
      approvedAt: new Date().toISOString(),
      approvedBy: params.approvedBy,
      isExport: params.type === 'export',
      isDeletion: params.type === 'deletion',
      deletionDate: params.deletionDate?.toISOString(),
      gracePeriodDays: params.gracePeriodDays || 30,
    },
  });
}

/**
 * Helper: Send data export ready notification
 */
export async function notifyDataExportReady(params: {
  uid: string;
  requestId: string;
  downloadUrl: string;
  sizeBytes: number;
  expiresAt: Date;
}): Promise<void> {
  const email = await getUserEmail(params.uid);

  await sendNotification({
    uid: params.uid,
    type: 'data_export_ready',
    channels: ['email', 'inApp'],
    email: email || undefined,
    meta: {
      requestId: params.requestId,
      downloadUrl: params.downloadUrl,
      sizeKB: Math.round(params.sizeBytes / 1024),
      generatedAt: new Date().toISOString(),
      expiresAt: params.expiresAt.toISOString(),
    },
  });
}

/**
 * Helper: Send account deleted notification
 */
export async function notifyAccountDeleted(params: {
  uid: string;
  requestId: string;
  email?: string;
}): Promise<void> {
  // For deleted accounts, we need the email passed explicitly
  if (!params.email) {
    console.warn(`Cannot send deletion notification for ${params.uid}: no email provided`);
    return;
  }

  await sendNotification({
    uid: params.uid,
    type: 'account_deleted',
    channels: ['email'], // Only email (user is deleted)
    email: params.email,
    meta: {
      requestId: params.requestId,
      uid: params.uid,
      deletedAt: new Date().toISOString(),
    },
  });
}
