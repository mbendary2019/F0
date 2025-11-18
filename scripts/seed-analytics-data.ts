/**
 * Seed Analytics Test Data Script
 * Seeds ops_metrics_daily collection with test data for analytics dashboard
 *
 * Usage:
 * FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm tsx scripts/seed-analytics-data.ts
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('✅ Using Firestore Emulator:', process.env.FIRESTORE_EMULATOR_HOST);
}

const app = initializeApp({ projectId: 'from-zero-84253' });
const db = getFirestore(app);

/**
 * Generate date string N days ago (UTC)
 */
function daysAgoUTC(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
}

/**
 * Generate random metrics for a day
 */
function generateDayMetrics(daysAgo: number) {
  const baseTotal = 1000 + Math.floor(Math.random() * 500);
  const errorRate = 0.02 + Math.random() * 0.03; // 2-5%
  const errors = Math.floor(baseTotal * errorRate);
  const warns = Math.floor(baseTotal * 0.1); // ~10%
  const infos = baseTotal - errors - warns;

  return {
    date: daysAgoUTC(daysAgo),
    total: baseTotal,
    info: infos,
    warn: warns,
    error: errors,
    avgLatency: Math.floor(150 + Math.random() * 100), // 150-250ms
    p50Latency: Math.floor(100 + Math.random() * 50), // 100-150ms
    p95Latency: Math.floor(300 + Math.random() * 200), // 300-500ms
    byType: {
      'agent.run': Math.floor(baseTotal * 0.4),
      'deploy.success': Math.floor(baseTotal * 0.3),
      'webhook.delivery': Math.floor(baseTotal * 0.2),
      'auth.login': Math.floor(baseTotal * 0.1),
    },
    byStrategy: {
      'default': Math.floor(baseTotal * 0.6),
      'optimized': Math.floor(baseTotal * 0.4),
    },
    updatedAt: Timestamp.now().toMillis(),
  };
}

async function seedAnalyticsData() {
  console.log('🌱 Starting analytics data seed...\n');

  const batch = db.batch();
  const days = 30; // Seed 30 days of data

  for (let i = 0; i < days; i++) {
    const dateStr = daysAgoUTC(i);
    const docRef = db.collection('ops_metrics_daily').doc(dateStr);
    const metrics = generateDayMetrics(i);

    batch.set(docRef, metrics);
    console.log(`📊 Day ${i + 1}/${days}: ${dateStr} - ${metrics.total} events (${metrics.error} errors)`);
  }

  await batch.commit();
  console.log(`\n✅ Successfully seeded ${days} days of analytics data!`);
  console.log('\n📈 Collection: ops_metrics_daily');
  console.log('🔗 View in Emulator UI: http://localhost:4000/firestore');
}

// Run the seed script
seedAnalyticsData()
  .then(() => {
    console.log('\n✨ Seed completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  });
