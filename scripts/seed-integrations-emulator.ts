/**
 * Seed Integrations Data for Emulator
 *
 * This script adds sample integration data to the Firestore emulator
 * so that the integration cards show as "Connected" in the UI.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm tsx scripts/seed-integrations-emulator.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin with emulator
const app = initializeApp({
  projectId: 'from-zero-84253',
});

const db = getFirestore(app);

// Sample user ID (you can change this to match your test user)
const TEST_USER_ID = 'test-user-123';

async function seedIntegrations() {
  console.log('🌱 Starting integration data seed...');
  console.log(`📍 Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`👤 Test User ID: ${TEST_USER_ID}`);

  try {
    // Firebase integration
    console.log('\n📝 Adding Firebase integration...');
    await db
      .collection('vault')
      .doc('integrations')
      .collection(TEST_USER_ID)
      .doc('firebase')
      .set({
        provider: 'firebase',
        tokens: {
          accessToken: 'test-firebase-token',
          refreshToken: 'test-firebase-refresh-token',
          expiresAt: Date.now() + 3600000, // 1 hour from now
        },
        credentials: null,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
    console.log('✅ Firebase integration added');

    // Vercel integration
    console.log('\n📝 Adding Vercel integration...');
    await db
      .collection('vault')
      .doc('integrations')
      .collection(TEST_USER_ID)
      .doc('vercel')
      .set({
        provider: 'vercel',
        tokens: {
          accessToken: 'test-vercel-token',
        },
        credentials: null,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
    console.log('✅ Vercel integration added');

    // GitHub integration
    console.log('\n📝 Adding GitHub integration...');
    await db
      .collection('vault')
      .doc('integrations')
      .collection(TEST_USER_ID)
      .doc('github')
      .set({
        provider: 'github',
        tokens: {
          accessToken: 'test-github-token',
        },
        credentials: null,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
    console.log('✅ GitHub integration added');

    // GoDaddy integration (optional - uncomment if needed)
    /*
    console.log('\n📝 Adding GoDaddy integration...');
    await db
      .collection('vault')
      .doc('integrations')
      .collection(TEST_USER_ID)
      .doc('godaddy')
      .set({
        provider: 'godaddy',
        tokens: null,
        credentials: {
          apiKey: 'test-godaddy-api-key',
          apiSecret: 'test-godaddy-api-secret',
        },
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
    console.log('✅ GoDaddy integration added');
    */

    console.log('\n✅ All integrations seeded successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Make sure you are logged in with user ID:', TEST_USER_ID);
    console.log('2. Navigate to /settings/integrations');
    console.log('3. You should see Firebase, Vercel, and GitHub as "Connected"');
    console.log('\n💡 Tip: If you want to use a different user ID, edit this script and change TEST_USER_ID');
  } catch (error) {
    console.error('❌ Error seeding integrations:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the seed function
seedIntegrations();
