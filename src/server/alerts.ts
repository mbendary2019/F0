/**
 * Alert Management System
 * Create, send, and manage system alerts via Firestore, Slack, and Email
 */

import { db } from './firebase-admin';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertKind =
  | 'error_rate'
  | 'auth_fail'
  | 'quota_breach'
  | 'function_error'
  | 'account_deletion_scheduled'
  | 'account_deletion_completed'
  | 'custom';
export type AlertStatus = 'open' | 'ack' | 'closed';

export interface Alert {
  severity: AlertSeverity;
  kind: AlertKind;
  message: string;
  context?: Record<string, any>;
  status?: AlertStatus;
  createdAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  closedAt?: Date;
}

/**
 * Create an alert in Firestore
 */
export async function createAlert(alert: Alert): Promise<string> {
  try {
    const payload = {
      severity: alert.severity,
      kind: alert.kind,
      message: alert.message,
      context: alert.context || {},
      status: alert.status || 'open',
      createdAt: alert.createdAt || new Date(),
    };

    const ref = await db.collection('alerts').add(payload);
    console.log(`[Alert Created] ${alert.severity} - ${alert.kind}: ${alert.message}`);
    return ref.id;
  } catch (error) {
    console.error('[createAlert] Failed to create alert:', error);
    throw error;
  }
}

/**
 * Post message to Slack webhook
 */
export async function postSlack(text: string): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[postSlack] SLACK_WEBHOOK_URL not configured');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('[postSlack] Failed to send Slack message:', error);
    return false;
  }
}

/**
 * Send alert notification to Slack
 */
export async function alertSlack(alert: Alert): Promise<boolean> {
  const emoji =
    alert.severity === 'critical'
      ? '🧯'
      : alert.severity === 'warning'
        ? '🚨'
        : 'ℹ️';

  const contextStr = alert.context
    ? `\n\nContext: \`\`\`${JSON.stringify(alert.context, null, 2)}\`\`\``
    : '';

  const message = `${emoji} *[${alert.kind.toUpperCase()}]* ${alert.message}${contextStr}`;

  return await postSlack(message);
}

/**
 * Send alert notification via email (SendGrid)
 */
export async function alertEmail(alert: Alert): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const toEmail = process.env.ALERT_EMAIL_TO;

  if (!apiKey || !toEmail) {
    console.warn('[alertEmail] SendGrid not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: toEmail }],
            subject: `[${alert.severity.toUpperCase()}] ${alert.kind}: ${alert.message}`,
          },
        ],
        from: { email: 'alerts@yourdomain.com', name: 'System Alerts' },
        content: [
          {
            type: 'text/plain',
            value: `Severity: ${alert.severity}\nKind: ${alert.kind}\nMessage: ${alert.message}\n\nContext: ${JSON.stringify(alert.context || {}, null, 2)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`SendGrid API failed: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('[alertEmail] Failed to send email:', error);
    return false;
  }
}

/**
 * Create alert and send notifications (all-in-one)
 */
export async function alert(
  alertData: Alert,
  opts?: { slack?: boolean; email?: boolean }
): Promise<string> {
  const options = {
    slack: opts?.slack !== false, // Default: true
    email: opts?.email !== false, // Default: true
  };

  // Create alert in Firestore
  const alertId = await createAlert(alertData);

  // Send notifications
  if (options.slack) {
    await alertSlack(alertData);
  }

  if (options.email && alertData.severity === 'critical') {
    // Only send emails for critical alerts to avoid spam
    await alertEmail(alertData);
  }

  return alertId;
}

/**
 * Acknowledge an alert (update status)
 */
export async function acknowledgeAlert(
  alertId: string,
  acknowledgedBy: string
): Promise<void> {
  try {
    await db.doc(`alerts/${alertId}`).update({
      status: 'ack',
      acknowledgedBy,
      acknowledgedAt: new Date(),
    });
    console.log(`[Alert Acknowledged] ${alertId} by ${acknowledgedBy}`);
  } catch (error) {
    console.error('[acknowledgeAlert] Failed:', error);
    throw error;
  }
}

/**
 * Close an alert
 */
export async function closeAlert(alertId: string): Promise<void> {
  try {
    await db.doc(`alerts/${alertId}`).update({
      status: 'closed',
      closedAt: new Date(),
    });
    console.log(`[Alert Closed] ${alertId}`);
  } catch (error) {
    console.error('[closeAlert] Failed:', error);
    throw error;
  }
}

/**
 * Get recent alerts
 */
export async function getRecentAlerts(
  limit: number = 100
): Promise<Array<Alert & { id: string }>> {
  try {
    const snapshot = await db
      .collection('alerts')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const alerts: Array<Alert & { id: string }> = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      alerts.push({
        id: doc.id,
        severity: data.severity,
        kind: data.kind,
        message: data.message,
        context: data.context,
        status: data.status,
        createdAt: data.createdAt?.toDate(),
        acknowledgedBy: data.acknowledgedBy,
        acknowledgedAt: data.acknowledgedAt?.toDate(),
        closedAt: data.closedAt?.toDate(),
      });
    });

    return alerts;
  } catch (error) {
    console.error('[getRecentAlerts] Failed:', error);
    return [];
  }
}
