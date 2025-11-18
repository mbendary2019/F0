import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

/** Rollup daily usage to monthly (every 3 hours) */
export const rollupDailyToMonthly = onSchedule('every 3 hours', async () => {
  console.log('🔄 Starting daily → monthly rollup');

  const users = await db.collection('users').limit(1000).get();
  let processed = 0;

  for (const u of users.docs) {
    const uid = u.id;
    const mk = monthKey();

    try {
      // Get all daily docs for current month
      const dcol = db.collection(`usage_logs/${uid}/daily`);
      const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 31);

      const dailyDocs = await dcol
        .where('lastUpdated', '>=', thirtyDaysAgo)
        .get();

      if (dailyDocs.empty) continue;

      let total = 0;
      const byEndpoint: Record<string, number> = {};
      let cost = 0;

      dailyDocs.forEach(d => {
        const data = d.data();
        total += data.total || 0;
        cost += data.cost || 0;

        // Aggregate endpoint counters
        Object.keys(data).forEach(k => {
          if (
            k.includes('_/v1') ||
            k.includes('/api/') ||
            k.startsWith('GET_') ||
            k.startsWith('POST_')
          ) {
            byEndpoint[k] = (byEndpoint[k] || 0) + (data[k] || 0);
          }
        });
      });

      // Update monthly doc
      await db.doc(`usage_logs/${uid}/monthly/${mk}`).set(
        {
          total,
          byEndpoint,
          cost,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      processed++;
    } catch (error) {
      console.error(`❌ Error processing user ${uid}:`, error);
    }
  }

  console.log(`✅ Rollup complete: processed ${processed} users`);
});
