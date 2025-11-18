/**
 * Notify Admin Events Cloud Function
 * Triggered on new admin_audit documents
 * Sends alerts to Slack for sensitive actions
 */

import * as functions from 'firebase-functions';

// Import IncomingWebhook from @slack/webhook if installed
// For now, use native fetch
type SlackMessage = {
  text: string;
  blocks?: any[];
};

/**
 * Sends Slack notification for sensitive admin actions
 * Triggered when new document is created in admin_audit collection
 */
export const notifyAdminEvents = functions.firestore
  .document('admin_audit/{auditId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() as {
      action: string;
      actorUid: string;
      targetUid?: string;
      ip?: string;
      ua?: string;
      ts: number;
      meta?: Record<string, unknown>;
    };

    // Only notify on sensitive actions
    const sensitiveActions = ['grant', 'revoke', 'delete', 'suspend'];
    if (!sensitiveActions.includes(data.action)) {
      console.log(`[notifyAdminEvents] Skipping non-sensitive action: ${data.action}`);
      return null;
    }

    // Get Slack webhook URL from environment
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      console.log('[notifyAdminEvents] SLACK_WEBHOOK_URL not configured, skipping notification');
      return null;
    }

    try {
      // Format timestamp
      const timestamp = new Date(data.ts).toISOString();
      
      // Build Slack message
      const message: SlackMessage = {
        text: `🚨 Admin Event: ${data.action}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🚨 Admin Event: ${data.action.toUpperCase()}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Action:*\n${data.action}`,
              },
              {
                type: 'mrkdwn',
                text: `*Actor:*\n\`${data.actorUid}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Target:*\n\`${data.targetUid || '—'}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Time:*\n${timestamp}`,
              },
              {
                type: 'mrkdwn',
                text: `*IP Address:*\n\`${data.ip || '—'}\``,
              },
              {
                type: 'mrkdwn',
                text: `*User Agent:*\n${data.ua?.slice(0, 50) || '—'}`,
              },
            ],
          },
        ],
      };

      // Add metadata if present
      if (data.meta && Object.keys(data.meta).length > 0) {
        message.blocks!.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Metadata:*\n\`\`\`${JSON.stringify(data.meta, null, 2)}\`\`\``,
          },
        });
      }

      // Send to Slack
      const response = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Slack API returned ${response.status}`);
      }

      console.log(`[notifyAdminEvents] Notification sent for ${data.action} by ${data.actorUid}`);
      return null;
    } catch (error) {
      console.error('[notifyAdminEvents] Error sending notification:', error);
      // Don't throw - we don't want to fail the audit log creation
      return null;
    }
  });

