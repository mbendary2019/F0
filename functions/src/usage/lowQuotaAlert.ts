import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();

export const lowQuotaAlert = onSchedule(
  {
    schedule: '*/30 7-23 * * *',
    timeZone: 'Asia/Kuwait',
    retryCount: 2,
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const threshold = Number(process.env.LOW_QUOTA_THRESHOLD || 0.9); // 90%
    const today = new Date().toISOString().slice(0, 10);

    logger.info('[usage] Starting low quota check', { date: today, threshold });

    const q = await db
      .collection('ops_usage_daily')
      .where('date', '==', today)
      .get();

    let alertCount = 0;
    for (const doc of q.docs) {
      const u = doc.data();
      const up = await db.collection('ops_user_plans').doc(u.uid).get();
      const dq = up.data()?.dailyQuota || 0;

      if (!dq) continue;

      if ((u.tokens || 0) >= dq * threshold) {
        logger.info('[usage] low-quota', {
          uid: u.uid,
          used: u.tokens,
          quota: dq,
          percentage: Math.round(((u.tokens || 0) / dq) * 100),
        });
        alertCount++;
        // TODO: Integrate with email/FCM/Slack later (Phase 49)
      }
    }

    logger.info('[usage] Low quota check complete', {
      totalUsers: q.size,
      alertsTriggered: alertCount,
    });
  }
);
