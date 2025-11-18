/**
 * AI Governance - Alert Scheduled Function
 * Monitors flagged rate and sends alerts when threshold is exceeded
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

/**
 * Scheduled alert job (runs every 60 minutes)
 * Checks flagged rate in the last 24 hours and sends alert if above threshold
 */
export const aiGovFlagRateAlert = onSchedule('every 60 minutes', async () => {
  const db = admin.firestore();

  console.log('🔔 Checking AI Governance flag rate...');

  try {
    // Get evaluations from last 24 hours
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const snaps = await db
      .collectionGroup('runs')
      .where('meta.ts', '>=', since)
      .get();

    const total = snaps.size || 1; // Avoid division by zero
    const flagged = snaps.docs.filter((d) => !!d.data().flagged).length;
    const ratePct = (flagged / total) * 100;

    console.log(
      `📊 Last 24h: ${total} evals, ${flagged} flagged (${ratePct.toFixed(1)}%)`
    );

    // Get alert threshold from config
    const cfgRef = db.collection('config').doc('ai_governance');
    const cfg = (await cfgRef.get()).data() || {};
    const limitPct = cfg.alertFlagRatePct ?? 10;

    console.log(`🎯 Alert threshold: ${limitPct}%`);

    // Check if threshold exceeded
    if (ratePct >= limitPct) {
      console.warn(
        `⚠️  Flag rate ${ratePct.toFixed(1)}% exceeds threshold ${limitPct}%`
      );

      // Send alert
      await sendAlert({
        ratePct,
        limitPct,
        total,
        flagged,
      });

      // Log alert to audit trail
      await db.collection('audit_logs').add({
        ts: admin.firestore.FieldValue.serverTimestamp(),
        actor: 'system',
        action: 'ai_gov.alert.flag_rate',
        resource: 'ai_evals',
        status: 'warning',
        metadata: {
          flagRate: ratePct,
          threshold: limitPct,
          total,
          flagged,
          period: '24h',
        },
      });
    } else {
      console.log('✅ Flag rate within acceptable range');
    }
  } catch (error) {
    console.error('❌ Error checking flag rate:', error);

    // Log error to audit trail
    await db
      .collection('audit_logs')
      .add({
        ts: admin.firestore.FieldValue.serverTimestamp(),
        actor: 'system',
        action: 'ai_gov.alert.flag_rate',
        resource: 'ai_evals',
        status: 'error',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
      .catch(() => {}); // Ignore logging errors
  }
});

/**
 * Send alert via Slack or Discord webhook
 */
async function sendAlert(data: {
  ratePct: number;
  limitPct: number;
  total: number;
  flagged: number;
}) {
  const { ratePct, limitPct, total, flagged } = data;

  // Get webhook URL from environment variables
  const slackUrl = process.env.ALERTS_SLACK_WEBHOOK;
  const discordUrl = process.env.ALERTS_DISCORD_WEBHOOK;

  const url = slackUrl || discordUrl;

  if (!url) {
    console.warn('⚠️  No webhook URL configured, skipping alert notification');
    return;
  }

  const message = `🚨 **AI Governance Alert**

Flagged rate has exceeded the threshold in the last 24 hours.

• **Flagged Rate:** ${ratePct.toFixed(1)}%
• **Threshold:** ${limitPct}%
• **Total Evaluations:** ${total}
• **Flagged Outputs:** ${flagged}

Please review the AI Governance dashboard for details.`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        // Slack-specific formatting
        ...(slackUrl && {
          attachments: [
            {
              color: 'danger',
              fields: [
                {
                  title: 'Flagged Rate',
                  value: `${ratePct.toFixed(1)}%`,
                  short: true,
                },
                {
                  title: 'Threshold',
                  value: `${limitPct}%`,
                  short: true,
                },
                {
                  title: 'Total Evaluations',
                  value: total.toString(),
                  short: true,
                },
                {
                  title: 'Flagged Outputs',
                  value: flagged.toString(),
                  short: true,
                },
              ],
            },
          ],
        }),
        // Discord-specific formatting
        ...(discordUrl && {
          embeds: [
            {
              title: '🚨 AI Governance Alert',
              description: message,
              color: 15158332, // Red
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      }),
    });

    if (response.ok) {
      console.log('✅ Alert sent successfully');
    } else {
      console.error(
        `❌ Failed to send alert: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.error('❌ Error sending alert:', error);
  }
}
