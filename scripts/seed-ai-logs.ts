// scripts/seed-ai-logs.ts
// Seed test AI logs for testing the dashboard

import * as admin from 'firebase-admin';
import * as serviceAccount from '../.secrets/firebase.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

const sampleLogs = [
  {
    ownerUid: 'test-user-1', // Replace with your test user ID
    projectId: 'QNnGNj3QRLlaVwg9y8Lz',
    projectName: 'F0 Platform',
    type: 'Plan',
    description: 'Generated plan: Implement user authentication with Firebase Auth',
    status: 'Success',
    createdAt: Date.now() - 7200000, // 2 hours ago
  },
  {
    ownerUid: 'test-user-1',
    projectId: 'QNnGNj3QRLlaVwg9y8Lz',
    projectName: 'F0 Platform',
    type: 'Patch',
    description: 'Applied 3 patch(es): src/components/Auth.tsx, src/lib/auth.ts, src/app/login/page.tsx',
    status: 'Applied',
    createdAt: Date.now() - 5400000, // 1.5 hours ago
  },
  {
    ownerUid: 'test-user-1',
    projectId: 'QNnGNj3QRLlaVwg9y8Lz',
    projectName: 'F0 Platform',
    type: 'Analysis',
    description: 'Analyzed: Project structure for optimal database schema design',
    status: 'Success',
    createdAt: Date.now() - 3600000, // 1 hour ago
  },
  {
    ownerUid: 'test-user-1',
    projectId: 'abc123',
    projectName: 'E-commerce Store',
    type: 'Plan',
    description: 'Generated plan: Add shopping cart functionality with Stripe integration',
    status: 'Success',
    createdAt: Date.now() - 1800000, // 30 mins ago
  },
  {
    ownerUid: 'test-user-1',
    projectId: 'abc123',
    projectName: 'E-commerce Store',
    type: 'Patch',
    description: 'Applied 5 patch(es): src/components/Cart.tsx, src/lib/stripe.ts, src/app/checkout/page.tsx',
    status: 'Applied',
    createdAt: Date.now() - 900000, // 15 mins ago
  },
  {
    ownerUid: 'test-user-1',
    projectId: 'QNnGNj3QRLlaVwg9y8Lz',
    projectName: 'F0 Platform',
    type: 'Chat',
    description: 'How do I implement dark mode with Tailwind CSS?',
    status: 'Info',
    createdAt: Date.now() - 300000, // 5 mins ago
  },
];

async function seedAiLogs() {
  console.log('🌱 Seeding AI logs...');

  try {
    const batch = db.batch();

    for (const log of sampleLogs) {
      const ref = db.collection('ops_aiLogs').doc();
      batch.set(ref, log);
    }

    await batch.commit();

    console.log(`✅ Successfully seeded ${sampleLogs.length} AI logs`);
    console.log('📊 You can now view them in the F0 Dashboard');
  } catch (error) {
    console.error('❌ Error seeding AI logs:', error);
    process.exit(1);
  }
}

seedAiLogs()
  .then(() => {
    console.log('✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
