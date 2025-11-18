/**
 * Phase 49: Alert Notifications
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

const db = admin.firestore();

export const processAlerts = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    const alertsSnap = await db.collection('_alerts_queue')
      .where('processed', '==', false)
      .limit(20)
      .get();

    if (alertsSnap.empty) {
      console.log('No alerts to process');
      return;
    }

    const config = functions.config();
    const telegramBotToken = config?.alerts?.telegram_bot_token;
    const telegramChatId = config?.alerts?.telegram_chat_id;

    for (const alertDoc of alertsSnap.docs) {
      const alert = alertDoc.data();
      const { incidentId, severity, message } = alert;

      try {
        if (telegramBotToken && telegramChatId) {
          const emoji = severity === 'critical' ? '🚨' : '⚠️';
          const telegramMessage = emoji + ' **Incident Alert**\n\n' + message + '\n\nIncident ID: `' + incidentId + '`';

          await sendTelegramMessage(telegramBotToken, telegramChatId, telegramMessage);
        }

        await alertDoc.ref.update({ processed: true, processedAt: Date.now() });
        console.log('Alert processed: ' + alertDoc.id);
      } catch (error) {
        console.error('Error processing alert ' + alertDoc.id + ':', error);
      }
    }
  });

async function sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<void> {
  const url = 'https://api.telegram.org/bot' + botToken + '/sendMessage';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    }),
  });

  if (!response.ok) {
    throw new Error('Telegram API error: ' + response.status + ' ' + response.statusText);
  }
}
